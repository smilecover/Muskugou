<script setup lang="ts">
/**
 * 搜索页。
 *
 * 一次提交会并行请求单曲/歌单/专辑/歌手四种类型，切换 tab 不需要重新请求；
 * 某一类型失败不会清空其它类型的结果。
 */

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Clapperboard, Flame, Play, Search, Sparkles, X } from 'lucide-vue-next';
import AlbumCard from '@/components/AlbumCard.vue';
import ArtistCard from '@/components/ArtistCard.vue';
import CoverImage from '@/components/CoverImage.vue';
import PlaylistCard from '@/components/PlaylistCard.vue';
import SongList from '@/components/SongList.vue';
import {
  getHotSearches,
  getSearchSuggestions,
  searchAlbums,
  searchArtists,
  searchLyrics,
  searchMvs,
  searchPlaylists,
  searchSongs,
  toErrorMessage,
  type Album,
  type Artist,
  type LyricSearchItem,
  type Mv,
  type Playlist,
  type Song,
} from '@/api';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import { useToastStore } from '@/stores/toast';
import { formatDuration } from '@/utils/format';

defineOptions({ name: 'SearchView' });

type SearchType = 'song' | 'playlist' | 'album' | 'artist' | 'mv' | 'lyric';

const PAGE_SIZE = 30;

const tabs: { key: SearchType; label: string }[] = [
  { key: 'song', label: '单曲' },
  { key: 'playlist', label: '歌单' },
  { key: 'album', label: '专辑' },
  { key: 'artist', label: '歌手' },
  { key: 'mv', label: 'MV' },
  { key: 'lyric', label: '歌词' },
];

const router = useRouter();
const library = useLibraryStore();
const player = usePlayerStore();
const settings = useSettingsStore();
const toast = useToastStore();

const keyword = ref('');
const submitted = ref('');
const activeType = ref<SearchType>('song');
const loading = ref(false);
const loadingMore = ref(false);
const hot = ref<string[]>([]);
const hotLoading = ref(false);
const suggestions = ref<string[]>([]);

const results = reactive<{
  song: Song[];
  playlist: Playlist[];
  album: Album[];
  artist: Artist[];
  mv: Mv[];
  lyric: LyricSearchItem[];
}>({ song: [], playlist: [], album: [], artist: [], mv: [], lyric: [] });

const totals = reactive<Record<SearchType, number>>({
  song: 0,
  playlist: 0,
  album: 0,
  artist: 0,
  mv: 0,
  lyric: 0,
});
const pages = reactive<Record<SearchType, number>>({
  song: 0,
  playlist: 0,
  album: 0,
  artist: 0,
  mv: 0,
  lyric: 0,
});

let suggestionTimer: number | undefined;
let suggestionToken = 0;
/** 搜索请求序号：快速连续搜索时丢弃旧响应，避免结果串台 */
let searchToken = 0;

const showedSuggestions = computed(
  () => Boolean(keyword.value.trim()) && keyword.value.trim() !== submitted.value && suggestions.value.length > 0,
);

function hasMore(type: SearchType): boolean {
  return results[type].length > 0 && results[type].length < totals[type];
}

function totalOf(type: SearchType): number {
  return Math.max(totals[type], results[type].length);
}

async function loadHot(): Promise<void> {
  if (hot.value.length || hotLoading.value) return;
  hotLoading.value = true;
  try {
    hot.value = await getHotSearches();
  } catch {
    hot.value = [];
  } finally {
    hotLoading.value = false;
  }
}

function resetResults(): void {
  results.song = [];
  results.playlist = [];
  results.album = [];
  results.artist = [];
  results.mv = [];
  results.lyric = [];
  totals.song = totals.playlist = totals.album = totals.artist = totals.mv = totals.lyric = 0;
  pages.song = pages.playlist = pages.album = pages.artist = pages.mv = pages.lyric = 0;
}

function clearKeyword(): void {
  keyword.value = '';
  suggestions.value = [];
}

