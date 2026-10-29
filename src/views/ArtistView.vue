<script setup lang="ts">
/**
 * 歌手详情。
 *
 * 热门歌曲和专辑分别支持分页加载；歌手资料只请求一次。
 */

import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Play, Plus, Shuffle } from 'lucide-vue-next';
import AlbumCard from '@/components/AlbumCard.vue';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import {
  fallback,
  followArtist,
  getArtistAlbums,
  getArtistDetail,
  getArtistHonours,
  getArtistSongs,
  getArtistVideos,
  toErrorMessage,
  unfollowArtist,
  type Album,
  type Artist,
  type ArtistHonour,
  type Mv,
  type Song,
} from '@/api';
import { formatCount, formatDuration } from '@/utils/format';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

const props = defineProps<{ id: string }>();

const router = useRouter();
const player = usePlayerStore();
const toast = useToastStore();
const user = useUserStore();

const artist = ref<Artist | null>(null);
const videos = ref<Mv[]>([]);
const honours = ref<ArtistHonour[]>([]);
const following = ref(false);
const followPending = ref(false);
const songs = ref<Song[]>([]);
const albums = ref<Album[]>([]);
const songTotal = ref(0);
const albumTotal = ref(0);
const songPage = ref(0);
const albumPage = ref(0);
const loading = ref(true);
const loadingSongs = ref(false);
const loadingAlbums = ref(false);
const error = ref('');

let requestToken = 0;

const hasMoreSongs = computed(() => songs.value.length > 0 && songs.value.length < songTotal.value);
const hasMoreAlbums = computed(() => albums.value.length > 0 && albums.value.length < albumTotal.value);

async function loadInitial(): Promise<void> {
  const token = (requestToken += 1);
  loading.value = true;
  error.value = '';
  artist.value = null;
  songs.value = [];
  albums.value = [];
  videos.value = [];
  honours.value = [];
  following.value = false;
  songTotal.value = 0;
  albumTotal.value = 0;
  songPage.value = 0;
  albumPage.value = 0;

  // 扩展信息与歌手详情并行请求，失败时不影响主内容
  void loadVideos();
  void loadHonours();

  try {
    const result = await getArtistDetail(props.id, 1, 30);
    if (token !== requestToken) return;
    artist.value = result.artist;
    songs.value = result.songs;
    albums.value = result.albums;
    songTotal.value = Math.max(result.songTotal, result.songs.length);
    albumTotal.value = Math.max(result.albumTotal, result.albums.length);
    songPage.value = 1;
    albumPage.value = result.albums.length ? 1 : 0;
  } catch (err) {
    if (token !== requestToken) return;
    error.value = toErrorMessage(err);
    toast.error(error.value);
  } finally {
    if (token === requestToken) loading.value = false;
  }
}

/** 歌手关联 MV（/artist/videos），失败时静默忽略 */
async function loadVideos(): Promise<void> {
  const token = requestToken;
  const result = await fallback(() => getArtistVideos(props.id, 1, 12), { videos: [], total: 0 });
  if (token !== requestToken) return;
  videos.value = result.videos;
}

/** 歌手荣誉（/artist/honour） */
async function loadHonours(): Promise<void> {
  const token = requestToken;
  const result = await fallback(() => getArtistHonours(props.id), [] as ArtistHonour[]);
  if (token !== requestToken) return;
  honours.value = result;
}

async function loadMoreSongs(): Promise<void> {
  if (loadingSongs.value || !hasMoreSongs.value) return;
  loadingSongs.value = true;
  const token = requestToken;
  try {
    const result = await getArtistSongs(props.id, songPage.value + 1, 30);
    if (token !== requestToken) return;
    const seen = new Set(songs.value.map((song) => song.id));
    songs.value = [...songs.value, ...result.songs.filter((song) => !seen.has(song.id))];
    songPage.value += 1;
    if (!result.songs.length) songTotal.value = songs.value.length;
    else songTotal.value = Math.max(result.total, songs.value.length);
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    loadingSongs.value = false;
  }
}

