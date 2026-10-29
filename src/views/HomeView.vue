<script setup lang="ts">
/**
 * 首页（发现）。
 *
 * 五个区块并行请求，任何一个失败都不会影响其它区块：
 * 推荐单曲、推荐歌单、排行榜、新歌速递、新碟上架。
 */

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  CalendarHeart,
  Clapperboard,
  Compass,
  Headphones,
  ListMusic,
  Play,
  Radio,
  RefreshCw,
  Search,
  Settings,
} from 'lucide-vue-next';
import AlbumCard from '@/components/AlbumCard.vue';
import CoverImage from '@/components/CoverImage.vue';
import PlaylistCard from '@/components/PlaylistCard.vue';
import RankCard from '@/components/RankCard.vue';
import SectionHeader from '@/components/SectionHeader.vue';
import SongList from '@/components/SongList.vue';
import { getHomeData, type HomeData, type Song } from '@/api';
import { usePlayerStore } from '@/stores/player';
import { useUserStore } from '@/stores/user';

defineOptions({ name: 'HomeView' });

const router = useRouter();
const player = usePlayerStore();
const user = useUserStore();

const data = reactive<HomeData>({
  discover: [],
  conceptSongs: [],
  playlists: [],
  ranks: [],
  newSongs: [],
  newAlbums: [],
});

const loading = ref(true);
const refreshing = ref(false);

/** 首页功能入口；更多入口在「发现」tab */
const shortcuts = [
  { label: '每日推荐', to: '/daily', icon: CalendarHeart, color: '#38e1c6' },
  { label: '歌单广场', to: '/square', icon: ListMusic, color: '#ffc35c' },
  { label: '电台', to: '/fm', icon: Radio, color: '#5b9bff' },
  { label: '听书', to: '/audiobooks', icon: Headphones, color: '#b58cff' },
  { label: 'MV', to: '/videos', icon: Clapperboard, color: '#ff8c69' },
  { label: '发现', to: '/discover', icon: Compass, color: '#8ee6d5' },
];

const greeting = computed(() => {
  const hour = new Date().getHours();
  const base = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  return user.loggedIn && user.profile ? `${base}，${user.nickname}` : base;
});

const isEmpty = computed(
  () =>
    !data.discover.length &&
    !data.conceptSongs.length &&
    !data.playlists.length &&
    !data.ranks.length &&
    !data.newSongs.length &&
    !data.newAlbums.length,
);