function cancelSearch(): void {
  // 让仍在途中的请求失效，防止取消后结果又写回来
  searchToken += 1;
  clearKeyword();
  submitted.value = '';
  resetResults();
  loading.value = false;
  loadingMore.value = false;
}

async function submit(text?: string): Promise<void> {
  const query = (text ?? keyword.value).trim();
  if (!query) return;

  keyword.value = query;
  submitted.value = query;
  suggestions.value = [];
  library.addSearchHistory(query);
  activeType.value = 'song';
  resetResults();
  loading.value = true;
  loadingMore.value = false;
  const token = (searchToken += 1);

  let failed = 0;
  try {
    const [songResult, playlistResult, albumResult, artistResult, mvResult, lyricResult] = await Promise.all([
      searchSongs(query, 1, PAGE_SIZE).catch(() => null),
      searchPlaylists(query, 1, 20).catch(() => null),
      searchAlbums(query, 1, 20).catch(() => null),
      searchArtists(query, 1, 20).catch(() => null),
      searchMvs(query, 1, 20).catch(() => null),
      searchLyrics(query, 1, PAGE_SIZE).catch(() => null),
    ]);

    // 期间又提交了新的关键词：旧结果直接丢弃
    if (token !== searchToken) return;

    if (songResult) {
      results.song = songResult.songs;
      totals.song = Math.max(songResult.total, songResult.songs.length);
      pages.song = 1;
    } else failed += 1;

    if (playlistResult) {
      results.playlist = playlistResult.playlists;
      totals.playlist = Math.max(playlistResult.total, playlistResult.playlists.length);
      pages.playlist = 1;
    } else failed += 1;

    if (albumResult) {
      results.album = albumResult.albums;
      totals.album = Math.max(albumResult.total, albumResult.albums.length);
      pages.album = 1;
    } else failed += 1;

    if (artistResult) {
      results.artist = artistResult.artists;
      totals.artist = Math.max(artistResult.total, artistResult.artists.length);
      pages.artist = 1;
    } else failed += 1;

    if (mvResult) {
      results.mv = mvResult.videos;
      totals.mv = Math.max(mvResult.total, mvResult.videos.length);
      pages.mv = 1;
    } else failed += 1;

    if (lyricResult) {
      results.lyric = lyricResult.items;
      totals.lyric = Math.max(lyricResult.total, lyricResult.items.length);
      pages.lyric = 1;
    } else failed += 1;

    if (failed === 6) toast.error('搜索失败，请检查网络后重试');
  } finally {
    if (token === searchToken) loading.value = false;
  }
}

function useKeyword(word: string): void {
  void submit(word);
}

function loadMore(): void {
  void (async () => {
    const type = activeType.value;
    const query = submitted.value;
    if (!query || loadingMore.value || !hasMore(type)) return;

    const token = searchToken;
    loadingMore.value = true;
    const nextPage = pages[type] + 1;
    try {
      let incoming: { id: string }[] = [];
      if (type === 'song') {
        const response = await searchSongs(query, nextPage, PAGE_SIZE);
        if (token !== searchToken) return;
        results.song = mergeById(results.song, response.songs);
        totals.song = Math.max(response.total, results.song.length);
        incoming = response.songs;
      } else if (type === 'playlist') {
        const response = await searchPlaylists(query, nextPage, 20);
        if (token !== searchToken) return;
        results.playlist = mergeById(results.playlist, response.playlists);
        totals.playlist = Math.max(response.total, results.playlist.length);
        incoming = response.playlists;
      } else if (type === 'album') {
        const response = await searchAlbums(query, nextPage, 20);
        if (token !== searchToken) return;
        results.album = mergeById(results.album, response.albums);
        totals.album = Math.max(response.total, results.album.length);
        incoming = response.albums;
      } else if (type === 'artist') {
        const response = await searchArtists(query, nextPage, 20);
        if (token !== searchToken) return;
        results.artist = mergeById(results.artist, response.artists);
        totals.artist = Math.max(response.total, results.artist.length);
        incoming = response.artists;
      } else if (type === 'mv') {
        const response = await searchMvs(query, nextPage, 20);
        if (token !== searchToken) return;
        results.mv = mergeById(results.mv, response.videos);
        totals.mv = Math.max(response.total, results.mv.length);
        incoming = response.videos;
      } else {
        const response = await searchLyrics(query, nextPage, PAGE_SIZE);
        if (token !== searchToken) return;
        results.lyric = mergeById(results.lyric, response.items);
        totals.lyric = Math.max(response.total, results.lyric.length);
        incoming = response.items;
      }
      if (incoming.length) pages[type] = nextPage;
    } catch (error) {
      if (token === searchToken) toast.error(toErrorMessage(error));
    } finally {
      if (token === searchToken) loadingMore.value = false;
    }
  })();
}

