<script setup lang="ts">
/** 歌手卡片（圆形头像）。 */

import CoverImage from './CoverImage.vue';
import type { Artist } from '@/api';
import { formatCount } from '@/utils/format';

defineProps<{ artist: Artist; showFans?: boolean }>();
</script>

<template>
  <router-link :to="{ name: 'artist', params: { id: artist.id } }" class="artist-card">
    <div class="artist-card__avatar cover-frame">
      <CoverImage :src="artist.avatar" :alt="artist.name" :icon-size="24" />
    </div>
    <p class="artist-card__name ellipsis">{{ artist.name }}</p>
    <p v-if="showFans && artist.fans" class="artist-card__fans">{{ formatCount(artist.fans) }} 粉丝</p>
  </router-link>
</template>

<style scoped>
.artist-card {
  display: block;
  width: 88px;
  text-align: center;
}

.artist-card__avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
}

.artist-card__name {
  margin: 8px 0 0;
  color: var(--text);
  font-size: 12.5px;
  font-weight: 550;
}

.artist-card__fans {
  margin: 1px 0 0;
  color: var(--muted);
  font-size: 10px;
}
</style>
