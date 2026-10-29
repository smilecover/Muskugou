<script setup lang="ts">
/**
 * 发现页：概念版全部功能入口。
 *
 * 顶部是功能宫格，下面聚合每日推荐、概念卡片、主题、场景、电台和听书。
 * 所有区块并行加载，单个接口失败只隐藏对应区块，不影响整页。
 */

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  CalendarHeart,
  Cloud,
  Clapperboard,
  Headphones,
  ListMusic,
  MoonStar,
  Palette,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import SectionHeader from '@/components/SectionHeader.vue';
import SongList from '@/components/SongList.vue';
import { fallback } from '@/api';
import {
  getAudiobookDaily,
  getConceptCard,
  getDailyRecommend,
  getFollowedArtistNewSongs,
  getFmClasses,
  getScenes,
  getThemes,
  getYueku,
  type Audiobook,
  type ConceptCard,
  type DailyRecommend,
  type FmClass,
  type Scene,
  type Theme,
  type YuekuData,
} from '@/api';
import type { Song } from '@/api';
import { usePlayerStore } from '@/stores/player';
import { useUserStore } from '@/stores/user';

defineOptions({ name: 'DiscoverView' });

const router = useRouter();
const player = usePlayerStore();
const user = useUserStore();

const loading = ref(true);
const refreshing = ref(false);

const daily = ref<DailyRecommend | null>(null);
const cardFresh = ref<ConceptCard | null>(null);
const cardVip = ref<ConceptCard | null>(null);
const themes = ref<Theme[]>([]);
const scenes = ref<Scene[]>([]);
const fmClasses = ref<FmClass[]>([]);
const audiobooks = ref<Audiobook[]>([]);
const yueku = ref<YuekuData | null>(null);
const followedNewSongs = ref<Song[]>([]);

const fmStations = computed(() => fmClasses.value.flatMap((item) => item.stations).slice(0, 12));

const shortcuts = [
  { label: '每日推荐', desc: '今天听什么', to: '/daily', icon: CalendarHeart, color: '#38e1c6' },
  { label: '电台', desc: '主题 FM', to: '/fm', icon: Radio, color: '#5b9bff' },
  { label: '听书', desc: '有声小说', to: '/audiobooks', icon: Headphones, color: '#b58cff' },
  { label: 'MV', desc: '音乐视频', to: '/videos', icon: Clapperboard, color: '#ff8c69' },
  { label: '歌单广场', desc: '按分类找歌单', to: '/square', icon: ListMusic, color: '#ffc35c' },
  { label: '主题音乐', desc: '风格歌单', to: '/themes', icon: Palette, color: '#63d8ff' },
  { label: '场景音乐', desc: '助眠/通勤', to: '/scenes', icon: MoonStar, color: '#8ea7ff' },
  { label: 'IP 专区', desc: '影视动漫', to: '/ips', icon: Sparkles, color: '#ff7eb6' },
  { label: '云盘', desc: '上传的音乐', to: '/cloud', icon: Cloud, color: '#6ee7a8' },
  { label: '账号', desc: '关注与已购', to: '/account', icon: Users, color: '#9fb4d8' },
];

