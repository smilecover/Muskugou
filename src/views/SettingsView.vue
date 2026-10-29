<script setup lang="ts">
/**
 * 设置页。
 *
 * App 固定使用酷狗概念版：这里展示概念版标识、每日 VIP 领取与播放偏好。
 * 音质、歌词翻译、自动切歌等设置会持久化；清除本地数据不影响登录状态。
 */

import { useRouter } from 'vue-router';
import {
  ChevronRight,
  Crown,
  Database,
  Gift,
  Info,
  LogIn,
  LogOut,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  SlidersHorizontal,
  UserRound,
} from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import { clearUrlCache, type Quality } from '@/api';
import { useLibraryStore } from '@/stores/library';
import { useMembershipStore } from '@/stores/membership';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const settings = useSettingsStore();
const player = usePlayerStore();
const user = useUserStore();
const library = useLibraryStore();
const toast = useToastStore();
const membership = useMembershipStore();

const qualities: { value: Quality; label: string; note: string }[] = [
  { value: '128', label: '标准', note: '128K' },
  { value: '320', label: '高品质', note: '320K' },
  { value: 'flac', label: '无损', note: 'FLAC' },
  { value: 'high', label: 'Hi-Res', note: '高解析' },
  { value: 'super', label: '超品', note: '母带' },
];

/** 手动领取今日概念版 VIP；未登录时先去登录 */
async function claimVip(): Promise<void> {
  if (!user.loggedIn) {
    router.push('/login');
    return;
  }
  await membership.manualClaim();
}

function setQuality(value: Quality): void {
  if (value === settings.state.quality) return;
  settings.setQuality(value);
  if (player.current) player.refreshQuality();
  else toast.success('默认音质已更新');
}

function clearCache(): void {
  clearUrlCache();
  toast.success('播放地址缓存已清除');
}

function clearLocalData(): void {
  const confirmed = window.confirm('将清除本地收藏、最近播放和搜索历史，且无法恢复。确定继续吗？');
  if (!confirmed) return;
  library.clearFavorites();
  library.clearHistory();
  library.clearSearchHistory();
  toast.success('本地音乐数据已清除');
}

function logout(): void {
  if (!window.confirm('确定要退出当前酷狗账号吗？')) return;
  user.logout();
}

function goLogin(): void {
  router.push('/login');
}
</script>

