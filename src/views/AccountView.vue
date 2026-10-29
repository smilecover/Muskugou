<script setup lang="ts">
/**
 * 账号页。
 *
 * 展示当前概念版账号的资料、会员状态，以及关注、粉丝、已购单曲/专辑。
 * 酷狗只允许读取当前登录账号的资料，因此未登录时全部引导到扫码登录。
 */

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  ChevronRight,
  Crown,
  Gift,
  Loader2,
  LogIn,
  LogOut,
  Settings,
  UserRound,
} from 'lucide-vue-next';
import AlbumCard from '@/components/AlbumCard.vue';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import {
  followUser,
  getFans,
  getFollowedUsers,
  getFriends,
  getPurchasedAlbums,
  getPurchasedSongs,
  getVisitors,
  toErrorMessage,
  unfollowUser,
  type Album,
  type PublicUser,
  type Song,
} from '@/api';
import { useMembershipStore } from '@/stores/membership';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

defineOptions({ name: 'AccountView' });

type AccountTab = 'following' | 'fans' | 'friends' | 'visitors' | 'songs' | 'albums';

const tabs: { key: AccountTab; label: string }[] = [
  { key: 'following', label: '关注' },
  { key: 'fans', label: '粉丝' },
  { key: 'friends', label: '好友' },
  { key: 'visitors', label: '访客' },
  { key: 'songs', label: '已购单曲' },
  { key: 'albums', label: '已购专辑' },
];

const router = useRouter();
const user = useUserStore();
const membership = useMembershipStore();
const toast = useToastStore();

const tab = ref<AccountTab>('following');
const following = ref<PublicUser[]>([]);
const fans = ref<PublicUser[]>([]);
const friends = ref<PublicUser[]>([]);
const visitors = ref<PublicUser[]>([]);
const purchasedSongs = ref<Song[]>([]);
const purchasedAlbums = ref<Album[]>([]);
const tabLoading = ref(false);
const tabError = ref('');

/** 本次会话中已关注的用户 id，用于切换按钮状态 */
const followedIds = ref<string[]>([]);
const followPending = ref<string[]>([]);

const loaded = reactive<Record<AccountTab, boolean>>({
  following: false,
  fans: false,
  friends: false,
  visitors: false,
  songs: false,
  albums: false,
});

/** 当前 tab 对应的人物列表 */
const people = computed<PublicUser[]>(() => {
  if (tab.value === 'following') return following.value;
  if (tab.value === 'fans') return fans.value;
  if (tab.value === 'friends') return friends.value;
  if (tab.value === 'visitors') return visitors.value;
  return [];
});

const peopleEmpty = computed(() => {
  const map: Record<string, string> = {
    following: '还没有关注的人',
    fans: '还没有粉丝',
    friends: '还没有好友',
    visitors: '最近还没有访客',
  };
  return map[tab.value] || '这里还是空的';
});

const profile = computed(() => user.profile);
const fanCount = computed(() => profile.value?.fans || fans.value.length);
const followCount = computed(() => profile.value?.follows || following.value.length);

async function loadTab(key: AccountTab, force = false): Promise<void> {
  if (!user.loggedIn) return;
  if (loaded[key] && !force) return;

  tabLoading.value = true;
  tabError.value = '';
  try {
    if (key === 'following') following.value = await getFollowedUsers();
    else if (key === 'fans') fans.value = await getFans();
    else if (key === 'friends') friends.value = await getFriends();
    else if (key === 'visitors') visitors.value = await getVisitors(1, 30);
    else if (key === 'songs') purchasedSongs.value = (await getPurchasedSongs(1, 50)).songs;
    else purchasedAlbums.value = (await getPurchasedAlbums(1, 30)).albums;
    loaded[key] = true;
  } catch (err) {
    tabError.value = toErrorMessage(err);
  } finally {
    tabLoading.value = false;
  }
}

watch(tab, (value) => void loadTab(value));

/** 关注用户（粉丝 / 访客列表） */
async function follow(person: PublicUser): Promise<void> {
  if (!person.id || followPending.value.includes(person.id)) return;
  followPending.value = [...followPending.value, person.id];
  try {
    await followUser(person.id);
    followedIds.value = [...followedIds.value, person.id];
    toast.success(`已关注 ${person.name}`);
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    followPending.value = followPending.value.filter((id) => id !== person.id);
  }
}

/** 取关用户（关注列表） */
async function unfollow(person: PublicUser): Promise<void> {
  if (!person.id || followPending.value.includes(person.id)) return;
  followPending.value = [...followPending.value, person.id];
  try {
    await unfollowUser(person.id);
    following.value = following.value.filter((item) => item.id !== person.id);
    toast.success(`已取消关注 ${person.name}`);
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    followPending.value = followPending.value.filter((id) => id !== person.id);
  }
}

async function claimVip(): Promise<void> {
  if (!user.loggedIn) {
    router.push('/login');
    return;
  }
  await membership.manualClaim();
}

