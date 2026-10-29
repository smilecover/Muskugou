<script setup lang="ts">
/**
 * 用户主页。
 *
 * 入口：我的页/账号页/设置页头像，以及关注、粉丝、评论里的用户头像。
 * - 自己的主页：资料来自登录态，展示听歌等级、累计听歌时长与我的歌单；
 * - 他人的主页：优先读取 `/user/detail`，失败时使用列表里缓存的昵称头像，
 *   公开音乐统一通过 `/youth/user/song` 读取。
 *
 * 酷狗没有公开的“按 userid 查资料”接口，所以他人资料只做展示，不做等级查询。
 */

import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ChevronRight,
  CircleAlert,
  Loader2,
  LogIn,
  Settings,
  Smartphone,
  UserRound,
} from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import PlaylistCard from '@/components/PlaylistCard.vue';
import SongList from '@/components/SongList.vue';
import UserLevelCard from '@/components/UserLevelCard.vue';
import {
  followUser,
  getAuth,
  getFollowedUsers,
  getRememberedUser,
  getUserDetail,
  getUserPublicSongs,
  rememberUser,
  toErrorMessage,
  unfollowUser,
  type PublicUser,
  type Song,
} from '@/api';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

defineOptions({ name: 'UserProfileView' });

const route = useRoute();
const router = useRouter();
const user = useUserStore();
const toast = useToastStore();

/** 支持 `/user/me` 作为“当前账号”的简写 */
const routeId = computed(() => String(route.params.id || '').trim());
/**
 * 当前账号 id。
 *
 * 冷启动直接打开 `/user/:id` 时，store 里的资料可能还没加载，
 * 因此回退到登录 Cookie 中的 userid，避免把自己的主页误判成他人主页。
 */
const selfId = computed(() => {
  if (!user.loggedIn) return '';
  return String(user.profile?.userid || getAuth().userid || '');
});
const targetId = computed(() => (routeId.value === 'me' ? selfId.value : routeId.value));
const isSelf = computed(
  () => Boolean(targetId.value) && Boolean(selfId.value) && targetId.value === selfId.value,
);

const remoteUser = ref<PublicUser | null>(null);
const cachedUser = ref<PublicUser | null>(null);
const profileLoading = ref(false);
const profileError = ref('');

const songs = ref<Song[]>([]);
const songTotal = ref(0);
const songsLoading = ref(false);
const songsError = ref('');

const following = ref(false);
const followPending = ref(false);

let requestToken = 0;

/** 自己的资料优先使用 store，避免详情接口返回当前账号之外的数据 */
const profile = computed<PublicUser | null>(() => {
  if (isSelf.value && user.profile) {
    return {
      id: user.profile.userid,
      name: user.profile.nickname,
      avatar: user.profile.avatar,
      signature: user.profile.signature,
      fans: user.profile.fans,
      follows: user.profile.follows,
      songs: songTotal.value,
    };
  }
  if (remoteUser.value && remoteUser.value.id === targetId.value) return remoteUser.value;
  if (cachedUser.value && cachedUser.value.id === targetId.value) return cachedUser.value;
  return null;
});

const displayName = computed(
  () => profile.value?.name || (isSelf.value ? user.nickname : '酷狗用户'),
);
const displayAvatar = computed(
  () => profile.value?.avatar || (isSelf.value ? user.avatar : ''),
);
const displaySignature = computed(
  () =>
    profile.value?.signature ||
    (isSelf.value ? '酷狗概念版用户' : 'TA 还没有填写个性签名'),
);
const shownSongTotal = computed(() => songTotal.value || profile.value?.songs || 0);
/** 主页只展示前 6 个歌单，完整列表仍在“我的”页 */
const previewPlaylists = computed(() => user.playlists.slice(0, 6));

function goLogin(): void {
  void router.push('/login');
}

function resetPage(): void {
  remoteUser.value = null;
  cachedUser.value = null;
  profileLoading.value = false;
  profileError.value = '';
  songs.value = [];
  songTotal.value = 0;
  songsLoading.value = false;
  songsError.value = '';
  following.value = false;
  followPending.value = false;
}

