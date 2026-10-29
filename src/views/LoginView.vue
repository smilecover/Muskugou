<script setup lang="ts">
/**
 * 扫码登录页。
 *
 * 只使用酷狗二维码登录，不提供短信登录入口（短信会真实发送到手机）。
 * 二维码状态：0 过期 / 1 等待扫码 / 2 已扫码待确认 / 4 登录成功。
 */

import { onBeforeUnmount, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  ListMusic,
  LogOut,
  Music4,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const user = useUserStore();

function refreshQr(): void {
  if (user.qrLoading) return;
  void user.refreshQr();
}

function logout(): void {
  if (!window.confirm('确定要退出当前酷狗账号吗？')) return;
  user.logout();
}

watch(
  () => user.loggedIn,
  (loggedIn) => {
    if (!loggedIn) void user.startLogin();
  },
);

onMounted(() => {
  if (user.loggedIn) {
    if (!user.profile) void user.refresh();
  } else {
    void user.startLogin();
  }
});

onBeforeUnmount(() => {
  // 离开页面后停止轮询，避免后台一直请求状态接口
  user.stopPolling();
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
        <p>用酷狗音乐 App 扫码，同步歌单并领取每日概念版 VIP</p>
      </div>

      <!-- 已登录 -->
      <template v-if="user.loggedIn">
        <div class="account-card">
          <div class="account-avatar">
            <CoverImage :src="user.avatar" :alt="user.nickname" :icon-size="28" />
          </div>
          <div class="account-info">
            <p class="account-name ellipsis">
              {{ user.nickname }}
              <span v-if="user.profile?.vipType" class="account-vip">VIP</span>
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

        <button class="btn btn--soft btn--block" style="margin-top: 16px" @click="router.back()">
          继续使用
        </button>
        <button class="btn btn--danger btn--block" style="margin-top: 10px" @click="logout">
          <LogOut :size="16" />
          退出登录
        </button>
      </template>

      <!-- 未登录：二维码 -->
      <template v-else>
        <div class="qr-card">
          <div class="qr-frame">
            <img v-if="user.qr" :src="user.qr.image" alt="酷狗登录二维码" draggable="false" />
            <div v-else class="qr-loading">
              <span class="spinner" />
              正在生成二维码
            </div>

            <div v-if="user.qrStatus === 2" class="qr-overlay">
              <ScanLine :size="30" :stroke-width="1.6" />
              <strong>已扫码</strong>
              <span>请在手机上确认登录</span>
            </div>
            <div v-else-if="user.qrStatus === 0" class="qr-overlay">
              <RefreshCw :size="26" :stroke-width="1.6" />
              <strong>二维码已过期</strong>
              <button class="btn btn--primary btn--sm" @click="refreshQr">重新生成</button>
            </div>
          </div>

          <p class="qr-message">{{ user.qrMessage || '正在准备登录…' }}</p>

          <button class="qr-refresh" :disabled="user.qrLoading" @click="refreshQr">
            <RefreshCw :size="14" :class="{ 'spin-icon': user.qrLoading }" />
            刷新二维码
          </button>
        </div>

        <ul class="benefits">
          <li>
            <span class="benefit-icon"><ListMusic :size="17" /></span>
            <span>同步酷狗歌单和收藏</span>
          </li>
          <li>
            <span class="benefit-icon"><ShieldCheck :size="17" /></span>
            <span>只扫码，不发送短信</span>
          </li>
          <li>
            <span class="benefit-icon"><Sparkles :size="17" /></span>
            <span>登录后免费听标准音质，每日自动领取 VIP</span>
          </li>
        </ul>
      </template>

      <p class="login-note">
        登录基于酷狗概念版（Young）接口，仅供个人学习使用。
        若二维码无法显示，请检查网络后刷新。
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
  padding: 8px 0 24px;
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

.qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 18px 14px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background:
    radial-gradient(120% 100% at 50% 0%, rgba(56, 225, 198, 0.07), transparent 60%),
    rgba(255, 255, 255, 0.03);
}

.qr-frame {
  position: relative;
  width: min(62vw, 220px);
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
}

.qr-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 100%;
  color: #556;
  font-size: 11px;
  background: #0f1622;
}

.qr-loading .spinner {
  border-color: rgba(255, 255, 255, 0.16);
  border-top-color: var(--accent);
}

.qr-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px;
  color: var(--text);
  text-align: center;
  background: rgba(7, 11, 18, 0.86);
  backdrop-filter: blur(3px);
}

.qr-overlay strong {
  font-size: 14px;
}

.qr-overlay span {
  color: var(--muted);
  font-size: 10.5px;
}

.qr-overlay .btn {
  margin-top: 8px;
}

.qr-message {
  min-height: 18px;
  margin: 14px 0 0;
  color: var(--text-2);
  font-size: 11.5px;
  text-align: center;
}

.qr-refresh {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  padding: 5px 10px;
  color: var(--muted);
  font-size: 10.5px;
}

.spin-icon {
  animation: spin 0.9s linear infinite;
}

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
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 50%;
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
</style>
