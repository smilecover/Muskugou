<script setup lang="ts">
/** 主题音乐详情：主题介绍 + 歌曲列表。 */

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Play, Shuffle } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import { getThemeDetail, type ThemeDetail } from '@/api';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';

defineOptions({ name: 'ThemeDetailView' });

const route = useRoute();
const player = usePlayerStore();
const toast = useToastStore();

const detail = ref<ThemeDetail | null>(null);
const loading = ref(true);

const themeId = computed(() => String(route.params.id || ''));
const theme = computed(() => detail.value?.theme);
const songs = computed(() => detail.value?.songs || []);

async function load(): Promise<void> {
  loading.value = true;
  try {
    detail.value = await getThemeDetail(themeId.value);
    if (!detail.value.songs.length) toast.error('这个主题暂时没有歌曲');
  } catch {
    toast.error('主题详情加载失败');
  } finally {
    loading.value = false;
  }
}

/** 随机播放主题歌曲 */
function shufflePlay(): void {
  if (!songs.value.length) return;
  player.setMode('shuffle');
  void player.playSongs(songs.value, Math.floor(Math.random() * songs.value.length));
}

onMounted(load);
</script>

<template>
  <div class="page theme-detail">
    <DetailHeader :title="theme?.title || '主题音乐'" />

    <section v-if="theme" class="theme-hero">
      <div class="theme-hero__bg">
        <CoverImage :src="theme.detailPic || theme.cover" :alt="theme.title" />
      </div>
      <div class="theme-hero__content">
        <div class="theme-hero__cover cover-frame">
          <CoverImage :src="theme.cover" :alt="theme.title" />
        </div>
        <div class="theme-hero__info">
          <p class="theme-hero__eyebrow">{{ theme.tag || 'THEME' }}</p>
          <h1>{{ theme.title }}</h1>
          <p class="theme-hero__sub ellipsis">{{ theme.subtitle }}</p>
          <p class="theme-hero__intro clamp-2">{{ theme.intro }}</p>
        </div>
      </div>
      <div class="theme-hero__actions">
        <button class="btn btn--primary btn--sm" :disabled="!songs.length" @click="player.playSongs(songs, 0)">
          <Play :size="14" fill="currentColor" :stroke-width="0" />
          播放全部
        </button>
        <button class="btn btn--soft btn--sm" :disabled="!songs.length" @click="shufflePlay">
          <Shuffle :size="14" />
          随机播放
        </button>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">主题歌单</h2>
        <span class="muted" style="font-size: 11px">{{ songs.length }} 首</span>
      </div>
      <SongList
        :songs="songs"
        :loading="loading"
        empty-title="主题歌曲为空"
        empty-desc="换一个主题看看"
      />
    </section>
  </div>
</template>

<style scoped>
.theme-hero {
  position: relative;
  margin: 0 14px;
  padding: 18px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: #0c1420;
}

.theme-hero__bg {
  position: absolute;
  inset: 0;
  opacity: 0.24;
  filter: blur(18px) saturate(1.1);
  transform: scale(1.12);
}

.theme-hero__bg::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(7, 11, 18, 0.3), #0c1420 82%);
  content: '';
}

.theme-hero__content {
  position: relative;
  display: flex;
  gap: 14px;
}

.theme-hero__cover {
  flex: 0 0 104px;
  width: 104px;
  height: 104px;
  border-radius: 16px;
  box-shadow: var(--shadow-card);
}

.theme-hero__info {
  flex: 1;
  min-width: 0;
}

.theme-hero__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.theme-hero__info h1 {
  margin: 4px 0 2px;
  font-size: 21px;
  font-weight: 780;
  letter-spacing: -0.02em;
}

.theme-hero__sub {
  margin: 0;
  color: var(--text-2);
  font-size: 11.5px;
}

.theme-hero__intro {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.45;
}

.theme-hero__actions {
  position: relative;
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
</style>
