<script setup lang="ts">
/**
 * 歌单详情。
 *
 * 歌单信息只在第一页返回（`data.list_info`），后续翻页只追加歌曲。
 */

import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { BookmarkPlus, MessageCircle, Pencil, Play, Shuffle, Trash2 } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import CommentSheet from '@/components/CommentSheet.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import PlaylistCard from '@/components/PlaylistCard.vue';
import SongList from '@/components/SongList.vue';
import {
  collectPlaylist,
  deletePlaylist,
  fallback,
  getPlaylistPage,
  getSimilarPlaylists,
  removeSongsFromPlaylist,
  toErrorMessage,
  updatePlaylist,
  type Playlist,
  type Song,
} from '@/api';
import { formatCount } from '@/utils/format';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

const props = defineProps<{ id: string }>();

const router = useRouter();
const player = usePlayerStore();
const toast = useToastStore();
const user = useUserStore();

/** 数字 id 表示当前账号的歌单，可以在线移除歌曲；公开歌单只读 */
const isUserList = computed(() => /^\d+$/.test(props.id));
const commentsOpen = ref(false);
const collecting = ref(false);

const playlist = ref<Playlist | null>(null);
const similar = ref<Playlist[]>([]);
const songs = ref<Song[]>([]);
const total = ref(0);
const page = ref(0);
const loading = ref(true);
const loadingMore = ref(false);
const error = ref('');

let requestToken = 0;

const hasMore = computed(() => songs.value.length > 0 && songs.value.length < total.value);

async function loadInitial(): Promise<void> {
  const token = (requestToken += 1);
  loading.value = true;
  error.value = '';
  songs.value = [];
  total.value = 0;
  page.value = 0;
  playlist.value = null;
  similar.value = [];

  // 相似歌单与主内容并行请求，失败时隐藏区块
  if (!isUserList.value) void loadSimilar();

  try {
    const result = await getPlaylistPage(props.id, 1, 50);
    if (token !== requestToken) return;
    playlist.value = result.playlist;
    songs.value = result.songs;
    total.value = Math.max(result.total, result.playlist?.trackCount || 0, result.songs.length);
    page.value = 1;
  } catch (err) {
    if (token !== requestToken) return;
    error.value = toErrorMessage(err);
    toast.error(error.value);
  } finally {
    if (token === requestToken) loading.value = false;
  }
}

/** 相似歌单（/playlist/similar） */
async function loadSimilar(): Promise<void> {
  const token = requestToken;
  const result = await fallback(() => getSimilarPlaylists(props.id), []);
  if (token !== requestToken) return;
  similar.value = result;
}

