<script setup lang="ts">
/** 主题音乐列表：按心情 / 风格策展的歌单。 */

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Palette, RefreshCw } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import { getThemes, type Theme } from '@/api';

defineOptions({ name: 'ThemeListView' });

const router = useRouter();
const themes = ref<Theme[]>([]);
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    themes.value = await getThemes();
  } catch {
    error.value = '主题音乐加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page theme-page">
    <DetailHeader title="主题音乐">
      <template #actions>
        <button class="icon-btn icon-btn--ghost" aria-label="刷新" @click="load">
          <RefreshCw :size="18" />
        </button>
      </template>
    </DetailHeader>

    <p class="theme-intro">按心情与风格策展，给每个场景一首歌。</p>

    <div v-if="loading" class="theme-grid">
      <div v-for="n in 6" :key="n" class="skeleton theme-skeleton" />
    </div>

    <div v-else-if="themes.length" class="theme-grid">
      <button
        v-for="theme in themes"
        :key="theme.id"
        class="theme-tile"
        :style="{ '--theme-color': theme.titleColor }"
        @click="router.push(`/themes/${theme.id}`)"
      >
        <span class="theme-tile__cover cover-frame">
          <CoverImage :src="theme.cover" :alt="theme.title" />
          <span class="theme-tile__shade" />
          <span class="theme-tile__title">{{ theme.title }}</span>
          <span class="theme-tile__tag">{{ theme.tag || theme.subtitle }}</span>
        </span>
        <span class="theme-tile__sub ellipsis">{{ theme.intro || theme.subtitle }}</span>
      </button>
    </div>

    <div v-else class="empty-state" style="padding-top: 60px">
      <div class="empty-state__icon"><Palette :size="24" /></div>
      <p class="empty-state__title">{{ error || '暂无主题' }}</p>
      <p class="empty-state__desc">稍后刷新看看</p>
    </div>
  </div>
</template>

<style scoped>
.theme-intro {
  margin: 2px 18px 14px;
  color: var(--muted);
  font-size: 12px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 0 18px;
}

.theme-skeleton {
  height: 150px;
  border-radius: 18px;
}

.theme-tile {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  text-align: left;
}

.theme-tile__cover {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  width: 100%;
  height: 132px;
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
}

.theme-tile__shade {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(4, 8, 14, 0.02) 30%, rgba(4, 8, 14, 0.82));
}

.theme-tile__title {
  position: relative;
  z-index: 2;
  padding: 0 11px;
  font-size: 15px;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.theme-tile__tag {
  position: relative;
  z-index: 2;
  padding: 1px 11px 9px;
  color: color-mix(in srgb, var(--theme-color) 75%, #fff);
  font-size: 9.5px;
}

.theme-tile__sub {
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.35;
}
</style>