/** 按 id 去重，防止翻页时服务端返回重复数据 */
function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}

/** 歌词搜索结果可能带高亮标签，展示前去掉 */
function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

function openMv(mv: Mv): void {
  if (mv.id) void router.push(`/video/${mv.id}`);
}

/** 歌词结果没有完整歌曲结构，这里用 hash 组装一个最小 Song 交给播放器 */
function playLyric(item: LyricSearchItem): void {
  if (!item.hash) {
    toast.error('这条歌词没有可播放的音频');
    return;
  }
  const song: Song = {
    id: item.id || item.hash,
    hash: item.hash,
    name: plainText(item.name) || '未知歌曲',
    artist: item.artist || '未知歌手',
    artistIds: [],
    albumId: item.albumId,
    albumName: '',
    albumAudioId: '',
    cover: '',
    duration: item.duration,
    qualities: [],
    payType: 0,
    privilege: 0,
    source: 'lyric-search',
  };
  void player.playSongs([song], 0);
}

watch(keyword, (value) => {
  const text = value.trim();
  window.clearTimeout(suggestionTimer);
  suggestionToken += 1;
  const token = suggestionToken;

  if (!text || text === submitted.value) {
    suggestions.value = [];
    return;
  }

  suggestionTimer = window.setTimeout(() => {
    void (async () => {
      try {
        const words = await getSearchSuggestions(text);
        if (token === suggestionToken) suggestions.value = words;
      } catch {
        if (token === suggestionToken) suggestions.value = [];
      }
    })();
  }, 300);
});

onMounted(() => {
  void loadHot();
});
</script>

