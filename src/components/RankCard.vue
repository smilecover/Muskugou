<script setup lang="ts">
/** 排行榜卡片。 */

import { TrendingUp } from 'lucide-vue-next';
import CoverImage from './CoverImage.vue';
import type { Rank } from '@/api';

defineProps<{ rank: Rank }>();
</script>

<template>
  <router-link
    :to="{ name: 'rank-detail', params: { id: rank.id }, query: rank.rankCid ? { cid: rank.rankCid } : {} }"
    class="rank-card"
  >
    <div class="rank-card__cover cover-frame">
      <CoverImage :src="rank.cover" :alt="rank.name" />
      <div class="rank-card__shade" />
      <svg class="rank-card__wave" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 26 L14 18 L28 22 L42 10 L56 16 L70 6 L84 13 L98 5 L120 12" fill="none" stroke="rgba(56,225,198,.75)" stroke-width="2" />
      </svg>
      <span class="rank-card__badge">
        <TrendingUp :size="11" />
        榜单
      </span>
    </div>
    <p class="rank-card__name ellipsis">{{ rank.name }}</p>
    <p v-if="rank.updateFrequency" class="rank-card__update ellipsis">{{ rank.updateFrequency }}</p>
  </router-link>
</template>

<style scoped>
.rank-card {
  display: block;
  width: 144px;
}

.rank-card__cover {
  width: 100%;
  aspect-ratio: 1;
}

.rank-card__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 35%, rgba(4, 8, 14, 0.78) 100%);
}

.rank-card__wave {
  position: absolute;
  right: 0;
  bottom: 8px;
  left: 0;
  width: 100%;
  height: 30px;
  opacity: 0.9;
}

.rank-card__badge {
  position: absolute;
  top: 8px;
  left: 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--accent);
  font-size: 9px;
  background: rgba(4, 8, 14, 0.55);
  backdrop-filter: blur(8px);
}

.rank-card__name {
  margin: 8px 0 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.rank-card__update {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 10px;
}
</style>
