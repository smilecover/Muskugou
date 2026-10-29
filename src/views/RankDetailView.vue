<script setup lang="ts">
/**
 * 榜单详情。
 *
 * 酷狗榜单用 `rankid + rank_cid` 定位；`rank_cid` 从榜单列表带过来，
 * 直接访问链接时可能为空，接口仍能返回默认内容。
 */

import { computed, onMounted, ref, watch } from 'vue';
import { Crown, Play, Shuffle, TrendingUp } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import {
  fallback,
  getRankDetail,
  getRankVolumes,
  toErrorMessage,
  type Rank,
  type RankVolume,
  type Song,
} from '@/api';
import { formatCount } from '@/utils/format';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';

const props = defineProps<{ id: string; cid: string }>();

const player = usePlayerStore();
const toast = useToastStore();

const rank = ref<Rank | null>(null);
const songs = ref<Song[]>([]);
const total = ref(0);
const page = ref(0);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref('');

/** 当前选中的期数；空字符串表示最新一期 */
const activeCid = ref(props.cid || '');
const volumes = ref<RankVolume[]>([]);

/** 把「年份 -> 期数」拍平成一行可横向滚动的选项 */
const volumeOptions = computed(() =>
  volumes.value.flatMap((group) =>
    group.vols.map((vol) => ({ ...vol, year: group.year })),
  ),
);

let requestToken = 0;

const hasMore = computed(() => songs.value.length > 0 && songs.value.length < total.value);

/**
 * 加载榜单内容。
 * `cid` 传入期数；不传时使用路由上的 `rank_cid`（最新一期）。
 */
async function loadInitial(cid = props.cid || ''): Promise<void> {
  const token = (requestToken += 1);
  loading.value = true;
  error.value = '';
  activeCid.value = cid;
  rank.value = null;
  songs.value = [];
  total.value = 0;
  page.value = 0;

  // 往期列表只需请求一次，失败时不影响主内容
  if (!volumes.value.length) void loadVolumes(token);

  try {
    const result = await getRankDetail(props.id, cid, 1, 50);
    if (token !== requestToken) return;
    rank.value = result.rank;
    songs.value = result.songs;
    total.value = Math.max(result.total, result.songs.length);
    page.value = 1;
  } catch (err) {
    if (token !== requestToken) return;
    error.value = toErrorMessage(err);
    toast.error(error.value);
  } finally {
    if (token === requestToken) loading.value = false;
  }
}

/** 获取榜单往期（年份 + 期数） */
async function loadVolumes(token = requestToken): Promise<void> {
  const result = await fallback(() => getRankVolumes(props.id), []);
  if (token !== requestToken) return;
  volumes.value = result;
}

/** 切换到某一期；空字符串表示最新一期 */
function selectVolume(volId: string): void {
  if (volId === activeCid.value) return;
  void loadInitial(volId);
}