<template>
  <div class="page search-page">
    <header class="search-header">
      <form class="search-bar" @submit.prevent="submit()">
        <Search :size="18" class="search-bar__icon" />
        <input
          v-model="keyword"
          type="search"
          inputmode="search"
          enterkeyhint="search"
          placeholder="搜索歌曲、歌手、歌单、MV"
          autocomplete="off"
          spellcheck="false"
          @keydown.enter.prevent="submit()"
        />
        <button v-if="keyword" type="button" class="search-bar__clear" aria-label="清空" @click="clearKeyword">
          <X :size="15" />
        </button>
      </form>
      <button v-if="submitted || loading" class="text-btn search-cancel" @click="cancelSearch">取消</button>
    </header>

    <!-- 输入联想 -->
    <div v-if="showedSuggestions" class="suggestion-panel">
      <button v-for="item in suggestions" :key="item" class="suggestion-row" @click="useKeyword(item)">
        <Search :size="15" class="muted" />
        <span class="ellipsis">{{ item }}</span>
        <span class="suggestion-row__go">搜索</span>
      </button>
    </div>

    <!-- 未搜索：历史 + 热搜 -->
    <div v-else-if="!submitted" class="search-idle">
      <section v-if="library.searchHistory.length" class="search-block">
        <div class="search-block__head">
          <h2>搜索历史</h2>
          <button class="text-btn text-btn--muted" @click="library.clearSearchHistory()">清空</button>
        </div>
        <div class="history-chips">
          <div v-for="word in library.searchHistory" :key="word" class="history-chip">
            <button class="history-chip__main ellipsis" @click="useKeyword(word)">{{ word }}</button>
            <button class="history-chip__remove" aria-label="删除" @click="library.removeSearchHistory(word)">
              <X :size="12" />
            </button>
          </div>
        </div>
      </section>

      <section v-if="settings.state.showHotSearch" class="search-block">
        <div class="search-block__head">
          <h2>
            <Flame :size="16" />
            酷狗热搜
          </h2>
        </div>
        <div v-if="hotLoading" class="loading-state">
          <span class="spinner" />
          正在加载热搜
        </div>
        <div v-else class="hot-list">
          <button v-for="(word, index) in hot" :key="word" class="hot-row" @click="useKeyword(word)">
            <span class="hot-row__rank" :class="{ 'hot-row__rank--top': index < 3 }">{{ index + 1 }}</span>
            <span class="hot-row__word ellipsis">{{ word }}</span>
            <Flame v-if="index < 3" :size="13" class="hot-row__flame" />
          </button>
        </div>
      </section>

      <div v-if="!library.searchHistory.length && !settings.state.showHotSearch" class="empty-state">
        <div class="empty-state__icon">
          <Sparkles :size="24" :stroke-width="1.5" />
        </div>
        <p class="empty-state__title">开始探索音乐</p>
        <p class="empty-state__desc">输入歌名、歌手或专辑，找到你想听的歌</p>
      </div>
    </div>

    <!-- 搜索结果 -->
    <template v-else>
      <nav class="type-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="type-tab"
          :class="{ 'type-tab--active': activeType === tab.key }"
          @click="activeType = tab.key"
        >
          {{ tab.label }}
          <span v-if="!loading && totals[tab.key]" class="type-tab__count">{{ totalOf(tab.key) }}</span>
        </button>
      </nav>

      <div class="result-area">
        <div v-if="!loading && results[activeType].length" class="result-summary">
          找到 {{ totalOf(activeType) }} 个结果
        </div>

        <template v-if="activeType === 'song'">
          <div class="result-songs">
            <SongList
              :songs="results.song"
              :loading="loading"
              :show-index="false"
              show-cover
              empty-title="没有找到相关歌曲"
              empty-desc="换个关键词试试"
            />
          </div>
        </template>

        <template v-else-if="activeType === 'playlist'">
          <div v-if="loading" class="loading-state"><span class="spinner" />正在搜索歌单</div>
          <div v-else-if="results.playlist.length" class="result-grid">
            <PlaylistCard v-for="playlist in results.playlist" :key="playlist.id" :playlist="playlist" />
          </div>
          <div v-else class="empty-state">
            <p class="empty-state__title">没有找到相关歌单</p>
            <p class="empty-state__desc">换个关键词试试</p>
          </div>
        </template>

        <template v-else-if="activeType === 'album'">
          <div v-if="loading" class="loading-state"><span class="spinner" />正在搜索专辑</div>
          <div v-else-if="results.album.length" class="result-grid">
            <AlbumCard v-for="album in results.album" :key="album.id" :album="album" />
          </div>
          <div v-else class="empty-state">
            <p class="empty-state__title">没有找到相关专辑</p>
            <p class="empty-state__desc">换个关键词试试</p>
          </div>
        </template>

        <template v-else-if="activeType === 'artist'">
          <div v-if="loading" class="loading-state"><span class="spinner" />正在搜索歌手</div>
          <div v-else-if="results.artist.length" class="result-grid result-grid--artists">
            <ArtistCard v-for="artist in results.artist" :key="artist.id" :artist="artist" show-fans />
          </div>
          <div v-else class="empty-state">
            <p class="empty-state__title">没有找到相关歌手</p>
            <p class="empty-state__desc">换个关键词试试</p>
          </div>
        </template>

        <template v-else-if="activeType === 'mv'">
          <div v-if="loading" class="loading-state"><span class="spinner" />正在搜索 MV</div>
          <div v-else-if="results.mv.length" class="result-mv-grid">
            <button v-for="mv in results.mv" :key="mv.id" class="result-mv" @click="openMv(mv)">
              <span class="result-mv__cover cover-frame">
                <CoverImage :src="mv.cover" :alt="mv.name" :icon-size="20" />
                <span class="result-mv__play"><Play :size="15" fill="currentColor" :stroke-width="0" /></span>
                <span v-if="mv.duration" class="result-mv__duration">{{ formatDuration(mv.duration) }}</span>
              </span>
              <span class="result-mv__name clamp-2">{{ mv.name }}</span>
              <span class="result-mv__artist ellipsis">{{ mv.artist }}</span>
            </button>
          </div>
          <div v-else class="empty-state">
            <div class="empty-state__icon"><Clapperboard :size="24" /></div>
            <p class="empty-state__title">没有找到相关 MV</p>
            <p class="empty-state__desc">换个关键词试试</p>
          </div>
        </template>

        <template v-else>
          <div v-if="loading" class="loading-state"><span class="spinner" />正在搜索歌词</div>
          <div v-else-if="results.lyric.length" class="lyric-list">
            <button
              v-for="item in results.lyric"
              :key="item.id"
              class="lyric-row"
              :disabled="!item.hash"
              @click="playLyric(item)"
            >
              <span class="lyric-row__main">
                <span class="lyric-row__head">
                  <span class="lyric-row__name ellipsis">{{ plainText(item.name) }}</span>
                  <span class="lyric-row__artist ellipsis">{{ item.artist }}</span>
                </span>
                <span class="lyric-row__snippet clamp-2">{{ plainText(item.lyric) }}</span>
              </span>
              <span class="lyric-row__play"><Play :size="15" fill="currentColor" :stroke-width="0" /></span>
            </button>
          </div>
          <div v-else class="empty-state">
            <p class="empty-state__title">没有找到相关歌词</p>
            <p class="empty-state__desc">换一句歌词试试</p>
          </div>
        </template>

        <div v-if="!loading && hasMore(activeType)" class="load-more">
          <button class="btn btn--soft btn--sm" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </button>
        </div>
        <div
          v-else-if="!loading && results[activeType].length && !hasMore(activeType)"
          class="end-hint"
        >
          已经到底了
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.search-page {
  padding-bottom: calc(24px + var(--safe-bottom));
}

