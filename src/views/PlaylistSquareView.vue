<script setup lang="ts">
/**
 * 歌单广场。
 *
 * 分类标签来自 /playlist/tags，歌单来自 /top/playlist。
 * 分类 id 直接作为 category_id 传给接口，0 表示全部推荐。
 */

import { onMounted, ref } from 'vue';
import { ListMusic, Loader2 } from 'lucide-vue-next';
import DetailHeader from '@/components/DetailHeader.vue';
import PlaylistCard from '@/components/PlaylistCard.vue';
import { fallback, getPlaylistSquare, getPlaylistTags, type Playlist, type PlaylistTagGroup } from '@/api';

defineOptions({ name: 'PlaylistSquareView' });

const PAGE_SIZE = 30;

const tagGroups = ref<PlaylistTagGroup[]>([]);
const activeTag = ref('0');
const playlists = ref<Playlist[]>([]);
const loading = ref(true);
const loadingMore = ref(false);
const hasMore = ref(true);
const page = ref(1);
const total = ref(0);

/** 分类标签按组展开后去重，直接用一长条横向滚动展示 */
function flattenTags(): { id: string; name: string }[] {
  const seen = new Set<string>();
  const tags: { id: string; name: string }[] = [];
  for (const group of tagGroups.value) {
    for (const tag of group.tags) {
      if (!tag.id || !tag.name || seen.has(tag.id)) continue;
      seen.add(tag.id);
      tags.push(tag);
    }
  }
  return tags;
}

const allTags = ref<{ id: string; name: string }[]>([]);

async function loadSquare(reset = true): Promise<void> {
  if (reset) {
    loading.value = true;
    page.value = 1;
    hasMore.value = true;
    playlists.value = [];
  } else {
    loadingMore.value = true;
  }
  try {
    const result = await getPlaylistSquare(Number(activeTag.value) || 0, page.value, PAGE_SIZE);
    playlists.value = reset
      ? result.playlists
      : [...playlists.value, ...result.playlists.filter((item) => !playlists.value.some((old) => old.id === item.id))];
    total.value = result.total;
    hasMore.value = result.hasMore && result.playlists.length > 0;
    if (result.playlists.length) page.value += 1;
  } catch {
    if (reset) {
      playlists.value = [];
      total.value = 0;
    }
    hasMore.value = false;
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function selectTag(id: string): Promise<void> {
  if (activeTag.value === id) return;
  activeTag.value = id;
  await loadSquare(true);
}

onMounted(async () => {
  const groups = await fallback(getPlaylistTags, [] as PlaylistTagGroup[]);
  tagGroups.value = groups;
  allTags.value = flattenTags();
  await loadSquare(true);
});
</script>

<template>
  <div class="page square-page">
    <DetailHeader title="歌单广场" />

    <div class="chip-row square-tags">
      <button class="chip" :class="{ 'chip--active': activeTag === '0' }" @click="selectTag('0')">推荐</button>
      <button
        v-for="tag in allTags"
        :key="tag.id"
        class="chip"
        :class="{ 'chip--active': activeTag === tag.id }"
        @click="selectTag(tag.id)"
      >
        {{ tag.name }}
      </button>
    </div>

    <div class="section-head square-count">
      <h2 class="section-title">精选歌单</h2>
      <span class="muted" style="font-size: 11px">
        共 {{ total || playlists.length }} 个
      </span>
    </div>

    <div v-if="loading && !playlists.length" class="playlist-grid">
      <div v-for="n in 6" :key="n" class="skeleton square-skeleton" />
    </div>

    <div v-else-if="playlists.length" class="playlist-grid">
      <PlaylistCard v-for="playlist in playlists" :key="playlist.id" :playlist="playlist" />
    </div>

    <div v-else class="empty-state" style="padding-top: 46px">
      <div class="empty-state__icon"><ListMusic :size="24" /></div>
      <p class="empty-state__title">这个分类还没有歌单</p>
      <p class="empty-state__desc">换一个分类看看</p>
    </div>

    <div v-if="playlists.length && hasMore" class="load-more">
      <button class="btn btn--soft btn--block btn--sm" :disabled="loadingMore" @click="loadSquare(false)">
        <Loader2 v-if="loadingMore" :size="14" class="spin-icon" />
        {{ loadingMore ? '加载中' : '加载更多' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.square-tags {
  padding: 2px 18px 14px;
}

.square-count {
  margin-top: 0;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 14px;
  padding: 0 18px;
}

.playlist-grid :deep(.playlist-card) {
  width: 100%;
}

.square-skeleton {
  height: 210px;
  border-radius: 16px;
}

.load-more {
  padding: 20px 18px 0;
}
</style>
