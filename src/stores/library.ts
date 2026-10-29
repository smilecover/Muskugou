/**
 * 本地音乐库：收藏、最近播放、搜索历史。
 *
 * 这些数据完全保存在设备上；登录后可继续使用酷狗账号的云端歌单，
 * 但“收藏/历史”不依赖登录，保证离线也能看到自己的记录。
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { cleanStoredSong, readJson, STORAGE_KEYS, writeJson, type Song } from '@/api';

const MAX_HISTORY = 100;
const MAX_SEARCH_HISTORY = 12;

export const useLibraryStore = defineStore('library', () => {
  // 旧版本可能把 "歌名.mp3" 写进本地数据，加载时统一清洗展示名
  const savedFavorites = readJson<Song[]>(STORAGE_KEYS.favorites, []);
  const savedHistory = readJson<Song[]>(STORAGE_KEYS.history, []);
  const favorites = ref<Song[]>(
    Array.isArray(savedFavorites) ? savedFavorites.map(cleanStoredSong) : [],
  );
  const history = ref<Song[]>(
    Array.isArray(savedHistory) ? savedHistory.map(cleanStoredSong) : [],
  );
  const searchHistory = ref<string[]>(readJson<string[]>(STORAGE_KEYS.searchHistory, []));

  const favoriteIds = computed(() => new Set(favorites.value.map((song) => song.id)));
  const isFavorite = (songId: string) => favoriteIds.value.has(songId);

  function persistFavorites(): void {
    writeJson(STORAGE_KEYS.favorites, favorites.value);
  }

  function persistHistory(): void {
    writeJson(STORAGE_KEYS.history, history.value);
  }

  function persistSearchHistory(): void {
    writeJson(STORAGE_KEYS.searchHistory, searchHistory.value);
  }

  function toggleFavorite(song: Song): boolean {
    const index = favorites.value.findIndex((item) => item.id === song.id);
    if (index >= 0) {
      favorites.value.splice(index, 1);
      persistFavorites();
      return false;
    }
    favorites.value.unshift({ ...song });
    persistFavorites();
    return true;
  }

  function removeFavorite(songId: string): void {
    favorites.value = favorites.value.filter((item) => item.id !== songId);
    persistFavorites();
  }

  function clearFavorites(): void {
    favorites.value = [];
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
    history,
    searchHistory,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    clearFavorites,
    addHistory,
    clearHistory,
    addSearchHistory,
    removeSearchHistory,
    clearSearchHistory,
  };
});
