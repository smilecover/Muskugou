<script setup lang="ts">
/**
 * 歌曲列表。
 *
 * 点击任意一行会把整个列表作为播放队列，并从点击的位置开始播放；
 * 这样播放页的“上一首/下一首”始终与当前列表一致。
 */

import { Heart, Music2 } from 'lucide-vue-next';
import CoverImage from './CoverImage.vue';
import type { Song } from '@/api';
import { formatDuration } from '@/utils/format';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';

const props = withDefaults(
  defineProps<{
    songs: Song[];
    loading?: boolean;
    /** 显示序号（播放中会变成跳动音柱） */
    showIndex?: boolean;
    /** 显示封面缩略图 */
    showCover?: boolean;
    emptyTitle?: string;
    emptyDesc?: string;
    /** 是否显示收藏按钮 */
    showFavorite?: boolean;
  }>(),
  {
    loading: false,
    showIndex: true,
    showCover: false,
    emptyTitle: '暂时没有歌曲',
    emptyDesc: '换个页面或稍后再试试',
    showFavorite: true,
  },
);

const player = usePlayerStore();
const library = useLibraryStore();
const toast = useToastStore();

function isCurrent(song: Song): boolean {
  return player.current?.id === song.id;
}

function play(index: number): void {
  void player.playSongs(props.songs, index);
}

function toggleFavorite(song: Song): void {
  const added = library.toggleFavorite(song);
  toast.success(added ? '已收藏' : '已取消收藏');
}
</script>

<template>
  <div class="song-list">
    <template v-if="loading && !songs.length">
      <div v-for="n in 5" :key="n" class="song-skeleton">
        <div class="skeleton song-skeleton__cover" />
        <div class="song-skeleton__lines">
          <div class="skeleton song-skeleton__title" />
          <div class="skeleton song-skeleton__sub" />
        </div>
      </div>
    </template>

    <div
      v-for="(song, index) in songs"
      v-else-if="songs.length"
      :key="`${song.id}-${index}`"
      class="song-row"
      :class="{ 'song-row--active': isCurrent(song) }"
      role="button"
      tabindex="0"
      @click="play(index)"
      @keydown.enter="play(index)"
    >
      <div v-if="showIndex" class="song-row__index">
        <span v-if="isCurrent(song)" class="bars" :class="{ 'bars--paused': !player.playing }">
          <i />
          <i />
          <i />
        </span>
        <span v-else>{{ index + 1 }}</span>
      </div>

      <div v-if="showCover" class="song-row__cover">
        <CoverImage :src="song.cover" :alt="song.name" :icon-size="18" />
      </div>

      <div class="song-row__info">
        <div class="song-row__title-line">
          <span class="song-row__name ellipsis">{{ song.name }}</span>
          <span v-if="song.payType !== 0" class="song-row__vip">VIP</span>
        </div>
        <p class="song-row__artist ellipsis">{{ song.artist || '未知歌手' }}</p>
      </div>

      <span class="song-row__duration">{{ formatDuration(song.duration) }}</span>

      <button
        v-if="showFavorite"
        class="song-row__heart"
        :class="{ 'song-row__heart--on': library.isFavorite(song.id) }"
        :aria-label="library.isFavorite(song.id) ? '取消收藏' : '收藏'"
        @click.stop="toggleFavorite(song)"
      >
        <Heart :size="17" :fill="library.isFavorite(song.id) ? 'currentColor' : 'none'" />
      </button>

      <!-- 页面自定义行操作（如云盘删除、歌单移除）；记得在按钮上 @click.stop -->
      <slot name="actions" :song="song" :index="index" />
    </div>

    <div v-else class="empty-state">
      <div class="empty-state__icon">
        <Music2 :size="24" :stroke-width="1.5" />
      </div>
      <p class="empty-state__title">{{ emptyTitle }}</p>
      <p class="empty-state__desc">{{ emptyDesc }}</p>
    </div>
  </div>
</template>

<style scoped>
.song-list {
  display: flex;
  flex-direction: column;
}

.song-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 12px;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.song-row:active {
  background: rgba(255, 255, 255, 0.05);
}

.song-row--active {
  background: rgba(56, 225, 198, 0.055);
}

.song-row__index {
  display: grid;
  flex: 0 0 auto;
  width: 24px;
  place-items: center;
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.song-row--active .song-row__index {
  color: var(--accent);
}

.song-row__cover {
  flex: 0 0 auto;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border-radius: 11px;
}

.song-row__info {
  flex: 1;
  min-width: 0;
}

.song-row__title-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.song-row__name {
  color: var(--text);
  font-size: 14px;
  font-weight: 550;
}

.song-row--active .song-row__name {
  color: var(--accent);
}

.song-row__vip {
  flex: 0 0 auto;
  padding: 0 4px;
  border: 1px solid rgba(255, 195, 92, 0.45);
  border-radius: 4px;
  color: var(--warning);
  font-size: 8.5px;
  font-weight: 700;
  line-height: 13px;
  letter-spacing: 0.03em;
}

.song-row__artist {
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.song-row__duration {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.song-row__heart {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  margin-right: -5px;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
}

.song-row__heart--on {
  color: var(--accent);
}

.song-row__heart:active {
  background: rgba(255, 255, 255, 0.07);
}

.bars {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  width: 14px;
  height: 13px;
}

.bars i {
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
  animation: bar 0.9s ease-in-out infinite;
}

.bars i:nth-child(1) {
  height: 6px;
  animation-delay: -0.2s;
}

.bars i:nth-child(2) {
  height: 12px;
  animation-delay: -0.5s;
}

.bars i:nth-child(3) {
  height: 8px;
  animation-delay: -0.8s;
}

.bars--paused i {
  animation-play-state: paused;
}

@keyframes bar {
  0%,
  100% {
    transform: scaleY(0.45);
  }
  50% {
    transform: scaleY(1);
  }
}

.song-skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
}

.song-skeleton__cover {
  width: 46px;
  height: 46px;
  border-radius: 11px;
}

.song-skeleton__lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.song-skeleton__title {
  width: 52%;
  height: 12px;
}

.song-skeleton__sub {
  width: 32%;
  height: 9px;
  opacity: 0.7;
}
</style>