async function load(): Promise<void> {
  const token = (requestToken += 1);
  resetPage();

  if (routeId.value === 'me' && !user.loggedIn) {
    profileError.value = '登录后可以查看自己的主页';
    return;
  }

  let id = targetId.value;
  if (!id) {
    // 直接打开 /user/me 时，登录态里的资料可能还在后台加载
    profileLoading.value = true;
    await user.refresh().catch(() => null);
    if (token !== requestToken) return;
    profileLoading.value = false;
    id = targetId.value;
    if (!id) {
      profileError.value = user.loggedIn
        ? '还没有读取到账号信息，请稍后重试'
        : '请先登录后再查看主页';
      return;
    }
  }

  cachedUser.value = getRememberedUser(id);
  profileLoading.value = true;
  songsLoading.value = true;

  if (isSelf.value) {
    if (!user.profile) await user.refresh().catch(() => null);
    if (token !== requestToken) return;
    // 等级是独立接口；已有数据时不再重复请求
    if (!user.grade && !user.gradeLoading) void user.refreshGrade();
  }

  // 详情失败不立即打断页面：公开音乐接口通常还能带回昵称和头像
  let detailError = '';
  const detailTask = !isSelf.value
    ? getUserDetail(id).catch((error) => {
        detailError = toErrorMessage(error);
        return null;
      })
    : Promise.resolve(null);

  const songsTask = getUserPublicSongs(id, 1, 30).catch((error) => {
    if (token === requestToken) songsError.value = toErrorMessage(error);
    return { songs: [] as Song[], total: 0, user: null };
  });

  const followTask =
    !isSelf.value && user.loggedIn
      ? getFollowedUsers()
          .then((list) => list.some((item) => item.id === id))
          .catch(() => null)
      : Promise.resolve(null);

  const [detail, songResult, followed] = await Promise.all([detailTask, songsTask, followTask]);
  if (token !== requestToken) return;

  // 公开音乐接口会带回昵称/头像；详情接口缺失时直接用它补齐主页头部
  if (songResult.user) {
    cachedUser.value = getRememberedUser(id) || songResult.user;
  }

  if (detail?.id === id) {
    const merged = songResult.user
      ? {
          ...detail,
          name: detail.name && detail.name !== '酷狗用户' ? detail.name : songResult.user.name,
          avatar: detail.avatar || songResult.user.avatar,
        }
      : detail;
    remoteUser.value = merged;
    rememberUser(merged);
    cachedUser.value = getRememberedUser(id) || cachedUser.value;
  }

  songs.value = songResult.songs;
  songTotal.value = songResult.total;
  if (followed !== null) following.value = followed;
  profileLoading.value = false;
  songsLoading.value = false;

  if (!profile.value) {
    profileError.value = isSelf.value
      ? '账号资料暂时不可用，请稍后重试'
      : detailError || '暂时无法读取这个用户的资料，当前只展示公开音乐';
  }
}

async function toggleFollow(): Promise<void> {
  if (!targetId.value || followPending.value) return;
  if (!user.loggedIn) {
    goLogin();
    return;
  }

  followPending.value = true;
  try {
    if (following.value) {
      await unfollowUser(targetId.value);
      following.value = false;
      toast.success('已取消关注');
    } else {
      await followUser(targetId.value);
      following.value = true;
      toast.success('已关注');
    }
  } catch (error) {
    toast.error(toErrorMessage(error));
  } finally {
    followPending.value = false;
  }
}

function retry(): void {
  void load();
}

// targetId 会在 /user/me 的资料加载完成后补上；isSelf 变化时也需要重新判断
watch([targetId, isSelf], () => void load(), { immediate: true });
</script>

