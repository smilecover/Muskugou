<script setup lang="ts">
/**
 * 专辑详情。
 *
 * 专辑信息来自 `/album/detail`，歌曲来自 `/album/songs`；
 * 第一页同时请求两者，翻页时只追加歌曲。
 */

import { computed, onMounted, ref, watch } from 'vue';
import { MessageCircle, Play, Shuffle } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import CommentSheet from '@/components/CommentSheet.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import {
  getAlbumDetail,
  toErrorMessage,
  type Album,
  type Song,
} from '@/api';
import { formatDate } from '@/utils/format';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';

const props = defineProps<{ id: string }>();

const player = usePlayerStore();
const toast = useToastStore();

const album = ref<Album | null>(null);
const commentsOpen = ref(false);
const songs = ref<Song[]>([]);
const total = ref(0);
const page = ref(0);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref('');

let requestToken = 0;

const hasMore = computed(() => songs.value.length > 0 && songs.value.length < total.value);

const publishLabel = computed(() => {
  const raw = album.value?.publishTime?.trim();
  if (!raw) return '';
  if (/^\d+$/.test(raw)) return formatDate(Number(raw));
  return formatDate(raw).slice(0, 10);
});

async function loadInitial(): Promise<void> {
  const token = (requestToken += 1);
  loading.value = true;
  error.value = '';
  songs.value = [];
  total.value = 0;
  page.value = 0;
  album.value = null;

  try {
    const result = await getAlbumDetail(props.id, 1, 50);
    if (token !== requestToken) return;
    album.value = result.album;
    songs.value = result.songs;
    total.value = Math.max(result.total, result.album.songCount, result.songs.length);
    page.value = 1;
  } catch (err) {
    if (token !== requestToken) return;
    error.value = toErrorMessage(err);
    toast.error(error.value);
  } finally {
    if (token === requestToken) loading.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (loadingMore.value || loading.value || !hasMore.value) return;
  loadingMore.value = true;
  const token = requestToken;
  try {
    const result = await getAlbumDetail(props.id, page.value + 1, 50);
    if (token !== requestToken) return;
    const seen = new Set(songs.value.map((song) => song.id));
    songs.value = [...songs.value, ...result.songs.filter((song) => !seen.has(song.id))];
    page.value += 1;
    if (!result.songs.length) total.value = songs.value.length;
    else total.value = Math.max(result.total, songs.value.length);
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    loadingMore.value = false;
  }
}

function playAll(): void {
  if (!songs.value.length) return;
  void player.playSongs(songs.value, 0);
}

function shufflePlay(): void {
  if (!songs.value.length) return;
  player.setMode('shuffle');
  void player.playSongs(songs.value, Math.floor(Math.random() * songs.value.length));
}

watch(
  () => props.id,
  () => void loadInitial(),
);

onMounted(() => void loadInitial());
</script>

<template>
  <div class="page album-page">
    <DetailHeader :title="album?.name || '专辑'" />

    <template v-if="loading && !album">
      <div class="al-hero">
        <div class="skeleton al-cover-skeleton" />
        <div class="al-hero__info">
          <div class="skeleton sk-line sk-line--90" />
          <div class="skeleton sk-line sk-line--55" />
          <div class="skeleton sk-line sk-line--35" />
        </div>
      </div>
    </template>

    <template v-else-if="album || songs.length">
      <section class="al-hero">
        <div class="al-cover">
          <CoverImage :src="album?.cover" :alt="album?.name" :icon-size="30" />
        </div>
        <div class="al-hero__info">
          <p class="al-kind">ALBUM</p>
          <h1 class="al-name clamp-2">{{ album?.name || '专辑' }}</h1>
          <router-link
            v-if="album?.artistId"
            :to="{ name: 'artist', params: { id: album.artistId } }"
            class="al-artist ellipsis"
          >
            {{ album.artist }}
          </router-link>
          <p v-else class="al-artist ellipsis">{{ album?.artist || '未知歌手' }}</p>
          <p class="al-meta">
            <span>{{ total || songs.length }} 首</span>
            <template v-if="publishLabel"><span class="dot">·</span>{{ publishLabel }}</template>
          </p>
        </div>
      </section>

      <p v-if="album?.intro" class="al-intro clamp-2">{{ album.intro }}</p>

      <div class="al-actions">
        <button class="btn btn--primary al-play" :disabled="!songs.length" @click="playAll">
          <Play :size="18" fill="currentColor" :stroke-width="0" />
          播放全部
        </button>
        <button class="icon-btn al-shuffle" :disabled="!songs.length" aria-label="随机播放" @click="shufflePlay">
          <Shuffle :size="19" />
        </button>
        <button class="icon-btn al-comment" aria-label="专辑评论" @click="commentsOpen = true">
          <MessageCircle :size="19" />
        </button>
      </div>

      <div class="al-songs">
        <SongList
          :songs="songs"
          :loading="loading"
          show-index
          empty-title="这张专辑还没有歌曲"
          empty-desc="换一张专辑试试吧"
        />
      </div>

      <div v-if="!loading && hasMore" class="load-more">
        <button class="btn btn--soft btn--sm" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '加载中…' : '加载更多' }}
        </button>
      </div>
      <div v-else-if="!loading && songs.length" class="end-hint">已经到底了</div>
    </template>

    <div v-else class="empty-state">
      <p class="empty-state__title">{{ error ? '专辑加载失败' : '没有找到这张专辑' }}</p>
      <p class="empty-state__desc">{{ error || '专辑可能已下架或链接有误' }}</p>
      <button class="btn btn--soft btn--sm" style="margin-top: 8px" @click="loadInitial">重新加载</button>
    </div>

    <CommentSheet
      :open="commentsOpen"
      resource="album"
      :id="album?.id || id"
      :name="album?.name || '专辑'"
      @close="commentsOpen = false"
    />
  </div>