async function load(initial = false): Promise<void> {
  if (initial) loading.value = true;
  else refreshing.value = true;
  try {
    const [nextDaily, fresh, vip, nextThemes, nextScenes, nextFm, nextBooks, nextYueku, nextFollowed] = await Promise.all([
      fallback(getDailyRecommend, null as DailyRecommend | null),
      fallback(() => getConceptCard(3005, 12), null as ConceptCard | null),
      fallback(() => getConceptCard(3103, 12), null as ConceptCard | null),
      fallback(getThemes, [] as Theme[]),
      fallback(getScenes, [] as Scene[]),
      fallback(getFmClasses, [] as FmClass[]),
      fallback(getAudiobookDaily, [] as Audiobook[]),
      fallback(getYueku, null as YuekuData | null),
      // 关注歌手新歌需要登录；未登录时不请求
      user.loggedIn
        ? fallback(() => getFollowedArtistNewSongs(15), [] as Song[])
        : Promise.resolve([] as Song[]),
    ]);
    daily.value = nextDaily;
    cardFresh.value = fresh;
    cardVip.value = vip;
    themes.value = nextThemes;
    scenes.value = nextScenes;
    fmClasses.value = nextFm;
    audiobooks.value = nextBooks;
    yueku.value = nextYueku;
    followedNewSongs.value = nextFollowed;
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

function playDaily(song: Song, index: number): void {
  if (!daily.value) return;
  void player.playSongs(daily.value.songs, index);
}

function playCard(card: ConceptCard | null, song: Song, index: number): void {
  if (!card) return;
  void player.playSongs(card.songs, index);
}

function playTagSongs(card: ConceptCard, tagIndex: number): void {
  const tag = card.tags[tagIndex];
  if (tag?.songs.length) void player.playSongs(tag.songs, 0);
}

onMounted(() => {
  void load(true);
});
</script>

<template>
  <div class="page discover-page">
    <header class="discover-head">
      <div>
        <p class="discover-eyebrow">EXPLORE</p>
        <h1 class="discover-title">发现</h1>
      </div>
      <button class="icon-btn" aria-label="刷新" @click="load()">
        <RefreshCw :size="18" :class="{ 'spin-icon': refreshing }" />
      </button>
    </header>

    <!-- 功能宫格 -->
    <section class="shortcut-grid">
      <button v-for="item in shortcuts" :key="item.to" class="shortcut" @click="router.push(item.to)">
        <span class="shortcut__icon" :style="{ '--tile-color': item.color }">
          <component :is="item.icon" :size="20" :stroke-width="1.9" />
        </span>
        <span class="shortcut__label">{{ item.label }}</span>
        <span class="shortcut__desc">{{ item.desc }}</span>
      </button>
    </section>

    <!-- 今日推荐 -->
    <section v-if="daily?.songs.length" class="section">
      <SectionHeader title="今日推荐" to="/daily" />
      <div class="daily-hero" @click="playDaily(daily.songs[0], 0)">
        <div class="daily-hero__cover cover-frame">
          <CoverImage :src="daily.cover || daily.songs[0]?.cover" :alt="daily.subtitle" />
          <span class="daily-hero__play"><Play :size="20" fill="currentColor" :stroke-width="0" /></span>
        </div>
        <div class="daily-hero__info">
          <p class="daily-hero__eyebrow">DAILY MIX · {{ daily.date || '今天' }}</p>
          <h2>每天为你挑 {{ daily.songs.length }} 首</h2>
          <p class="daily-hero__desc ellipsis">{{ daily.subtitle }}</p>
          <div class="daily-hero__tags">
            <span v-for="song in daily.songs.slice(0, 3)" :key="song.id" class="daily-hero__tag ellipsis">
              {{ song.name }}
            </span>
          </div>
        </div>
      </div>
      <div class="hscroll">
        <button
          v-for="(song, index) in daily.songs.slice(0, 12)"
          :key="song.id"
          class="song-card"
          @click="playDaily(song, index)"
        >
          <span class="song-card__cover cover-frame">
            <CoverImage :src="song.cover" :alt="song.name" />
            <span class="song-card__play"><Play :size="14" fill="currentColor" :stroke-width="0" /></span>
          </span>
          <span class="song-card__name ellipsis">{{ song.name }}</span>
          <span class="song-card__artist ellipsis">{{ song.artist }}</span>
        </button>
      </div>
    </section>

    <!-- 关注歌手新歌（登录后） -->
    <section v-if="followedNewSongs.length" class="section">
      <SectionHeader title="关注歌手新歌" />
      <div class="follow-songs">
        <SongList :songs="followedNewSongs" show-cover :show-index="false" />
      </div>
    </section>

    <!-- 概念卡片 -->
    <template v-if="cardFresh?.songs.length">
      <section class="section">
        <SectionHeader :title="cardFresh.title" />
        <div class="hscroll">
          <button
            v-for="(song, index) in cardFresh.songs"
            :key="`fresh-${song.id}`"
            class="song-card song-card--wide"
            @click="playCard(cardFresh, song, index)"
          >
            <span class="song-card__cover cover-frame">
              <CoverImage :src="song.cover" :alt="song.name" />
              <span class="song-card__play"><Play :size="14" fill="currentColor" :stroke-width="0" /></span>
            </span>
            <span class="song-card__name ellipsis">{{ song.name }}</span>
            <span class="song-card__artist ellipsis">{{ song.artist }}</span>
          </button>
        </div>
      </section>
    </template>

    <!-- 曲风盲盒 -->
    <section v-if="cardVip?.tags.length" class="section">
      <SectionHeader :title="cardVip.title" />
      <div class="tag-grid">
        <button
          v-for="(tag, index) in cardVip.tags"
          :key="tag.id || tag.name"
          class="tag-card"
          @click="playTagSongs(cardVip, index)"
        >
          <span class="tag-card__cover cover-frame">
            <CoverImage :src="tag.cover" :alt="tag.name" />
            <span class="tag-card__badge">盲盒</span>
          </span>
          <span class="tag-card__name ellipsis">{{ tag.name }}</span>
          <span class="tag-card__desc ellipsis">{{ tag.desc || `${tag.songs.length} 首` }}</span>
        </button>
      </div>
    </section>

    <!-- 主题 -->
    <section v-if="themes.length" class="section">
      <SectionHeader title="主题音乐" to="/themes" />
      <div class="hscroll">
        <button
          v-for="theme in themes.slice(0, 10)"
          :key="theme.id"
          class="theme-card"
          @click="router.push(`/themes/${theme.id}`)"
        >
          <span class="theme-card__cover cover-frame">
            <CoverImage :src="theme.cover" :alt="theme.title" />
            <span class="theme-card__tag">{{ theme.tag || theme.subtitle }}</span>
          </span>
          <span class="theme-card__name ellipsis">{{ theme.title }}</span>
          <span class="theme-card__sub ellipsis">{{ theme.subtitle }}</span>
        </button>
      </div>
    </section>

    <!-- 场景 -->
    <section v-if="scenes.length" class="section">
      <SectionHeader title="场景音乐" to="/scenes" />
      <div class="hscroll">
        <button
          v-for="scene in scenes"
          :key="scene.id"
          class="scene-card"
          :style="{ '--scene-color': scene.color }"
          @click="router.push('/scenes')"
        >
          <span class="scene-card__cover cover-frame">
            <CoverImage :src="scene.cover" :alt="scene.title" />
            <span class="scene-card__glow" />
            <span class="scene-card__name">{{ scene.title }}</span>
          </span>
          <span class="scene-card__desc ellipsis">{{ scene.popup || scene.intro }}</span>
        </button>
      </div>
    </section>

    <!-- 电台 -->
    <section v-if="fmStations.length" class="section">
      <SectionHeader title="精选电台" to="/fm" />
      <div class="hscroll">
        <button
          v-for="station in fmStations"
          :key="station.id"
          class="fm-card"
          @click="router.push('/fm')"
        >
          <span class="fm-card__cover cover-frame">
            <CoverImage :src="station.cover" :alt="station.name" />
            <span class="fm-card__badge">FM</span>
          </span>
          <span class="fm-card__name ellipsis">{{ station.name }}</span>
          <span class="fm-card__desc ellipsis">{{ station.description }}</span>
        </button>
      </div>
    </section>

    <!-- 听书 -->
    <section v-if="audiobooks.length" class="section">
      <SectionHeader title="听书推荐" to="/audiobooks" />
      <div class="hscroll">
        <button
          v-for="book in audiobooks.slice(0, 10)"
          :key="book.id"
          class="book-card"
          @click="router.push(`/audiobooks/${book.id}`)"
        >
          <span class="book-card__cover cover-frame">
            <CoverImage :src="book.cover" :alt="book.name" />
          </span>
          <span class="book-card__name ellipsis">{{ book.name }}</span>
          <span class="book-card__author ellipsis">{{ book.author }}</span>
        </button>
      </div>
    </section>

    <!-- 乐库新歌 -->
    <section v-if="yueku?.songs.length" class="section">
      <SectionHeader title="乐库新歌" />
      <div class="hscroll">
        <button
          v-for="(song, index) in yueku.songs.slice(0, 12)"
          :key="`yueku-${song.id}`"
          class="song-card"
          @click="player.playSongs(yueku!.songs, index)"
        >
          <span class="song-card__cover cover-frame">
            <CoverImage :src="song.cover" :alt="song.name" />
            <span class="song-card__play"><Play :size="14" fill="currentColor" :stroke-width="0" /></span>
          </span>
          <span class="song-card__name ellipsis">{{ song.name }}</span>
          <span class="song-card__artist ellipsis">{{ song.artist }}</span>
        </button>
      </div>
    </section>

    <p class="discover-footer">概念版 · 全部功能入口</p>
  </div>
</template>

<style scoped>
.discover-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: calc(18px + var(--safe-top)) 18px 10px;
}

.discover-eyebrow {
  margin: 0;
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.24em;
}

.discover-title {
  margin: 3px 0 0;
  font-size: 25px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 8px 14px 0;
}

.shortcut {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 11px 4px 10px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: var(--text);
  transition:
    background 0.16s ease,
    transform 0.12s ease;
}

.shortcut:active {
  background: var(--surface);
  transform: scale(0.96);
}

.shortcut__icon {
  display: grid;
  width: 42px;
  height: 42px;
  border: 1px solid color-mix(in srgb, var(--tile-color) 28%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--tile-color) 14%, transparent);
  color: var(--tile-color);
  place-items: center;
}