async function loadMore(): Promise<void> {
  if (loadingMore.value || loading.value || !hasMore.value) return;
  loadingMore.value = true;
  const token = requestToken;
  try {
    const result = await getPlaylistPage(props.id, page.value + 1, 50);
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
  const start = Math.floor(Math.random() * songs.value.length);
  void player.playSongs(songs.value, start);
}

/** 收藏公开歌单到当前账号 */
async function collect(): Promise<void> {
  if (!playlist.value || collecting.value) return;
  if (!user.loggedIn) {
    router.push('/login');
    return;
  }
  collecting.value = true;
  try {
    await collectPlaylist(playlist.value);
    toast.success('已收藏歌单');
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    collecting.value = false;
  }
}

/** 从自己的歌单移除单曲（需要接口返回的 fileid） */
async function removeSong(song: Song): Promise<void> {
  if (!song.fileId) {
    toast.error('这首歌缺少文件 id，暂时无法移除');
    return;
  }
  const confirmed = window.confirm(`从歌单移除《${song.name}》？`);
  if (!confirmed) return;
  try {
    await removeSongsFromPlaylist(props.id, [song.fileId]);
    songs.value = songs.value.filter((item) => item.id !== song.id);
    total.value = Math.max(0, total.value - 1);
    toast.success('已从歌单移除');
  } catch (err) {
    toast.error(toErrorMessage(err));
  }
}

/** 重命名自己的歌单 */
async function renamePlaylist(): Promise<void> {
  if (!playlist.value) return;
  const name = window.prompt('歌单名称', playlist.value.name)?.trim();
  if (!name || name === playlist.value.name) return;
  try {
    await updatePlaylist(props.id, {
      name,
      tags: playlist.value.tags.join(','),
      intro: playlist.value.intro,
    });
    playlist.value = { ...playlist.value, name };
    toast.success('歌单已更新');
  } catch (err) {
    toast.error(toErrorMessage(err));
  }
}

/** 删除（或取消收藏）自己的歌单 */
async function removePlaylist(): Promise<void> {
  const name = playlist.value?.name || '这个歌单';
  if (!window.confirm(`删除歌单「${name}」？`)) return;
  try {
    await deletePlaylist(props.id);
    toast.success('歌单已删除');
    if (window.history.length > 1) router.back();
    else void router.replace('/library');
  } catch (err) {
    toast.error(toErrorMessage(err));
  }
}

watch(
  () => props.id,
  () => void loadInitial(),
);

onMounted(() => void loadInitial());
</script>

<template>
  <div class="page playlist-page">
    <DetailHeader :title="playlist?.name || '歌单'" />

    <template v-if="loading && !playlist">
      <div class="pl-hero pl-hero--loading">
        <div class="skeleton pl-cover-skeleton" />
        <div class="pl-hero__info">
          <div class="skeleton sk-line sk-line--90" />
          <div class="skeleton sk-line sk-line--60" />
          <div class="skeleton sk-line sk-line--40" />
        </div>
      </div>
    </template>

    <template v-else-if="playlist || songs.length">
      <section class="pl-hero">
        <div class="pl-cover">
          <CoverImage :src="playlist?.cover" :alt="playlist?.name" :icon-size="30" />
        </div>
        <div class="pl-hero__info">
          <p class="pl-kind">PLAYLIST</p>
          <h1 class="pl-name clamp-2">{{ playlist?.name || '歌单' }}</h1>
          <p v-if="playlist?.creator" class="pl-creator ellipsis">{{ playlist.creator }}</p>
          <p class="pl-meta">
            <span>{{ total || songs.length }} 首</span>
            <template v-if="playlist?.playCount"><span class="dot">·</span>{{ formatCount(playlist.playCount) }} 次播放</template>
          </p>
        </div>
      </section>

      <div v-if="playlist?.tags?.length" class="pl-tags">
        <span v-for="tag in playlist.tags.slice(0, 5)" :key="tag" class="pill">{{ tag }}</span>
      </div>

      <p v-if="playlist?.intro" class="pl-intro clamp-2">{{ playlist.intro }}</p>

      <div class="pl-actions">
        <button class="btn btn--primary pl-play" :disabled="!songs.length" @click="playAll">
          <Play :size="18" fill="currentColor" :stroke-width="0" />
          播放全部
        </button>
        <button class="icon-btn icon-btn--accent pl-shuffle" :disabled="!songs.length" aria-label="随机播放" @click="shufflePlay">
          <Shuffle :size="19" />
        </button>
        <button
          v-if="!isUserList"
          class="icon-btn pl-icon"
          aria-label="歌单评论"
          @click="commentsOpen = true"
        >
          <MessageCircle :size="19" />
        </button>
        <button
          v-if="!isUserList"
          class="icon-btn pl-icon"
          :disabled="collecting"
          aria-label="收藏歌单"
          @click="collect"
        >
          <BookmarkPlus :size="19" />
        </button>
        <button
          v-if="isUserList"
          class="icon-btn pl-icon"
          aria-label="重命名歌单"
          @click="renamePlaylist"
        >
          <Pencil :size="18" />
        </button>
        <button
          v-if="isUserList"
          class="icon-btn pl-icon pl-icon--danger"
          aria-label="删除歌单"
          @click="removePlaylist"
        >
          <Trash2 :size="18" />
        </button>
      </div>

      <div class="pl-songs">
        <SongList
          :songs="songs"
          :loading="loading"
          show-index
          empty-title="这个歌单还没有歌曲"
          empty-desc="换一个歌单试试吧"
        >
          <template v-if="isUserList" #actions="{ song }">
            <button class="pl-remove" aria-label="从歌单移除" @click.stop="removeSong(song)">
              <Trash2 :size="16" />
            </button>
          </template>
        </SongList>
      </div>

      <div v-if="!loading && hasMore" class="load-more">
        <button class="btn btn--soft btn--sm" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? '加载中…' : '加载更多' }}
        </button>
      </div>
      <div v-else-if="!loading && songs.length" class="end-hint">已经到底了</div>

      <section v-if="similar.length" class="section">
        <div class="section-head">
          <h2 class="section-title">相似歌单</h2>
        </div>
        <div class="pl-similar">
          <PlaylistCard v-for="item in similar" :key="item.id" :playlist="item" />
        </div>
      </section>
    </template>

    <div v-else class="empty-state">
      <p class="empty-state__title">{{ error ? '歌单加载失败' : '没有找到这个歌单' }}</p>
      <p class="empty-state__desc">{{ error || '歌单可能已下架或链接有误' }}</p>
      <button class="btn btn--soft btn--sm" style="margin-top: 8px" @click="loadInitial">重新加载</button>
    </div>

    <CommentSheet
      :open="commentsOpen"
      resource="playlist"
      :id="playlist?.id || id"
      :name="playlist?.name || '歌单'"
      @close="commentsOpen = false"
    />
  </div>