</template>

<style scoped>
.album-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.al-hero {
  display: flex;
  gap: 16px;
  padding: 10px 18px 0;
}

.al-hero__info {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}

.al-cover {
  flex: 0 0 auto;
  width: 118px;
  height: 118px;
  overflow: hidden;
  border-radius: 18px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.42);
}

.al-cover-skeleton {
  flex: 0 0 auto;
  width: 118px;
  height: 118px;
  border-radius: 18px;
}

.al-kind {
  margin: 0;
  color: var(--accent-2);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.2em;
}

.al-name {
  margin: 5px 0 0;
  font-size: 21px;
  font-weight: 750;
  line-height: 1.3;
  letter-spacing: -0.015em;
}

.al-artist {
  display: block;
  margin: 6px 0 0;
  color: var(--text-2);
  font-size: 12px;
}

a.al-artist {
  color: var(--accent);
}

.al-meta {
  display: flex;
  align-items: center;
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.dot {
  margin: 0 5px;
}

.al-intro {
  padding: 0 18px;
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.al-actions {
  display: flex;
  gap: 10px;
  padding: 18px 18px 10px;
}

.al-play {
  flex: 1;
  height: 48px;
}

.al-shuffle {
  width: 48px;
  height: 48px;
  color: #fff;
  background: rgba(75, 141, 255, 0.16);
}

.al-comment {
  width: 48px;
  height: 48px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
}

.al-songs {
  padding: 4px 6px 0;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 18px 0 8px;
}

.end-hint {
  padding: 20px 0 8px;
  color: rgba(255, 255, 255, 0.22);
  font-size: 11px;
  text-align: center;
}

.sk-line {
  height: 13px;
  margin-bottom: 9px;
}

.sk-line--90 {
  width: 90%;
}

.sk-line--55 {
  width: 55%;
}

.sk-line--35 {
  width: 35%;
}
</style>
