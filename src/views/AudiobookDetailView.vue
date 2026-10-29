<script setup lang="ts">
/**
 * 有声书详情。
 *
 * 章节可以像歌曲一样播放；播放器会保留章节顺序，方便连续听。
 */

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Loader2, Play, Shuffle } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import {
  getAudiobookChapters,
  getAudiobookDetail,
  type AudiobookDetail,
  type Chapter,
} from '@/api';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';
import { formatCount } from '@/utils/format';

defineOptions({ name: 'AudiobookDetailView' });

const route = useRoute();
const player = usePlayerStore();
const toast = useToastStore();

const albumId = computed(() => String(route.params.id || ''));
const detail = ref<AudiobookDetail | null>(null);
const chapters = ref<Chapter[]>([]);
const loading = ref(true);
const chaptersLoading = ref(false);
const loadingMore = ref(false);
const page = ref(1);
const hasMore = ref(true);
const expanded = ref(false);

const songs = computed(() => chapters.value.map((chapter) => chapter.song));

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [book, firstPage] = await Promise.all([
      getAudiobookDetail(albumId.value),
      getAudiobookChapters(albumId.value, 1, 50),
    ]);
    detail.value = book;
    chapters.value = firstPage.chapters;
    hasMore.value = firstPage.hasMore;
    page.value = 2;
  } catch {
    toast.error('有声书详情加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    const next = await getAudiobookChapters(albumId.value, page.value, 50);
    const seen = new Set(chapters.value.map((chapter) => chapter.id));
    chapters.value = [...chapters.value, ...next.chapters.filter((chapter) => !seen.has(chapter.id))];
    hasMore.value = next.hasMore;
    page.value += 1;
  } catch {
    toast.error('章节加载失败');
  } finally {
    loadingMore.value = false;
  }
}

function playAll(shuffle = false): void {
  if (!songs.value.length) {
    toast.error('章节还没有加载出来');
    return;
  }
  if (shuffle) {
    player.setMode('shuffle');
    void player.playSongs(songs.value, Math.floor(Math.random() * songs.value.length));
  } else {
    void player.playSongs(songs.value, 0);
  }
}

onMounted(load);
</script>

<template>
  <div class="page ab-detail">
    <DetailHeader :title="detail?.name || '有声书'" />

    <section v-if="detail" class="ab-hero">
      <div class="ab-hero__cover cover-frame">
        <CoverImage :src="detail.cover" :alt="detail.name" />
      </div>
      <div class="ab-hero__info">
        <h1 class="clamp-2">{{ detail.name }}</h1>
        <p class="ab-hero__author ellipsis">{{ detail.author || '佚名' }}</p>
        <p class="ab-hero__meta">
          <span v-if="detail.chapterCount">{{ detail.chapterCount }} 集</span>
          <span v-if="detail.playCount"> · {{ formatCount(detail.playCount) }} 次播放</span>
          <span v-if="detail.publishDate"> · {{ detail.publishDate.slice(0, 10) }}</span>
        </p>
        <div v-if="detail.tags.length" class="ab-hero__tags">
          <span v-for="tag in detail.tags.slice(0, 3)" :key="tag" class="ab-hero__tag">{{ tag }}</span>
        </div>
      </div>
    </section>

    <div v-if="detail?.description" class="ab-desc" :class="{ 'ab-desc--expanded': expanded }">
      <p>{{ detail.description }}</p>
      <button class="text-btn text-btn--muted" @click="expanded = !expanded">
        {{ expanded ? '收起' : '展开简介' }}
      </button>
    </div>

    <div class="ab-actions">
      <button class="btn btn--primary" :disabled="!songs.length" @click="playAll(false)">
        <Play :size="15" fill="currentColor" :stroke-width="0" />
        播放全部
      </button>
      <button class="btn btn--soft" :disabled="!songs.length" @click="playAll(true)">
        <Shuffle :size="15" />
        随机
      </button>
    </div>

    <section class="section">
      <div class="section-head">
        <h2 class="section-title">章节列表</h2>
        <span class="muted" style="font-size: 11px">{{ chapters.length }} 集</span>
      </div>

      <SongList
        :songs="songs"
        :loading="loading || chaptersLoading"
        empty-title="暂无章节"
        empty-desc="这本书可能还在更新"
      />

      <div v-if="songs.length && hasMore" class="load-more">
        <button class="btn btn--soft btn--block btn--sm" :disabled="loadingMore" @click="loadMore">
          <Loader2 v-if="loadingMore" :size="14" class="spin-icon" />
          {{ loadingMore ? '加载中' : '加载更多章节' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ab-hero {
  display: flex;
  gap: 15px;
  padding: 6px 18px 0;
}

.ab-hero__cover {
  flex: 0 0 118px;
  width: 118px;
  height: 158px;
  border-radius: 14px;
  box-shadow: var(--shadow-card);
}

.ab-hero__info {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}

.ab-hero__info h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 760;
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.ab-hero__author {
  margin: 7px 0 0;
  color: var(--text-2);
  font-size: 12.5px;
}

.ab-hero__meta {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.ab-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 9px;
}

.ab-hero__tag {
  padding: 2px 7px;
  border-radius: 5px;
  background: rgba(56, 225, 198, 0.1);
  color: var(--accent);
  font-size: 9.5px;
}

.ab-desc {
  position: relative;
  max-height: 52px;
  margin: 14px 18px 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.55;
}

.ab-desc p {
  margin: 0;
}

.ab-desc::after {
  position: absolute;
  inset: auto 0 0;
  height: 26px;
  background: linear-gradient(180deg, transparent, var(--bg));
  content: '';
}

.ab-desc--expanded {
  max-height: none;
}

.ab-desc--expanded::after {
  display: none;
}

.ab-desc .text-btn {
  margin-top: 4px;
  padding: 0;
  font-size: 11px;
}

.ab-actions {
  display: flex;
  gap: 10px;
  padding: 16px 18px 0;
}

.ab-actions .btn {
  flex: 1;
}

.load-more {
  padding: 14px 18px 0;
}
</style>
