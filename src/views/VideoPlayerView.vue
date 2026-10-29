<script setup lang="ts">
/**
 * MV 播放页。
 *
 * 先取视频详情里的各清晰度 hash，再换取播放地址；播放失败会自动尝试
 * 备用 CDN。清晰度切换会重新解析地址。
 */

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { AlertCircle, Loader2, Play } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import { getVideoDetail, getVideoUrls, type VideoDetail, type VideoSource } from '@/api';
import { formatCount, formatDate } from '@/utils/format';

defineOptions({ name: 'VideoPlayerView' });

const route = useRoute();
const videoId = computed(() => String(route.params.id || ''));

const detail = ref<VideoDetail | null>(null);
const quality = ref<VideoSource['quality']>('qhd');
const urls = ref<string[]>([]);
const urlIndex = ref(0);
const loading = ref(true);
const resolving = ref(false);
const error = ref('');

const videoEl = ref<HTMLVideoElement | null>(null);
const poster = computed(() => detail.value?.cover || '');
const sources = computed(() => detail.value?.sources || []);
const activeSource = computed(
  () => sources.value.find((source) => source.quality === quality.value) || sources.value[0],
);

async function loadSource(): Promise<void> {
  const source = activeSource.value;
  if (!source?.hash) {
    error.value = '这个视频没有可用的播放地址';
    return;
  }
  resolving.value = true;
  error.value = '';
  try {
    urls.value = await getVideoUrls(source.hash);
    urlIndex.value = 0;
    if (!urls.value.length) {
      error.value = '视频地址解析失败';
      return;
    }
    const element = videoEl.value;
    if (element) {
      element.src = urls.value[0];
      element.load();
    }
  } catch {
    error.value = '视频地址解析失败';
  } finally {
    resolving.value = false;
  }
}

function handleError(): void {
  if (urlIndex.value + 1 < urls.value.length) {
    urlIndex.value += 1;
    if (videoEl.value) {
      videoEl.value.src = urls.value[urlIndex.value];
      videoEl.value.load();
    }
    return;
  }
  error.value = '视频播放失败，可能是地区或版权限制';
}

function retry(): void {
  void loadSource();
}

watch(quality, () => {
  void loadSource();
});

onMounted(async () => {
  loading.value = true;
  try {
    detail.value = await getVideoDetail(videoId.value);
    const preferred = sources.value.find((source) => source.quality === 'qhd')
      || sources.value.find((source) => source.quality === 'hd')
      || sources.value[0];
    if (preferred) quality.value = preferred.quality;
    await loadSource();
  } catch {
    error.value = '视频详情加载失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page video-player">
    <DetailHeader :title="detail?.name || 'MV'" />

    <div class="video-stage">
      <div class="video-frame">
        <video
          ref="videoEl"
          class="video-el"
          controls
          playsinline
          preload="metadata"
          :poster="poster"
          @error="handleError"
        />

        <div v-if="loading || resolving" class="video-overlay">
          <Loader2 :size="26" class="spin-icon" />
          <span>{{ loading ? '加载视频信息' : '解析播放地址' }}</span>
        </div>

        <div v-else-if="error" class="video-overlay video-overlay--error">
          <AlertCircle :size="26" />
          <span>{{ error }}</span>
          <button class="btn btn--soft btn--sm" @click="retry">
            <Play :size="14" />
            重试
          </button>
        </div>
      </div>

      <div v-if="sources.length > 1" class="quality-row">
        <button
          v-for="source in sources"
          :key="source.quality"
          class="chip"
          :class="{ 'chip--active': quality === source.quality }"
          @click="quality = source.quality"
        >
          {{ source.label }}
        </button>
      </div>
    </div>

    <section v-if="detail" class="video-info">
      <h1 class="clamp-2">{{ detail.name }}</h1>
      <p class="video-info__artist ellipsis">{{ detail.artist }}</p>
      <p class="video-info__meta">
        <template v-if="detail.playCount">{{ formatCount(detail.playCount) }} 次播放</template>
        <template v-if="detail.publishTime"> · {{ formatDate(detail.publishTime) }}</template>
        <template v-if="detail.remark"> · {{ detail.remark }}</template>
      </p>
      <p v-if="detail.intro" class="video-info__intro">{{ detail.intro }}</p>
    </section>

    <section v-else-if="!loading" class="video-placeholder">
      <CoverImage :src="poster" alt="MV" />
      <p class="muted">视频信息不可用</p>
    </section>
  </div>
</template>

<style scoped>
.video-stage {
  margin: 0 12px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: #05080d;
}

.video-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}

.video-el {
  width: 100%;
  height: 100%;
  background: #000;
  object-fit: contain;
}

.video-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  background: rgba(3, 6, 11, 0.68);
  color: var(--text-2);
  font-size: 12px;
  backdrop-filter: blur(2px);
}

.video-overlay--error {
  color: var(--danger);
}

.quality-row {
  display: flex;
  gap: 6px;
  padding: 9px 11px;
  border-top: 1px solid var(--line);
}

.quality-row .chip {
  padding: 4px 10px;
  font-size: 10.5px;
}

.video-info {
  padding: 16px 18px 0;
}

.video-info h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 760;
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.video-info__artist {
  margin: 7px 0 0;
  color: var(--text-2);
  font-size: 13px;
}

.video-info__meta {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.video-info__intro {
  margin: 13px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 30px 18px;
}

.video-placeholder .cover-image {
  width: 180px;
  height: 102px;
  border-radius: 12px;
}
</style>
