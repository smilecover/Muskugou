/**
 * 路由表。
 *
 * 使用 hash 模式：Tauri 在 Android 上通过 `tauri://localhost` / 自定义协议
 * 加载静态文件，hash 路由不需要服务器做 history fallback。
 *
 * meta 约定：
 *   - tab：显示底部导航
 *   - keepAlive：切换 tab 时保留页面状态（首页/搜索/排行/我的）
 *   - fullscreen：隐藏底部导航与迷你播放器（播放页）
 *   - title：页面标题
 */

import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    tab?: boolean;
    keepAlive?: boolean;
    fullscreen?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '首页', tab: true, keepAlive: true },
  },
  {
    path: '/discover',
    name: 'discover',
    component: () => import('@/views/DiscoverView.vue'),
    meta: { title: '发现', tab: true, keepAlive: true },
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchView.vue'),
    meta: { title: '搜索', tab: true, keepAlive: true },
  },
  {
    path: '/ranks',
    name: 'ranks',
    component: () => import('@/views/RanksView.vue'),
    meta: { title: '排行榜', tab: true, keepAlive: true },
  },
  {
    path: '/library',
    name: 'library',
    component: () => import('@/views/LibraryView.vue'),
    meta: { title: '我的', tab: true, keepAlive: true },
  },
  {
    path: '/playlist/:id',
    name: 'playlist',
    component: () => import('@/views/PlaylistView.vue'),
    props: true,
    meta: { title: '歌单' },
  },
  {
    path: '/album/:id',
    name: 'album',
    component: () => import('@/views/AlbumView.vue'),
    props: true,
    meta: { title: '专辑' },
  },
  {
    path: '/artist/:id',
    name: 'artist',
    component: () => import('@/views/ArtistView.vue'),
    props: true,
    meta: { title: '歌手' },
  },
  {
    path: '/ranks/:id',
    name: 'rank-detail',
    component: () => import('@/views/RankDetailView.vue'),
    props: (route) => ({ id: String(route.params.id), cid: String(route.query.cid || '') }),
    meta: { title: '榜单' },
  },
  {
    path: '/player',
    name: 'player',
    component: () => import('@/views/PlayerView.vue'),
    meta: { title: '正在播放', fullscreen: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: '设置' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: '最近播放' },
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('@/views/FavoritesView.vue'),
    meta: { title: '我的收藏' },
  },
  {
    path: '/daily',
    name: 'daily',
    component: () => import('@/views/DailyRecommendView.vue'),
    meta: { title: '每日推荐' },
  },
  {
    path: '/themes',
    name: 'themes',
    component: () => import('@/views/ThemeListView.vue'),
    meta: { title: '主题音乐' },
  },
  {
    path: '/themes/:id',
    name: 'theme-detail',
    component: () => import('@/views/ThemeDetailView.vue'),
    meta: { title: '主题详情' },
  },
  {
    path: '/fm',
    name: 'fm',
    component: () => import('@/views/FmView.vue'),
    meta: { title: '电台' },
  },
  {
    path: '/audiobooks',
    name: 'audiobooks',
    component: () => import('@/views/AudiobookView.vue'),
    meta: { title: '听书' },
  },
  {
    path: '/audiobooks/:id',
    name: 'audiobook-detail',
    component: () => import('@/views/AudiobookDetailView.vue'),
    meta: { title: '有声书' },
  },
  {
    path: '/videos',
    name: 'videos',
    component: () => import('@/views/VideoListView.vue'),
    meta: { title: 'MV / 视频' },
  },
  {
    path: '/video/:id',
    name: 'video-player',
    component: () => import('@/views/VideoPlayerView.vue'),
    meta: { title: 'MV', fullscreen: true },
  },
  {
    path: '/square',
    name: 'playlist-square',
    component: () => import('@/views/PlaylistSquareView.vue'),
    meta: { title: '歌单广场' },
  },
  {
    path: '/scenes',
    name: 'scenes',
    component: () => import('@/views/SceneView.vue'),
    meta: { title: '场景音乐' },
  },
  {
    path: '/ips',
    name: 'ips',
    component: () => import('@/views/IpView.vue'),
    meta: { title: 'IP 专区' },
  },
  {
    path: '/cloud',
    name: 'cloud',
    component: () => import('@/views/CloudView.vue'),
    meta: { title: '我的云盘' },
  },
  {
    path: '/account',
    name: 'account',
    component: () => import('@/views/AccountView.vue'),
    meta: { title: '账号' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    // 每个页面的滚动容器由页面自身管理，这里不需要浏览器滚动复位
    return false;
  },
});

router.afterEach((to) => {
  const title = to.meta.title;
  document.title = title ? `${title} · Muskugou` : 'Muskugou';
});

export default router;