<template>
  <div class="page user-page">
    <DetailHeader :title="isSelf ? '我的主页' : '主页'">
      <template v-if="isSelf" #actions>
        <router-link to="/settings" class="icon-btn icon-btn--ghost" aria-label="设置">
          <Settings :size="19" />
        </router-link>
      </template>
    </DetailHeader>

    <!-- 未登录访问 /user/me -->
    <section v-if="routeId === 'me' && !user.loggedIn" class="user-login panel">
      <span class="user-login__icon"><UserRound :size="27" :stroke-width="1.6" /></span>
      <p class="user-login__title">登录后查看主页</p>
      <p class="user-login__desc">同步资料、听歌等级与你的酷狗歌单</p>
      <button class="btn btn--primary btn--sm" @click="goLogin">
        <LogIn :size="14" />
        去登录
      </button>
    </section>

    <div v-else class="user-body">
      <!-- 资料头部 -->
      <section class="user-hero">
        <div class="user-hero__avatar">
          <CoverImage :src="displayAvatar" :alt="displayName" :icon-size="32" />
        </div>

        <div class="user-hero__info">
          <p class="user-hero__name ellipsis">{{ displayName }}</p>
          <p class="user-hero__sign ellipsis">{{ displaySignature }}</p>
          <div class="user-hero__meta">
            <span v-if="targetId" class="user-hero__id">ID {{ targetId }}</span>
            <span v-if="isSelf && user.profile?.vipType" class="user-vip">VIP</span>
            <span v-if="isSelf && user.grade" class="user-level-chip">
              Lv.{{ user.grade.level }}
            </span>
          </div>
        </div>

        <button
          v-if="!isSelf"
          class="user-follow"
          :class="{ 'user-follow--active': following }"
          type="button"
          :disabled="followPending"
          @click="toggleFollow"
        >
          <Loader2 v-if="followPending" :size="12" class="spin-icon" />
          {{ user.loggedIn ? (following ? '已关注' : '关注') : '关注' }}
        </button>
      </section>

      <div v-if="profileLoading && !profile" class="user-inline-loading">
        <Loader2 :size="15" class="spin-icon" />
        正在读取资料
      </div>

      <section v-if="profileError && !profile" class="user-error panel">
        <CircleAlert :size="18" />
        <p>{{ profileError }}</p>
        <button class="btn btn--soft btn--sm" @click="retry">重试</button>
      </section>

      <!-- 粉丝 / 关注 / 公开音乐 -->
      <section class="user-stats">
        <div>
          <strong>{{ profile?.follows ?? '—' }}</strong>
          <span>关注</span>
        </div>
        <div>
          <strong>{{ profile?.fans ?? '—' }}</strong>
          <span>粉丝</span>
        </div>
        <div>
          <strong>{{ shownSongTotal }}</strong>
          <span>公开音乐</span>
        </div>
      </section>

      <!-- 听歌等级：仅自己 -->
      <UserLevelCard
        v-if="isSelf"
        class="user-level"
        :grade="user.grade"
        :loading="user.gradeLoading"
        :error="user.gradeError"
        refreshable
        @retry="user.refreshGrade"
      />

      <!-- 自己的快捷入口 -->
      <div v-if="isSelf" class="user-actions">
        <button type="button" @click="router.push('/account')">
          <UserRound :size="15" />
          账号与粉丝
          <ChevronRight :size="14" class="muted" />
        </button>
        <button type="button" @click="router.push('/devices')">
          <Smartphone :size="15" />
          登录设备
          <ChevronRight :size="14" class="muted" />
        </button>
      </div>

      <!-- 自己的歌单 -->
      <section v-if="isSelf" class="section">
        <div class="section-head">
          <h2 class="section-title">我的歌单</h2>
          <router-link to="/library" class="section-action">
            全部 {{ user.playlists.length }} 个
            <ChevronRight :size="13" />
          </router-link>
        </div>

        <div v-if="user.loading && !user.playlists.length" class="user-inline-loading">
          <Loader2 :size="15" class="spin-icon" />
          正在加载歌单
        </div>
        <div v-else-if="previewPlaylists.length" class="user-playlist-grid">
          <PlaylistCard
            v-for="playlist in previewPlaylists"
            :key="playlist.id"
            :playlist="playlist"
          />
        </div>
        <div v-else class="user-empty panel">
          <p>还没有创建或收藏歌单</p>
          <span>在酷狗 App 中创建的歌单会显示在这里</span>
        </div>
      </section>

      <!-- 公开音乐 -->
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">公开音乐</h2>
          <span class="muted user-song-count">{{ shownSongTotal }} 首</span>
        </div>

        <div v-if="songsError" class="user-error panel">
          <CircleAlert :size="18" />
          <p>{{ songsError }}</p>
          <button class="btn btn--soft btn--sm" @click="retry">重新加载</button>
        </div>
        <div v-else class="user-song-list">
          <SongList
            :songs="songs"
            :loading="songsLoading"
            show-cover
            empty-title="还没有公开音乐"
            empty-desc="这个用户暂时没有公开分享的歌曲"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.user-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.user-body {
  padding: 2px 0 0;
}

