<script setup lang="ts">
/**
 * MV / 视频列表。
 *
 * 默认展示乐库视频流；顶部可以搜索 MV，搜索结果支持分页。
 */

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Clapperboard, Loader2, Play, Search, X } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import { fallback, getYueku, searchMvs, type Mv } from '@/api';
import { formatCount, formatDuration } from '@/utils/format';

defineOptions({ name: 'VideoListView' });

const router = useRouter();

const feed = ref<Mv[]>([]);
const results = ref<Mv[]>([]);
const loading = ref(true);
const searching = ref(false);
const loadingMore = ref(false);
const keyword = ref('');
const searched = ref('');
const page = ref(1);
const hasMore = ref(false);
const total = ref(0);

const source = (): Mv[] => (searched.value ? results.value : feed.value);

async function loadFeed(): Promise<void> {
  loading.value = true;
  try {
    const yueku = await fallback(getYueku, null);
    feed.value = yueku?.videos || [];
  } finally {
    loading.value = false;
  }
}

async function submitSearch(): Promise<void> {
  const value = keyword.value.trim();
  if (!value) {
    clearSearch();
    return;
  }
  searching.value = true;
  searched.value = value;
  page.value = 1;
  try {
    const result = await searchMvs(value, 1, 20);
    results.value = result.videos;
    total.value = result.total;
    hasMore.value = result.videos.length < result.total;
  } catch {
    results.value = [];
    hasMore.value = false;
  } finally {
    searching.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (!searched.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const next = await searchMvs(searched.value, page.value + 1, 20);
    page.value += 1;
    const seen = new Set(results.value.map((video) => video.id));
    results.value = [...results.value, ...next.videos.filter((video) => !seen.has(video.id))];
    hasMore.value = results.value.length < next.total;
  } catch {
    hasMore.value = false;
  } finally {
    loadingMore.value = false;
  }
}

function clearSearch(): void {
  keyword.value = '';
  searched.value = '';
  results.value = [];
  hasMore.value = false;
  total.value = 0;
}

function open(video: Mv): void {
  if (!video.id) return;
  router.push(`/video/${video.id}`);
}

onMounted(loadFeed);
</script>

<template>
  <div class="page video-page">
    <DetailHeader title="MV / 视频" />

    <form class="video-search" @submit.prevent="submitSearch">
      <Search :size="17" class="video-search__icon" />
      <input v-model="keyword" class="video-search__input" placeholder="搜索 MV、现场、翻唱" />
      <button v-if="keyword" type="button" class="video-search__clear" aria-label="清空" @click="clearSearch">
        <X :size="15" />
      </button>
      <button type="submit" class="video-search__submit" :disabled="searching">搜索</button>
    </form>

    <div class="section-head" style="margin-top: 18px">
      <h2 class="section-title">{{ searched ? `“${searched}” 的结果` : '乐库视频' }}</h2>
      <span class="muted" style="font-size: 11px">
        <template v-if="searched">{{ total }} 个</template>
        <template v-else>精选 MV</template>
      </span>
    </div>

    <div v-if="(loading || searching) && !source().length" class="video-grid">
      <div v-for="n in 4" :key="n" class="skeleton video-skeleton" />
    </div>

    <div v-else-if="source().length" class="video-grid">
      <button v-for="video in source()" :key="video.id" class="video-card" @click="open(video)">
        <span class="video-card__cover cover-frame">
          <CoverImage :src="video.cover" :alt="video.name" :icon-size="22" />
          <span class="video-card__shade" />
          <span class="video-card__play">
            <Play :size="17" fill="currentColor" :stroke-width="0" />
          </span>
          <span v-if="video.duration" class="video-card__duration">{{ formatDuration(video.duration) }}</span>
        </span>
        <span class="video-card__name clamp-2">{{ video.name }}</span>
        <span class="video-card__meta ellipsis">
          {{ video.artist }}
          <template v-if="video.playCount"> · {{ formatCount(video.playCount) }}</template>
        </span>
      </button>
    </div>

    <div v-else class="empty-state" style="padding-top: 50px">
      <div class="empty-state__icon"><Clapperboard :size="24" /></div>
      <p class="empty-state__title">{{ searched ? '没有找到相关视频' : '暂无视频' }}</p>
      <p class="empty-state__desc">{{ searched ? '换个关键词试试' : '稍后再来看看' }}</p>
    </div>

    <div v-if="searched && hasMore" class="load-more">
      <button class="btn btn--soft btn--block btn--sm" :disabled="loadingMore" @click="loadMore">
        <Loader2 v-if="loadingMore" :size="14" class="spin-icon" />
        {{ loadingMore ? '加载中' : '加载更多' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.video-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 18px 4px;
  padding: 8px 10px 8px 13px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}

.video-search__icon {
  color: var(--muted);
}

.video-search__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-size: 13px;
}

.video-search__input::placeholder {
  color: var(--muted);
}

.video-search__clear {
  display: grid;
  border: 0;
  background: none;
  color: var(--muted);
  place-items: center;
}

.video-search__submit {
  flex: 0 0 auto;
  padding: 5px 11px;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: #04241f;
  font-size: 11.5px;
  font-weight: 700;
}

.video-search__submit:disabled {
  opacity: 0.6;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px 11px;
  padding: 0 18px;
}

.video-skeleton {
  height: 150px;
  border-radius: 14px;
}

.video-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  text-align: left;
}

.video-card__cover {
  position: relative;
  width: 100%;
  height: 102px;
  border-radius: 13px;
}

.video-card__shade {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background: linear-gradient(180deg, transparent 55%, rgba(3, 7, 12, 0.58));
}

.video-card__play {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  display: grid;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
  background: rgba(4, 9, 15, 0.55);
  color: #fff;
  opacity: 0.92;
  transform: translate(-50%, -50%);
  backdrop-filter: blur(4px);
  place-items: center;
}

.video-card__duration {
  position: absolute;
  right: 6px;
  bottom: 5px;
  z-index: 2;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(3, 7, 12, 0.7);
  color: #fff;
  font-size: 9px;
}

.video-card__name {
  font-size: 12.5px;
  font-weight: 620;
  line-height: 1.35;
}

.video-card__meta {
  color: var(--muted);
  font-size: 10px;
}

.load-more {
  padding: 18px;
}
</style>