function logout(): void {
  if (!window.confirm('确定要退出当前酷狗账号吗？')) return;
  user.logout();
  following.value = [];
  fans.value = [];
  friends.value = [];
  visitors.value = [];
  purchasedSongs.value = [];
  purchasedAlbums.value = [];
  followedIds.value = [];
  (Object.keys(loaded) as AccountTab[]).forEach((key) => {
    loaded[key] = false;
  });
  toast.success('已退出登录');
}

onMounted(async () => {
  if (!user.loggedIn) return;
  if (!user.profile) await user.refresh().catch(() => null);
  if (!membership.loaded) void membership.refresh();
  await loadTab(tab.value);
});
</script>

<template>
  <div class="page account-page">
    <DetailHeader title="账号">
      <template #actions>
        <router-link to="/settings" class="icon-btn icon-btn--ghost" aria-label="设置">
          <Settings :size="19" />
        </router-link>
      </template>
    </DetailHeader>

    <section v-if="!user.loggedIn" class="account-login panel">
      <span class="account-login__icon"><UserRound :size="26" :stroke-width="1.6" /></span>
      <p class="account-login__title">还没有登录</p>
      <p class="account-login__desc">扫码登录后可以查看关注、粉丝与已购内容</p>
      <button class="btn btn--primary btn--sm" @click="router.push('/login')">
        <LogIn :size="14" />
        去登录
      </button>
    </section>

    <template v-else>
      <!-- 资料 -->
      <section class="account-hero">
        <div class="account-hero__avatar">
          <CoverImage :src="user.avatar" :alt="user.nickname" :icon-size="26" />
        </div>
        <div class="account-hero__info">
          <p class="account-hero__name ellipsis">{{ user.nickname }}</p>
          <p class="account-hero__sub ellipsis">
            {{ profile?.signature || '酷狗概念版用户' }}
          </p>
          <div class="account-hero__stats">
            <span><strong>{{ followCount }}</strong> 关注</span>
            <span><strong>{{ fanCount }}</strong> 粉丝</span>
            <span v-if="profile?.userid" class="account-hero__id">ID {{ profile.userid }}</span>
          </div>
        </div>
      </section>

      <!-- 会员 -->
      <section class="account-vip">
        <span class="account-vip__icon"><Crown :size="19" /></span>
        <div class="account-vip__info">
          <p>概念版 VIP <span v-if="membership.vipActive" class="vip-badge">生效中</span></p>
          <span>{{ membership.statusText }}</span>
        </div>
        <button
          class="account-vip__action"
          :disabled="membership.claiming || !membership.canClaim"
          @click="claimVip"
        >
          <Loader2 v-if="membership.claiming" :size="13" class="spin-icon" />
          <template v-else>{{ membership.actionText }}</template>
        </button>
      </section>

      <p class="account-vip__foot">
        <Gift :size="12" />
        {{ membership.autoStatusText }}
      </p>

      <!-- 内容分区 -->
      <div class="segmented account-tabs account-tabs--scroll">
        <button
          v-for="item in tabs"
          :key="item.key"
          class="segmented__item"
          :class="{ 'segmented__item--active': tab === item.key }"
          @click="tab = item.key"
        >
          {{ item.label }}
        </button>
      </div>

      <div v-if="tabLoading" class="account-loading">
        <Loader2 :size="18" class="spin-icon" />
        正在加载
      </div>

      <div v-else-if="tabError" class="account-error">
        <p>{{ tabError }}</p>
        <button class="btn btn--soft btn--sm" @click="loadTab(tab, true)">重新加载</button>
      </div>

      <template v-else>
        <!-- 关注 / 粉丝 / 好友 / 访客 -->
        <div v-if="tab !== 'songs' && tab !== 'albums'" class="user-list">
          <div v-for="person in people" :key="person.id" class="user-row">
            <div class="user-row__avatar">
              <CoverImage :src="person.avatar" :alt="person.name" :icon-size="20" />
            </div>
            <div class="user-row__info">
              <p class="user-row__name ellipsis">{{ person.name }}</p>
              <p class="user-row__sign ellipsis">{{ person.signature || '这个人很神秘' }}</p>
            </div>
            <button
              v-if="tab === 'following'"
              class="user-row__action"
              :disabled="followPending.includes(person.id)"
              @click="unfollow(person)"
            >
              取关
            </button>
            <button
              v-else-if="tab === 'fans' || tab === 'visitors'"
              class="user-row__action user-row__action--follow"
              :disabled="followPending.includes(person.id) || followedIds.includes(person.id)"
              @click="follow(person)"
            >
              {{ followedIds.includes(person.id) ? '已关注' : '关注' }}
            </button>
            <ChevronRight v-else :size="16" class="muted" />
          </div>

          <div v-if="!people.length" class="empty-state" style="padding-top: 34px">
            <p class="empty-state__title">{{ peopleEmpty }}</p>
            <p class="empty-state__desc">去酷狗音乐 App 逛逛吧</p>
          </div>
        </div>

        <!-- 已购单曲 -->
        <SongList
          v-else-if="tab === 'songs'"
          :songs="purchasedSongs"
          show-cover
          empty-title="还没有购买单曲"
          empty-desc="在酷狗购买的数字单曲会显示在这里"
        />

        <!-- 已购专辑 -->
        <div v-else>
          <div v-if="purchasedAlbums.length" class="album-grid">
            <AlbumCard v-for="album in purchasedAlbums" :key="album.id" :album="album" />
          </div>
          <div v-else class="empty-state" style="padding-top: 34px">
            <p class="empty-state__title">还没有购买专辑</p>
            <p class="empty-state__desc">购买的数字专辑会显示在这里</p>
          </div>
        </div>
      </template>

      <button class="account-logout" @click="logout">
        <LogOut :size="16" />
        退出登录
      </button>
    </template>
  </div>
