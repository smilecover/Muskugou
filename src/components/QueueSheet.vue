<script setup lang="ts">
/**
 * 播放队列底部弹层。
 *
 * 支持跳转到任意一首、移除单曲和清空队列。弹层被 Teleport 到 body，
 * 避免被页面滚动容器裁剪。
 */

import { Play, X } from 'lucide-vue-next';
import CoverImage from './CoverImage.vue';
import { usePlayerStore } from '@/stores/player';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const player = usePlayerStore();

function jump(index: number): void {
  void player.jumpTo(index);
}

function remove(index: number, event: MouseEvent): void {
  event.stopPropagation();
  player.removeFromQueue(index);
  if (!player.queue.length) emit('close');
}

function clearAll(): void {
  player.clearQueue();
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="queue-root">
        <div class="sheet-mask" @click="emit('close')" />
        <section class="sheet queue-sheet">
          <div class="sheet__handle" />
          <header class="queue-head">
            <h2 class="sheet__title">
              播放队列
              <span class="queue-head__count">{{ player.queue.length }}</span>
            </h2>
            <button v-if="player.queue.length" class="text-btn text-btn--muted" @click="clearAll">
              清空
            </button>
          </header>

          <div v-if="player.queue.length" class="queue-list">
            <div
              v-for="(song, index) in player.queue"
              :key="`${song.id}-${index}`"
              class="queue-row"
              :class="{ 'queue-row--active': index === player.index }"
              @click="jump(index)"
            >
              <span class="queue-row__index">
                <Play v-if="index === player.index" :size="13" fill="currentColor" :stroke-width="0" />
                <span v-else>{{ index + 1 }}</span>
              </span>

              <div class="queue-row__cover">
                <CoverImage :src="song.cover" :alt="song.name" :icon-size="15" />
              </div>

              <div class="queue-row__info">
                <p class="queue-row__name ellipsis">{{ song.name }}</p>
                <p class="queue-row__artist ellipsis">{{ song.artist }}</p>
              </div>

              <button class="queue-row__remove" aria-label="从队列移除" @click="remove(index, $event)">
                <X :size="16" />
              </button>
            </div>
          </div>

          <div v-else class="empty-state" style="padding: 40px 0 24px">
            <p class="empty-state__title">队列是空的</p>
            <p class="empty-state__desc">去首页挑一首喜欢的歌吧</p>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.queue-sheet {
  display: flex;
  flex-direction: column;
}

.queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.queue-head .sheet__title {
  margin: 0;
}

.queue-head__count {
  margin-left: 4px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}

.queue-list {
  flex: 1;
  max-height: min(52vh, 460px);
  margin: 4px -6px;
  overflow-y: auto;
}

.queue-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 12px;
  cursor: pointer;
}

.queue-row:active {
  background: rgba(255, 255, 255, 0.05);
}

.queue-row--active .queue-row__name {
  color: var(--accent);
}

.queue-row__index {
  display: grid;
  flex: 0 0 auto;
  width: 20px;
  place-items: center;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.queue-row--active .queue-row__index {
  color: var(--accent);
}

.queue-row__cover {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 9px;
}

.queue-row__info {
  flex: 1;
  min-width: 0;
}

.queue-row__name {
  margin: 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 550;
}

.queue-row__artist {
  margin: 1px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.queue-row__remove {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
}

.queue-row__remove:active {
  color: var(--danger);
  background: rgba(255, 255, 255, 0.06);
}
</style>
