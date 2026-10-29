<script setup lang="ts">
/**
 * 登录页。
 *
 * 覆盖参考库中的全部登录方式：
 *   - 酷狗 App 扫码：0 过期 / 1 等待 / 2 待确认 / 4 成功
 *   - 手机号 + 短信验证码：只有用户点击按钮才会发送短信，60 秒倒计时
 *   - 用户名 + 密码：可能触发安全验证，密码不会写入本地存储
 *   - 微信扫码：408 等待 / 404 已扫码 / 403 拒绝 / 405 成功 / 402 过期
 *   - QQ 扫码：wait / scanned / expired / success，也支持 openid + access_token 直登
 *
 * 所有方式登录成功后都调用 `user.completeLogin()` 统一刷新 auth、资料和歌单。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Component } from 'vue';
import { useRouter } from 'vue-router';
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  ListMusic,
  Loader2,
  LogOut,
  MessageCircle,
  Music4,
  Phone,
  QrCode,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import LoginQrPanel from '@/components/LoginQrPanel.vue';
import {
  checkQqLoginQr,
  checkWxLoginQr,
  createQqLoginQr,
  createWxLoginQr,
  loginByPassword,
  loginByQq,
  loginBySms,
  loginByWxCode,
  normalizeMobile,
  refreshLogin,
  sendSmsCode,
  toErrorMessage,
  type LoginMethod,
  type QqQrSession,
  type QqQrState,
  type WxQrSession,
} from '@/api';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const user = useUserStore();
const toast = useToastStore();

const methods: { id: LoginMethod; label: string }[] = [
  { id: 'qr', label: '扫码' },
  { id: 'phone', label: '手机' },
  { id: 'password', label: '密码' },
  { id: 'wechat', label: '微信' },
  { id: 'qq', label: 'QQ' },
];

const methodIcons: Record<LoginMethod, Component> = {
  qr: QrCode,
  phone: Smartphone,
  password: KeyRound,
  wechat: MessageCircle,
  qq: Send,
};

const method = ref<LoginMethod>('qr');

/** 手机号 / 密码表单共用的错误提示 */
const formError = ref('');

// ---------------------------------------------------------------------------
// 酷狗扫码
// ---------------------------------------------------------------------------

const qrOverlay = computed<'scanned' | 'expired' | null>(() => {
  if (user.qrStatus === 2) return 'scanned';
  if (user.qrStatus === 0) return 'expired';
  return null;
});

function refreshQr(): void {
  if (user.qrLoading) return;
  void user.refreshQr();
}

// ---------------------------------------------------------------------------
// 手机号 + 短信验证码
// ---------------------------------------------------------------------------

const phone = ref('');
const smsCode = ref('');
const smsUserid = ref('');
const smsSending = ref(false);
const smsPending = ref(false);
const smsCountdown = ref(0);
let countdownTimer: number | null = null;

const phoneValid = computed(() => Boolean(normalizeMobile(phone.value)));
const canSendCode = computed(
  () => phoneValid.value && !smsSending.value && smsCountdown.value === 0,
);

