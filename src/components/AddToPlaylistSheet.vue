<script setup lang="ts">
/**
 * “添加到歌单”底部弹层。
 *
 * 只列出当前账号创建/收藏的歌单。酷狗要求使用数字 listid 添加歌曲，
 * 因此没有 listid 的歌单会被禁用。
 */

import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ListMusic, Loader2, LogIn, Plus } from 'lucide-vue-next';
import CoverImage from './CoverImage.vue';
import {
  addSongsToPlaylist,
  getUserPlaylists,
  toErrorMessage,
  type Playlist,
  type Song,
} from '@/api';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

const props = defineProps<{
  open: boolean;
  songs: Song[];
}>();

const emit = defineEmits<{ close: []; added: [] }>();

const router = useRouter();
const user = useUserStore();
const toast = useToastStore();

const playlists = ref<Playlist[]>([]);
const loading = ref(false);
const error = ref('');
const addingId = ref('');

async function load(): Promise<void> {
  if (!user.loggedIn) return;
  loading.value = true;
  error.value = '';
  try {
    // 优先使用用户 store 里已经拉取过的歌单，避免重复请求
    playlists.value = user.playlists.length ? user.playlists : await getUserPlaylists();
  } catch (err) {
    error.value = toErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

async function add(playlist: Playlist): Promise<void> {
  const listid = playlist.listId || (/^\d+$/.test(playlist.id) ? playlist.id : '');
  if (!listid || addingId.value || !props.songs.length) return;
  addingId.value = playlist.id;
  try {
    await addSongsToPlaylist(listid, props.songs);
    toast.success(`已添加 ${props.songs.length} 首到「${playlist.name}」`);
    emit('added');
    emit('close');
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    addingId.value = '';
  }
}

function goLogin(): void {
  emit('close');
  void router.push('/login');
}

watch(
  () => props.open,
  (open) => {
    if (open) void load();
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="add-root">
        <div class="sheet-mask" @click="emit('close')" />
        <section class="sheet add-sheet">
          <div class="sheet__handle" />
          <header class="add-head">
            <h2 class="sheet__title">添加到歌单</h2>
            <span class="add-head__count">{{ songs.length }} 首</span>
          </header>

          <div v-if="!user.loggedIn" class="add-login">
            <p>登录后即可把歌曲加入你的酷狗歌单</p>
            <button class="btn btn--primary btn--sm" @click="goLogin">
              <LogIn :size="14" />
              去登录
            </button>
          </div>

          <div v-else-if="loading" class="add-loading">
            <Loader2 :size="18" class="spin-icon" />
            正在加载歌单
          </div>

          <div v-else-if="error" class="add-error">
            <p>{{ error }}</p>
            <button class="btn btn--soft btn--sm" @click="load">重新加载</button>
          </div>

          <div v-else-if="playlists.length" class="add-list">
            <button
              v-for="playlist in playlists"
              :key="playlist.id"
              class="add-row"
              :disabled="addingId !== '' || !(playlist.listId || /^\d+$/.test(playlist.id))"
              @click="add(playlist)"
            >
              <span class="add-row__cover">
                <CoverImage :src="playlist.cover" :alt="playlist.name" :icon-size="16" />
              </span>
              <span class="add-row__info">
                <span class="add-row__name ellipsis">{{ playlist.name }}</span>
                <span class="add-row__count">{{ playlist.trackCount || 0 }} 首</span>
              </span>
              <Loader2 v-if="addingId === playlist.id" :size="17" class="spin-icon" />
              <Plus v-else :size="18" class="muted" />
            </button>
          </div>

          <div v-else class="add-empty">
            <ListMusic :size="22" class="muted" />
            <p>还没有可以添加的歌单</p>
            <span>先在酷狗 App 创建歌单吧</span>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.add-sheet {
  display: flex;
  flex-direction: column;
}

.add-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.add-head .sheet__title {
  margin-bottom: 8px;
}

.add-head__count {
  color: var(--muted);
  font-size: 10.5px;
}

.add-login,
.add-empty,
.add-loading,
.add-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding: 30px 14px 22px;
  color: var(--muted);
  font-size: 11.5px;
  text-align: center;
}

.add-login p,
.add-empty p,
.add-error p {
  margin: 0;
}

.add-empty span {
  font-size: 10px;
}

.add-error {
  color: var(--danger);
}

.add-list {
  max-height: min(46vh, 430px);
  margin: 2px -6px 0;
  overflow-y: auto;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 8px 6px;
  border-radius: 12px;
  color: var(--text);
  text-align: left;
}

.add-row:active {
  background: rgba(255, 255, 255, 0.05);
}

.add-row__cover {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  overflow: hidden;
  border-radius: 10px;
}

.add-row__info {
  flex: 1;
  min-width: 0;
}

.add-row__name {
  display: block;
  font-size: 13px;
  font-weight: 550;
}

.add-row__count {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}
</style>
