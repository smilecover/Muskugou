<script setup lang="ts">
/**
 * 我的收藏。
 *
 * 登录后展示酷狗账号的「我喜欢」歌单，爱心增删同步到云端；
 * 未登录（或云端同步失败）时使用本地收藏。
 */

import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Heart, Play, RefreshCw, Shuffle, Trash2 } from 'lucide-vue-next';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const library = useLibraryStore();
const player = usePlayerStore();
const toast = useToastStore();
const user = useUserStore();

const songs = computed(() => library.favorites);
const isCloud = computed(() => user.loggedIn);
const loading = computed(() => isCloud.value && library.likedLoading && !library.likedLoaded);
const cloudFailed = computed(
  () => isCloud.value && !library.cloudMode && Boolean(library.likedError),
);

onMounted(() => {
  if (isCloud.value) void library.loadLiked();
});

function playAll(): void {
  if (!songs.value.length) return;
  void player.playSongs(songs.value, 0);
}

function shufflePlay(): void {
  if (!songs.value.length) return;
  player.setMode('shuffle');
  void player.playSongs(songs.value, Math.floor(Math.random() * songs.value.length));
}

async function refresh(): Promise<void> {
  if (!isCloud.value) return;
  await library.loadLiked(undefined, true);
}

function clearAll(): void {
  if (!library.favorites.length) return;
  if (!window.confirm(`将移除全部 ${library.favorites.length} 首收藏，确定继续吗？`)) return;
  library.clearFavorites();
  toast.success('收藏已清空');
}
</script>

<template>
  <div class="page favorites-page">
    <DetailHeader title="我的收藏">
      <template #actions>
        <button
          v-if="isCloud"
          class="icon-btn icon-btn--ghost"
          :disabled="library.likedLoading"
          aria-label="重新同步我喜欢"
          @click="refresh"
        >
          <RefreshCw :size="18" :class="{ 'spin-icon': library.likedLoading }" />
        </button>
        <button
          v-if="!isCloud && library.favorites.length"
          class="icon-btn icon-btn--ghost"
          aria-label="清空收藏"
          @click="clearAll"
        >
          <Trash2 :size="18" />
        </button>
      </template>
    </DetailHeader>

    <div class="collection-banner">
      <div class="collection-badge">
        <Heart :size="24" fill="currentColor" :stroke-width="0" />
      </div>
      <div class="collection-info">
        <h2>{{ isCloud ? '我喜欢' : '喜欢的音乐' }}</h2>
        <p>
          {{ songs.length }} 首歌曲 ·
          {{ isCloud ? (library.cloudMode ? '同步自酷狗账号' : '本地收藏') : '保存在本机' }}
        </p>
      </div>
    </div>

    <div v-if="cloudFailed" class="collection-error panel">
      <p>{{ library.likedError }}</p>
      <button class="btn btn--soft btn--sm" :disabled="library.likedLoading" @click="refresh">
        重新同步
      </button>
    </div>

    <div v-if="songs.length" class="collection-actions">
      <button class="btn btn--primary collection-play" @click="playAll">
        <Play :size="18" fill="currentColor" :stroke-width="0" />
        播放全部
      </button>
      <button class="icon-btn collection-shuffle" aria-label="随机播放" @click="shufflePlay">
        <Shuffle :size="19" />
      </button>
    </div>

    <div class="collection-list">
      <SongList
        :songs="songs"
        :loading="loading"
        show-cover
        :show-index="false"
        :empty-title="isCloud ? '「我喜欢」还没有歌曲' : '还没有收藏歌曲'"
        :empty-desc="
          isCloud
            ? '在任意歌曲右侧点一下爱心，就会同步到这里'
            : '在歌曲右侧点一下爱心，就会出现在这里'
        "
      />
    </div>

    <div v-if="!songs.length && !loading" class="collection-empty-action">
      <button class="btn btn--soft btn--sm" @click="router.push('/')">去首页发现音乐</button>
    </div>
  </div>
</template>

<style scoped>
.favorites-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.collection-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 8px 18px 0;
  padding: 16px;
  border: 1px solid rgba(56, 225, 198, 0.14);
  border-radius: 20px;
  background:
    radial-gradient(120% 160% at 0% 0%, rgba(56, 225, 198, 0.14), transparent 55%),
    #0f1826;
}

.collection-badge {
  display: grid;
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 16px;
  color: var(--accent);
  background: rgba(56, 225, 198, 0.12);
}

.collection-info {
  min-width: 0;
}

.collection-info h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.collection-info p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.collection-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 12px 18px 0;
  padding: 12px 14px;
  border-color: rgba(255, 107, 107, 0.22);
  color: var(--danger);
  font-size: 11px;
}

.collection-error p {
  min-width: 0;
  margin: 0;
  line-height: 1.5;
  word-break: break-word;
}

.collection-actions {
  display: flex;
  gap: 10px;
  padding: 16px 18px 8px;
}

.collection-play {
  flex: 1;
  height: 46px;
}

.collection-shuffle {
  width: 46px;
  height: 46px;
  color: #04231f;
  background: rgba(56, 225, 198, 0.16);
}

.collection-list {
  padding: 2px 6px 0;
}

.collection-empty-action {
  display: flex;
  justify-content: center;
  padding: 0 18px;
}
</style>