function stopCountdown(): void {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startCountdown(): void {
  stopCountdown();
  smsCountdown.value = 60;
  countdownTimer = window.setInterval(() => {
    smsCountdown.value -= 1;
    if (smsCountdown.value <= 0) {
      smsCountdown.value = 0;
      stopCountdown();
    }
  }, 1000);
}

/** 发送验证码：严格校验手机号，且只在用户主动点击时调用 */
async function sendCode(): Promise<void> {
  if (!canSendCode.value) return;
  formError.value = '';
  smsSending.value = true;
  try {
    const message = await sendSmsCode(phone.value);
    toast.success(message);
    startCountdown();
  } catch (error) {
    formError.value = toErrorMessage(error);
  } finally {
    smsSending.value = false;
  }
}

async function submitPhone(): Promise<void> {
  if (smsPending.value) return;
  formError.value = '';
  smsPending.value = true;
  try {
    await loginBySms(phone.value, smsCode.value, smsUserid.value.trim() || undefined);
    smsCode.value = '';
    await user.completeLogin();
  } catch (error) {
    formError.value = toErrorMessage(error);
  } finally {
    smsPending.value = false;
  }
}

// ---------------------------------------------------------------------------
// 用户名 + 密码
// ---------------------------------------------------------------------------

const username = ref('');
const password = ref('');
const passwordCode = ref('');
const passwordVisible = ref(false);
const passwordPending = ref(false);

async function submitPassword(): Promise<void> {
  if (passwordPending.value) return;
  formError.value = '';
  passwordPending.value = true;
  try {
    await loginByPassword(username.value, password.value, passwordCode.value);
    password.value = '';
    passwordCode.value = '';
    await user.completeLogin();
  } catch (error) {
    formError.value = toErrorMessage(error);
  } finally {
    passwordPending.value = false;
  }
}

// ---------------------------------------------------------------------------
// 微信扫码
// ---------------------------------------------------------------------------

const wxSession = ref<WxQrSession | null>(null);
const wxLoading = ref(false);
const wxStatus = ref(-1);
const wxMessage = ref('');
const wxError = ref('');
let wxTimer: number | null = null;
let wxPollToken = 0;
let wxFailures = 0;

const wxOverlay = computed<'scanned' | 'expired' | null>(() => {
  if (wxStatus.value === 404) return 'scanned';
  if (wxStatus.value === 402 || wxStatus.value === 403) return 'expired';
  return null;
});

const wxOverlayTitle = computed(() => {
  if (wxOverlay.value === 'scanned') return '已扫码';
  if (wxStatus.value === 403) return '已拒绝登录';
  return '二维码已过期';
});

const wxOverlayDesc = computed(() =>
  wxOverlay.value === 'scanned' ? '请在微信中确认登录' : '请刷新二维码后重试',
);

function clearWxTimer(): void {
  if (wxTimer !== null) {
    window.clearTimeout(wxTimer);
    wxTimer = null;
  }
}

/** 取消微信轮询（切换 Tab / 离开页面 / 重新生成时调用） */
function cancelWxLogin(): void {
  wxPollToken += 1;
  clearWxTimer();
}

function scheduleWxPoll(token: number, delay = 1500): void {
  if (token !== wxPollToken) return;
  clearWxTimer();
  wxTimer = window.setTimeout(() => void pollWx(token), delay);
}

async function startWxLogin(): Promise<void> {
  cancelWxLogin();
  const token = wxPollToken;
  wxLoading.value = true;
  wxSession.value = null;
  wxStatus.value = -1;
  wxMessage.value = '';
  wxError.value = '';
  wxFailures = 0;

  try {
    const session = await createWxLoginQr();
    if (token !== wxPollToken) return;
    wxSession.value = session;
    wxStatus.value = 0;
    wxMessage.value = '请使用微信扫码';
    scheduleWxPoll(token, 1500);
  } catch (error) {
    if (token !== wxPollToken) return;
    wxError.value = toErrorMessage(error);
    wxMessage.value = wxError.value;
  } finally {
    if (token === wxPollToken) wxLoading.value = false;
  }
}

async function pollWx(token: number): Promise<void> {
  if (token !== wxPollToken || method.value !== 'wechat' || user.loggedIn) return;
  const session = wxSession.value;
  if (!session) return;

  try {
    const result = await checkWxLoginQr(session.uuid);
    if (token !== wxPollToken) return;
    wxFailures = 0;
    wxStatus.value = result.status;
    wxMessage.value = result.message;
    wxError.value = '';

    if (result.status === 405) {
      // 微信授权成功：停止轮询，用 wx_code 换取酷狗登录态
      clearWxTimer();
      if (!result.wxCode) {
        wxError.value = '微信未返回授权码，请刷新二维码重试';
        wxMessage.value = wxError.value;
        return;
      }
      wxLoading.value = true;
      wxMessage.value = '正在完成登录…';
      try {
        await loginByWxCode(result.wxCode);
        await user.completeLogin();
      } catch (error) {
        wxError.value = toErrorMessage(error);
        wxMessage.value = wxError.value;
      } finally {
        wxLoading.value = false;
      }
      return;
    }

    if (result.status === 402 || result.status === 403) {
      clearWxTimer();
      return;
    }

    scheduleWxPoll(token, result.status === 404 ? 2000 : 1500);
  } catch (error) {
    if (token !== wxPollToken) return;
    wxFailures += 1;
    wxError.value = toErrorMessage(error);
    if (wxFailures >= 5) {
      wxMessage.value = '微信登录连接失败，请刷新二维码重试';
      clearWxTimer();
      return;
    }
    wxMessage.value = '网络波动，正在重试…';
    scheduleWxPoll(token, 3000);
  }
}

// ---------------------------------------------------------------------------
// QQ 扫码 / QQ 授权参数
// ---------------------------------------------------------------------------

const qqSession = ref<QqQrSession | null>(null);
const qqLoading = ref(false);
const qqState = ref<QqQrState | 'idle'>('idle');
const qqMessage = ref('');
const qqError = ref('');
const qqDirectError = ref('');
const qqOpenid = ref('');
const qqAccessToken = ref('');
const qqDirectPending = ref(false);
let qqTimer: number | null = null;
let qqPollToken = 0;
let qqFailures = 0;

const qqOverlay = computed<'scanned' | 'expired' | null>(() => {
  if (qqState.value === 'scanned') return 'scanned';
  if (qqState.value === 'expired') return 'expired';
  return null;
});

const qqOverlayTitle = computed(() =>
  qqOverlay.value === 'expired' ? '二维码已失效' : '已扫码',
);

const qqOverlayDesc = computed(() =>
  qqOverlay.value === 'expired' ? '请刷新二维码后重新扫码' : '请在手机 QQ 中确认登录',
);

function clearQqTimer(): void {
  if (qqTimer !== null) {
    window.clearTimeout(qqTimer);
    qqTimer = null;
  }
}

function cancelQqLogin(): void {
  qqPollToken += 1;
  clearQqTimer();
}

function scheduleQqPoll(token: number, delay = 1800): void {
  if (token !== qqPollToken) return;
  clearQqTimer();
  qqTimer = window.setTimeout(() => void pollQq(token), delay);
}

async function startQqLogin(): Promise<void> {
  cancelQqLogin();
  const token = qqPollToken;
  qqLoading.value = true;
  qqSession.value = null;
  qqState.value = 'idle';
  qqMessage.value = '';
  qqError.value = '';
  qqFailures = 0;

  try {
    const session = await createQqLoginQr();
    if (token !== qqPollToken) return;
    qqSession.value = session;
    qqState.value = 'wait';
    qqMessage.value = '请使用手机 QQ 扫码';
    scheduleQqPoll(token, 1800);
  } catch (error) {
    if (token !== qqPollToken) return;
    qqError.value = toErrorMessage(error);
    qqMessage.value = qqError.value;
  } finally {
    if (token === qqPollToken) qqLoading.value = false;
  }
}

async function pollQq(token: number): Promise<void> {
  if (token !== qqPollToken || method.value !== 'qq' || user.loggedIn) return;
  const session = qqSession.value;
  if (!session) return;

  try {
    const result = await checkQqLoginQr(session);
    if (token !== qqPollToken) return;
    qqFailures = 0;
    qqState.value = result.status;
    qqMessage.value = result.message;
    qqError.value = '';

    if (result.status === 'success') {
      clearQqTimer();
      qqLoading.value = true;
      qqMessage.value = '正在完成登录…';
      try {
        await user.completeLogin();
      } catch (error) {
        qqError.value = toErrorMessage(error);
        qqMessage.value = qqError.value;
      } finally {
        qqLoading.value = false;
      }
      return;
    }

    if (result.status === 'expired') {
      clearQqTimer();
      return;
    }

    scheduleQqPoll(token, result.status === 'scanned' ? 2000 : 1800);
  } catch (error) {
    if (token !== qqPollToken) return;
    qqFailures += 1;
    qqError.value = toErrorMessage(error);
    if (qqFailures >= 5) {
      qqMessage.value = 'QQ 登录连接失败，请刷新二维码重试';
      clearQqTimer();
      return;
    }
    qqMessage.value = '网络波动，正在重试…';
    scheduleQqPoll(token, 3000);
  }
}

/** 已有 QQ openid / access_token 时直接换取酷狗登录态 */
async function submitQqDirect(): Promise<void> {
  if (qqDirectPending.value) return;
  qqDirectError.value = '';
  qqDirectPending.value = true;
  try {
    await loginByQq(qqOpenid.value, qqAccessToken.value);
    qqAccessToken.value = '';
    await user.completeLogin();
  } catch (error) {
    qqDirectError.value = toErrorMessage(error);
  } finally {
    qqDirectPending.value = false;
  }
}

// ---------------------------------------------------------------------------
// 通用交互
// ---------------------------------------------------------------------------

function selectMethod(next: LoginMethod): void {
  if (next === method.value || user.loggedIn) return;
  formError.value = '';
  wxError.value = '';
  qqError.value = '';
  qqDirectError.value = '';

  // 先停掉上一种方式的轮询，再启动新方式
  user.cancelLogin();
  cancelWxLogin();
  cancelQqLogin();
  method.value = next;

  if (next === 'qr') user.resumePolling();
  else if (next === 'wechat') void startWxLogin();
  else if (next === 'qq') void startQqLogin();
}

function stopAllPolling(): void {
  user.cancelLogin();
  cancelWxLogin();
  cancelQqLogin();
}

const refreshingLogin = ref(false);

/** 刷新登录态，延长 token 有效期（用户主动触发） */
async function refreshLoginState(): Promise<void> {
  if (refreshingLogin.value) return;
  refreshingLogin.value = true;
  try {
    await refreshLogin();
    await user.refresh();
    toast.success('登录状态已刷新');
  } catch (error) {
    toast.error(toErrorMessage(error));
  } finally {
    refreshingLogin.value = false;
  }
}

function logout(): void {
  if (!window.confirm('确定要退出当前酷狗账号吗？')) return;
  stopAllPolling();
  user.logout();
}

/** 已登录时点击头像进入主页 */
function openProfile(): void {
  router.push(user.profile?.userid ? `/user/${user.profile.userid}` : '/user/me');
}

watch(
  () => user.loggedIn,
  (loggedIn) => {
    if (loggedIn) {
      stopAllPolling();
      formError.value = '';
      return;
    }
    // 退出登录后，按当前 Tab 重新开始对应流程
    if (method.value === 'qr') void user.startLogin();
    else if (method.value === 'wechat') void startWxLogin();
    else if (method.value === 'qq') void startQqLogin();
  },
);

onMounted(() => {
  if (user.loggedIn) {
    if (!user.profile) void user.refresh();
  } else if (method.value === 'qr') {
    void user.startLogin();
  }
});

onBeforeUnmount(() => {
  // 离开页面后停止所有轮询与倒计时，避免后台持续请求
  stopAllPolling();
  stopCountdown();
});
</script>

<template>
  <div class="page login-page">
    <DetailHeader title="登录" />

    <div class="login-body">
      <div class="login-brand">
        <div class="login-logo">
          <Music4 :size="26" :stroke-width="1.8" />
        </div>
        <h1>登录 Muskugou</h1>
        <p>同步歌单、收藏与每日概念版 VIP</p>
      </div>

      <!-- 已登录 -->
      <template v-if="user.loggedIn">
        <div class="account-card">
          <button
            class="account-avatar"
            type="button"
            aria-label="查看我的主页"
            @click="openProfile"
          >
            <CoverImage :src="user.avatar" :alt="user.nickname" :icon-size="28" />
          </button>
          <div class="account-info">
            <p class="account-name ellipsis">
              {{ user.nickname }}
              <span v-if="user.profile?.vipType" class="account-vip">VIP</span>
              <span v-if="user.grade" class="account-level">Lv.{{ user.grade.level }}</span>
            </p>
            <p class="account-id">ID {{ user.profile?.userid || '—' }}</p>
            <p v-if="user.profile?.signature" class="account-signature ellipsis">
              {{ user.profile.signature }}
            </p>
          </div>
        </div>

        <div class="account-stats">
          <div>
            <strong>{{ user.profile?.fans ?? '—' }}</strong>
            <span>粉丝</span>
          </div>
          <div>
            <strong>{{ user.profile?.follows ?? '—' }}</strong>
            <span>关注</span>
          </div>
          <div>
            <strong>{{ user.playlists.length }}</strong>
            <span>歌单</span>
          </div>
        </div>

        <button class="account-refresh" :disabled="refreshingLogin" @click="refreshLoginState">
          <Loader2 v-if="refreshingLogin" :size="13" class="spin-icon" />
          <ShieldCheck v-else :size="13" />
          {{ refreshingLogin ? '正在刷新…' : '刷新登录状态（延长 token 有效期）' }}
        </button>

        <button class="btn btn--soft btn--block" style="margin-top: 12px" @click="router.back()">
          继续使用
        </button>
        <button class="btn btn--danger btn--block" style="margin-top: 10px" @click="logout">
          <LogOut :size="16" />
          退出登录
        </button>
      </template>

      <!-- 未登录：五种登录方式 -->
      <template v-else>
        <div class="login-tabs" role="tablist" aria-label="登录方式">
          <button
            v-for="item in methods"
            :key="item.id"
            type="button"
            class="login-tab"
            :class="{ 'login-tab--active': method === item.id }"
            role="tab"
            :aria-selected="method === item.id"
            @click="selectMethod(item.id)"
          >
            <component :is="methodIcons[item.id]" :size="15" />
            {{ item.label }}
          </button>
        </div>

        <!-- 酷狗扫码 -->
        <LoginQrPanel
          v-if="method === 'qr'"
          :image="user.qr?.image || ''"
          :loading="user.qrLoading"
          loading-text="正在生成二维码"
          :message="user.qrMessage || '正在准备登录…'"
          :overlay="qrOverlay"
          :overlay-title="qrOverlay === 'scanned' ? '已扫码' : '二维码已过期'"
          :overlay-desc="qrOverlay === 'scanned' ? '请在手机上的酷狗音乐 App 中确认登录' : '请刷新二维码后重试'"
          :refreshing="user.qrLoading"
          refresh-label="刷新二维码"
          @refresh="refreshQr"
        />

        <!-- 手机号 + 验证码 -->
        <div v-else-if="method === 'phone'" class="login-card">
          <label class="field">
            <span class="field__label">手机号</span>
            <span class="field__control">
              <Phone :size="16" class="field__icon" />
              <input
                v-model="phone"
                class="field__input"
                type="tel"
                inputmode="numeric"
                maxlength="13"
                autocomplete="tel"
                placeholder="请输入 11 位手机号"
              />
            </span>
          </label>

          <label class="field">
            <span class="field__label">短信验证码</span>
            <span class="field__control">
              <KeyRound :size="16" class="field__icon" />
              <input
                v-model="smsCode"
                class="field__input"
                type="text"
                inputmode="numeric"
                maxlength="6"
                autocomplete="one-time-code"
                placeholder="请输入短信验证码"
              />
              <button
                type="button"
                class="code-btn"
                :disabled="!canSendCode"
                @click="sendCode"
              >
                {{ smsSending ? '发送中…' : smsCountdown > 0 ? `${smsCountdown}s 后重发` : '发送验证码' }}
              </button>
            </span>
          </label>

          <label class="field">
            <span class="field__label">
              账号 ID
              <em>多账号时填写，可留空</em>
            </span>
            <span class="field__control">
              <ShieldCheck :size="16" class="field__icon" />
              <input
                v-model="smsUserid"
                class="field__input"
                type="text"
                inputmode="numeric"
                autocomplete="off"
                placeholder="酷狗用户 ID（可选）"
              />
            </span>
          </label>

          <p v-if="formError" class="form-error">
            <AlertCircle :size="13" />
            {{ formError }}
          </p>

          <button
            class="btn btn--primary btn--block login-submit"
            :disabled="smsPending || !phoneValid || !smsCode"
            @click="submitPhone"
          >
            <Loader2 v-if="smsPending" :size="16" class="spin-icon" />
            {{ smsPending ? '登录中…' : '登录' }}
          </button>
          <p class="form-hint">验证码只会在你点击“发送验证码”后发送到上面填写的手机号。</p>
        </div>

        <!-- 用户名 + 密码 -->
        <div v-else-if="method === 'password'" class="login-card">
          <label class="field">
            <span class="field__label">酷狗账号</span>
            <span class="field__control">
              <Phone :size="16" class="field__icon" />
              <input
                v-model="username"
                class="field__input"
                type="text"
                autocomplete="username"
                placeholder="手机号 / 用户名"
              />
            </span>
          </label>

          <label class="field">
            <span class="field__label">密码</span>
            <span class="field__control">
              <KeyRound :size="16" class="field__icon" />
              <input
                v-model="password"
                class="field__input"
                :type="passwordVisible ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="请输入密码"
              />
              <button
                type="button"
                class="field__action"
                :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
                @click="passwordVisible = !passwordVisible"
              >
                <EyeOff v-if="passwordVisible" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </span>
          </label>

          <label class="field">
            <span class="field__label">
              安全验证
              <em>如被要求填写</em>
            </span>
            <span class="field__control">
              <ShieldCheck :size="16" class="field__icon" />
              <input
                v-model="passwordCode"
                class="field__input"
                type="text"
                inputmode="numeric"
                maxlength="6"
                autocomplete="off"
                placeholder="图形/短信验证码（可选）"
              />
            </span>
          </label>

          <p v-if="formError" class="form-error">
            <AlertCircle :size="13" />
            {{ formError }}
          </p>

          <button
            class="btn btn--primary btn--block login-submit"
            :disabled="passwordPending || !username.trim() || !password"
            @click="submitPassword"
          >
            <Loader2 v-if="passwordPending" :size="16" class="spin-icon" />
            {{ passwordPending ? '登录中…' : '登录' }}
          </button>
          <p class="form-hint">
            密码只用于本次加密登录请求，不会写入本地存储；酷狗可能要求额外安全验证。
          </p>
        </div>

        <!-- 微信扫码 -->
        <div v-else-if="method === 'wechat'">
          <LoginQrPanel
            :image="wxSession?.image || ''"
            alt="微信登录二维码"
            :loading="wxLoading"
            loading-text="正在生成微信二维码"
            :message="wxMessage || '正在准备微信登录…'"
            :overlay="wxOverlay"
            :overlay-title="wxOverlayTitle"
            :overlay-desc="wxOverlayDesc"
            :refreshing="wxLoading"
            refresh-label="刷新微信二维码"
            @refresh="startWxLogin"
          />
          <p v-if="wxError" class="form-error form-error--center">
            <AlertCircle :size="13" />
            {{ wxError }}
          </p>
          <p class="form-hint form-hint--center">
            微信授权成功后会自动换取酷狗概念版登录态，无需另外绑定。
          </p>
        </div>

        <!-- QQ 扫码 / QQ 授权参数 -->
        <div v-else-if="method === 'qq'">
          <LoginQrPanel
            :image="qqSession?.image || ''"
            alt="QQ 登录二维码"
            :loading="qqLoading"
            loading-text="正在生成 QQ 二维码"
            :message="qqMessage || '正在准备 QQ 登录…'"
            :overlay="qqOverlay"
            :overlay-title="qqOverlayTitle"
            :overlay-desc="qqOverlayDesc"
            :refreshing="qqLoading"
            refresh-label="刷新 QQ 二维码"
            @refresh="startQqLogin"
          />
          <p v-if="qqError" class="form-error form-error--center">
            <AlertCircle :size="13" />
            {{ qqError }}
          </p>

          <details class="qq-direct">
            <summary>已有 QQ 授权参数？使用 openid / access_token 登录</summary>
            <label class="field">
              <span class="field__label">openid</span>
              <span class="field__control">
                <Send :size="16" class="field__icon" />
                <input
                  v-model="qqOpenid"
                  class="field__input"
                  type="text"
                  autocomplete="off"
                  placeholder="QQ 开放平台返回的 openid"
                />
              </span>
            </label>
            <label class="field">
              <span class="field__label">access_token</span>
              <span class="field__control">
                <KeyRound :size="16" class="field__icon" />
                <input
                  v-model="qqAccessToken"
                  class="field__input"
                  type="password"
                  autocomplete="off"
                  placeholder="QQ 开放平台返回的 access_token"
                />
              </span>
            </label>
            <p v-if="qqDirectError" class="form-error">
              <AlertCircle :size="13" />
              {{ qqDirectError }}
            </p>
            <button
              class="btn btn--soft btn--block login-submit"
              :disabled="qqDirectPending || !qqOpenid.trim() || !qqAccessToken.trim()"
              @click="submitQqDirect"
            >
              <Loader2 v-if="qqDirectPending" :size="16" class="spin-icon" />
              {{ qqDirectPending ? '登录中…' : '使用授权参数登录' }}
            </button>
          </details>

          <p class="form-hint form-hint--center">
            扫码后会自动用 QQ 授权换取酷狗登录态，令牌只保存在本机。
          </p>
        </div>

        <ul class="benefits">
          <li>
            <span class="benefit-icon"><ListMusic :size="17" /></span>
            <span>同步酷狗歌单和收藏</span>
          </li>
          <li>
            <span class="benefit-icon"><ShieldCheck :size="17" /></span>
            <span>五种登录方式，密码不保存在本地</span>
          </li>
          <li>
            <span class="benefit-icon"><Sparkles :size="17" /></span>
            <span>登录后免费听标准音质，每日自动领取 VIP</span>
          </li>
        </ul>
      </template>

      <p class="login-note">
        登录基于酷狗概念版（Young）接口，仅供个人学习使用。
        第三方登录需要微信 / QQ 授权；若二维码无法显示，请检查网络后刷新。
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.login-body {
  padding: 10px 22px 0;
}

.login-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 0 22px;
  text-align: center;
}

