<script setup lang="ts">
/**
 * “我的”页。
 *
 * 展示登录状态、本地收藏/历史入口，以及登录后的酷狗歌单。
 * 本地数据（收藏、历史）不依赖登录。
 */

import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  ChevronRight,
  Cloud,
  Compass,
  Crown,
  Gift,
  Heart,
  History as HistoryIcon,
  ListMusic,
  LogIn,
  RefreshCw,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import PlaylistCard from '@/components/PlaylistCard.vue';
import { useLibraryStore } from '@/stores/library';
import { useMembershipStore } from '@/stores/membership';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

defineOptions({ name: 'LibraryView' });

const router = useRouter();
const library = useLibraryStore();
const user = useUserStore();
const membership = useMembershipStore();
const toast = useToastStore();

const playlistCount = computed(() => user.playlists.length);

async function refresh(): Promise<void> {
  if (!user.loggedIn) return;
  await user.refresh();
  void membership.refresh();
  toast.success('已刷新账号信息');
}

/** 领取今日概念版 VIP；未登录时跳转登录页 */
async function claimVip(): Promise<void> {
  if (!user.loggedIn) {
    router.push('/login');
    return;
  }
  await membership.manualClaim();
}

/** 未登录去登录；已登录则滚动到歌单区域 */
function openPlaylists(): void {
  if (!user.loggedIn) {
    router.push('/login');
    return;
  }
  document.getElementById('my-playlists')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(() => {
  if (user.loggedIn && !user.profile) void user.refresh();
  if (user.loggedIn && !membership.loaded) void membership.refresh();
});
</script>

<template>
  <div class="page library-page">
    <header class="library-header">
      <div>
        <p class="library-eyebrow">MY MUSIC</p>
        <h1 class="library-title">我的</h1>
      </div>
      <router-link to="/settings" class="icon-btn" aria-label="设置">
        <Settings :size="19" />
      </router-link>
    </header>

    <!-- 账号卡片 -->
    <section class="profile-card">
      <div class="profile-card__glow" />
      <div class="profile-main">
        <div class="profile-avatar">
          <CoverImage :src="user.avatar" :alt="user.nickname" :icon-size="26" />
        </div>
        <div class="profile-info">
          <p class="profile-name ellipsis">{{ user.nickname }}</p>
          <p v-if="user.loggedIn" class="profile-sub ellipsis">
            <span v-if="user.profile?.vipType" class="vip-badge">VIP</span>
            <span v-else>酷狗账号已登录</span>
            <span v-if="user.profile?.signature" class="profile-signature">· {{ user.profile.signature }}</span>
          </p>
          <p v-else class="profile-sub">登录后同步你的酷狗歌单</p>
        </div>

        <button
          v-if="user.loggedIn"
          class="icon-btn icon-btn--sm profile-refresh"
          :disabled="user.loading"
          aria-label="刷新账号信息"
          @click="refresh"
        >
          <RefreshCw :size="15" :class="{ 'spin-icon': user.loading }" />
        </button>
        <button v-else class="btn btn--primary btn--sm profile-login" @click="router.push('/login')">
          <LogIn :size="15" />
          登录
        </button>
      </div>

      <div class="profile-stats">
        <button class="stat" @click="router.push('/favorites')">
          <strong>{{ library.favorites.length }}</strong>
          <span>收藏</span>
        </button>
        <span class="stat-divider" />
        <button class="stat" @click="router.push('/history')">
          <strong>{{ library.history.length }}</strong>
          <span>最近播放</span>
        </button>
        <span class="stat-divider" />
        <button class="stat" @click="openPlaylists">
          <strong>{{ user.loggedIn ? playlistCount : '—' }}</strong>
          <span>歌单</span>
        </button>
      </div>
    </section>

    <!-- 概念版 VIP -->
    <section class="vip-card" :class="{ 'vip-card--active': membership.vipActive }">
      <div class="vip-card__glow" />
      <div class="vip-card__head">
        <span class="vip-card__crown">
          <Crown :size="20" :stroke-width="1.9" />
        </span>
        <div class="vip-card__info">
          <p>
            概念版 VIP
            <span v-if="membership.vipActive" class="vip-badge">生效中</span>
          </p>
          <span>{{ membership.statusText }}</span>
        </div>
        <button
          class="vip-card__action"
          :disabled="membership.claiming || (user.loggedIn && !membership.canClaim)"
          @click="claimVip"
        >
          <span v-if="membership.claiming" class="spinner spinner--vip" />
          <template v-else>{{ user.loggedIn ? membership.actionText : '登录领取' }}</template>
        </button>
      </div>
      <div class="vip-card__foot">
        <Gift :size="13" />
        <span>{{ membership.autoStatusText }} · 每天可领 1 天 VIP</span>
      </div>
    </section>

    <!-- 酷狗歌单 -->
    <section v-if="user.loggedIn" id="my-playlists" class="section">
      <div class="section-head">
        <h2 class="section-title">我的歌单</h2>
        <span class="muted" style="font-size: 11px">{{ playlistCount }} 个</span>
      </div>
      <div v-if="user.loading && !playlistCount" class="loading-state">
        <span class="spinner" />
        正在加载歌单
      </div>
      <div v-else-if="playlistCount" class="playlist-grid">
        <PlaylistCard v-for="playlist in user.playlists" :key="playlist.id" :playlist="playlist" />
      </div>
      <div v-else class="panel playlist-empty">
        <ListMusic :size="22" class="muted" />
        <p>还没有创建或收藏歌单</p>
        <span>在酷狗 App 中创建的歌单会显示在这里</span>
      </div>
    </section>

    <section v-else class="section">
      <div class="panel login-prompt">
        <div class="login-prompt__icon">
          <Sparkles :size="22" :stroke-width="1.6" />
        </div>
        <div class="login-prompt__text">
          <p>把酷狗歌单带到这里</p>
          <span>扫码登录后即可查看你收藏的歌单</span>
        </div>
        <button class="text-btn" @click="router.push('/login')">去登录</button>
      </div>
    </section>

    <!-- 本地音乐库 -->
    <section class="section">
      <div class="section-head">
        <h2 class="section-title">音乐库</h2>
      </div>
      <div class="menu-panel">
        <button class="menu-row" @click="router.push('/favorites')">
          <span class="menu-row__icon"><Heart :size="18" /></span>
          <span class="menu-row__text">
            <strong>我的收藏</strong>
            <small>{{ library.favorites.length }} 首歌曲</small>
          </span>
          <ChevronRight :size="17" class="muted" />
        </button>
        <button class="menu-row" @click="router.push('/history')">
          <span class="menu-row__icon"><HistoryIcon :size="18" /></span>
          <span class="menu-row__text">
            <strong>最近播放</strong>
            <small>最多保留 100 首</small>
          </span>
          <ChevronRight :size="17" class="muted" />
        </button>
        <button class="menu-row" @click="router.push('/account')">
          <span class="menu-row__icon"><UserRound :size="18" /></span>
          <span class="menu-row__text">
            <strong>账号与已购</strong>
            <small>关注、粉丝、已购单曲与专辑</small>
          </span>
          <ChevronRight :size="17" class="muted" />
        </button>
        <button class="menu-row" @click="router.push('/cloud')">
          <span class="menu-row__icon"><Cloud :size="18" /></span>
          <span class="menu-row__text">
            <strong>我的云盘</strong>
            <small>与酷狗账号同步的云盘音乐</small>
          </span>
          <ChevronRight :size="17" class="muted" />
        </button>
        <button class="menu-row" @click="router.push('/discover')">
          <span class="menu-row__icon"><Compass :size="18" /></span>
          <span class="menu-row__text">
            <strong>发现更多</strong>
            <small>每日推荐、歌单广场、电台与听书</small>
          </span>
          <ChevronRight :size="17" class="muted" />
        </button>
        <button class="menu-row" @click="router.push('/settings')">
          <span class="menu-row__icon"><Settings :size="18" /></span>
          <span class="menu-row__text">
            <strong>设置</strong>
            <small>音质、概念版会员与播放偏好</small>
          </span>
          <ChevronRight :size="17" class="muted" />
        </button>
      </div>
    </section>

    <p class="library-footer">Muskugou · 个人学习项目</p>
  </div>
</template>

<style scoped>
.library-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: calc(18px + var(--safe-top)) 18px 14px;
}