.user-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: 22px 18px 0;
  padding: 34px 18px;
  text-align: center;
}

.user-login__icon {
  display: grid;
  width: 60px;
  height: 60px;
  margin-bottom: 4px;
  place-items: center;
  border-radius: 20px;
  color: var(--accent);
  background: var(--accent-soft);
}

.user-login__title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}

.user-login__desc {
  margin: 0 0 9px;
  color: var(--muted);
  font-size: 11px;
}

/* 资料头部 */
.user-hero {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 4px 18px 0;
  padding: 17px 15px;
  overflow: hidden;
  border: 1px solid rgba(56, 225, 198, 0.14);
  border-radius: 22px;
  background:
    radial-gradient(120% 160% at 0% 0%, rgba(56, 225, 198, 0.14), transparent 54%),
    radial-gradient(120% 140% at 100% 20%, rgba(75, 141, 255, 0.12), transparent 58%),
    #0f1826;
}

.user-hero__avatar {
  flex: 0 0 auto;
  width: 70px;
  height: 70px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 50%;
  background: var(--surface);
}

.user-hero__info {
  flex: 1;
  min-width: 0;
}

.user-hero__name {
  margin: 0;
  font-size: 19px;
  font-weight: 720;
  letter-spacing: -0.01em;
}

.user-hero__sign {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
}

.user-hero__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 7px;
  font-size: 9.5px;
}

.user-hero__id {
  color: rgba(255, 255, 255, 0.3);
  font-variant-numeric: tabular-nums;
}

.user-vip {
  padding: 0 5px;
  border-radius: 4px;
  color: #3a2600;
  font-size: 8px;
  font-weight: 800;
  line-height: 14px;
  background: linear-gradient(135deg, #ffd777, #f5a623);
}

.user-level-chip {
  padding: 0 6px;
  border-radius: 4px;
  color: var(--accent);
  font-size: 8.5px;
  font-weight: 700;
  line-height: 14px;
  background: var(--accent-soft);
}

.user-follow {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 7px 13px;
  border: 1px solid rgba(56, 225, 198, 0.3);
  border-radius: 999px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 650;
  background: var(--accent-soft);
}

.user-follow--active {
  border-color: var(--line);
  color: var(--muted);
  background: rgba(255, 255, 255, 0.04);
}

.user-follow:disabled {
  opacity: 0.6;
}

/* 统计 */
.user-stats {
  display: flex;
  align-items: center;
  margin: 12px 18px 0;
  padding: 12px 6px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.025);
}

.user-stats > div {
  flex: 1;
  text-align: center;
}

.user-stats > div + div {
  border-left: 1px solid rgba(255, 255, 255, 0.07);
}

.user-stats strong {
  display: block;
  color: var(--text);
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.user-stats span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.user-level {
  margin: 12px 18px 0;
}

.user-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin: 12px 18px 0;
}

.user-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 8px;
  border: 1px solid var(--line);
  border-radius: 13px;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 550;
  background: rgba(255, 255, 255, 0.03);
}

.user-actions button .muted {
  margin-left: auto;
}

/* 歌单 */
.user-playlist-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 14px;
  padding: 0 18px;
}

.user-playlist-grid :deep(.playlist-card) {
  width: 100%;
}

.user-inline-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 24px 0;
  color: var(--muted);
  font-size: 11px;
}

.user-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 0 18px;
  padding: 24px 16px;
  color: var(--muted);
  text-align: center;
}

.user-empty p {
  margin: 0;
  color: var(--text-2);
  font-size: 12.5px;
}

.user-empty span {
  font-size: 10.5px;
}

.user-song-count {
  font-size: 11px;
}

.user-song-list {
  padding: 0 6px;
}

.user-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  margin: 0 18px;
  padding: 26px 16px;
  color: var(--danger);
  text-align: center;
}

.user-error p {
  margin: 0;
  font-size: 11px;
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