async function loadMoreAlbums(): Promise<void> {
  if (loadingAlbums.value || !hasMoreAlbums.value) return;
  loadingAlbums.value = true;
  const token = requestToken;
  try {
    // 首屏已经从 getArtistDetail 带了第 1 页专辑，后续从第 2 页开始
    const nextPage = albumPage.value + 1;
    const result = await getArtistAlbums(props.id, nextPage, 12);
    if (token !== requestToken) return;
    const seen = new Set(albums.value.map((album) => album.id));
    albums.value = [...albums.value, ...result.albums.filter((album) => !seen.has(album.id))];
    albumPage.value = nextPage;
    if (!result.albums.length) {
      albumTotal.value = albums.value.length;
    } else if (result.albums.length < 12) {
      // 不足一页，说明已经是最后一页
      albumTotal.value = albums.value.length;
    } else if (result.total > 0) {
      albumTotal.value = Math.max(result.total, albums.value.length);
    } else {
      // 接口不返回总数时，保留歌手详情里的 album_count
      albumTotal.value = Math.max(albumTotal.value, albums.value.length + 1);
    }
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    loadingAlbums.value = false;
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

/** 关注 / 取关歌手；接口不返回关注状态，先按本地状态切换 */
async function toggleFollow(): Promise<void> {
  if (!user.loggedIn) {
    router.push('/login');
    return;
  }
  if (followPending.value) return;
  followPending.value = true;
  const next = !following.value;
  try {
    if (next) await followArtist(props.id);
    else await unfollowArtist(props.id);
    following.value = next;
    toast.success(next ? '已关注歌手' : '已取消关注');
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    followPending.value = false;
  }
}

function openVideo(video: Mv): void {
  if (!video.id) return;
  router.push(`/video/${video.id}`);
}

watch(
  () => props.id,
  () => void loadInitial(),
);

onMounted(() => void loadInitial());
</script>

<template>
  <div class="page artist-page">
    <DetailHeader :title="artist?.name || '歌手'" />

    <template v-if="loading && !artist">
      <div class="ar-hero">
        <div class="skeleton ar-avatar-skeleton" />
        <div class="ar-hero__info">
          <div class="skeleton sk-line sk-line--80" />
          <div class="skeleton sk-line sk-line--50" />
          <div class="skeleton sk-line sk-line--35" />
        </div>
      </div>
    </template>

    <template v-else-if="artist">
      <section class="ar-hero">
        <div class="ar-avatar">
          <CoverImage :src="artist.avatar" :alt="artist.name" :icon-size="32" />
        </div>
        <div class="ar-hero__info">
          <p class="ar-kind">ARTIST</p>
          <h1 class="ar-name ellipsis">{{ artist.name }}</h1>
          <p class="ar-meta">
            <template v-if="artist.fans"><span>{{ formatCount(artist.fans) }} 粉丝</span><span class="dot">·</span></template>
            <span>{{ songTotal || songs.length }} 首歌</span>
            <template v-if="albumTotal"><span class="dot">·</span><span>{{ albumTotal }} 张专辑</span></template>
          </p>
        </div>
      </section>

      <p v-if="artist.intro" class="ar-intro clamp-2">{{ artist.intro }}</p>

      <div v-if="honours.length" class="ar-honours">
        <span
          v-for="honour in honours.slice(0, 6)"
          :key="honour.id || honour.name"
          class="ar-honour"
          :title="honour.desc || honour.name"
        >
          {{ honour.name }}
        </span>
      </div>

      <div class="ar-actions">
        <button class="btn btn--primary ar-play" :disabled="!songs.length" @click="playAll">
          <Play :size="18" fill="currentColor" :stroke-width="0" />
          播放热门歌曲
        </button>
        <button class="icon-btn ar-shuffle" :disabled="!songs.length" aria-label="随机播放" @click="shufflePlay">
          <Shuffle :size="19" />
        </button>
        <button
          class="ar-follow"
          :class="{ 'ar-follow--on': following }"
          :disabled="followPending"
          @click="toggleFollow"
        >
          <Plus :size="15" :class="{ 'ar-follow__icon--rotate': following }" />
          {{ following ? '已关注' : '关注' }}
        </button>
      </div>

      <section class="section">
        <div class="section-head">
          <h2 class="section-title">热门歌曲</h2>
          <span class="muted ar-count">{{ songTotal || songs.length }} 首</span>
        </div>
        <div class="ar-songs">
          <SongList
            :songs="songs"
            :loading="loading"
            show-index
            empty-title="暂时没有歌曲"
            empty-desc="这位歌手的歌曲还没有上架"
          />
        </div>
        <div v-if="hasMoreSongs" class="load-more">
          <button class="btn btn--soft btn--sm" :disabled="loadingSongs" @click="loadMoreSongs">
            {{ loadingSongs ? '加载中…' : '加载更多歌曲' }}
          </button>
        </div>
      </section>

      <section v-if="albums.length" class="section">
        <div class="section-head">
          <h2 class="section-title">专辑</h2>
          <span class="muted ar-count">{{ albumTotal || albums.length }} 张</span>
        </div>
        <div class="album-grid">
          <AlbumCard v-for="album in albums" :key="album.id" :album="album" />
        </div>
        <div v-if="hasMoreAlbums" class="load-more">
          <button class="btn btn--soft btn--sm" :disabled="loadingAlbums" @click="loadMoreAlbums">
            {{ loadingAlbums ? '加载中…' : '加载更多专辑' }}
          </button>
        </div>
      </section>

      <section v-if="videos.length" class="section">
        <div class="section-head">
          <h2 class="section-title">MV</h2>
          <span class="muted ar-count">{{ videos.length }} 个</span>
        </div>
        <div class="ar-videos">
          <button v-for="video in videos" :key="video.id" class="ar-video" @click="openVideo(video)">
            <span class="ar-video__cover cover-frame">
              <CoverImage :src="video.cover" :alt="video.name" :icon-size="20" />
              <span class="ar-video__play">
                <Play :size="15" fill="currentColor" :stroke-width="0" />
              </span>
              <span v-if="video.duration" class="ar-video__duration">{{ formatDuration(video.duration) }}</span>
            </span>
            <span class="ar-video__name clamp-2">{{ video.name }}</span>
          </button>
        </div>
      </section>
    </template>

    <div v-else class="empty-state">
      <p class="empty-state__title">{{ error ? '歌手信息加载失败' : '没有找到这位歌手' }}</p>
      <p class="empty-state__desc">{{ error || '歌手可能已下架或链接有误' }}</p>
      <button class="btn btn--soft btn--sm" style="margin-top: 8px" @click="loadInitial">重新加载</button>
    </div>
  </div>
</template>

<style scoped>
.artist-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.ar-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 18px 0;
}

.ar-avatar {
  flex: 0 0 auto;
  width: 100px;
  height: 100px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4);
}