.search-header {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: calc(14px + var(--safe-top)) 16px 10px;
  background: linear-gradient(180deg, rgba(7, 11, 18, 0.98) 0%, rgba(7, 11, 18, 0.9) 70%, transparent 100%);
  backdrop-filter: blur(18px);
}

.search-bar {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.055);
  transition: border-color 0.18s ease;
}

.search-bar:focus-within {
  border-color: rgba(56, 225, 198, 0.38);
}

.search-bar__icon {
  flex: 0 0 auto;
  color: var(--muted);
}

.search-bar input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: none;
  color: var(--text);
  font-size: 14px;
  background: transparent;
}

.search-bar input::placeholder {
  color: var(--muted);
}

.search-bar input::-webkit-search-cancel-button {
  display: none;
}

.search-bar__clear {
  display: grid;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.08);
}

.search-cancel {
  flex: 0 0 auto;
  padding: 4px 2px;
}

.search-idle {
  padding: 6px 18px 0;
}

.search-block {
  margin-top: 18px;
}

.search-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.search-block__head h2 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.history-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-chip {
  display: flex;
  align-items: center;
  max-width: 100%;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
}

.history-chip__main {
  max-width: 180px;
  padding: 7px 4px 7px 13px;
  color: var(--text-2);
  font-size: 12.5px;
}

.history-chip__remove {
  display: grid;
  width: 28px;
  height: 30px;
  place-items: center;
  color: var(--muted);
}

.hot-list {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.025);
}

