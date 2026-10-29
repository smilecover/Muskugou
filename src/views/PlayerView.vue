<script setup lang="ts">
/**
 * 全屏播放页。
 *
 * 上半部分可在封面和歌词之间切换；歌词按当前播放时间自动滚动，
 * 点击歌词行可以直接跳转。底部包含播放模式、上一首/下一首、队列入口。
 */

import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertTriangle,
  ChevronDown,
  Clapperboard,
  Disc3,
  Heart,
  Info,
  ListMusic,
  ListPlus,
  MessageCircle,
  Mic2,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide-vue-next';
import AddToPlaylistSheet from '@/components/AddToPlaylistSheet.vue';
import CommentSheet from '@/components/CommentSheet.vue';
import CoverImage from '@/components/CoverImage.vue';
import QueueSheet from '@/components/QueueSheet.vue';
import SongInfoSheet from '@/components/SongInfoSheet.vue';
import { getSongMvs } from '@/api';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import { useToastStore } from '@/stores/toast';
import { formatSeconds } from '@/utils/format';
import { findActiveLine } from '@/utils/lyric';

const route = useRoute();
const router = useRouter();
const player = usePlayerStore();
const library = useLibraryStore();
const settings = useSettingsStore();
const toast = useToastStore();

const showLyrics = ref(false);
const queueOpen = ref(false);
const commentsOpen = ref(false);
const addOpen = ref(false);
const infoOpen = ref(false);
const mvLoading = ref(false);
const dragging = ref(false);
const dragValue = ref(0);
const lyricViewport = ref<HTMLElement | null>(null);
const lineEls = ref<(HTMLElement | null)[]>([]);

const isFavorite = computed(() => (player.current ? library.isFavorite(player.current.id) : false));

const backdropStyle = computed(() => {
  const cover = player.current?.cover;
  return cover ? { backgroundImage: `url("${cover}")` } : {};
});

const qualityLabel = computed(() => {
  if (player.preview) return '试听 60s';
  const quality = player.currentQuality;
  if (player.freeListen) return quality === '128' ? '免费听 128K' : `免费听 ${quality || ''}`.trim();
  if (!quality) return '标准';
  if (quality === 'flac') return '无损';
  if (quality === 'high') return 'Hi-Res';
  if (quality === 'super') return '超品';
  return `${quality}K`;
});

const modeIcon = computed(() => {
  if (player.mode === 'single') return Repeat1;
  if (player.mode === 'shuffle') return Shuffle;
  return Repeat;
});

const sliderMax = computed(() => Math.max(player.duration, 0.1));
const sliderValue = computed(() => (dragging.value ? dragValue.value : player.currentTime));
const sliderPercent = computed(() =>
  player.duration > 0 ? Math.min(100, Math.max(0, (sliderValue.value / player.duration) * 100)) : 0,
);

const activeLyricIndex = computed(() => findActiveLine(player.lyricLines, player.currentTime));

function goBack(): void {
  if (window.history.length > 1) router.back();
  else router.replace('/');
}

function onSeekInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  dragging.value = true;
  dragValue.value = value;
}

function onSeekChange(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  player.seek(value);
  dragValue.value = value;
  dragging.value = false;
}

function toggleFavorite(): void {
  if (!player.current) return;
  const added = library.toggleFavorite(player.current);
  toast.success(added ? '已收藏' : '已取消收藏');
}

/** 评论接口使用 mixsongid，歌曲没有 mixsongid 时退回音频 id */
const commentId = computed(() => player.current?.albumAudioId || player.current?.id || '');

/** 到酷狗查询这首歌关联的 MV，再进入视频播放页 */
async function openSongMv(): Promise<void> {
  const current = player.current;
  if (!current || mvLoading.value) return;
  if (!current.albumAudioId) {
    toast.info('这首歌还没有关联 MV');
    return;
  }
  mvLoading.value = true;
  try {
    const videos = await getSongMvs(current.albumAudioId);
    const target = videos.find((video) => video.id);
    if (target) void router.push(`/video/${target.id}`);
    else toast.info('这首歌还没有 MV');
  } catch {
    toast.error('MV 查询失败');
  } finally {
    mvLoading.value = false;
  }
}

function jumpToLyric(time: number): void {
  player.seek(time + 0.02);
  if (!player.playing) void player.resume();
}

function setLineRef(el: unknown, index: number): void {
  lineEls.value[index] = (el as HTMLElement) || null;
}

