<script setup lang="ts">
/**
 * 底部迷你播放器。
 *
 * 点击主体进入播放页；播放/暂停、下一首可以直接在这里操作。
 * 顶部细线显示播放进度。
 */

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ListMusic, Pause, Play, SkipForward } from 'lucide-vue-next';
import CoverImage from './CoverImage.vue';
import { usePlayerStore } from '@/stores/player';

const route = useRoute();
const router = useRouter();
const player = usePlayerStore();

const hasTab = computed(() => Boolean(route.meta.tab));
const subtitle = computed(() => {
  const song = player.current;
  if (!song) return '';
  if (player.error) return `${song.artist} · 加载失败，点按重试`;
  if (player.preview) return `${song.artist} · 试听`;
  if (player.freeListen) return `${song.artist} · 概念版免费听`;
  return song.artist;
});

function openPlayer(): void {
  if (route.name !== 'player') router.push({ name: 'player' });
}

function togglePlay(event: MouseEvent): void {
  event.stopPropagation();
  void player.toggle();
}

function playNext(event: MouseEvent): void {
  event.stopPropagation();
  void player.next();
}

function openQueue(event: MouseEvent): void {
  event.stopPropagation();
  router.push({ name: 'player', query: { queue: '1' } });
}
</script>

<template>
  <div class="mini-shell" :class="{ 'mini-shell--tab': hasTab }">
    <div class="mini" @click="openPlayer">
      <div class="mini__progress">
        <div class="mini__progress-value" :style="{ width: `${player.progress * 100}%` }" />
      </div>

      <div class="mini__cover">
        <CoverImage :src="player.current?.cover" :alt="player.current?.name" :icon-size="18" />
      </div>

      <div class="mini__info">
        <p class="mini__name ellipsis">{{ player.current?.name }}</p>
        <p class="mini__artist ellipsis">{{ subtitle }}</p>
      </div>

      <button class="mini__btn mini__btn--play" :aria-label="player.playing ? '暂停' : '播放'" @click="togglePlay">
        <span v-if="player.loading" class="spinner spinner--mini" />
        <Pause v-else-if="player.playing" :size="19" fill="currentColor" :stroke-width="0" />
        <Play v-else :size="19" fill="currentColor" :stroke-width="0" />
      </button>

      <button class="mini__btn" aria-label="下一首" @click="playNext">
        <SkipForward :size="19" fill="currentColor" :stroke-width="1.6" />
      </button>

      <button class="mini__btn mini__btn--queue" aria-label="播放队列" @click="openQueue">
        <ListMusic :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.mini-shell {
  flex: 0 0 auto;
  padding: 6px 10px calc(8px + var(--safe-bottom));
}

.mini-shell--tab {
  padding-bottom: 6px;
}

.mini {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 62px;
  padding: 0 10px 0 8px;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 18px;
  background:
    linear-gradient(120deg, rgba(56, 225, 198, 0.08), transparent 42%),
    rgba(17, 26, 40, 0.96);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(24px);
  transition: transform 0.16s ease;
  cursor: pointer;
}

.mini:active {
  transform: scale(0.992);
}

.mini__progress {
  position: absolute;
  top: 0;
  right: 14px;
  left: 14px;
  height: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.mini__progress-value {
  height: 100%;
  border-radius: inherit;
  background: var(--accent-gradient);
  transition: width 0.25s linear;
}

.mini__cover {
  flex: 0 0 auto;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border-radius: 12px;
}

.mini__info {
  flex: 1;
  min-width: 0;
}

.mini__name {
  margin: 0;
  color: var(--text);
  font-size: 13.5px;
  font-weight: 650;
}

.mini__artist {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 11.5px;
}

.mini__btn {
  display: grid;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  color: var(--text-2);
  background: transparent;
}

.mini__btn:active {
  background: rgba(255, 255, 255, 0.08);
}

.mini__btn--play {
  width: 36px;
  height: 36px;
  color: #04231f;
  background: var(--accent);
}

.mini__btn--play:active {
  background: var(--accent-strong);
}

.mini__btn--queue {
  width: 30px;
  color: var(--muted);
}

.spinner--mini {
  width: 17px;
  height: 17px;
  border-color: rgba(4, 35, 31, 0.25);
  border-top-color: #04231f;
}

@media (max-width: 360px) {
  .mini__btn--queue {
    display: none;
  }
}
</style>
