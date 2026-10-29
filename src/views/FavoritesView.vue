<script setup lang="ts">
/** 我的收藏（本地保存，不依赖登录）。 */

import { useRouter } from 'vue-router';
import { Heart, Play, Shuffle, Trash2 } from 'lucide-vue-next';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';

const router = useRouter();
const library = useLibraryStore();
const player = usePlayerStore();
const toast = useToastStore();

function playAll(): void {
  if (!library.favorites.length) return;
  void player.playSongs(library.favorites, 0);
}

function shufflePlay(): void {
  if (!library.favorites.length) return;
  player.setMode('shuffle');
  void player.playSongs(library.favorites, Math.floor(Math.random() * library.favorites.length));
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
          v-if="library.favorites.length"
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
        <h2>喜欢的音乐</h2>
        <p>{{ library.favorites.length }} 首歌曲 · 保存在本机</p>
      </div>
    </div>

    <div v-if="library.favorites.length" class="collection-actions">
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
        :songs="library.favorites"
        show-cover
        :show-index="false"
        empty-title="还没有收藏歌曲"
        empty-desc="在歌曲右侧点一下爱心，就会出现在这里"
      />
    </div>

    <div v-if="!library.favorites.length" class="collection-empty-action">
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