function scrollToLine(index: number, instant = false): void {
  const container = lyricViewport.value;
  if (!container) return;
  if (index < 0) {
    container.scrollTo({ top: 0, behavior: instant ? 'auto' : 'smooth' });
    return;
  }
  const el = lineEls.value[index];
  if (!el) return;
  const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
  container.scrollTo({ top: Math.max(0, top), behavior: instant ? 'auto' : 'smooth' });
}

watch(activeLyricIndex, (index) => {
  if (!showLyrics.value) return;
  void nextTick(() => scrollToLine(index));
});

watch(showLyrics, (value) => {
  if (!value) return;
  void nextTick(() => scrollToLine(activeLyricIndex.value, true));
});

watch(
  () => player.current?.id,
  () => {
    lineEls.value = [];
    if (showLyrics.value) void nextTick(() => scrollToLine(-1, true));
  },
);

onMounted(() => {
  if (route.query.queue === '1') {
    queueOpen.value = true;
    void router.replace({ name: 'player' });
  }
});
</script>

<template>
  <div class="page player-page">
    <div class="player-backdrop" :style="backdropStyle" />
    <div class="player-scrim" />

    <div class="player-content">
      <header class="player-header">
        <button class="icon-btn icon-btn--ghost" aria-label="收起播放页" @click="goBack">
          <ChevronDown :size="24" />
        </button>
        <div class="player-header__center">
          <span>正在播放</span>
          <span v-if="player.preview" class="player-header__preview">试听</span>
          <span v-else-if="player.freeListen" class="player-header__free">免费听</span>
        </div>
        <span class="player-header__quality">{{ qualityLabel }}</span>
      </header>

      <template v-if="player.current">
        <div class="player-main">
          <!-- 封面 / 歌词 -->
          <div class="stage">
            <Transition name="stage" mode="out-in">
              <div v-if="!showLyrics" key="cover" class="artwork-wrap" @click="showLyrics = true">
                <div class="vinyl" :class="{ 'vinyl--spinning': player.playing }" />
                <div class="artwork">
                  <CoverImage :src="player.current.cover" :alt="player.current.name" :icon-size="42" />
                </div>
              </div>

              <div v-else key="lyrics" class="lyrics">
                <div class="lyrics__head">
                  <span>歌词</span>
                  <button
                    class="lyrics__translation"
                    :class="{ 'lyrics__translation--on': settings.state.showTranslation }"
                    @click="settings.toggleShowTranslation()"
                  >
                    翻译
                  </button>
                </div>

                <div v-if="player.lyricLoading" class="lyrics__state">
                  <span class="spinner" />
                  正在加载歌词
                </div>
                <div v-else-if="!player.lyricLines.length" class="lyrics__state">
                  <Mic2 :size="22" :stroke-width="1.5" />
                  暂无歌词
                </div>
                <div v-else ref="lyricViewport" class="lyrics__viewport">
                  <button
                    v-for="(line, index) in player.lyricLines"
                    :key="`${line.time}-${index}`"
                    :ref="(el) => setLineRef(el, index)"
                    class="lyric-line"
                    :class="{ 'lyric-line--active': index === activeLyricIndex }"
                    @click="jumpToLyric(line.time)"
                  >
                    <span class="lyric-line__text">{{ line.text }}</span>
                    <span
                      v-if="settings.state.showTranslation && line.translation"
                      class="lyric-line__translation"
                    >
                      {{ line.translation }}
                    </span>
                  </button>
                  <div class="lyrics__spacer" />
                </div>
              </div>
            </Transition>
          </div>

          <!-- 歌曲信息 -->
          <div class="track-info">
            <div class="track-title-line">
              <h1 class="track-title ellipsis">{{ player.current.name }}</h1>
              <span v-if="player.preview" class="preview-chip">试听</span>
              <span v-else-if="player.freeListen" class="free-chip">免费听</span>
              <button class="track-info-btn" aria-label="歌曲信息" @click="infoOpen = true">
                <Info :size="15" />
              </button>
            </div>
            <router-link
              v-if="player.current.artistIds?.length"
              :to="{ name: 'artist', params: { id: player.current.artistIds[0] } }"
              class="track-artist ellipsis"
            >
              {{ player.current.artist || '未知歌手' }}
            </router-link>
            <p v-else class="track-artist ellipsis">{{ player.current.artist || '未知歌手' }}</p>
          </div>

          <!-- 播放失败 / 自动播放提示 -->
          <div v-if="player.error" class="playback-error">
            <AlertTriangle :size="16" />
            <span>{{ player.error }}</span>
            <button class="playback-error__retry" @click="player.retryCurrent()">
              <RefreshCw :size="13" />
              重试
            </button>
          </div>
          <p v-else-if="player.needsGesture" class="playback-hint">
            已加载完成，点按播放按钮开始播放
          </p>

          <!-- 进度 -->
          <div class="progress-block">
            <input
              class="progress-range"
              type="range"
              min="0"
              :max="sliderMax"
              step="0.1"
              :value="sliderValue"
              :style="`--progress: ${sliderPercent}%`"
              aria-label="播放进度"
              @input="onSeekInput"
              @change="onSeekChange"
            />
            <div class="progress-times">
              <span>{{ formatSeconds(sliderValue) }}</span>
              <span>{{ formatSeconds(player.duration) }}</span>
            </div>
          </div>

          <!-- 控制区 -->
          <div class="controls">
            <button
              class="control control--side"
              :class="{ 'control--active': player.mode !== 'list' }"
              :aria-label="player.modeLabel"
              @click="player.cycleMode()"
            >
              <component :is="modeIcon" :size="21" />
            </button>

            <button class="control control--skip" aria-label="上一首" @click="player.prev()">
              <SkipBack :size="30" fill="currentColor" :stroke-width="0.8" />
            </button>

            <button class="play-button" :aria-label="player.playing ? '暂停' : '播放'" @click="player.toggle()">
              <span v-if="player.loading" class="spinner play-button__spinner" />
              <Pause v-else-if="player.playing" :size="32" fill="currentColor" :stroke-width="0" />
              <Play v-else :size="32" fill="currentColor" :stroke-width="0" class="play-button__icon" />
            </button>

            <button class="control control--skip" aria-label="下一首" @click="player.next()">
              <SkipForward :size="30" fill="currentColor" :stroke-width="0.8" />
            </button>

            <button class="control control--side" aria-label="播放队列" @click="queueOpen = true">
              <ListMusic :size="21" />
              <span v-if="player.queue.length" class="control__badge">{{ player.queue.length }}</span>
            </button>
          </div>

          <!-- 收藏 / 歌单 / 评论 / MV / 音质 / 歌词 -->
          <div class="player-actions">
            <button class="action" :class="{ 'action--active': isFavorite }" @click="toggleFavorite">
              <Heart :size="19" :fill="isFavorite ? 'currentColor' : 'none'" />
              <span>{{ isFavorite ? '已收藏' : '收藏' }}</span>
            </button>

            <button class="action" @click="addOpen = true">
              <ListPlus :size="19" />
              <span>歌单</span>
            </button>

            <button class="action" @click="commentsOpen = true">
              <MessageCircle :size="19" />
              <span>评论</span>
            </button>

            <button class="action" :disabled="mvLoading" @click="openSongMv">
              <Clapperboard :size="19" />
              <span>MV</span>
            </button>

            <span class="quality-badge" :class="{ 'quality-badge--preview': player.preview }">
              {{ qualityLabel }}
            </span>

            <button class="action" @click="showLyrics = !showLyrics">
              <Disc3 v-if="showLyrics" :size="19" />
              <Mic2 v-else :size="19" />
              <span>{{ showLyrics ? '封面' : '歌词' }}</span>
            </button>
          </div>
        </div>
      </template>

      <div v-else class="player-empty">
        <div class="empty-state__icon">
          <Disc3 :size="26" :stroke-width="1.5" />
        </div>
        <p class="empty-state__title">当前没有播放</p>
        <p class="empty-state__desc">去首页发现一首喜欢的歌吧</p>
        <button class="btn btn--primary btn--sm" style="margin-top: 10px" @click="router.replace('/')">
          去首页
        </button>
      </div>
    </div>

    <QueueSheet :open="queueOpen" @close="queueOpen = false" />

    <CommentSheet
      v-if="player.current"
      :open="commentsOpen"
      resource="song"
      :id="commentId"
      :name="player.current.name"
      @close="commentsOpen = false"
    />

    <AddToPlaylistSheet
      :open="addOpen"
      :songs="player.current ? [player.current] : []"
      @close="addOpen = false"
    />

    <SongInfoSheet :open="infoOpen" :song="player.current" @close="infoOpen = false" />
  </div>