.login-logo {
  display: grid;
  width: 58px;
  height: 58px;
  margin-bottom: 10px;
  place-items: center;
  border-radius: 19px;
  color: #04231f;
  background: var(--accent-gradient);
  box-shadow: 0 14px 34px rgba(56, 225, 198, 0.24);
}

.login-brand h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.login-brand p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11.5px;
}

/* 登录方式切换 */
.login-tabs {
  display: flex;
  gap: 3px;
  padding: 4px;
  margin-bottom: 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.028);
}

.login-tab {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 2px;
  border-radius: 12px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  transition: color 0.16s ease, background 0.16s ease;
}

.login-tab--active {
  color: var(--accent);
  background: var(--accent-soft);
}

/* 表单 */
.login-card {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background:
    radial-gradient(120% 100% at 50% 0%, rgba(56, 225, 198, 0.05), transparent 58%),
    rgba(255, 255, 255, 0.03);
}

.field {
  display: block;
  margin-bottom: 13px;
}

.field__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 0 2px 6px;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
}

.field__label em {
  color: rgba(255, 255, 255, 0.26);
  font-size: 9.5px;
  font-style: normal;
  font-weight: 400;
}

.field__control {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: rgba(7, 11, 18, 0.45);
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.field__control:focus-within {
  border-color: rgba(56, 225, 198, 0.42);
  box-shadow: 0 0 0 3px rgba(56, 225, 198, 0.06);
}

.field__icon {
  flex: 0 0 auto;
  color: var(--muted);
}

.field__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  color: var(--text);
  font-size: 13.5px;
  background: transparent;
}

