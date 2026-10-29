<script setup lang="ts">
/**
 * App 外壳。
 *
 * 布局：内容区（可滚动） + 迷你播放器 + 底部导航。
 * 播放页是 fullscreen，会同时隐藏后两者。
 */

import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MiniPlayer from '@/components/MiniPlayer.vue';
import TabBar from '@/components/TabBar.vue';
import ToastHost from '@/components/ToastHost.vue';
import { usePlayerStore } from '@/stores/player';

const route = useRoute();
const router = useRouter();
const player = usePlayerStore();

const showTab = computed(() => Boolean(route.meta.tab));
const showMini = computed(
  () => Boolean(player.current) && !route.meta.fullscreen && route.name !== 'login',
);

// 只有 tab 页参与 keep-alive，详情页每次进入重新请求
const cachedViews = ['HomeView', 'DiscoverView', 'SearchView', 'RanksView', 'LibraryView'];

/**
 * Android 实体/手势返回键。
 *
 * Tauri 在注册监听后会接管默认行为，因此这里自己决定：
 *   - 详情页/播放页：返回上一页；没有历史时回首页
 *   - 首页：退出应用
 * 桌面端即使注册了监听也不会触发，动态导入避免影响浏览器调试。
 */
let unregisterBack: (() => void) | null = null;

onMounted(() => {
  if (!('__TAURI_INTERNALS__' in window)) return;
  void import('@tauri-apps/api/app')
    .then(async ({ onBackButtonPress, exit }) => {
      const listener = await onBackButtonPress(({ canGoBack }) => {
        if (router.currentRoute.value.name === 'home') {
          void exit(0);
          return;
        }
        if (canGoBack) router.back();
        else void router.replace('/');
      });
      unregisterBack = () => void listener.unregister();
    })
    .catch(() => {
      // 非 Android 平台可用时忽略即可
    });
});

onBeforeUnmount(() => {
  unregisterBack?.();
});
</script>

<template>
  <div class="app-shell">
    <div class="app-content">
      <router-view v-slot="{ Component }">
        <keep-alive :include="cachedViews">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>

    <MiniPlayer v-if="showMini" />
    <TabBar v-if="showTab" />
    <ToastHost />
  </div>
</template>
