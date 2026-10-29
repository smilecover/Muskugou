<script setup lang="ts">
/**
 * IP 专区（影视 / 动漫 / 明星等）。
 *
 * 专区列表来自 `/ip/zone`，选中后加载该 IP 下的歌单。
 * 上游 IP 首页接口偶尔不稳定，因此这里只依赖分步接口，失败时展示空态。
 */

import { onMounted, ref } from 'vue';
import { Loader2, Sparkles } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import PlaylistCard from '@/components/PlaylistCard.vue';
import { getIpPlaylists, getIpZones, type IpZone, type Playlist } from '@/api';
import { useToastStore } from '@/stores/toast';

defineOptions({ name: 'IpView' });

const PAGE_SIZE = 20;

const toast = useToastStore();

const zones = ref<IpZone[]>([]);
const loading = ref(true);
const selected = ref<IpZone | null>(null);
const playlists = ref<Playlist[]>([]);
const playlistsLoading = ref(false);
const loadingMore = ref(false);
const page = ref(1);
const hasMore = ref(false);

let requestToken = 0;

async function loadPlaylists(reset = true): Promise<void> {
  const zone = selected.value;
  if (!zone) return;

  const token = (requestToken += 1);
  if (reset) {
    playlistsLoading.value = true;
    playlists.value = [];
    page.value = 1;
    hasMore.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    const result = await getIpPlaylists(zone.ipId || zone.id, page.value, PAGE_SIZE);
    if (token !== requestToken) return;
    playlists.value = reset
      ? result
      : [...playlists.value, ...result.filter((item) => !playlists.value.some((old) => old.id === item.id))];
    hasMore.value = result.length >= PAGE_SIZE;
    if (result.length) page.value += 1;
  } catch {
    if (token !== requestToken) return;
    if (reset) playlists.value = [];
    hasMore.value = false;
    toast.error('这个专区的歌单加载失败');
  } finally {
    if (token === requestToken) {
      playlistsLoading.value = false;
      loadingMore.value = false;
    }
  }
}

async function selectZone(zone: IpZone): Promise<void> {
  if (selected.value?.id === zone.id) return;
  selected.value = zone;
  await loadPlaylists(true);
}

onMounted(async () => {
  try {
    zones.value = await getIpZones();
    if (zones.value.length) await selectZone(zones.value[0]);
  } catch {
    toast.error('IP 专区加载失败');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page ip-page">
    <DetailHeader title="IP 专区" />

    <div v-if="loading" class="ip-grid">
      <div v-for="n in 4" :key="n" class="skeleton ip-skeleton" />
    </div>

    <div v-else-if="zones.length" class="ip-grid">
      <button
        v-for="zone in zones"
        :key="zone.id"
        class="ip-tile"
        :class="{ 'ip-tile--active': selected?.id === zone.id }"
        @click="selectZone(zone)"
      >
        <span class="ip-tile__icon cover-frame">
          <CoverImage :src="zone.icon" :alt="zone.name" :icon-size="20" />
        </span>
        <span class="ip-tile__info">
          <span class="ip-tile__name ellipsis">{{ zone.name }}</span>
          <span class="ip-tile__summary ellipsis">{{ zone.summary || '主题歌单' }}</span>
        </span>
      </button>
    </div>

    <div v-else class="empty-state" style="padding-top: 50px">
      <div class="empty-state__icon"><Sparkles :size="24" /></div>
      <p class="empty-state__title">暂无 IP 专区</p>
      <p class="empty-state__desc">稍后再来看看</p>
    </div>

    <section v-if="selected" class="section">
      <div class="section-head">
        <h2 class="section-title">{{ selected.name }}</h2>
        <span class="muted" style="font-size: 11px">{{ playlists.length }} 个歌单</span>
      </div>

      <div v-if="playlistsLoading && !playlists.length" class="playlist-grid">
        <div v-for="n in 4" :key="n" class="skeleton ip-card-skeleton" />
      </div>

      <div v-else-if="playlists.length" class="playlist-grid">
        <PlaylistCard v-for="playlist in playlists" :key="playlist.id" :playlist="playlist" />
      </div>

      <div v-else class="empty-state" style="padding-top: 26px">
        <p class="empty-state__title">这个专区还没有歌单</p>
        <p class="empty-state__desc">换一个 IP 看看</p>
      </div>

      <div v-if="playlists.length && hasMore" class="load-more">
        <button class="btn btn--soft btn--block btn--sm" :disabled="loadingMore" @click="loadPlaylists(false)">
          <Loader2 v-if="loadingMore" :size="14" class="spin-icon" />
          {{ loadingMore ? '加载中' : '加载更多' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ip-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 2px 18px 0;
}

.ip-skeleton {
  height: 66px;
  border-radius: 16px;
}

.ip-tile {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.025);
  color: var(--text);
  text-align: left;
}

.ip-tile--active {
  border-color: rgba(56, 225, 198, 0.42);
  background: rgba(56, 225, 198, 0.07);
}

.ip-tile__icon {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
}

.ip-tile__info {
  min-width: 0;
}

.ip-tile__name {
  display: block;
  font-size: 12.5px;
  font-weight: 650;
}

.ip-tile__summary {
  display: block;
  margin-top: 1px;
  color: var(--muted);
  font-size: 9.5px;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 14px;
  padding: 0 18px;
}

.playlist-grid :deep(.playlist-card) {
  width: 100%;
}

.ip-card-skeleton {
  height: 210px;
  border-radius: 16px;
}

.load-more {
  padding: 20px 18px 0;
}
</style>