.shortcut__label {
  font-size: 11.5px;
  font-weight: 650;
}

.shortcut__desc {
  margin-top: -3px;
  color: var(--muted);
  font-size: 9px;
}

.daily-hero {
  display: flex;
  gap: 14px;
  margin: 0 18px 14px;
  padding: 14px;
  border: 1px solid rgba(56, 225, 198, 0.16);
  border-radius: 20px;
  background:
    radial-gradient(120% 150% at 0% 0%, rgba(56, 225, 198, 0.18), transparent 55%),
    linear-gradient(135deg, #101b2a, #0b121d);
  cursor: pointer;
}

.daily-hero__cover {
  position: relative;
  flex: 0 0 96px;
  width: 96px;
  height: 96px;
  border-radius: 16px;
}

.daily-hero__play {
  position: absolute;
  right: 7px;
  bottom: 7px;
  display: grid;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: #04241f;
  box-shadow: 0 6px 16px rgba(56, 225, 198, 0.35);
  place-items: center;
}

.daily-hero__info {
  flex: 1;
  min-width: 0;
}

.daily-hero__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.daily-hero__info h2 {
  margin: 4px 0 2px;
  font-size: 17px;
  font-weight: 750;
}

.daily-hero__desc {
  margin: 0;
  color: var(--text-2);
  font-size: 11.5px;
}

.daily-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 7px;
}

