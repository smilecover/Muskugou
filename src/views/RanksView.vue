<script setup lang="ts">
/** 排行榜列表页。 */

import { onMounted, ref } from 'vue';
import { RefreshCw, Trophy } from 'lucide-vue-next';
import RankCard from '@/components/RankCard.vue';
import { getRankList, toErrorMessage, type Rank } from '@/api';
import { useToastStore } from '@/stores/toast';

defineOptions({ name: 'RanksView' });

const toast = useToastStore();

const ranks = ref<Rank[]>([]);
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    ranks.value = await getRankList();
  } catch (err) {
    error.value = toErrorMessage(err);
    toast.error(error.value);
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="page ranks-page">
    <header class="ranks-header">
      <div>
        <p class="ranks-eyebrow">CHARTS</p>
        <h1 class="ranks-title">排行榜</h1>
        <p class="ranks-sub">酷狗实时榜单，发现正在流行的声音</p>
      </div>
      <button class="icon-btn" aria-label="刷新" @click="load">
        <RefreshCw :size="18" :class="{ 'spin-icon': loading }" />
      </button>
    </header>

    <div v-if="loading" class="rank-grid">
      <div v-for="n in 6" :key="n" class="skeleton rank-skeleton" />
    </div>

    <div v-else-if="ranks.length" class="rank-grid">
      <RankCard v-for="rank in ranks" :key="`${rank.id}-${rank.rankCid}`" :rank="rank" />
    </div>

    <div v-else class="empty-state">
      <div class="empty-state__icon">
        <Trophy :size="24" :stroke-width="1.5" />
      </div>
      <p class="empty-state__title">{{ error ? '排行榜加载失败' : '暂时没有榜单' }}</p>
      <p class="empty-state__desc">{{ error || '请稍后重试' }}</p>
      <button class="btn btn--soft btn--sm" style="margin-top: 8px" @click="load">重新加载</button>
    </div>
  </div>
</template>

<style scoped>
.ranks-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.ranks-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: calc(18px + var(--safe-top)) 18px 16px;
}

.ranks-eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.24em;
}

.ranks-title {
  margin: 3px 0 0;
  font-size: 25px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.ranks-sub {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11.5px;
}

.spin-icon {
  animation: spin 0.9s linear infinite;
}

.rank-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px 14px;
  padding: 4px 18px 0;
}

.rank-grid :deep(.rank-card) {
  width: 100%;
}

.rank-skeleton {
  aspect-ratio: 0.78;
  border-radius: var(--radius-md);
}
</style>
