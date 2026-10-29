<script setup lang="ts">
/**
 * 场景音乐。
 *
 * 每个场景（通勤 / 助眠 / 运动…）下有若干标签，标签 id 才是
 * `/scene/audio/list` 需要的参数；选中场景后自动加载第一个标签的歌曲。
 */

import { nextTick, onMounted, ref } from 'vue';
import { Loader2, MoonStar, Play } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import SectionHeader from '@/components/SectionHeader.vue';
import SongList from '@/components/SongList.vue';
import {
  getScenes,
  getSceneSongs,
  type Scene,
  type SceneTag,
  type Song,
} from '@/api';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';

defineOptions({ name: 'SceneView' });

const PAGE_SIZE = 30;

const player = usePlayerStore();
const toast = useToastStore();

const scenes = ref<Scene[]>([]);
const loading = ref(true);
const selected = ref<Scene | null>(null);
const activeTag = ref<SceneTag | null>(null);
const songs = ref<Song[]>([]);
const songsLoading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const page = ref(1);
const panel = ref<HTMLElement | null>(null);

let requestToken = 0;

async function loadSongs(reset = true): Promise<void> {
  const scene = selected.value;
  const tag = activeTag.value;
  if (!scene || !tag) {
    songs.value = [];
    hasMore.value = false;
    return;
  }

  const token = (requestToken += 1);
  if (reset) {
    songsLoading.value = true;
    songs.value = [];
    page.value = 1;
    hasMore.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    const result = await getSceneSongs(scene.id, tag.id, page.value, PAGE_SIZE);
    if (token !== requestToken) return;
    songs.value = reset
      ? result.songs
      : [...songs.value, ...result.songs.filter((song) => !songs.value.some((old) => old.id === song.id))];
    hasMore.value = result.hasMore && result.songs.length > 0;
    if (result.songs.length) page.value += 1;
  } catch {
    if (token !== requestToken) return;
    if (reset) songs.value = [];
    hasMore.value = false;
    toast.error('场景歌曲加载失败');
  } finally {
    if (token === requestToken) {
      songsLoading.value = false;
      loadingMore.value = false;
    }
  }
}

async function selectScene(scene: Scene, scroll = false): Promise<void> {
  selected.value = scene;
  activeTag.value = scene.tags[0] || null;
  await loadSongs(true);
  if (scroll) {
    await nextTick();
    panel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function selectTag(tag: SceneTag): Promise<void> {
  if (activeTag.value?.id === tag.id) return;
  activeTag.value = tag;
  await loadSongs(true);
}

function playAll(): void {
  if (!songs.value.length) return;
  void player.playSongs(songs.value, 0);
}

onMounted(async () => {
  try {
    scenes.value = await getScenes();
    if (scenes.value.length) await selectScene(scenes.value[0]);
  } catch {
    toast.error('场景列表加载失败');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page scene-page">
    <DetailHeader title="场景音乐" />

    <p class="scene-intro">按当下的心情挑一个场景，让音乐先响起。</p>

    <div v-if="loading" class="scene-grid">
      <div v-for="n in 4" :key="n" class="skeleton scene-skeleton" />
    </div>

    <div v-else-if="scenes.length" class="scene-grid">
      <button
        v-for="scene in scenes"
        :key="scene.id"
        class="scene-tile"
        :class="{ 'scene-tile--active': selected?.id === scene.id }"
        :style="{ '--scene-color': scene.color }"
        @click="selectScene(scene, true)"
      >
        <CoverImage :src="scene.cover || scene.background" :alt="scene.title" :icon-size="20" />
        <span class="scene-tile__shade" />
        <span class="scene-tile__name">{{ scene.title }}</span>
        <span class="scene-tile__desc ellipsis">{{ scene.popup || scene.intro }}</span>
      </button>
    </div>

    <div v-else class="empty-state" style="padding-top: 50px">
      <div class="empty-state__icon"><MoonStar :size="24" /></div>
      <p class="empty-state__title">暂无场景</p>
      <p class="empty-state__desc">稍后再来看看</p>
    </div>

    <section v-if="selected" ref="panel" class="section scene-panel">
      <SectionHeader :title="selected.title" />

      <p v-if="selected.intro" class="scene-panel__intro">{{ selected.intro }}</p>

      <div v-if="selected.tags.length" class="chip-row scene-tags">
        <button
          v-for="tag in selected.tags"
          :key="tag.id"
          class="chip"
          :class="{ 'chip--active': activeTag?.id === tag.id }"
          @click="selectTag(tag)"
        >
          {{ tag.name }}
        </button>
      </div>

      <div class="scene-actions">
        <button class="btn btn--primary scene-play" :disabled="!songs.length" @click="playAll">
          <Play :size="15" fill="currentColor" :stroke-width="0" />
          播放全部
        </button>
        <span class="muted" style="font-size: 10.5px">{{ songs.length }} 首</span>
      </div>

      <SongList
        :songs="songs"
        :loading="songsLoading"
        empty-title="这个场景还没有歌曲"
        empty-desc="换一个标签试试"
      />

      <div v-if="songs.length && hasMore" class="load-more">
        <button class="btn btn--soft btn--block btn--sm" :disabled="loadingMore" @click="loadSongs(false)">
          <Loader2 v-if="loadingMore" :size="14" class="spin-icon" />
          {{ loadingMore ? '加载中' : '加载更多' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.scene-intro {
  margin: 0 18px 14px;
  color: var(--muted);
  font-size: 11.5px;
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 11px;
  padding: 0 18px;
}

.scene-skeleton {
  height: 106px;
  border-radius: 16px;
}

.scene-tile {
  position: relative;
  display: flex;
  height: 106px;
  flex-direction: column;
  justify-content: flex-end;
  padding: 11px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 16px;
  background: var(--surface);
  color: #fff;
  text-align: left;
}

.scene-tile :deep(.cover-image) {
  position: absolute;
  inset: 0;
}

.scene-tile__shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(3, 7, 12, 0.08) 20%, rgba(3, 7, 12, 0.82)),
    linear-gradient(120deg, color-mix(in srgb, var(--scene-color) 32%, transparent), transparent 62%);
}

.scene-tile--active {
  border-color: color-mix(in srgb, var(--scene-color) 65%, transparent);
  box-shadow: 0 10px 26px color-mix(in srgb, var(--scene-color) 16%, transparent);
}

.scene-tile__name,
.scene-tile__desc {
  position: relative;
  z-index: 1;
}

.scene-tile__name {
  font-size: 14.5px;
  font-weight: 720;
}

.scene-tile__desc {
  margin-top: 1px;
  max-width: 100%;
  color: rgba(255, 255, 255, 0.64);
  font-size: 9.5px;
}

.scene-panel {
  scroll-margin-top: 66px;
}

.scene-panel__intro {
  margin: -4px 18px 12px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.55;
}

.scene-tags {
  padding: 0 18px 12px;
}

.scene-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px 6px;
}

.scene-play {
  height: 40px;
  padding: 0 18px;
}

.load-more {
  padding: 16px 18px 0;
}
</style>
