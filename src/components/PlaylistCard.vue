<script setup lang="ts">
/** 歌单卡片（横向滚动 / 网格均可使用）。 */

import { Headphones, Play } from 'lucide-vue-next';
import CoverImage from './CoverImage.vue';
import type { Playlist } from '@/api';
import { formatCount } from '@/utils/format';

defineProps<{ playlist: Playlist }>();
</script>

<template>
  <router-link :to="{ name: 'playlist', params: { id: playlist.id } }" class="playlist-card">
    <div class="playlist-card__cover cover-frame">
      <CoverImage :src="playlist.cover" :alt="playlist.name" />
      <span class="playlist-card__count">
        <Headphones :size="11" />
        {{ formatCount(playlist.playCount) }}
      </span>
      <span class="playlist-card__play">
        <Play :size="14" fill="currentColor" :stroke-width="0" />
      </span>
    </div>
    <p class="playlist-card__name clamp-2">{{ playlist.name }}</p>
    <p v-if="playlist.creator" class="playlist-card__creator ellipsis">{{ playlist.creator }}</p>
  </router-link>
</template>

<style scoped>
.playlist-card {
  display: block;
  width: 150px;
}

.playlist-card__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
}

.playlist-card__count {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  background: rgba(0, 0, 0, 0.46);
  backdrop-filter: blur(8px);
}

.playlist-card__play {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  color: #05231f;
  background: rgba(56, 225, 198, 0.94);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.playlist-card__name {
  min-height: 38px;
  margin: 8px 0 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 550;
  line-height: 1.45;
}

.playlist-card__creator {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}
</style>
