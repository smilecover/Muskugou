<script setup lang="ts">
/**
 * 登录设备管理。
 *
 * - 通过 `features/device.ts` 调用 `/login/device`，不直接拼协议参数；
 * - 设备下线前二次确认，目标设备参数只来自刚刚拉取的列表；
 * - 当前设备（MID 与本地登录态一致）标记为“本机”且不可下线。
 */

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  CircleAlert,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Smartphone,
} from 'lucide-vue-next';
import DetailHeader from '@/components/DetailHeader.vue';
import {
  getLoginDevices,
  kickLoginDevice,
  toErrorMessage,
  type LoginDevice,
} from '@/api';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

defineOptions({ name: 'DevicesView' });

const router = useRouter();
const user = useUserStore();
const toast = useToastStore();

const devices = ref<LoginDevice[]>([]);
const loading = ref(false);
const error = ref('');
const kickingKey = ref('');

const kickableCount = computed(() => devices.value.filter((device) => device.canKick).length);

async function load(): Promise<void> {
  if (!user.loggedIn || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    devices.value = await getLoginDevices();
  } catch (loadError) {
    const message = toErrorMessage(loadError);
    // 刷新失败时保留上一次成功读取的列表，避免页面突然变空
    if (devices.value.length) toast.error(message);
    else error.value = message;
  } finally {
    loading.value = false;
  }
}

async function kick(device: LoginDevice): Promise<void> {
  if (!device.canKick || kickingKey.value) return;
  const confirmed = window.confirm(
    `确定要让“${device.name}”下线吗？该设备需要重新登录后才能继续使用。`,
  );
  if (!confirmed) return;

  kickingKey.value = device.key;
  try {
    const message = await kickLoginDevice(device);
    devices.value = devices.value.filter((item) => item.key !== device.key);
    toast.success(message);
  } catch (kickError) {
    toast.error(toErrorMessage(kickError));
  } finally {
    kickingKey.value = '';
  }
}

function goLogin(): void {
  router.push('/login');
}

function goApiCenter(): void {
  router.push('/api-center');
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="page devices-page">
    <DetailHeader title="登录设备">
      <template v-if="user.loggedIn" #actions>
        <button
          class="icon-btn icon-btn--ghost"
          aria-label="刷新设备列表"
          :disabled="loading"
          @click="load"
        >
          <RefreshCw :size="18" :class="{ 'spin-icon': loading }" />
        </button>
      </template>
    </DetailHeader>

    <div class="devices-body">
      <!-- 未登录 -->
      <section v-if="!user.loggedIn" class="devices-login">
        <span class="devices-login__icon"><Smartphone :size="28" :stroke-width="1.6" /></span>
        <p class="devices-login__title">登录后管理登录设备</p>
        <p class="devices-login__desc">
          查看当前账号在哪些设备上登录，并把不再使用的设备踢下线。
        </p>
        <button class="btn btn--primary btn--sm" @click="goLogin">
          <LogIn :size="14" />
          去登录
        </button>
      </section>

      <template v-else>
        <!-- 概览 -->
        <section class="devices-summary">
          <div class="devices-summary__main">
            <span class="devices-summary__icon"><Smartphone :size="20" /></span>
            <div>
              <p>{{ devices.length ? `${devices.length} 台设备` : '设备列表' }}</p>
              <span>
                {{ loading ? '正在读取登录设备…' : `${kickableCount} 台可下线` }}
              </span>
            </div>
          </div>
          <button class="text-btn" :disabled="loading" @click="load">
            {{ loading ? '刷新中…' : '刷新' }}
          </button>
        </section>

        <div class="devices-tip">
          <ShieldAlert :size="14" />
          <p>
            设备下线会让该设备退出登录，不会修改密码或影响本机。
            如果列表读取失败，可在接口中心调用
            <button class="text-btn text-btn--inline" @click="goApiCenter">/login/device</button>
            排查。
          </p>
        </div>

        <!-- 加载中 -->
        <div v-if="loading && !devices.length" class="devices-loading">
          <Loader2 :size="22" class="spin-icon" />
          <span>正在读取设备列表</span>
        </div>

        <!-- 错误 -->
        <div v-else-if="error" class="devices-error">
          <CircleAlert :size="20" />
          <p class="devices-error__title">设备列表读取失败</p>
          <p class="devices-error__desc">{{ error }}</p>
          <button class="btn btn--soft btn--sm" @click="load">
            <RefreshCw :size="14" />
            重试
          </button>
        </div>

        <!-- 空列表 -->
        <div v-else-if="!devices.length" class="empty-state devices-empty">
          <span class="empty-state__icon"><Smartphone :size="24" /></span>
          <p class="empty-state__title">没有读取到登录设备</p>
          <p class="empty-state__desc">
            可能是接口没有返回设备信息，或当前登录态已失效。可以重新登录后再试。
          </p>
          <button class="btn btn--soft btn--sm" @click="load">
            <RefreshCw :size="14" />
            重新读取
          </button>
        </div>

        <!-- 设备列表 -->
        <div v-else class="devices-list">
          <article
            v-for="device in devices"
            :key="device.key"
            class="device-card"
            :class="{ 'device-card--current': device.current }"
          >
            <span class="device-card__icon">
              <Smartphone :size="19" />
            </span>

            <div class="device-card__main">
              <div class="device-card__title">
                <span class="ellipsis">{{ device.name }}</span>
                <span v-if="device.current" class="device-badge">当前设备</span>
                <span v-else-if="!device.canKick" class="device-badge device-badge--muted">
                  参数不全
                </span>
              </div>

              <p class="device-card__meta">
                <span v-if="device.model && device.model !== device.name">{{ device.model }}</span>
                <span v-if="device.appid">App {{ device.appid }}</span>
                <span v-if="device.clientver">v{{ device.clientver }}</span>
              </p>

              <p v-if="device.lastActive || device.ip" class="device-card__extra">
                <span v-if="device.lastActive">最近活跃 {{ device.lastActive }}</span>
                <span v-if="device.ip">IP {{ device.ip }}</span>
              </p>
            </div>

            <button
              class="device-kick"
              :disabled="!device.canKick || Boolean(kickingKey)"
              @click="kick(device)"
            >
              <Loader2 v-if="kickingKey === device.key" :size="13" class="spin-icon" />
              <LogOut v-else :size="13" />
              {{ device.current ? '本机' : '下线' }}
            </button>
          </article>
        </div>

        <p class="devices-footnote">
          设备信息由酷狗账号接口实时返回，不同账号展示的字段可能不同。
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.devices-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.devices-body {
  padding: 4px 16px 0;
}

.devices-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 38px 20px;
  text-align: center;
}