</template>

<style scoped>
.account-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: 24px 18px 0;
  padding: 30px 18px;
  text-align: center;
}

.account-login__icon {
  display: grid;
  width: 60px;
  height: 60px;
  margin-bottom: 4px;
  place-items: center;
  border-radius: 20px;
  color: var(--accent);
  background: var(--accent-soft);
}

.account-login__title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}

.account-login__desc {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 11px;
}

.account-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 18px 16px;
}

.account-hero__avatar {
  flex: 0 0 auto;
  width: 68px;
  height: 68px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  background: var(--surface);
}

.account-hero__info {
  flex: 1;
  min-width: 0;
}

.account-hero__name {
  margin: 0;
  font-size: 19px;
  font-weight: 720;
}

.account-hero__sub {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 11px;
}

.account-hero__stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
  color: var(--muted);
  font-size: 10.5px;
}

.account-hero__stats strong {
  margin-right: 2px;
  color: var(--text-2);
  font-size: 12.5px;
  font-weight: 650;
}

.account-hero__id {
  color: rgba(255, 255, 255, 0.28);
}

.account-vip {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 0 18px;
  padding: 12px 14px;
  border: 1px solid rgba(245, 166, 35, 0.2);
  border-radius: 18px;
  background:
    radial-gradient(140% 160% at 100% 0%, rgba(245, 166, 35, 0.12), transparent 62%),
    rgba(255, 255, 255, 0.025);
}

.account-vip__icon {
  display: grid;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  color: #3a2600;
  background: linear-gradient(135deg, #ffd777, #f5a623);
}

.account-vip__info {
  flex: 1;
  min-width: 0;
}

.account-vip__info p {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-size: 13px;
  font-weight: 640;
}

.account-vip__info > span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 9.5px;
}

.vip-badge {
  padding: 0 5px;
  border-radius: 4px;
  color: #3a2600;
  font-size: 8px;
  font-weight: 800;
  line-height: 14px;
  background: linear-gradient(135deg, #ffd777, #f5a623);
}

.account-vip__action {
  flex: 0 0 auto;
  padding: 6px 12px;
  border-radius: 999px;
  color: #3a2600;
  font-size: 10.5px;
  font-weight: 700;
  background: linear-gradient(135deg, #ffd777, #f5a623);
}

.account-vip__foot {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 7px 22px 0;
  color: var(--muted);
  font-size: 9.5px;
}

.account-vip__foot svg {
  color: #f5a623;
}

.account-tabs {
  margin: 18px 18px 14px;
}

/* 六个分区在窄屏上横向滚动，避免文字被压缩 */
.account-tabs--scroll {
  overflow-x: auto;
  scrollbar-width: none;
}

.account-tabs--scroll::-webkit-scrollbar {
  display: none;
}

.account-tabs--scroll .segmented__item {
  flex: 0 0 auto;
  padding: 7px 12px;
}

.account-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px 0;
  color: var(--muted);
  font-size: 11.5px;
}

.account-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 18px;
  color: var(--danger);
  font-size: 11.5px;
}

.account-error p {
  margin: 0;
}

.user-list {
  padding: 0 12px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 6px;
  border-radius: 14px;
}

.user-row__avatar {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--surface);
}

.user-row__info {
  flex: 1;
  min-width: 0;
}

.user-row__name {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.user-row__sign {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.user-row__action {
  flex: 0 0 auto;
  padding: 5px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.03);
}

.user-row__action--follow {
  border-color: rgba(56, 225, 198, 0.3);
  color: var(--accent);
  background: var(--accent-soft);
}

.user-row__action:disabled {
  opacity: 0.55;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px 10px;
  padding: 0 18px;
}

.album-grid :deep(.album-card) {
  width: 100%;
}

.account-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: calc(100% - 36px);
  margin: 28px 18px 0;
  padding: 12px;
  border: 1px solid rgba(255, 99, 119, 0.2);
  border-radius: 14px;
  color: var(--danger);
  font-size: 12.5px;
  font-weight: 600;
  background: rgba(255, 99, 119, 0.05);
}
</style>
