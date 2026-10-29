/**
 * 设置 store。
 *
 * 设置本身持久化在 `core/config.ts`；这里只是让 UI 获得响应式视图，
 * 并在音质变化时清理播放地址缓存。
 *
 * App 固定使用概念版，因此不再提供平台切换；`platform` 仅作为只读状态。
 */

import { defineStore } from 'pinia';
import { computed, reactive } from 'vue';
import {
  clearUrlCache,
  getSettings,
  updateSettings,
  type AppSettings,
  type Quality,
} from '@/api';

export const useSettingsStore = defineStore('settings', () => {
  const state = reactive<AppSettings>({ ...getSettings() });

  const platform = computed(() => state.platform);
  const isLite = computed(() => state.platform === 'lite');
  const quality = computed(() => state.quality);

  function patch(next: Partial<AppSettings>): void {
    const updated = updateSettings(next);
    Object.assign(state, updated);
    if (next.quality) clearUrlCache();
  }

  function setQuality(value: Quality): void {
    patch({ quality: value });
  }

  function toggleShowTranslation(): void {
    patch({ showTranslation: !state.showTranslation });
  }

  function toggleAutoPlayNext(): void {
    patch({ autoPlayNext: !state.autoPlayNext });
  }

  function toggleShowHotSearch(): void {
    patch({ showHotSearch: !state.showHotSearch });
  }

  function toggleAutoClaimVip(): void {
    patch({ autoClaimVip: !state.autoClaimVip });
  }

  function toggleAutoUpgradeVip(): void {
    patch({ autoUpgradeVip: !state.autoUpgradeVip });
  }

  /** 重新从存储读取（清除数据后调用） */
  function reload(): void {
    Object.assign(state, getSettings());
  }

  return {
    state,
    platform,
    isLite,
    quality,
    patch,
    setQuality,
    toggleShowTranslation,
    toggleAutoPlayNext,
    toggleShowHotSearch,
    toggleAutoClaimVip,
    toggleAutoUpgradeVip,
    reload,
  };
});
