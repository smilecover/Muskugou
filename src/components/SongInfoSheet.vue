<script setup lang="ts">
/**
 * 歌曲信息底部弹层。
 *
 * 三个分区：
 * - 相关版本：`/audio/related` 返回的翻唱 / Live / 伴奏等，可直接播放；
 * - AI 推荐：`/song/ai/recommend` 按当前歌曲推荐相似歌曲；
 * - 上榜成绩：`/song/ranking` 返回的全球平台排名。
 *
 * 接口失败只影响对应分区；弹层打开时才请求，避免影响播放页首屏。
 */

import { ref, watch } from 'vue';
import { BarChart3, Layers, Loader2, Play, Sparkles } from 'lucide-vue-next';
import CoverImage from './CoverImage.vue';
import {
  fallback,
  getAiRecommendSongs,
  getRelatedSongs,
  getSongRanking,
  type Song,
  type SongRanking,
} from '@/api';
import { formatDuration } from '@/utils/format';
import { usePlayerStore } from '@/stores/player';

const props = defineProps<{
  open: boolean;
  song: Song | null;
}>();

const emit = defineEmits<{ close: [] }>();

const player = usePlayerStore();

type InfoTab = 'related' | 'ai' | 'ranking';

const tab = ref<InfoTab>('related');
const related = ref<Song[]>([]);
const aiSongs = ref<Song[]>([]);
const ranking = ref<SongRanking | null>(null);
const loadingRelated = ref(false);
const loadingAi = ref(false);
const loadingRanking = ref(false);
const error = ref('');

async function load(): Promise<void> {
  const song = props.song;
  if (!song) return;
  error.value = '';
  related.value = [];
  aiSongs.value = [];
  ranking.value = null;

  loadingRelated.value = true;
  loadingAi.value = true;
  loadingRanking.value = true;

  // 三个分区并行请求，各自失败时为空
  const [, nextAi, nextRanking] = await Promise.all([
    fallback(async () => {
      const result = await getRelatedSongs(song, 1, 30);
      related.value = result.songs;
    }, undefined),
    fallback(async () => {
      const mixId = song.albumAudioId || song.id;
      if (!mixId) return [] as Song[];
      return getAiRecommendSongs(mixId);
    }, [] as Song[]),
    fallback(() => getSongRanking(song), null as SongRanking | null),
  ]);

  aiSongs.value = nextAi;
  ranking.value = nextRanking;
  loadingRelated.value = false;
  loadingAi.value = false;
  loadingRanking.value = false;

  if (!related.value.length && !aiSongs.value.length && !ranking.value?.items.length) {
    error.value = '暂时没有这首歌的更多信息';
  }
}

function playRelated(song: Song, index: number): void {
  if (!related.value.length) return;
  void player.playSongs(related.value, index);
}

function playAi(song: Song, index: number): void {
  if (!aiSongs.value.length) return;
  void player.playSongs(aiSongs.value, index);
}