</template>

<style scoped>
.player-page {
  position: relative;
  display: flex;
  height: 100%;
  overflow: hidden;
  padding: 0;
}

.player-backdrop {
  position: absolute;
  inset: -80px;
  background-position: center;
  background-size: cover;
  filter: blur(64px) saturate(1.4);
  opacity: 0.42;
  transform: scale(1.15);
  transition: background-image 0.4s ease;
}

.player-scrim {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(90% 60% at 50% 0%, rgba(7, 11, 18, 0.2), rgba(7, 11, 18, 0.78) 62%, #070b12 100%),
    linear-gradient(180deg, rgba(7, 11, 18, 0.35), rgba(7, 11, 18, 0.85));
}

.player-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.player-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: calc(10px + var(--safe-top)) 14px 4px;
}

.player-header__center {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.player-header__preview {
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--warning);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0;
  background: rgba(255, 195, 92, 0.12);
}

.player-header__free {
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--accent);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0;
  background: var(--accent-soft);
}

.player-header__quality {
  min-width: 44px;
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: right;
}

.player-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 0 24px calc(14px + var(--safe-bottom));
}

.stage {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 8px 0 12px;
}

/* 封面 */
.artwork-wrap {
  position: relative;
  width: min(74vw, 320px, 42vh);
  aspect-ratio: 1;
  cursor: pointer;
}

