<script setup lang="ts">
/**
 * 电台 FM。
 *
 * 分类 -> 电台 -> 歌曲。点击电台会拉取一批歌曲并直接开始播放，
 * 页面下方展示当前电台的歌曲列表。
 */

import { computed, onMounted, ref } from 'vue';
import { Loader2, Play, Radio, RefreshCw } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import { fallback, getFmClasses, getFmRecommend, getFmSongs, type FmClass, type FmStation, type Song } from '@/api';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';

defineOptions({ name: 'FmView' });

const player = usePlayerStore();
const toast = useToastStore();

const classes = ref<FmClass[]>([]);
const recommended = ref<FmStation[]>([]);
const activeClass = ref('');
const activeStation = ref<FmStation | null>(null);
const songs = ref<Song[]>([]);
const loading = ref(true);
const stationLoading = ref(false);
const loadingMore = ref(false);

const currentStations = computed(() => {
  if (!activeClass.value) return recommended.value;
  return classes.value.find((item) => item.id === activeClass.value)?.stations || [];
});

const classTabs = computed(() => [
  { id: '', name: '推荐' },
  ...classes.value.map((item) => ({ id: item.id, name: item.name })),
]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [nextClasses, nextRecommended] = await Promise.all([
      fallback(getFmClasses, [] as FmClass[]),
      fallback(getFmRecommend, [] as FmStation[]),
    ]);
    classes.value = nextClasses;
    recommended.value = nextRecommended;
    if (!nextRecommended.length && nextClasses.length) {
      recommended.value = nextClasses.flatMap((item) => item.stations).slice(0, 12);
    }
  } finally {
    loading.value = false;
  }
}

async function playStation(station: FmStation): Promise<void> {
  activeStation.value = station;
  stationLoading.value = true;
  songs.value = [];
  try {
    const list = await getFmSongs(station.id, 0, 30);
    songs.value = list;
    if (list.length) {
      await player.playSongs(list, 0);
      toast.success(`正在播放：${station.name}`);
    } else {
      toast.error('这个电台暂时没有歌曲');
    }
  } catch {
    toast.error('电台加载失败');
  } finally {
    stationLoading.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (!activeStation.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const next = await getFmSongs(activeStation.value.id, songs.value.length, 30);
    const seen = new Set(songs.value.map((song) => song.id));
    const fresh = next.filter((song) => !seen.has(song.id));
    if (!fresh.length) {
      toast.error('没有更多歌曲了');
      return;
    }
    songs.value = [...songs.value, ...fresh];
  } catch {
    toast.error('加载更多失败');
  } finally {
    loadingMore.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="page fm-page">
    <DetailHeader title="电台">
      <template #actions>
        <button class="icon-btn icon-btn--ghost" aria-label="刷新" @click="load">
          <RefreshCw :size="18" />
        </button>
      </template>
    </DetailHeader>

    <p class="fm-intro">主题电台与音乐杂志，像广播一样连续播放。</p>

    <div class="chip-row fm-class">
      <button
        v-for="item in classTabs"
        :key="item.id"
        class="chip"
        :class="{ 'chip--active': activeClass === item.id }"
        @click="activeClass = item.id"
      >
        {{ item.name }}
      </button>
    </div>

    <div v-if="loading" class="fm-grid">
      <div v-for="n in 4" :key="n" class="skeleton fm-skeleton" />
    </div>

    <div v-else-if="currentStations.length" class="fm-grid">
      <button
        v-for="station in currentStations"
        :key="station.id"
        class="fm-tile"
        :class="{ 'fm-tile--active': activeStation?.id === station.id }"
        @click="playStation(station)"
      >
        <span class="fm-tile__cover cover-frame">
          <CoverImage :src="station.cover" :alt="station.name" />
          <span class="fm-tile__badge">FM</span>
          <span class="fm-tile__play">
            <Loader2 v-if="stationLoading && activeStation?.id === station.id" :size="16" class="spin-icon" />
            <Play v-else :size="15" fill="currentColor" :stroke-width="0" />
          </span>
        </span>
        <span class="fm-tile__name ellipsis">{{ station.name }}</span>
        <span class="fm-tile__desc ellipsis">{{ station.description }}</span>
      </button>
    </div>

    <div v-else class="empty-state" style="padding-top: 50px">
      <div class="empty-state__icon"><Radio :size="24" /></div>
      <p class="empty-state__title">这个分类还没有电台</p>
      <p class="empty-state__desc">换一个分类试试</p>
    </div>

    <section v-if="activeStation" class="section fm-current">
      <div class="fm-current__head">
        <div>
          <p class="fm-current__eyebrow">NOW PLAYING</p>
          <h2>{{ activeStation.name }}</h2>
          <p class="muted">{{ activeStation.description }}</p>
        </div>
        <span class="fm-current__pill">电台</span>
      </div>

      <SongList
        :songs="songs"
        :loading="stationLoading"
        empty-title="暂无歌曲"
        empty-desc="换一个电台试试"
      />

      <div v-if="songs.length" class="load-more">
        <button class="btn btn--soft btn--block btn--sm" :disabled="loadingMore" @click="loadMore">
          <Loader2 v-if="loadingMore" :size="14" class="spin-icon" />
          {{ loadingMore ? '加载中' : '换一批歌曲' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.fm-intro {
  margin: 2px 18px 12px;
  color: var(--muted);
  font-size: 12px;
}

.fm-class {
  margin-bottom: 14px;
}

.fm-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 0 18px;
}

.fm-skeleton {
  height: 154px;
  border-radius: 18px;
}

.fm-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  text-align: left;
}

.fm-tile__cover {
  position: relative;
  width: 100%;
  height: 108px;
  border-radius: 16px;
}

.fm-tile--active .fm-tile__cover {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.fm-tile__badge {
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

.fm-tile__play {
  position: absolute;
  right: 7px;
  bottom: 7px;
  display: grid;
  width: 29px;
  height: 29px;
  border-radius: 50%;
  background: rgba(5, 10, 16, 0.74);
  color: var(--accent);
  place-items: center;
}

.fm-tile__name {
  font-size: 12.5px;
  font-weight: 650;
}

.fm-tile__desc {
  margin-top: -3px;
  color: var(--muted);
  font-size: 10px;
}

.fm-current {
  padding: 0 6px;
}

.fm-current__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 12px 8px;
}

.fm-current__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.fm-current__head h2 {
  margin: 2px 0;
  font-size: 19px;
  font-weight: 750;
}

.fm-current__head .muted {
  margin: 0;
  font-size: 11.5px;
}

.fm-current__pill {
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(56, 225, 198, 0.12);
  color: var(--accent);
  font-size: 10px;
}

.load-more {
  padding: 12px 12px 0;
}
</style>
