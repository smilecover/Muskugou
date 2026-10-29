<script setup lang="ts">
/** 专辑卡片。 */

import CoverImage from './CoverImage.vue';
import type { Album } from '@/api';

defineProps<{ album: Album }>();
</script>

<template>
  <router-link :to="{ name: 'album', params: { id: album.id } }" class="album-card">
    <div class="album-card__cover cover-frame">
      <CoverImage :src="album.cover" :alt="album.name" />
    </div>
    <p class="album-card__name clamp-2">{{ album.name }}</p>
    <p class="album-card__artist ellipsis">{{ album.artist || '未知歌手' }}</p>
  </router-link>
</template>

<style scoped>
.album-card {
  display: block;
  width: 146px;
}

.album-card__cover {
  width: 100%;
  aspect-ratio: 1;
}

.album-card__name {
  min-height: 37px;
  margin: 8px 0 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 550;
  line-height: 1.42;
}

.album-card__artist {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}
</style>