.hot-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 14px;
  text-align: left;
}

.hot-row + .hot-row {
  border-top: 1px solid rgba(255, 255, 255, 0.045);
}

.hot-row:active {
  background: rgba(255, 255, 255, 0.04);
}

.hot-row__rank {
  flex: 0 0 auto;
  width: 18px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.hot-row__rank--top {
  color: var(--accent);
}

.hot-row__word {
  flex: 1;
  color: var(--text-2);
  font-size: 13.5px;
}

.hot-row__flame {
  flex: 0 0 auto;
  color: var(--warning);
  opacity: 0.8;
}

.suggestion-panel {
  padding: 4px 16px 12px;
}

.suggestion-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 8px;
  color: var(--text-2);
  font-size: 13.5px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.045);
}

.suggestion-row__go {
  margin-left: auto;
  color: var(--muted);
  font-size: 10.5px;
}

.type-tabs {
  position: sticky;
  /* 与 .search-header 的实际高度保持一致（14 + 44 + 10） */
  top: calc(68px + var(--safe-top));
  z-index: 25;
  display: flex;
  gap: 6px;
  padding: 6px 18px 10px;
  overflow-x: auto;
  background: rgba(7, 11, 18, 0.92);
  backdrop-filter: blur(18px);
  scrollbar-width: none;
}

.type-tabs::-webkit-scrollbar {
  display: none;
}

.type-tab {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 13px;
  border-radius: 999px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 550;
  transition: color 0.18s ease, background 0.18s ease;
}

.type-tab--active {
  color: #04231f;
  background: var(--accent);
}

.type-tab__count {
  font-size: 9.5px;
  font-weight: 600;
  opacity: 0.65;
}

.result-area {
  padding: 4px 12px 0;
}

.result-summary {
  padding: 0 6px 8px;
  color: var(--muted);
  font-size: 11px;
}

.result-songs {
  padding: 0 2px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 14px;
  padding: 6px 6px 12px;
}

.result-grid :deep(.playlist-card),
.result-grid :deep(.album-card) {
  width: 100%;
}

.result-grid--artists {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px 10px;
}

.result-grid--artists :deep(.artist-card) {
  width: 100%;
}

.result-grid--artists :deep(.artist-card__avatar) {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  margin: 0 auto;
}

.result-mv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 12px;
  padding: 6px 6px 12px;
}

.result-mv {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--text);
  text-align: left;
}

.result-mv__cover {
  position: relative;
  width: 100%;
  height: 100px;
  border-radius: 12px;
}

.result-mv__play {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  background: rgba(4, 9, 15, 0.55);
  color: #fff;
  transform: translate(-50%, -50%);
  backdrop-filter: blur(4px);
}

.result-mv__duration {
  position: absolute;
  right: 5px;
  bottom: 5px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(3, 7, 12, 0.7);
  color: #fff;
  font-size: 9px;
}

.result-mv__name {
  font-size: 12.5px;
  font-weight: 620;
  line-height: 1.35;
}

.result-mv__artist {
  color: var(--muted);
  font-size: 10px;
}

.lyric-list {
  display: flex;
  flex-direction: column;
  padding: 2px 2px 10px;
}

.lyric-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 8px;
  border-radius: 12px;
  color: var(--text);
  text-align: left;
}

.lyric-row:active {
  background: rgba(255, 255, 255, 0.05);
}

.lyric-row__main {
  flex: 1;
  min-width: 0;
}

.lyric-row__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.lyric-row__name {
  max-width: 62%;
  font-size: 13.5px;
  font-weight: 600;
}

.lyric-row__artist {
  min-width: 0;
  color: var(--muted);
  font-size: 10.5px;
}

.lyric-row__snippet {
  display: block;
  margin-top: 3px;
  color: var(--text-2);
  font-size: 11.5px;
  line-height: 1.5;
}

.lyric-row__play {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  color: var(--accent);
  background: var(--accent-soft);
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
</style>