.vinyl {
  position: absolute;
  top: 7%;
  right: -16%;
  width: 86%;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #10151d 0 18%, transparent 18.5%),
    repeating-radial-gradient(circle at center, #161b23 0 2px, #0b0f15 3px 5px);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
  animation: vinyl-spin 16s linear infinite;
  animation-play-state: paused;
}

.vinyl::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 30%;
  aspect-ratio: 1;
  border: 1px solid rgba(56, 225, 198, 0.3);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(56, 225, 198, 0.25), rgba(7, 11, 18, 0.9) 70%);
  transform: translate(-50%, -50%);
  content: '';
}

.vinyl--spinning {
  animation-play-state: running;
}

@keyframes vinyl-spin {
  to {
    transform: rotate(360deg);
  }
}

.artwork {
  position: relative;
  z-index: 1;
  width: 84%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 24px;
  box-shadow: 0 26px 60px rgba(0, 0, 0, 0.55);
}

/* 歌词 */
.lyrics {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.lyrics__head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 6px;
  color: var(--muted);
  font-size: 10.5px;
  letter-spacing: 0.12em;
}

.lyrics__translation {
  padding: 3px 9px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 9.5px;
  letter-spacing: 0.04em;
}

.lyrics__translation--on {
  border-color: rgba(56, 225, 198, 0.3);
  color: var(--accent);
  background: var(--accent-soft);
}

.lyrics__state {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
}

.lyrics__viewport {
  flex: 1;
  min-height: 0;
  padding: 8px 4px;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent, #000 12%, #000 86%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 12%, #000 86%, transparent);
  overscroll-behavior: contain;
}

.lyrics__viewport::-webkit-scrollbar {
  display: none;
}

.lyric-line {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 9px 10px;
  color: rgba(255, 255, 255, 0.34);
  font-size: 15px;
  font-weight: 550;
  line-height: 1.42;
  text-align: center;
  transition: color 0.25s ease, transform 0.25s ease;
  transform-origin: center;
}

.lyric-line__text {
  transition: transform 0.25s var(--ease-out);
}

.lyric-line--active {
  color: var(--text);
}

.lyric-line--active .lyric-line__text {
  color: var(--accent);
  font-size: 17px;
  font-weight: 700;
  transform: scale(1.02);
}

.lyric-line__translation {
  color: rgba(255, 255, 255, 0.3);
  font-size: 11px;
  font-weight: 400;
}

.lyric-line--active .lyric-line__translation {
  color: rgba(255, 255, 255, 0.56);
}

.lyrics__spacer {
  height: 42%;
}

/* 歌曲信息 */
.track-info {
  flex: 0 0 auto;
  padding: 2px 2px 0;
}

.track-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.track-title {
  margin: 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: 750;
  letter-spacing: -0.015em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.track-info-btn {
  display: grid;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.05);
}

.track-info-btn:active {
  color: var(--accent);
  background: var(--accent-soft);
}

.preview-chip {
  flex: 0 0 auto;
  padding: 1px 6px;
  border: 1px solid rgba(255, 195, 92, 0.4);
  border-radius: 4px;
  color: var(--warning);
  font-size: 8.5px;
  font-weight: 700;
  line-height: 14px;
}