async function load(initial = false): Promise<void> {
  if (initial) loading.value = true;
  else refreshing.value = true;
  try {
    const result = await getHomeData();
    Object.assign(data, result);
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

function playDiscover(song: Song, index: number): void {
  void player.playSongs(data.discover, index);
}

function playConceptSongs(song: Song, index: number): void {
  void player.playSongs(data.conceptSongs, index);
}

onMounted(() => {
  void load(true);
});
</script>

<template>
  <div class="page home">
    <header class="home-top">
      <div class="brand-row">
        <div class="brand-text">
          <div class="brand-line">
            <p class="brand-mark">MUSKUGOU</p>
            <span class="edition-pill">概念版</span>
          </div>
          <h1 class="brand-greeting ellipsis">{{ greeting }}</h1>
        </div>
        <div class="brand-actions">
          <button class="icon-btn" aria-label="刷新首页" @click="load()">
            <RefreshCw :size="18" :class="{ 'spin-icon': refreshing }" />
          </button>
          <router-link to="/settings" class="icon-btn" aria-label="设置">
            <Settings :size="19" />
          </router-link>
        </div>
      </div>

      <button class="search-entry" @click="router.push('/search')">
        <Search :size="18" />
        <span>搜索歌曲、歌手、歌单、MV</span>
        <span class="search-entry__hint">搜索</span>
      </button>

      <nav class="home-shortcuts">
        <button
          v-for="item in shortcuts"
          :key="item.to"
          class="home-shortcut"
          @click="router.push(item.to)"
        >
          <span class="home-shortcut__icon" :style="{ '--shortcut-color': item.color }">
            <component :is="item.icon" :size="18" :stroke-width="1.9" />
          </span>
          <span class="home-shortcut__label">{{ item.label }}</span>
        </button>
      </nav>
    </header>

    <!-- 首屏骨架 -->
    <template v-if="loading">
      <div class="home-skeleton">
        <div class="skeleton sk-cover" />
        <div class="sk-lines">
          <div class="skeleton sk-line sk-line--80" />
          <div class="skeleton sk-line sk-line--50" />
        </div>
      </div>
      <div class="section">
        <div class="section-head"><div class="skeleton sk-title" /></div>
        <div class="hscroll">
          <div v-for="n in 3" :key="n" class="skeleton sk-card" />
        </div>
      </div>
    </template>

    <template v-else-if="!isEmpty">
      <section v-if="data.discover.length" class="section">
        <SectionHeader title="为你推荐" />
        <div class="hscroll">
          <button
            v-for="(song, index) in data.discover"
            :key="song.id"
            class="discover-card"
            @click="playDiscover(song, index)"
          >
            <span class="discover-card__cover cover-frame">
              <CoverImage :src="song.cover" :alt="song.name" />
              <span class="discover-card__play">
                <Play :size="15" fill="currentColor" :stroke-width="0" />
              </span>
            </span>
            <span class="discover-card__name ellipsis">{{ song.name }}</span>
            <span class="discover-card__artist ellipsis">{{ song.artist }}</span>
          </button>
        </div>
      </section>

      <section v-if="data.conceptSongs.length" class="section">
        <SectionHeader title="概念版免费听" />
        <div class="hscroll">
          <button
            v-for="(song, index) in data.conceptSongs"
            :key="`concept-${song.id}`"
            class="discover-card"
            @click="playConceptSongs(song, index)"
          >
            <span class="discover-card__cover cover-frame">
              <CoverImage :src="song.cover" :alt="song.name" />
              <span class="discover-card__free">免费听</span>
              <span class="discover-card__play">
                <Play :size="15" fill="currentColor" :stroke-width="0" />
              </span>
            </span>
            <span class="discover-card__name ellipsis">{{ song.name }}</span>
            <span class="discover-card__artist ellipsis">{{ song.artist }}</span>
          </button>
        </div>
      </section>

      <section v-if="data.playlists.length" class="section">
        <SectionHeader title="精选歌单" />
        <div class="hscroll">
          <PlaylistCard v-for="playlist in data.playlists" :key="playlist.id" :playlist="playlist" />
        </div>
      </section>

      <section v-if="data.ranks.length" class="section">
        <SectionHeader title="排行榜" to="/ranks" />
        <div class="hscroll">
          <RankCard v-for="rank in data.ranks" :key="`${rank.id}-${rank.rankCid}`" :rank="rank" />
        </div>
      </section>

      <section v-if="data.newSongs.length" class="section">
        <SectionHeader title="新歌速递" />
        <div class="home-songs">
          <SongList :songs="data.newSongs" :show-index="false" show-cover />
        </div>
      </section>

      <section v-if="data.newAlbums.length" class="section">
        <SectionHeader title="新碟上架" />
        <div class="hscroll">
          <AlbumCard v-for="album in data.newAlbums" :key="album.id" :album="album" />
        </div>
      </section>

      <p class="home-footer">音乐数据来自酷狗 · 仅供个人学习使用</p>
    </template>

    <div v-else class="empty-state">
      <div class="empty-state__icon">
        <Search :size="24" :stroke-width="1.5" />
      </div>
      <p class="empty-state__title">暂时没有加载到内容</p>
      <p class="empty-state__desc">请检查网络或稍后重试</p>
      <button class="btn btn--soft btn--sm" style="margin-top: 8px" @click="load()">重新加载</button>
    </div>
  </div>
</template>

<style scoped>
.home {
  padding-bottom: calc(30px + var(--safe-bottom));
}

.home-top {
  padding: calc(18px + var(--safe-top)) 18px 6px;
}

.brand-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.brand-text {
  min-width: 0;
}

.brand-line {
  display: flex;
  align-items: center;
  gap: 7px;
}

.brand-mark {
  margin: 0;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.28em;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.edition-pill {
  padding: 1px 6px;
  border: 1px solid rgba(56, 225, 198, 0.24);
  border-radius: 999px;
  color: var(--accent);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: var(--accent-soft);
}

.brand-greeting {
  margin: 4px 0 0;
  font-size: 25px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.brand-actions {
  display: flex;
  gap: 8px;
  padding-top: 2px;
}

.spin-icon {
  animation: spin 0.9s linear infinite;
}

.search-entry {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 46px;
  padding: 0 14px;
  margin-top: 18px;
  border: 1px solid var(--line);
  border-radius: 15px;
  color: var(--muted);
  font-size: 13px;
  text-align: left;
  background: rgba(255, 255, 255, 0.045);
  transition: border-color 0.18s ease, background 0.18s ease;
}

.search-entry:active {
  border-color: rgba(56, 225, 198, 0.3);
  background: rgba(255, 255, 255, 0.07);
}

.search-entry__hint {
  padding: 3px 10px;
  margin-left: auto;
  border-radius: 999px;
  color: var(--accent);
  font-size: 10.5px;
  font-weight: 600;
  background: var(--accent-soft);
}

.home-shortcuts {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 2px;
  margin-top: 16px;
}

.home-shortcut {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-radius: 12px;
  color: var(--text-2);
}

.home-shortcut:active {
  background: rgba(255, 255, 255, 0.04);
}

.home-shortcut__icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--shortcut-color) 28%, transparent);
  border-radius: 13px;
  background: color-mix(in srgb, var(--shortcut-color) 13%, transparent);
  color: var(--shortcut-color);
}

.home-shortcut__label {
  font-size: 10px;
  font-weight: 550;
}

.home-songs {
  padding: 0 6px;
}

.discover-card {
  display: block;
  width: 152px;
  text-align: left;
}

.discover-card__cover {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
}

.discover-card__free {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 1px 6px;
  border-radius: 999px;
  color: #04231f;
  font-size: 8px;
  font-weight: 800;
  line-height: 14px;
  background: rgba(56, 225, 198, 0.94);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.discover-card__play {
  position: absolute;
  right: 9px;
  bottom: 9px;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  color: #04231f;
  background: rgba(56, 225, 198, 0.94);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.32);
}

.discover-card__name {
  display: block;
  margin-top: 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.discover-card__artist {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10.5px;
}

.home-footer {
  padding: 34px 18px calc(10px + var(--safe-bottom));
  margin: 0;
  color: rgba(255, 255, 255, 0.22);
  font-size: 10.5px;
  text-align: center;
  letter-spacing: 0.04em;
}

.home-skeleton {
  display: flex;
  gap: 14px;
  padding: 22px 18px 0;
}

.sk-cover {
  flex: 0 0 140px;
  height: 140px;
}

.sk-lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
}

.sk-line {
  height: 12px;
}

.sk-line--80 {
  width: 80%;
}

.sk-line--50 {
  width: 50%;
}

.sk-title {
  width: 110px;
  height: 18px;
}

.sk-card {
  flex: 0 0 140px;
  height: 140px;
}
</style>