.daily-hero__tag {
  max-width: 100%;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--muted);
  font-size: 9.5px;
}

.follow-songs {
  padding: 0 6px;
}

.song-card,
.theme-card,
.fm-card,
.book-card,
.scene-card {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  width: 104px;
  gap: 5px;
  border: 0;
  background: none;
  color: var(--text);
  text-align: left;
}

.song-card--wide {
  width: 112px;
}

.song-card__cover,
.theme-card__cover,
.fm-card__cover,
.book-card__cover {
  position: relative;
  width: 104px;
  height: 104px;
  border-radius: 14px;
}

.song-card--wide .song-card__cover {
  width: 112px;
  height: 112px;
}

.song-card__play {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: grid;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(5, 10, 16, 0.72);
  color: var(--accent);
  opacity: 0;
  transition: opacity 0.15s ease;
  place-items: center;
}

.song-card:active .song-card__play {
  opacity: 1;
}

.song-card__name,
.theme-card__name,
.fm-card__name,
.book-card__name {
  font-size: 12.5px;
  font-weight: 620;
}

.song-card__artist,
.theme-card__sub,
.fm-card__desc,
.book-card__author {
  margin-top: -3px;
  color: var(--muted);
  font-size: 10.5px;
}

.theme-card__cover {
  display: grid;
  width: 144px;
  height: 92px;
  border-radius: 14px;
  place-items: center;
}

.theme-card {
  width: 144px;
}

.theme-card__tag {
  position: absolute;
  bottom: 6px;
  left: 7px;
  max-width: 130px;
  padding: 2px 6px;
  border-radius: 5px;
  background: rgba(4, 8, 14, 0.66);
  color: #fff;
  font-size: 9px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tag-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 0 18px;
}

.tag-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  text-align: left;
}

.tag-card__cover {
  position: relative;
  width: 100%;
  height: 104px;
  border-radius: 14px;
}

.tag-card__badge {
  position: absolute;
  top: 7px;
  left: 7px;
  padding: 2px 6px;
  border-radius: 5px;
  background: rgba(4, 8, 14, 0.66);
  color: var(--accent);
  font-size: 9px;
}

.tag-card__name {
  font-size: 13px;
  font-weight: 650;
}

.tag-card__desc {
  margin-top: -3px;
  color: var(--muted);
  font-size: 10.5px;
}

.scene-card {
  width: 148px;
}

.scene-card__cover {
  position: relative;
  display: flex;
  width: 148px;
  height: 92px;
  align-items: flex-end;
  border-radius: 16px;
}

.scene-card__cover::before {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background: linear-gradient(180deg, transparent 30%, rgba(3, 7, 12, 0.78));
  content: '';
}

.scene-card__glow {
  position: absolute;
  inset: auto 0 0;
  z-index: 1;
  height: 44px;
  border-radius: inherit;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--scene-color) 42%, transparent));
  opacity: 0.5;
}

.scene-card__name {
  position: relative;
  z-index: 2;
  padding: 0 9px 8px;
  font-size: 13px;
  font-weight: 700;
}

.scene-card__desc {
  color: var(--muted);
  font-size: 10.5px;
}

.fm-card {
  width: 132px;
}

.fm-card__cover {
  width: 132px;
  height: 132px;
}

.fm-card__badge {
  position: absolute;
  top: 7px;
  left: 7px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(4, 8, 14, 0.68);
  color: var(--accent-2);
  font-size: 9px;
  font-weight: 700;
}

.book-card {
  width: 100px;
}

.book-card__cover {
  width: 100px;
  height: 132px;
  border-radius: 12px;
}

.discover-footer {
  margin: 30px 0 4px;
  color: var(--muted);
  font-size: 10.5px;
  text-align: center;
}
</style>