.field__input::placeholder {
  color: rgba(255, 255, 255, 0.24);
}

.field__action {
  display: grid;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
}

.code-btn {
  flex: 0 0 auto;
  padding: 4px 0 4px 10px;
  border-left: 1px solid var(--line);
  color: var(--accent);
  font-size: 10.5px;
  font-weight: 650;
  white-space: nowrap;
}

.code-btn:disabled {
  color: rgba(255, 255, 255, 0.28);
}

.login-submit {
  height: 48px;
  margin-top: 4px;
}

.form-error {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin: 0 0 10px;
  color: var(--danger);
  font-size: 10.5px;
  line-height: 1.5;
}

.form-error svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.form-error--center {
  justify-content: center;
  margin-top: 12px;
  text-align: center;
}

.form-hint {
  padding: 0 2px;
  margin: 12px 0 0;
  color: rgba(255, 255, 255, 0.28);
  font-size: 9.5px;
  line-height: 1.65;
}

.form-hint--center {
  text-align: center;
}

/* QQ 授权参数直登 */
.qq-direct {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}

.qq-direct summary {
  color: var(--muted);
  font-size: 10.5px;
  text-align: center;
  cursor: pointer;
  list-style: none;
}

.qq-direct summary::-webkit-details-marker {
  display: none;
}