<template>
  <div class="page settings-page">
    <DetailHeader title="设置" />

    <div class="settings-body">
      <!-- 概念版标识 -->
      <section class="concept-card">
        <div class="concept-card__mark">Y</div>
        <div class="concept-card__text">
          <p>酷狗概念版</p>
          <span>Young 接口 · 免费听 · 每日 VIP</span>
        </div>
        <span class="concept-card__badge">已启用</span>
      </section>

      <!-- 账号 -->
      <section class="settings-group">
        <h2 class="settings-group__title">账号</h2>
        <div class="settings-card">
          <div class="account-row">
            <div class="account-avatar">
              <CoverImage :src="user.avatar" :alt="user.nickname" :icon-size="22" />
            </div>
            <div class="account-info">
              <p class="ellipsis">{{ user.nickname }}</p>
              <span>{{ user.loggedIn ? '酷狗账号已登录' : '登录后可同步歌单' }}</span>
            </div>
            <button v-if="user.loggedIn" class="btn btn--soft btn--sm" @click="goLogin">切换账号</button>
            <button v-else class="btn btn--primary btn--sm" @click="goLogin">
              <LogIn :size="14" />
              登录
            </button>
          </div>

          <button v-if="user.loggedIn" class="setting-link setting-link--danger" @click="logout">
            <span class="setting-icon"><LogOut :size="17" /></span>
            <span>退出登录</span>
            <ChevronRight :size="16" class="muted" />
          </button>
        </div>
      </section>

      <!-- 概念版会员 -->
      <section class="settings-group">
        <h2 class="settings-group__title">
          <Crown :size="14" />
          概念版会员
        </h2>
        <div class="settings-card">
          <div class="vip-row">
            <div class="vip-row__icon">
              <Crown :size="19" />
            </div>
            <div class="vip-row__text">
              <p>
                每日 VIP
                <span v-if="membership.vipActive" class="vip-status">生效中</span>
              </p>
              <span>{{ membership.statusText }}</span>
            </div>
            <button
              class="btn btn--primary btn--sm"
              :disabled="membership.claiming || (user.loggedIn && !membership.canClaim)"
              @click="claimVip"
            >
              <span v-if="membership.claiming" class="spinner spinner--btn" />
              <template v-else>{{ user.loggedIn ? membership.actionText : '去登录' }}</template>
            </button>
          </div>

          <div class="setting-row">
            <div class="setting-label">
              <span>自动领取</span>
              <small>每天首次打开 App 时领取 1 天 VIP</small>
            </div>
            <button
              class="switch"
              :class="{ 'switch--on': settings.state.autoClaimVip }"
              role="switch"
              :aria-checked="settings.state.autoClaimVip"
              aria-label="自动领取概念版 VIP"
              @click="settings.toggleAutoClaimVip()"
            />
          </div>

          <div class="setting-row">
            <div class="setting-label">
              <span>自动升级</span>
              <small>领取后升级为畅听 VIP，提升可听音质</small>
            </div>
            <button
              class="switch"
              :class="{ 'switch--on': settings.state.autoUpgradeVip }"
              role="switch"
              :aria-checked="settings.state.autoUpgradeVip"
              aria-label="自动升级畅听 VIP"
              @click="settings.toggleAutoUpgradeVip()"
            />
          </div>

          <div class="vip-hint">
            <Gift :size="14" />
            <p>
              {{ membership.autoStatusText }}。VIP 生效后，概念版免费听会从标准音质提升到更高音质；
              领取结果以酷狗服务端为准。
            </p>
          </div>
        </div>
      </section>

      <!-- 播放 -->
      <section class="settings-group">
        <h2 class="settings-group__title">
          <SlidersHorizontal :size="14" />
          播放
        </h2>
        <div class="settings-card">
          <div class="setting-block">
            <div class="setting-label">
              <span>默认音质</span>
              <small>{{ qualities.find((item) => item.value === settings.state.quality)?.note }}</small>
            </div>
            <div class="quality-grid">
              <button
                v-for="item in qualities"
                :key="item.value"
                class="quality-chip"
                :class="{ 'quality-chip--active': settings.state.quality === item.value }"
                @click="setQuality(item.value)"
              >
                <span>{{ item.label }}</span>
                <small>{{ item.note }}</small>
              </button>
            </div>
            <p class="setting-hint">
              概念版登录后可免费听标准音质；领取 VIP 后可解锁更高音质。
              实际音质仍取决于歌曲版权，不可用时自动向下回退，最后支持 60 秒试听。
            </p>
          </div>

          <div class="setting-row">
            <div class="setting-label">
              <span>显示歌词翻译</span>
              <small>歌词页展示翻译行</small>
            </div>
            <button
              class="switch"
              :class="{ 'switch--on': settings.state.showTranslation }"
              role="switch"
              :aria-checked="settings.state.showTranslation"
              aria-label="显示歌词翻译"
              @click="settings.toggleShowTranslation()"
            />
          </div>

          <div class="setting-row">
            <div class="setting-label">
              <span>自动播放下一首</span>
              <small>关闭后歌曲结束将停在当前歌曲</small>
            </div>
            <button
              class="switch"
              :class="{ 'switch--on': settings.state.autoPlayNext }"
              role="switch"
              :aria-checked="settings.state.autoPlayNext"
              aria-label="自动播放下一首"
              @click="settings.toggleAutoPlayNext()"
            />
          </div>
        </div>
      </section>

      <!-- 搜索 -->
      <section class="settings-group">
        <h2 class="settings-group__title">
          <Search :size="14" />
          搜索
        </h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-label">
              <span>显示酷狗热搜</span>
              <small>在搜索页展示实时热搜榜</small>
            </div>
            <button
              class="switch"
              :class="{ 'switch--on': settings.state.showHotSearch }"
              role="switch"
              :aria-checked="settings.state.showHotSearch"
              aria-label="显示酷狗热搜"
              @click="settings.toggleShowHotSearch()"
            />
          </div>
        </div>
      </section>

      <!-- 数据 -->
      <section class="settings-group">
        <h2 class="settings-group__title">
          <Database :size="14" />
          数据
        </h2>
        <div class="settings-card">
          <button class="setting-link" @click="clearCache">
            <span class="setting-icon"><RefreshCw :size="17" /></span>
            <span>清除播放地址缓存</span>
            <ChevronRight :size="16" class="muted" />
          </button>
          <button class="setting-link" @click="clearLocalData">
            <span class="setting-icon"><Database :size="17" /></span>
            <span>清除收藏与播放记录</span>
            <ChevronRight :size="16" class="muted" />
          </button>
          <button class="setting-link" @click="goLogin">
            <span class="setting-icon"><UserRound :size="17" /></span>
            <span>{{ user.loggedIn ? '管理账号' : '登录账号' }}</span>
            <ChevronRight :size="16" class="muted" />
          </button>
        </div>
      </section>

      <!-- 关于 -->
      <section class="settings-group">
        <h2 class="settings-group__title">
          <Info :size="14" />
          关于
        </h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-label">
              <span>Muskugou</span>
              <small>版本 0.1.0 · Tauri + Vue 3</small>
            </div>
            <span class="about-mark">♪</span>
          </div>
          <div class="setting-row">
            <div class="setting-label">
              <span>接口来源</span>
              <small>酷狗概念版 Young / Android 协议</small>
            </div>
            <Server :size="16" class="muted" />
          </div>
          <div class="disclaimer">
            <ShieldAlert :size="16" />
            <p>
              本项目仅供个人学习与技术研究，音乐版权归酷狗音乐及版权方所有。
              请勿用于商业用途或大规模抓取。登录仅支持扫码，不会触发短信。
            </p>
          </div>
        </div>
      </section>

      <p class="settings-footer">Muskugou · Made for learning</p>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.settings-body {
  padding: 2px 18px 0;
}

