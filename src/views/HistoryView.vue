<script setup lang="ts">
/** 最近播放（本地保存，最多 100 首）。 */

import { useRouter } from 'vue-router';
import { History as HistoryIcon, Play, Shuffle, Trash2 } from 'lucide-vue-next';
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
  if (!library.history.length) return;
  void player.playSongs(library.history, 0);
}

function shufflePlay(): void {
  if (!library.history.length) return;
  player.setMode('shuffle');
  void player.playSongs(library.history, Math.floor(Math.random() * library.history.length));
}

function clearAll(): void {
  if (!library.history.length) return;
  if (!window.confirm('确定清空最近播放记录吗？')) return;
  library.clearHistory();
  toast.success('播放记录已清空');
}
</script>

<template>
  <div class="page history-page">
    <DetailHeader title="最近播放">
      <template #actions>
        <button
          v-if="library.history.length"
          class="icon-btn icon-btn--ghost"
          aria-label="清空播放记录"
          @click="clearAll"
        >
          <Trash2 :size="18" />
        </button>
      </template>
    </DetailHeader>

    <div class="collection-banner">
      <div class="collection-badge">
        <HistoryIcon :size="24" :stroke-width="1.8" />
      </div>
      <div class="collection-info">
        <h2>播放历史</h2>
        <p>{{ library.history.length }} 首 · 最多保留 100 首</p>
      </div>
    </div>

    <div v-if="library.history.length" class="collection-actions">
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
        :songs="library.history"
        show-cover
        :show-index="false"
        empty-title="还没有播放记录"
        empty-desc="听过的歌曲会自动记录在这里"
      />
    </div>

    <div v-if="!library.history.length" class="collection-empty-action">
      <button class="btn btn--soft btn--sm" @click="router.push('/')">去首页听歌</button>
    </div>
  </div>
</template>

<style scoped>
.history-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.collection-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 8px 18px 0;
  padding: 16px;
  border: 1px solid rgba(75, 141, 255, 0.16);
  border-radius: 20px;
  background:
    radial-gradient(120% 160% at 0% 0%, rgba(75, 141, 255, 0.15), transparent 55%),
    #0f1826;
}

.collection-badge {
  display: grid;
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 16px;
  color: var(--accent-2);
  background: rgba(75, 141, 255, 0.12);
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
  color: var(--accent-2);
  background: rgba(75, 141, 255, 0.14);
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