.free-chip {
  flex: 0 0 auto;
  padding: 1px 6px;
  border: 1px solid rgba(56, 225, 198, 0.36);
  border-radius: 4px;
  color: var(--accent);
  font-size: 8.5px;
  font-weight: 700;
  line-height: 14px;
  background: rgba(56, 225, 198, 0.08);
}

/* 播放失败 / 自动播放提示 */
.playback-error {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 9px 11px;
  border: 1px solid rgba(255, 99, 119, 0.3);
  border-radius: 12px;
  color: #ffb3bd;
  font-size: 10.5px;
  line-height: 1.4;
  background: rgba(255, 99, 119, 0.08);
}

.playback-error > svg {
  flex: 0 0 auto;
}

.playback-error > span {
  flex: 1;
  min-width: 0;
}

.playback-error__retry {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 4px 9px;
  border-radius: 999px;
  color: var(--text);
  font-size: 10px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.12);
}

.playback-error__retry:active {
  background: rgba(255, 255, 255, 0.2);
}

.playback-hint {
  flex: 0 0 auto;
  margin: 10px 0 0;
  padding: 8px 10px;
  border: 1px solid rgba(56, 225, 198, 0.18);
  border-radius: 10px;
  color: var(--text-2);
  font-size: 10.5px;
  text-align: center;
  background: rgba(56, 225, 198, 0.06);
}

.track-artist {
  display: block;
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12.5px;
}

a.track-artist {
  color: var(--text-2);
}

/* 进度 */
.progress-block {
  flex: 0 0 auto;
  padding: 14px 0 0;
}

.progress-range {
  display: block;
  width: 100%;
  height: 22px;
  margin: 0;
  padding: 9px 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}

.progress-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--accent) 0%,
    var(--accent) var(--progress, 0%),
    rgba(255, 255, 255, 0.16) var(--progress, 0%),
    rgba(255, 255, 255, 0.16) 100%
  );
}

.progress-range::-webkit-slider-thumb {
  width: 13px;
  height: 13px;
  margin-top: -4.5px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
  appearance: none;
  -webkit-appearance: none;
}

.progress-range::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
}

.progress-range::-moz-range-progress {
  height: 4px;
  border-radius: 999px;
  background: var(--accent);
}

.progress-range::-moz-range-thumb {
  width: 13px;
  height: 13px;
  border: 0;
  border-radius: 50%;
  background: #fff;
}

.progress-times {
  display: flex;
  justify-content: space-between;
  margin-top: -2px;
  color: var(--muted);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
}

/* 控制 */
.controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 12px 2px 8px;
}

.control {
  position: relative;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  color: var(--text-2);
  transition: color 0.18s ease, transform 0.15s ease;
}

.control:active {
  transform: scale(0.92);
}

.control--side {
  color: var(--muted);
}

.control--active {
  color: var(--accent);
}

.control--skip {
  width: 50px;
  height: 50px;
  color: var(--text);
}

.control__badge {
  position: absolute;
  top: 2px;
  right: 0;
  min-width: 14px;
  padding: 0 3px;
  border-radius: 999px;
  color: #04231f;
  font-size: 8px;
  font-weight: 700;
  line-height: 13px;
  text-align: center;
  background: var(--accent);
}

.play-button {
  display: grid;
  width: 68px;
  height: 68px;
  place-items: center;
  border-radius: 50%;
  color: #04231f;
  background: var(--accent-gradient);
  box-shadow: 0 12px 34px rgba(56, 225, 198, 0.3);
  transition: transform 0.16s var(--ease-out);
}

.play-button:active {
  transform: scale(0.94);
}

.play-button__icon {
  margin-left: 3px;
}

.play-button__spinner {
  width: 24px;
  height: 24px;
  border-color: rgba(4, 35, 31, 0.25);
  border-top-color: #04231f;
}

.player-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px 0;
}

.action {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 4px;
  color: var(--muted);
  font-size: 10.5px;
  transition: color 0.18s ease;
}

.action--active {
  color: var(--accent);
}

.quality-badge {
  padding: 3px 10px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  color: var(--text-2);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.quality-badge--preview {
  border-color: rgba(255, 195, 92, 0.32);
  color: var(--warning);
  background: rgba(255, 195, 92, 0.08);
}

/* 空状态 */
.player-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding-bottom: 8vh;
}

/* 封面/歌词切换 */
.stage-enter-active,
.stage-leave-active {
  transition: opacity 0.22s ease, transform 0.22s var(--ease-out);
}

.stage-enter-from,
.stage-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