.qq-direct[open] summary {
  margin-bottom: 14px;
  color: var(--text-2);
}

/* 权益说明 */
.benefits {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 6px 0;
  margin: 0;
  list-style: none;
}

.benefits li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-2);
  font-size: 12px;
}

.benefit-icon {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  color: var(--accent);
  background: rgba(56, 225, 198, 0.08);
}

.login-note {
  padding: 26px 10px 0;
  margin: 0;
  color: rgba(255, 255, 255, 0.22);
  font-size: 10px;
  line-height: 1.7;
  text-align: center;
}

/* 已登录账号 */
.account-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(56, 225, 198, 0.16);
  border-radius: 20px;
  background:
    radial-gradient(120% 160% at 100% 0%, rgba(56, 225, 198, 0.12), transparent 55%),
    #0f1826;
}

.account-avatar {
  flex: 0 0 auto;
  width: 66px;
  height: 66px;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 50%;
  background: var(--surface);
  cursor: pointer;
}

.account-info {
  flex: 1;
  min-width: 0;
}

.account-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.account-vip {
  display: inline-block;
  padding: 0 5px;
  margin-left: 5px;
  border-radius: 4px;
  color: #3a2600;
  font-size: 8.5px;
  font-weight: 800;
  line-height: 14px;
  vertical-align: 2px;
  background: linear-gradient(135deg, #ffd777, #f5a623);
}

.account-level {
  display: inline-block;
  padding: 0 5px;
  margin-left: 5px;
  border-radius: 4px;
  color: var(--accent);
  font-size: 8.5px;
  font-weight: 700;
  line-height: 14px;
  vertical-align: 2px;
  background: var(--accent-soft);
}

.account-id {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.account-signature {
  margin: 3px 0 0;
  color: var(--text-2);
  font-size: 10.5px;
}

.account-stats {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  padding: 12px 0;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.025);
}

.account-stats > div {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.account-stats strong {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.account-stats span {
  color: var(--muted);
  font-size: 9.5px;
}

.account-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  margin-top: 12px;
  padding: 8px;
  color: var(--muted);
  font-size: 10.5px;
}

.spin-icon {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
