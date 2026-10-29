<script setup lang="ts">
/**
 * 我的云盘。
 *
 * 云盘歌曲和普通歌曲一样进入播放队列；删除时按 fileid / kvid 批量提交。
 * 云盘接口需要登录，未登录时只展示登录引导。
 */

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Cloud, Loader2, LogIn, Play, Trash2 } from 'lucide-vue-next';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import {
  deleteCloudSongs,
  getCloudSongs,
  toErrorMessage,
  type CloudSong,
  type Song,
} from '@/api';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

defineOptions({ name: 'CloudView' });

const PAGE_SIZE = 50;

const router = useRouter();
const user = useUserStore();
const player = usePlayerStore();
const toast = useToastStore();

const songs = ref<CloudSong[]>([]);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const page = ref(1);
const hasMore = ref(false);
const deletingId = ref('');

const isEmpty = computed(() => !loading.value && !error.value && songs.value.length === 0);

async function load(reset = true): Promise<void> {
  if (!user.loggedIn) return;
  if (reset) {
    loading.value = true;
    error.value = '';
    page.value = 1;
    songs.value = [];
  } else {
    loadingMore.value = true;
  }
  try {
    const result = await getCloudSongs(page.value, PAGE_SIZE);
    songs.value = reset
      ? result.songs
      : [...songs.value, ...result.songs.filter((song) => !songs.value.some((old) => old.id === song.id))];
    total.value = Math.max(result.total, songs.value.length);
    hasMore.value = result.songs.length >= PAGE_SIZE && songs.value.length < total.value;
    if (result.songs.length) page.value += 1;
  } catch (err) {
    if (reset) {
      songs.value = [];
      total.value = 0;
      error.value = toErrorMessage(err);
    }
    hasMore.value = false;
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function playAll(): void {
  if (!songs.value.length) return;
  void player.playSongs(songs.value, 0);
}

async function remove(song: Song): Promise<void> {
  if (deletingId.value) return;
  const confirmed = window.confirm(`从云盘删除《${song.name}》？此操作无法撤销。`);
  if (!confirmed) return;
  deletingId.value = song.id;
  try {
    // 列表本身是 CloudSong[]，槽位参数被 SongList 拓宽为 Song，这里补回云盘字段
    await deleteCloudSongs([song as CloudSong]);
    songs.value = songs.value.filter((item) => item.id !== song.id);
    total.value = Math.max(0, total.value - 1);
    toast.success('已从云盘删除');
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    deletingId.value = '';
  }
}

onMounted(() => {
  if (user.loggedIn) void load(true);
});
</script>

<template>
  <div class="page cloud-page">
    <DetailHeader title="我的云盘" />

    <section v-if="!user.loggedIn" class="cloud-login panel">
      <span class="cloud-login__icon"><Cloud :size="26" :stroke-width="1.6" /></span>
      <p class="cloud-login__title">登录后查看云盘</p>
      <p class="cloud-login__desc">云盘里的音乐与酷狗账号同步</p>
      <button class="btn btn--primary btn--sm" @click="router.push('/login')">
        <LogIn :size="14" />
        去登录
      </button>
    </section>

    <template v-else>
      <div class="cloud-head">
        <div>
          <p class="cloud-eyebrow">CLOUD MUSIC</p>
          <h1 class="cloud-title">我的云盘</h1>
          <p class="cloud-meta">{{ total || songs.length }} 首歌曲</p>
        </div>
        <button class="btn btn--primary btn--sm" :disabled="!songs.length" @click="playAll">
          <Play :size="14" fill="currentColor" :stroke-width="0" />
          播放全部
        </button>
      </div>

      <SongList
        :songs="songs"
        :loading="loading"
        show-cover
        :show-favorite="false"
        empty-title="云盘还是空的"
        empty-desc="在酷狗 App 上传音乐后会同步到这里"
      >
        <template #actions="{ song }">
          <button
            class="cloud-del"
            :disabled="deletingId === song.id"
            aria-label="从云盘删除"
            @click.stop="remove(song)"
          >
            <Loader2 v-if="deletingId === song.id" :size="16" class="spin-icon" />
            <Trash2 v-else :size="16" />
          </button>
        </template>
      </SongList>

      <div v-if="error && !loading" class="cloud-error">
        <p>{{ error }}</p>
        <button class="btn btn--soft btn--sm" @click="load(true)">重新加载</button>
      </div>

      <div v-if="songs.length && hasMore" class="load-more">
        <button class="btn btn--soft btn--block btn--sm" :disabled="loadingMore" @click="load(false)">
          <Loader2 v-if="loadingMore" :size="14" class="spin-icon" />
          {{ loadingMore ? '加载中' : '加载更多' }}
        </button>
      </div>

      <p v-if="isEmpty && !error" class="cloud-hint">概念版云盘与标准版共用同一份文件。</p>
    </template>
  </div>
</template>

<style scoped>
.cloud-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: 24px 18px 0;
  padding: 30px 18px;
  text-align: center;
}

.cloud-login__icon {
  display: grid;
  width: 60px;
  height: 60px;
  margin-bottom: 4px;
  place-items: center;
  border-radius: 20px;
  color: var(--accent);
  background: var(--accent-soft);
}

.cloud-login__title {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}

.cloud-login__desc {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 11px;
}

.cloud-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 4px 18px 14px;
}

.cloud-eyebrow {
  margin: 0;
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.cloud-title {
  margin: 3px 0 0;
  font-size: 23px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.cloud-meta {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.cloud-head .btn {
  margin-top: 16px;
}

.cloud-del {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  margin-right: -5px;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
}

.cloud-del:active {
  color: var(--danger);
  background: rgba(255, 255, 255, 0.06);
}

.cloud-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 18px;
  color: var(--danger);
  font-size: 11.5px;
}

.cloud-error p {
  margin: 0;
}

.load-more {
  padding: 18px;
}

.cloud-hint {
  padding: 18px;
  margin: 0;
  color: var(--muted);
  font-size: 10.5px;
  text-align: center;
}
</style>