.devices-login__icon {
  display: grid;
  width: 62px;
  height: 62px;
  margin-bottom: 4px;
  place-items: center;
  border-radius: 20px;
  color: var(--accent);
  background: var(--accent-soft);
}

.devices-login__title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
}

.devices-login__desc {
  max-width: 260px;
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.devices-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid rgba(56, 225, 198, 0.16);
  border-radius: 16px;
  background:
    radial-gradient(130% 180% at 100% 0%, rgba(56, 225, 198, 0.1), transparent 60%),
    rgba(255, 255, 255, 0.025);
}

.devices-summary__main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.devices-summary__icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  color: var(--accent);
  background: var(--accent-soft);
}

.devices-summary p {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
}

.devices-summary span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.devices-tip {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 10px;
  padding: 0 4px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.55;
}

.devices-tip svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--warning);
}

.devices-tip p {
  margin: 0;
}

.text-btn--inline {
  padding: 0;
  color: var(--accent);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9.5px;
}

.devices-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 54px 16px;
  color: var(--muted);
  font-size: 11.5px;
}

.devices-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 44px 18px;
  text-align: center;
}

.devices-error > svg {
  color: var(--danger);
}

.devices-error__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.devices-error__desc {
  max-width: 280px;
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.55;
  user-select: text;
}

.devices-empty {
  padding: 48px 18px;
}

.devices-empty .btn {
  margin-top: 4px;
}

.devices-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 14px;
}

.device-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.025);
}

.device-card--current {
  border-color: rgba(56, 225, 198, 0.22);
  background: rgba(56, 225, 198, 0.035);
}

.device-card__icon {
  display: grid;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.06);
}

.device-card--current .device-card__icon {
  color: var(--accent);
  background: var(--accent-soft);
}

.device-card__main {
  flex: 1;
  min-width: 0;
}

.device-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
}

.device-card__title .ellipsis {
  flex: 0 1 auto;
}

.device-badge {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--accent);
  font-size: 8px;
  font-weight: 600;
  background: var(--accent-soft);
}

.device-badge--muted {
  color: var(--muted);
  background: rgba(255, 255, 255, 0.055);
}

.device-card__meta,
.device-card__extra {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 9.5px;
  line-height: 1.45;
}

.device-card__extra {
  color: rgba(255, 255, 255, 0.32);
  font-size: 9px;
  user-select: text;
}

.device-kick {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  align-self: center;
  padding: 6px 10px;
  border: 1px solid rgba(255, 99, 119, 0.22);
  border-radius: 999px;
  color: var(--danger);
  font-size: 10px;
  font-weight: 600;
  background: rgba(255, 99, 119, 0.055);
}

.device-kick:disabled {
  border-color: var(--line);
  color: var(--muted);
  background: rgba(255, 255, 255, 0.03);
  opacity: 0.65;
}

.devices-footnote {
  margin: 14px 4px 0;
  color: var(--muted);
  font-size: 9.5px;
  line-height: 1.5;
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