.ar-avatar-skeleton {
  flex: 0 0 auto;
  width: 100px;
  height: 100px;
  border-radius: 50%;
}

.ar-hero__info {
  flex: 1;
  min-width: 0;
}

.ar-kind {
  margin: 0;
  color: var(--accent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.22em;
}

.ar-name {
  margin: 5px 0 0;
  font-size: 24px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.ar-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.dot {
  margin: 0 5px;
}

.ar-intro {
  padding: 0 18px;
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

/* 歌手荣誉 */
.ar-honours {
  display: flex;
  gap: 6px;
  padding: 10px 18px 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.ar-honours::-webkit-scrollbar {
  display: none;
}

.ar-honour {
  flex: 0 0 auto;
  padding: 3px 9px;
  border: 1px solid rgba(245, 166, 35, 0.24);
  border-radius: 999px;
  color: #f5c465;
  font-size: 9.5px;
  background: rgba(245, 166, 35, 0.08);
}

.ar-actions {
  display: flex;
  gap: 10px;
  padding: 18px 18px 4px;
}

.ar-play {
  flex: 1;
  height: 46px;
}

.ar-shuffle {
  width: 46px;
  height: 46px;
  color: #04231f;
  background: rgba(56, 225, 198, 0.16);
}

.ar-follow {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  height: 46px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.03);
}

.ar-follow--on {
  border-color: rgba(56, 225, 198, 0.3);
  color: var(--accent);
  background: var(--accent-soft);
}

.ar-follow:disabled {
  opacity: 0.6;
}

.ar-follow__icon--rotate {
  transform: rotate(45deg);
}

.ar-count {
  font-size: 11px;
}

.ar-songs {
  padding: 0 6px;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 14px;
  padding: 0 18px;
}

.album-grid :deep(.album-card) {
  width: 100%;
}

/* 歌手 MV 横向列表 */
.ar-videos {
  display: flex;
  gap: 12px;
  padding: 0 18px 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.ar-videos::-webkit-scrollbar {
  display: none;
}

.ar-video {
  display: flex;
  flex: 0 0 140px;
  flex-direction: column;
  gap: 5px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  text-align: left;
}

.ar-video__cover {
  position: relative;
  width: 100%;
  height: 82px;
  border-radius: 12px;
}

.ar-video__play {
  position: absolute;
  right: 7px;
  bottom: 7px;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  color: #04231f;
  background: rgba(56, 225, 198, 0.94);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.ar-video__duration {
  position: absolute;
  left: 7px;
  bottom: 7px;
  padding: 1px 5px;
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  background: rgba(0, 0, 0, 0.55);
}

.ar-video__name {
  color: var(--text-2);
  font-size: 11.5px;
  line-height: 1.4;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 18px 0 8px;
}

.sk-line {
  height: 13px;
  margin-bottom: 9px;
}

.sk-line--80 {
  width: 80%;
}

.sk-line--50 {
  width: 50%;
}

.sk-line--35 {
  width: 35%;
}
</style>