.library-eyebrow {
  margin: 0;
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.24em;
}

.library-title {
  margin: 3px 0 0;
  font-size: 25px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.profile-card {
  position: relative;
  margin: 0 18px;
  padding: 18px 16px 0;
  overflow: hidden;
  border: 1px solid rgba(56, 225, 198, 0.14);
  border-radius: 22px;
  background:
    radial-gradient(120% 160% at 0% 0%, rgba(56, 225, 198, 0.16), transparent 52%),
    radial-gradient(120% 140% at 100% 20%, rgba(75, 141, 255, 0.16), transparent 55%),
    #0f1826;
}

.profile-card__glow {
  position: absolute;
  top: -60px;
  right: -30px;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: rgba(56, 225, 198, 0.12);
  filter: blur(40px);
  pointer-events: none;
}

.profile-main {
  position: relative;
  display: flex;
  align-items: center;
  gap: 13px;
}

.profile-avatar {
  flex: 0 0 auto;
  width: 62px;
  height: 62px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 50%;
  background: var(--surface);
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.profile-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11.5px;
}

.profile-signature {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.vip-badge {
  flex: 0 0 auto;
  padding: 0 5px;
  border-radius: 4px;
  color: #3a2600;
  font-size: 8.5px;
  font-weight: 800;
  line-height: 14px;
  background: linear-gradient(135deg, #ffd777, #f5a623);
}

.profile-login {
  flex: 0 0 auto;
}

.profile-refresh {
  flex: 0 0 auto;
}

/* 概念版 VIP */
.vip-card {
  position: relative;
  margin: 12px 18px 0;
  padding: 14px 15px 0;
  overflow: hidden;
  border: 1px solid rgba(245, 166, 35, 0.2);
  border-radius: 20px;
  background:
    radial-gradient(130% 180% at 100% 0%, rgba(245, 166, 35, 0.14), transparent 58%),
    rgba(255, 255, 255, 0.025);
}

.vip-card--active {
  border-color: rgba(245, 166, 35, 0.38);
  box-shadow: 0 10px 30px rgba(245, 166, 35, 0.08);
}

.vip-card__glow {
  position: absolute;
  top: -46px;
  right: -20px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(245, 166, 35, 0.16);
  filter: blur(34px);
  pointer-events: none;
}

.vip-card__head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
}

.vip-card__crown {
  display: grid;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  color: #3a2600;
  background: linear-gradient(135deg, #ffd777, #f5a623);
  box-shadow: 0 8px 18px rgba(245, 166, 35, 0.24);
}

.vip-card__info {
  flex: 1;
  min-width: 0;
}

.vip-card__info p {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13.5px;
  font-weight: 650;
}

.vip-card__info > span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.45;
}

.vip-card__action {
  flex: 0 0 auto;
  padding: 7px 13px;
  border-radius: 999px;
  color: #3a2600;
  font-size: 11px;
  font-weight: 700;
  background: linear-gradient(135deg, #ffd777, #f5a623);
  transition: opacity 0.18s ease, transform 0.15s ease;
}

.vip-card__action:active {
  transform: scale(0.96);
}

.vip-card__action:disabled {
  opacity: 0.5;
}

.vip-card__foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px -15px 0;
  padding: 9px 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--muted);
  font-size: 9.5px;
  background: rgba(0, 0, 0, 0.12);
}

.vip-card__foot svg {
  flex: 0 0 auto;
  color: #f5a623;
}

.spinner--vip {
  width: 13px;
  height: 13px;
  border-color: rgba(58, 38, 0, 0.25);
  border-top-color: #3a2600;
}

.spin-icon {
  animation: spin 0.9s linear infinite;
}

.profile-stats {
  position: relative;
  display: flex;
  align-items: center;
  margin: 16px -16px 0;
  padding: 11px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(0, 0, 0, 0.12);
}

.stat {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 2px 0;
}

.stat strong {
  color: var(--text);
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stat span {
  color: var(--muted);
  font-size: 10px;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.08);
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 14px;
  padding: 0 18px;
}

.playlist-grid :deep(.playlist-card) {
  width: 100%;
}

.playlist-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin: 0 18px;
  padding: 26px 18px;
  color: var(--muted);
  text-align: center;
}

.playlist-empty p {
  margin: 4px 0 0;
  color: var(--text-2);
  font-size: 13px;
}

.playlist-empty span {
  font-size: 11px;
}

.login-prompt {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 18px;
  padding: 15px;
}

.login-prompt__icon {
  display: grid;
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 13px;
  color: var(--accent);
  background: var(--accent-soft);
}

.login-prompt__text {
  flex: 1;
  min-width: 0;
}

.login-prompt__text p {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
}

.login-prompt__text span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10.5px;
}

.menu-panel {
  margin: 0 18px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.025);
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 13px 15px;
  text-align: left;
}

.menu-row + .menu-row {
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.menu-row:active {
  background: rgba(255, 255, 255, 0.04);
}

.menu-row__icon {
  display: grid;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  color: var(--accent);
  background: rgba(56, 225, 198, 0.09);
}

.menu-row__text {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.menu-row__text strong {
  font-size: 13.5px;
  font-weight: 600;
}

.menu-row__text small {
  color: var(--muted);
  font-size: 10.5px;
}

.library-footer {
  padding: 34px 18px 8px;
  margin: 0;
  color: rgba(255, 255, 255, 0.2);
  font-size: 10px;
  text-align: center;
}
</style>