watch(
  () => [props.open, props.song?.id] as const,
  ([open]) => {
    if (!open) return;
    tab.value = 'related';
    void load();
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="info-root">
        <div class="sheet-mask" @click="emit('close')" />
        <section class="sheet info-sheet">
          <div class="sheet__handle" />
          <header class="info-head">
            <div class="info-head__text">
              <h2 class="sheet__title">歌曲信息</h2>
              <p class="info-head__song ellipsis">{{ song?.name || '未知歌曲' }}</p>
            </div>
            <span class="info-head__artist ellipsis">{{ song?.artist }}</span>
          </header>

          <div class="segmented info-tabs">
            <button
              class="segmented__item"
              :class="{ 'segmented__item--active': tab === 'related' }"
              @click="tab = 'related'"
            >
              <Layers :size="14" />
              相关版本
            </button>
            <button
              class="segmented__item"
              :class="{ 'segmented__item--active': tab === 'ai' }"
              @click="tab = 'ai'"
            >
              <Sparkles :size="14" />
              AI 推荐
            </button>
            <button
              class="segmented__item"
              :class="{ 'segmented__item--active': tab === 'ranking' }"
              @click="tab = 'ranking'"
            >
              <BarChart3 :size="14" />
              上榜成绩
            </button>
          </div>

          <!-- 相关版本 -->
          <template v-if="tab === 'related'">
            <div v-if="loadingRelated" class="info-state">
              <Loader2 :size="17" class="spin-icon" />
              正在查找相关版本
            </div>
            <div v-else-if="related.length" class="info-list">
              <button
                v-for="(item, index) in related"
                :key="item.id"
                class="info-row"
                @click="playRelated(item, index)"
              >
                <span class="info-row__cover">
                  <CoverImage :src="item.cover" :alt="item.name" :icon-size="14" />
                  <span class="info-row__play">
                    <Play :size="11" fill="currentColor" :stroke-width="0" />
                  </span>
                </span>
                <span class="info-row__info">
                  <span class="info-row__name ellipsis">{{ item.name }}</span>
                  <span class="info-row__sub ellipsis">{{ item.artist }}</span>
                </span>
                <span class="info-row__duration">{{ formatDuration(item.duration) }}</span>
              </button>
            </div>
            <div v-else class="info-state">
              <Layers :size="20" class="muted" />
              <p>没有找到翻唱或其它版本</p>
            </div>
          </template>

          <!-- AI 推荐 -->
          <template v-else-if="tab === 'ai'">
            <div v-if="loadingAi" class="info-state">
              <Loader2 :size="17" class="spin-icon" />
              正在生成推荐
            </div>
            <div v-else-if="aiSongs.length" class="info-list">
              <button
                v-for="(item, index) in aiSongs"
                :key="`ai-${item.id}`"
                class="info-row"
                @click="playAi(item, index)"
              >
                <span class="info-row__cover">
                  <CoverImage :src="item.cover" :alt="item.name" :icon-size="14" />
                  <span class="info-row__play">
                    <Play :size="11" fill="currentColor" :stroke-width="0" />
                  </span>
                </span>
                <span class="info-row__info">
                  <span class="info-row__name ellipsis">{{ item.name }}</span>
                  <span class="info-row__sub ellipsis">{{ item.artist }}</span>
                </span>
                <span class="info-row__duration">{{ formatDuration(item.duration) }}</span>
              </button>
            </div>
            <div v-else class="info-state">
              <Sparkles :size="20" class="muted" />
              <p>暂时没有 AI 推荐</p>
            </div>
          </template>

          <!-- 上榜成绩 -->
          <template v-else>
            <div v-if="loadingRanking" class="info-state">
              <Loader2 :size="17" class="spin-icon" />
              正在查询上榜成绩
            </div>
            <template v-else-if="ranking?.items.length">
              <p v-if="ranking.subtitle" class="info-ranking__sub ellipsis">
                {{ ranking.title }} · {{ ranking.subtitle }}
              </p>
              <div class="info-list">
                <div v-for="item in ranking.items" :key="`${item.platform}-${item.rank}`" class="info-row">
                  <span class="info-row__logo">
                    <CoverImage :src="item.logo" :alt="item.name" :icon-size="13" />
                  </span>
                  <span class="info-row__info">
                    <span class="info-row__name ellipsis">{{ item.name || item.platform }}</span>
                    <span class="info-row__sub ellipsis">
                      {{ item.lastTime || '最近在榜' }}
                      <template v-if="item.times"> · 在榜 {{ item.times }} 次</template>
                    </span>
                  </span>
                  <span class="info-row__rank">#{{ item.rank }}</span>
                </div>
              </div>
            </template>
            <div v-else class="info-state">
              <BarChart3 :size="20" class="muted" />
              <p>这首歌还没有上榜记录</p>
            </div>
          </template>

          <p v-if="error" class="info-error">{{ error }}</p>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.info-sheet {
  display: flex;
  flex-direction: column;
}

.info-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.info-head__text {
  min-width: 0;
}

.info-head__song {
  margin: 2px 0 0;
  color: var(--text-2);
  font-size: 11px;
}

.info-head__artist {
  flex: 0 0 38%;
  color: var(--muted);
  font-size: 10.5px;
  text-align: right;
}

.info-tabs {
  margin: 12px 0 10px;
}

.info-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 14px 22px;
  color: var(--muted);
  font-size: 11.5px;
  text-align: center;
}

.info-state p {
  margin: 0;
}

.info-list {
  max-height: min(46vh, 430px);
  margin: 0 -6px;
  overflow-y: auto;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 8px 6px;
  border-radius: 12px;
  color: var(--text);
  text-align: left;
}

button.info-row:active {
  background: rgba(255, 255, 255, 0.05);
}

.info-row__cover {
  position: relative;
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  overflow: hidden;
  border-radius: 10px;
}

.info-row__play {
  position: absolute;
  right: 3px;
  bottom: 3px;
  display: grid;
  width: 17px;
  height: 17px;
  place-items: center;
  border-radius: 50%;
  color: #04231f;
  background: rgba(56, 225, 198, 0.92);
}

.info-row__logo {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  overflow: hidden;
  border-radius: 10px;
}

.info-row__info {
  flex: 1;
  min-width: 0;
}

.info-row__name {
  display: block;
  font-size: 12.5px;
  font-weight: 550;
}

.info-row__sub {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.info-row__duration {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.info-row__rank {
  flex: 0 0 auto;
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.info-ranking__sub {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 10.5px;
}

.info-error {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 10px;
  text-align: center;
}
</style>