.concept-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 14px 15px;
  border: 1px solid rgba(56, 225, 198, 0.18);
  border-radius: 18px;
  background:
    radial-gradient(130% 180% at 100% 0%, rgba(56, 225, 198, 0.13), transparent 55%),
    rgba(255, 255, 255, 0.025);
}

.concept-card__mark {
  display: grid;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  color: #04231f;
  font-size: 20px;
  font-weight: 800;
  background: var(--accent-gradient);
  box-shadow: 0 8px 20px rgba(56, 225, 198, 0.18);
}

.concept-card__text {
  flex: 1;
  min-width: 0;
}

.concept-card__text p {
  margin: 0;
  font-size: 13.5px;
  font-weight: 650;
}

.concept-card__text span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.concept-card__badge {
  flex: 0 0 auto;
  padding: 3px 8px;
  border-radius: 999px;
  color: var(--accent);
  font-size: 9px;
  font-weight: 700;
  background: var(--accent-soft);
}

.settings-group {
  margin-top: 22px;
}

.settings-group:first-child {
  margin-top: 4px;
}

.settings-group__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 9px 4px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.settings-card {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.025);
}

.account-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 15px;
}

.account-avatar {
  flex: 0 0 auto;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--surface);
}

.account-info {
  flex: 1;
  min-width: 0;
}

.account-info p {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
}

.account-info span {
  color: var(--muted);
  font-size: 10.5px;
}

.setting-block {
  padding: 15px;
}

.setting-block + .setting-block,
.setting-block + .setting-row,
.setting-row + .setting-block,
.setting-row + .setting-row,
.account-row + .setting-link {
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-label span {
  font-size: 13.5px;
  font-weight: 550;
}

.setting-label small {
  color: var(--muted);
  font-size: 10px;
}

.setting-hint {
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.55;
}

.vip-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 14px 15px;
}

.vip-row__icon {
  display: grid;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  color: #3a2600;
  background: linear-gradient(135deg, #ffd777, #f5a623);
}

.vip-row__text {
  flex: 1;
  min-width: 0;
}

.vip-row__text p {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-size: 13.5px;
  font-weight: 650;
}

.vip-row__text > span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.45;
}

.vip-status {
  padding: 1px 5px;
  border-radius: 4px;
  color: #3a2600;
  font-size: 8px;
  font-weight: 800;
  line-height: 13px;
  background: linear-gradient(135deg, #ffd777, #f5a623);
}

.vip-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 11px 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.055);
  color: var(--muted);
  font-size: 10px;
  line-height: 1.55;
  background: rgba(0, 0, 0, 0.12);
}

.vip-hint svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #f5a623;
}

.vip-hint p {
  margin: 0;
}

.quality-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.quality-chip {
  display: flex;
  flex: 1 1 72px;
  flex-direction: column;
  gap: 1px;
  align-items: center;
  padding: 8px 6px;
  border: 1px solid var(--line);
  border-radius: 11px;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.03);
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}

.quality-chip span {
  font-size: 11.5px;
  font-weight: 600;
}

.quality-chip small {
  color: var(--muted);
  font-size: 8.5px;
  letter-spacing: 0.04em;
}

.quality-chip--active {
  border-color: rgba(56, 225, 198, 0.34);
  color: var(--accent);
  background: var(--accent-soft);
}

.quality-chip--active small {
  color: rgba(56, 225, 198, 0.62);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 15px;
}

.setting-link {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 13px 15px;
  color: var(--text-2);
  font-size: 13px;
  text-align: left;
}

.setting-link + .setting-link {
  border-top: 1px solid rgba(255, 255, 255, 0.055);
}

.setting-link:active {
  background: rgba(255, 255, 255, 0.04);
}

.setting-link > span:nth-child(2) {
  flex: 1;
}

.setting-link--danger {
  color: var(--danger);
}

.spinner--btn {
  width: 14px;
  height: 14px;
  border-color: rgba(4, 35, 31, 0.25);
  border-top-color: #04231f;
}

.setting-icon {
  display: grid;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 9px;
  color: var(--accent);
  background: rgba(56, 225, 198, 0.08);
}

.setting-link--danger .setting-icon {
  color: var(--danger);
  background: rgba(255, 99, 119, 0.08);
}

.about-mark {
  color: var(--accent);
  font-size: 18px;
}

.disclaimer {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 12px 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.055);
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
  background: rgba(0, 0, 0, 0.12);
}

.disclaimer svg {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--warning);
}

.disclaimer p {
  margin: 0;
}

.settings-footer {
  padding: 30px 0 8px;
  margin: 0;
  color: rgba(255, 255, 255, 0.2);
  font-size: 10px;
  text-align: center;
}
</style>