</template>

<style scoped>
.playlist-page {
  padding-bottom: calc(28px + var(--safe-bottom));
}

.pl-hero {
  display: flex;
  gap: 16px;
  padding: 10px 18px 0;
}

.pl-hero__info {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}

.pl-cover {
  flex: 0 0 auto;
  width: 118px;
  height: 118px;
  overflow: hidden;
  border-radius: 18px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.42);
}

.pl-cover-skeleton {
  flex: 0 0 auto;
  width: 118px;
  height: 118px;
  border-radius: 18px;
}

.pl-kind {
  margin: 0;
  color: var(--accent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.2em;
}

.pl-name {
  margin: 5px 0 0;
  font-size: 21px;
  font-weight: 750;
  line-height: 1.3;
  letter-spacing: -0.015em;
}

.pl-creator {
  margin: 6px 0 0;
  color: var(--text-2);
  font-size: 12px;
}

.pl-meta {
  display: flex;
  align-items: center;
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 10.5px;
}

.dot {
  margin: 0 5px;
}

.pl-tags {
  display: flex;
  gap: 7px;
  padding: 14px 18px 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.pl-tags::-webkit-scrollbar {
  display: none;
}

.pl-tags .pill {
  flex: 0 0 auto;
  min-height: 26px;
  padding: 3px 10px;
  font-size: 10.5px;
}

.pl-intro {
  padding: 0 18px;
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.6;
}

.pl-actions {
  display: flex;
  gap: 10px;
  padding: 18px 18px 10px;
}

.pl-play {
  flex: 1;
  height: 48px;
}

.pl-shuffle {
  width: 48px;
  height: 48px;
  color: #04231f;
  background: rgba(56, 225, 198, 0.18);
}

.pl-icon {
  width: 48px;
  height: 48px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
}

.pl-icon--danger:active {
  border-color: rgba(255, 99, 119, 0.35);
  color: var(--danger);
  background: rgba(255, 99, 119, 0.08);
}

.pl-songs {
  padding: 4px 6px 0;
}

.pl-remove {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  margin-right: -5px;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
}

.pl-remove:active {
  color: var(--danger);
  background: rgba(255, 255, 255, 0.06);
}

/* 相似歌单横向列表 */
.pl-similar {
  display: flex;
  gap: 14px;
  padding: 0 18px 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.pl-similar::-webkit-scrollbar {
  display: none;
}

.pl-similar :deep(.playlist-card) {
  flex: 0 0 138px;
  width: 138px;
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

.sk-line--90 {
  width: 90%;
}

.sk-line--60 {
  width: 60%;
}

.sk-line--40 {
  width: 40%;
}
</style>
