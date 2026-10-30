/**
 * 音乐库：收藏、最近播放、搜索历史。
 *
 * 登录后「收藏」直接使用酷狗账号的「我喜欢」歌单：
 * - 登录/打开应用后同步该歌单，爱心状态以云端为准；
 * - 点爱心会调用歌单增删接口，未登录时仍使用本地收藏。
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  addSongsToPlaylist,
  cleanStoredSong,
  getPlaylistAllSongs,
  getUserPlaylists,
  hasLogin,
  readJson,
  removeSongsFromPlaylist,
  STORAGE_KEYS,
  toErrorMessage,
  writeJson,
  type Playlist,
  type Song,
} from '@/api';

const MAX_HISTORY = 100;
const MAX_SEARCH_HISTORY = 12;
const LIKED_PLAYLIST_NAMES = ['我喜欢', '我喜欢的音乐'];

/** 找到账号里的「我喜欢」歌单；名称匹配前先去掉空白 */
function findLikedPlaylist(playlists: Playlist[]): Playlist | null {
  return (
    playlists.find((playlist) => {
      const name = playlist.name.replace(/\s+/g, '');
      return Boolean(playlist.listId) && LIKED_PLAYLIST_NAMES.includes(name);
    }) || null
  );
}

export const useLibraryStore = defineStore('library', () => {
  // 旧版本可能把 "歌名.mp3" 写进本地数据，加载时统一清洗展示名
  const savedFavorites = readJson<Song[]>(STORAGE_KEYS.favorites, []);
  const savedHistory = readJson<Song[]>(STORAGE_KEYS.history, []);
  const localFavorites = ref<Song[]>(
    Array.isArray(savedFavorites) ? savedFavorites.map(cleanStoredSong) : [],
  );
  const history = ref<Song[]>(
    Array.isArray(savedHistory) ? savedHistory.map(cleanStoredSong) : [],
  );
  const searchHistory = ref<string[]>(readJson<string[]>(STORAGE_KEYS.searchHistory, []));

  const likedSongs = ref<Song[]>([]);
  const likedListId = ref('');
  const likedLoaded = ref(false);
  const likedLoading = ref(false);
  const likedError = ref('');
  /** 已开始使用云端「我喜欢」，用于决定爱心状态与收藏页数据来源 */
  const cloudActive = ref(false);
  const pendingFavoriteIds = ref(new Set<string>());

  let likedRequest = 0;
  let likedPromise: Promise<void> | null = null;

  const favorites = computed(() => (cloudActive.value ? likedSongs.value : localFavorites.value));
  const cloudMode = computed(() => cloudActive.value && Boolean(likedListId.value));
  const favoriteIds = computed(() => new Set(favorites.value.map((song) => song.id)));

  function isFavorite(songId: string): boolean {
    return favoriteIds.value.has(songId);
  }

  function isFavoritePending(songId: string): boolean {
    return pendingFavoriteIds.value.has(songId);
  }

  function persistFavorites(): void {
    writeJson(STORAGE_KEYS.favorites, localFavorites.value);
  }

  function persistHistory(): void {
    writeJson(STORAGE_KEYS.history, history.value);
  }

  function persistSearchHistory(): void {
    writeJson(STORAGE_KEYS.searchHistory, searchHistory.value);
  }

  /** 本地收藏（未登录，或云端同步失败时使用） */
  function toggleLocalFavorite(song: Song): boolean {
    const index = localFavorites.value.findIndex((item) => item.id === song.id);
    if (index >= 0) {
      localFavorites.value.splice(index, 1);
      persistFavorites();
      return false;
    }
    localFavorites.value.unshift({ ...song });
    persistFavorites();
    return true;
  }

  /** 清空云端同步状态，退回到本地收藏（退出登录/切换账号时调用） */
  function resetCloud(): void {
    likedRequest += 1;
    likedPromise = null;
    likedSongs.value = [];
    likedListId.value = '';
    likedLoaded.value = false;
    likedLoading.value = false;
    likedError.value = '';
    cloudActive.value = false;
    pendingFavoriteIds.value.clear();
  }

  /**
   * 同步「我喜欢」歌单。
   *
   * @param playlists 用户 store 已经拉取过的歌单，传入可省一次请求
   * @param force     强制重新拉取（收藏页手动刷新）
   */
  function loadLiked(playlists?: Playlist[], force = false): Promise<void> {
    if (!hasLogin()) {
      resetCloud();
      return Promise.resolve();
    }
    if (!force && likedLoaded.value) return Promise.resolve();
    if (!force && likedPromise) return likedPromise;

    const token = (likedRequest += 1);
    cloudActive.value = true;
    likedLoading.value = true;
    likedError.value = '';

    const task = (async () => {
      try {
        let lists = playlists?.length ? playlists : await getUserPlaylists();
        if (token !== likedRequest) return;

        let liked = findLikedPlaylist(lists);
        // 用户 store 的歌单可能只加载了部分分页，找不到时再请求一次完整列表
        if (!liked && playlists?.length) {
          lists = await getUserPlaylists();
          if (token !== likedRequest) return;
          liked = findLikedPlaylist(lists);
        }
        if (!liked?.listId) throw new Error('未找到酷狗「我喜欢」歌单，请先在酷狗 App 中创建');

        likedListId.value = liked.listId;
        const result = await getPlaylistAllSongs(liked.listId);
        if (token !== likedRequest) return;

        likedSongs.value = result.songs;
        likedLoaded.value = true;
      } catch (error) {
        if (token !== likedRequest) return;
        // 云端不可用时退回本地收藏，至少保证离线仍能使用
        cloudActive.value = false;
        likedListId.value = '';
        likedLoaded.value = false;
        likedError.value = toErrorMessage(error) || '同步酷狗「我喜欢」失败';
      } finally {
        if (token === likedRequest) likedLoading.value = false;
      }
    })();

    likedPromise = task;
    void task.finally(() => {
      if (likedPromise === task) likedPromise = null;
    });
    return task;
  }

  /** 用户歌单刷新后同步「我喜欢」（登录、切换账号、手动刷新资料时调用） */
  function applyPlaylists(playlists: Playlist[]): void {
    if (!hasLogin()) {
      resetCloud();
      return;
    }
    const liked = findLikedPlaylist(playlists);
    if (!liked?.listId) return;

    const changed = likedListId.value !== liked.listId;
    likedListId.value = liked.listId;
    cloudActive.value = true;
    if (changed || !likedLoaded.value) {
      void loadLiked(playlists, changed);
    }
  }

  /** 收藏 / 取消收藏：登录后写酷狗「我喜欢」，未登录写本地 */
  async function toggleFavorite(song: Song): Promise<boolean> {
    if (!hasLogin()) return toggleLocalFavorite(song);
    if (pendingFavoriteIds.value.has(song.id)) return isFavorite(song.id);

    if (!likedLoaded.value || !likedListId.value) {
      await loadLiked();
    }
    if (!likedListId.value) {
      throw new Error(likedError.value || '未找到酷狗「我喜欢」歌单');
    }

    pendingFavoriteIds.value.add(song.id);
    try {
      const existing = likedSongs.value.find((item) => item.id === song.id);
      if (existing) {
        const fileId = existing.fileId || song.fileId;
        if (!fileId) throw new Error('这首歌缺少文件 id，暂时无法取消收藏');
        await removeSongsFromPlaylist(likedListId.value, [fileId]);
        likedSongs.value = likedSongs.value.filter((item) => item.id !== song.id);
        return false;
      }

      if (!song.hash) throw new Error('这首歌缺少 hash，暂时无法收藏');
      await addSongsToPlaylist(likedListId.value, [song]);
      likedSongs.value = [{ ...song }, ...likedSongs.value.filter((item) => item.id !== song.id)];
      return true;
    } finally {
      pendingFavoriteIds.value.delete(song.id);
    }
  }

  /** 其它入口（添加到歌单）写入「我喜欢」后同步爱心状态 */
  function addLikedSongs(songs: Song[]): void {
    if (!cloudActive.value || !likedLoaded.value) return;
    const known = new Set(likedSongs.value.map((song) => song.id));
    const additions = songs.filter((song) => song.hash && !known.has(song.id));
    if (!additions.length) return;
    likedSongs.value = [...additions.map((song) => ({ ...song })), ...likedSongs.value];
  }

  /** 其它入口（歌单详情移除歌曲）从「我喜欢」移除后同步爱心状态 */
  function removeLikedSong(songId: string): void {
    if (!cloudActive.value || !likedLoaded.value) return;
    likedSongs.value = likedSongs.value.filter((song) => song.id !== songId);
  }

  function isLikedList(listid: string): boolean {
    return Boolean(likedListId.value) && listid === likedListId.value;
  }

  function isLikedPlaylist(playlist: Playlist): boolean {
    if (likedListId.value && (playlist.listId === likedListId.value || playlist.id === likedListId.value)) {
      return true;
    }
    return LIKED_PLAYLIST_NAMES.includes(playlist.name.replace(/\s+/g, ''));
  }

  function removeFavorite(songId: string): void {
    localFavorites.value = localFavorites.value.filter((item) => item.id !== songId);
    persistFavorites();
  }

  function clearFavorites(): void {
    localFavorites.value = [];
    persistFavorites();
  }

  /** 最近播放：按 id 去重并置顶 */
  function addHistory(song: Song): void {
    const next = history.value.filter((item) => item.id !== song.id);
    next.unshift({ ...song });
    history.value = next.slice(0, MAX_HISTORY);
    persistHistory();
  }

  function clearHistory(): void {
    history.value = [];
    persistHistory();
  }

  function addSearchHistory(keyword: string): void {
    const text = keyword.trim();
    if (!text) return;
    searchHistory.value = [text, ...searchHistory.value.filter((item) => item !== text)].slice(0, MAX_SEARCH_HISTORY);
    persistSearchHistory();
  }

  function removeSearchHistory(keyword: string): void {
    searchHistory.value = searchHistory.value.filter((item) => item !== keyword);
    persistSearchHistory();
  }

  function clearSearchHistory(): void {
    searchHistory.value = [];
    persistSearchHistory();
  }

  return {
    favorites,
    cloudMode,
    likedLoading,
    likedLoaded,
    likedError,
    likedListId,
    isFavorite,
    isFavoritePending,
    toggleFavorite,
    addLikedSongs,
    removeLikedSong,
    isLikedList,
    isLikedPlaylist,
    loadLiked,
    applyPlaylists,
    resetCloud,
    removeFavorite,
    clearFavorites,
    history,
    searchHistory,
    addHistory,
    clearHistory,
    addSearchHistory,
    removeSearchHistory,
    clearSearchHistory,
  };
});