async function loadMore(): Promise<void> {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  const token = requestToken;
  try {
    const result = await getRankDetail(props.id, activeCid.value, page.value + 1, 50);
    if (token !== requestToken) return;
    const seen = new Set(songs.value.map((song) => song.id));
    songs.value = [...songs.value, ...result.songs.filter((song) => !seen.has(song.id))];
    page.value += 1;
    if (!result.songs.length) total.value = songs.value.length;
    else total.value = Math.max(result.total, songs.value.length);
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    loadingMore.value = false;
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

watch(
  () => props.id,
  () => {
    volumes.value = [];
    void loadInitial();
  },
);

watch(
  () => props.cid,
  () => void loadInitial(),
);

onMounted(() => void loadInitial());
</script>

<template>
  <div class="page rank-page">
    <DetailHeader :title="rank?.name || '榜单'" />

    <template v-if="loading && !rank">
      <div class="rk-hero">
        <div class="skeleton rk-cover-skeleton" />
        <div class="rk-hero__info">
          <div class="skeleton sk-line sk-line--80" />
          <div class="skeleton sk-line sk-line--50" />
          <div class="skeleton sk-line sk-line--35" />
        </div>
      </div>
    </template>

    <template v-else-if="rank || songs.length">
      <section class="rk-hero">
        <div class="rk-cover">
          <CoverImage :src="rank?.cover" :alt="rank?.name" :icon-size="30" />
          <span class="rk-crown"><Crown :size="15" fill="currentColor" :stroke-width="0" /></span>
        </div>
        <div class="rk-hero__info">
          <p class="rk-kind"><TrendingUp :size="10" /> CHART</p>
          <h1 class="rk-name clamp-2">{{ rank?.name || '热门榜单' }}</h1>
          <p v-if="rank?.updateFrequency" class="rk-update ellipsis">{{ rank.updateFrequency }}</p>
          <p class="rk-meta">
            <span>{{ total || songs.length }} 首</span>
            <template v-if="rank?.playCount"><span class="dot">·</span>{{ formatCount(rank.playCount) }} 次播放</template>
          </p>
        </div>
      </section>

      <p v-if="rank?.intro" class="rk-intro clamp-2">{{ rank.intro }}</p>

      <!-- 往期选择（/rank/vol）；选择后按 volid 作为 rank_cid 重新拉取 -->
      <div v-if="volumeOptions.length" class="rk-vols">
        <button
          class="rk-vol"
          :class="{ 'rk-vol--active': !activeCid }"
          @click="selectVolume('')"
        >
          最新
        </button>
        <button
          v-for="vol in volumeOptions"
          :key="vol.id || vol.name"
          class="rk-vol"
          :class="{ 'rk-vol--active': activeCid === vol.id }"
          :title="vol.year"
          @click="selectVolume(vol.id)"
        >
          {{ vol.name || vol.id }}
        </button>
      </div>

      <div class="rk-actions">
        <button class="btn btn--primary rk-play" :disabled="!songs.length" @click="playAll">
          <Play :size="18" fill="currentColor" :stroke-width="0" />
          播放全部
        </button>
        <button class="icon-btn rk-shuffle" :disabled="!songs.length" aria-label="随机播放" @click="shufflePlay">
          <Shuffle :size="19" />
        </button>
      </div>

      <div class="rk-songs">
        <SongList
          :songs="songs"
          :loading="loading"
          show-index
          empty-title="榜单暂时没有歌曲"
          empty-desc="稍后再来看看吧"
        />
      </div>

      <div v-if="!loading && hasMore" class="load-more">
        <button class="btn btn--soft btn--sm" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '加载中…' : '加载更多' }}
        </button>
      </div>
      <div v-else-if="!loading && songs.length" class="end-hint">已经到底了</div>
    </template>

    <div v-else class="empty-state">
      <p class="empty-state__title">{{ error ? '榜单加载失败' : '没有找到这个榜单' }}</p>
      <p class="empty-state__desc">{{ error || '榜单可能已更新，请返回列表重试' }}</p>
      <button class="btn btn--soft btn--sm" style="margin-top: 8px" @click="loadInitial()">重新加载</button>
    </div>
  </div>
</template>

<style scoped>
.rank-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.rk-hero {
  display: flex;
  gap: 16px;
  padding: 10px 18px 0;
}

.rk-hero__info {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}

.rk-cover {
  position: relative;
  flex: 0 0 auto;
  width: 118px;
  height: 118px;
  overflow: hidden;
  border-radius: 18px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.42);
}

.rk-cover-skeleton {
  flex: 0 0 auto;
  width: 118px;
  height: 118px;
  border-radius: 18px;
}

.rk-crown {
  position: absolute;
  top: 8px;
  left: 8px;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  color: #3a2600;
  background: linear-gradient(135deg, #ffd777, #f5a623);
}

.rk-kind {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: var(--warning);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.rk-name {
  margin: 5px 0 0;
  font-size: 21px;
  font-weight: 750;
  line-height: 1.3;
  letter-spacing: -0.015em;
}

.rk-update {
  margin: 6px 0 0;
  color: var(--text-2);
  font-size: 11.5px;
}

.rk-meta {
  display: flex;
  align-items: center;
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.dot {
  margin: 0 5px;
}

.rk-intro {
  padding: 0 18px;
  margin: 14px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

/* 往期选择 */
.rk-vols {
  display: flex;
  gap: 7px;
  padding: 14px 18px 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.rk-vols::-webkit-scrollbar {
  display: none;
}

.rk-vol {
  flex: 0 0 auto;
  padding: 5px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 10.5px;
  background: rgba(255, 255, 255, 0.03);
  transition: color 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.rk-vol--active {
  border-color: rgba(56, 225, 198, 0.35);
  color: var(--accent);
  background: var(--accent-soft);
}

.rk-actions {
  display: flex;
  gap: 10px;
  padding: 18px 18px 10px;
}

.rk-play {
  flex: 1;
  height: 48px;
}

.rk-shuffle {
  width: 48px;
  height: 48px;
  color: var(--warning);
  background: rgba(255, 195, 92, 0.13);
}

.rk-songs {
  padding: 4px 6px 0;
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
