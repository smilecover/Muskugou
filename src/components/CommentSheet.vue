<script setup lang="ts">
/**
 * 评论底部弹层（歌曲 / 歌单 / 专辑）。
 *
 * 打开时加载第一页评论，支持分页、展开楼层回复和发表评论。
 * 发表评论需要登录；未登录会直接跳到扫码登录页。
 */

import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { CornerDownRight, Loader2, MessageCircle, Send } from 'lucide-vue-next';
import CoverImage from './CoverImage.vue';
import {
  getAlbumComments,
  getFloorComments,
  getPlaylistComments,
  getSongComments,
  sendAlbumComment,
  sendPlaylistComment,
  sendSongComment,
  toErrorMessage,
  type CommentItem,
  type CommentResource,
} from '@/api';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** 歌曲为 mixsongid，歌单/专辑为对应 id */
    id: string;
    resource?: CommentResource;
    /** 用于发送评论时携带的名称 */
    name?: string;
    /** 歌曲评论可选的 special_id */
    specialId?: string;
  }>(),
  { resource: 'song', name: '', specialId: '' },
);

const emit = defineEmits<{ close: [] }>();

const PAGE_SIZE = 30;

const router = useRouter();
const user = useUserStore();
const toast = useToastStore();

const comments = ref<CommentItem[]>([]);
const total = ref(0);
const page = ref(1);
const hasMore = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const content = ref('');
const sending = ref(false);

interface ReplyState {
  items: CommentItem[];
  loading: boolean;
  open: boolean;
}

const replies = reactive<Record<string, ReplyState>>({});
let requestToken = 0;

const resourceLabel = computed(() => {
  if (props.resource === 'playlist') return '歌单';
  if (props.resource === 'album') return '专辑';
  return '单曲';
});

async function fetchPage(pageNumber: number) {
  if (props.resource === 'playlist') return getPlaylistComments(props.id, pageNumber, PAGE_SIZE);
  if (props.resource === 'album') return getAlbumComments(props.id, pageNumber, PAGE_SIZE);
  return getSongComments(props.id, pageNumber, PAGE_SIZE);
}

async function load(reset = true): Promise<void> {
  if (!props.id) return;
  const token = (requestToken += 1);
  if (reset) {
    loading.value = true;
    error.value = '';
    page.value = 1;
    comments.value = [];
    total.value = 0;
    hasMore.value = false;
    content.value = '';
    for (const key of Object.keys(replies)) delete replies[key];
  } else {
    loadingMore.value = true;
  }

  try {
    const result = await fetchPage(page.value);
    if (token !== requestToken) return;
    comments.value = reset
      ? result.comments
      : [...comments.value, ...result.comments.filter((item) => !comments.value.some((old) => old.id === item.id))];
    total.value = Math.max(result.total, comments.value.length);
    hasMore.value = result.hasMore;
    if (result.comments.length) page.value += 1;
  } catch (err) {
    if (token !== requestToken) return;
    if (reset) error.value = toErrorMessage(err);
    hasMore.value = false;
  } finally {
    if (token === requestToken) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

async function send(): Promise<void> {
  const value = content.value.trim();
  if (!value || sending.value) return;
  if (!user.loggedIn) {
    toast.info('请先登录后再评论');
    emit('close');
    router.push('/login');
    return;
  }

  sending.value = true;
  try {
    if (props.resource === 'playlist') {
      await sendPlaylistComment({ id: props.id, content: value, playlistName: props.name });
    } else if (props.resource === 'album') {
      await sendAlbumComment({ id: props.id, content: value, albumName: props.name });
    } else {
      await sendSongComment({
        mixsongid: props.id,
        content: value,
        songName: props.name,
        specialId: props.specialId || undefined,
        childId: props.id,
      });
    }
    content.value = '';
    toast.success('评论已发送');
    await load(true);
  } catch (err) {
    toast.error(toErrorMessage(err));
  } finally {
    sending.value = false;
  }
}

async function toggleReplies(comment: CommentItem): Promise<void> {
  const current = replies[comment.id];
  if (current?.open) {
    current.open = false;
    return;
  }
  if (current?.items.length) {
    current.open = true;
    return;
  }

  replies[comment.id] = { items: [], loading: true, open: true };
  try {
    const result = await getFloorComments(
      comment,
      1,
      PAGE_SIZE,
      props.resource,
      props.resource === 'song' ? props.id : '',
    );
    replies[comment.id] = { items: result.comments, loading: false, open: true };
  } catch {
    replies[comment.id] = { items: [], loading: false, open: true };
    toast.error('回复加载失败');
  }
}

function shortTime(value: string): string {
  if (!value) return '';
  return value.length > 16 ? value.slice(0, 16) : value;
}

/** 未登录时点输入框直接引导登录 */
function focusEditor(): void {
  if (!user.loggedIn) {
    emit('close');
    void router.push('/login');
  }
}

// 打开时初始化；切换资源（例如从歌曲切到歌单）时重新加载
watch(
  () => [props.open, props.id, props.resource] as const,
  ([open]) => {
    if (open) void load(true);
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="comment-root">
        <div class="sheet-mask" @click="emit('close')" />

        <section class="sheet comment-sheet">
          <div class="sheet__handle" />

          <header class="comment-head">
            <h2 class="sheet__title">
              评论
              <span class="comment-head__count">{{ total || comments.length }}</span>
            </h2>
            <span class="comment-head__hint">{{ resourceLabel }}评论 · 来自酷狗</span>
          </header>

          <div class="comment-body">
            <div v-if="loading" class="comment-loading">
              <Loader2 :size="18" class="spin-icon" />
              正在加载评论
            </div>

            <div v-else-if="error" class="comment-error">
              <p>{{ error }}</p>
              <button class="btn btn--soft btn--sm" @click="load(true)">重新加载</button>
            </div>

            <div v-else-if="comments.length" class="comment-list">
              <article v-for="comment in comments" :key="comment.id" class="comment-item">
                <div class="comment-avatar">
                  <CoverImage :src="comment.userAvatar" :alt="comment.userName" :icon-size="16" />
                </div>
                <div class="comment-main">
                  <div class="comment-meta">
                    <span class="comment-user ellipsis">{{ comment.userName }}</span>
                    <span v-if="comment.hot" class="comment-tag">热</span>
                    <span class="comment-time">{{ shortTime(comment.time) }}</span>
                  </div>
                  <p class="comment-content">{{ comment.content }}</p>
                  <div class="comment-footer">
                    <span v-if="comment.likes" class="comment-like">♥ {{ comment.likes }}</span>
                    <span v-if="comment.city" class="comment-city">{{ comment.city }}</span>
                    <button
                      v-if="comment.replyCount"
                      class="comment-reply-btn"
                      @click="toggleReplies(comment)"
                    >
                      <CornerDownRight :size="12" />
                      {{ replies[comment.id]?.open ? '收起回复' : `${comment.replyCount} 条回复` }}
                    </button>
                  </div>

                  <div v-if="replies[comment.id]?.open" class="comment-replies">
                    <div v-if="replies[comment.id].loading" class="comment-replies__loading">
                      <Loader2 :size="13" class="spin-icon" />
                      加载回复
                    </div>
                    <p v-for="reply in replies[comment.id].items" :key="reply.id" class="comment-reply">
                      <span class="comment-reply__user">{{ reply.userName }}：</span>{{ reply.content }}
                    </p>
                    <p v-if="!replies[comment.id].loading && !replies[comment.id].items.length" class="comment-reply muted">
                      暂无回复
                    </p>
                  </div>
                </div>
              </article>

              <div v-if="hasMore" class="comment-more">
                <button class="text-btn text-btn--muted" :disabled="loadingMore" @click="load(false)">
                  {{ loadingMore ? '加载中…' : '加载更多评论' }}
                </button>
              </div>
            </div>

            <div v-else class="empty-state" style="padding: 36px 0 20px">
              <div class="empty-state__icon"><MessageCircle :size="22" /></div>
              <p class="empty-state__title">还没有评论</p>
              <p class="empty-state__desc">来说点什么吧</p>
            </div>
          </div>

          <form class="comment-editor" @submit.prevent="send">
            <input
              v-model="content"
              class="comment-editor__input"
              :placeholder="user.loggedIn ? '写下你的评论…' : '登录后参与评论'"
              maxlength="140"
              @focus="focusEditor"
            />
            <button type="submit" class="comment-editor__send" :disabled="!content.trim() || sending">
              <Loader2 v-if="sending" :size="15" class="spin-icon" />
              <Send v-else :size="15" />
            </button>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.comment-sheet {
  display: flex;
  height: min(72vh, 620px);
  flex-direction: column;
  padding-bottom: calc(12px + var(--safe-bottom));
}

.comment-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.comment-head .sheet__title {
  margin-bottom: 8px;
}

.comment-head__count {
  margin-left: 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}

.comment-head__hint {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 9.5px;
}

.comment-body {
  flex: 1;
  min-height: 0;
  margin: 2px -6px 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.comment-loading,
.comment-replies__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 34px 0;
  color: var(--muted);
  font-size: 11.5px;
}

.comment-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 12px;
  color: var(--danger);
  font-size: 11.5px;
  text-align: center;
}

.comment-error p {
  margin: 0;
}

.comment-list {
  padding: 0 6px;
}

.comment-item {
  display: flex;
  gap: 10px;
  padding: 11px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.comment-item:last-of-type {
  border-bottom: 0;
}

.comment-avatar {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--surface);
}

.comment-main {
  flex: 1;
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.comment-user {
  max-width: 130px;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
}

.comment-tag {
  flex: 0 0 auto;
  padding: 0 4px;
  border-radius: 3px;
  color: var(--accent);
  font-size: 8px;
  line-height: 13px;
  background: var(--accent-soft);
}

.comment-time {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.26);
  font-size: 9px;
}

.comment-content {
  margin: 4px 0 0;
  color: var(--text);
  font-size: 12.5px;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
}

.comment-footer {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 4px;
  color: var(--muted);
  font-size: 9.5px;
}

.comment-like {
  color: rgba(255, 255, 255, 0.34);
}

.comment-city {
  color: rgba(255, 255, 255, 0.24);
}

.comment-reply-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  color: var(--accent);
  font-size: 9.5px;
}

.comment-replies {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
}

.comment-reply {
  margin: 0;
  color: var(--text-2);
  font-size: 11px;
  line-height: 1.6;
  word-break: break-word;
}

.comment-reply + .comment-reply {
  margin-top: 5px;
}

.comment-reply__user {
  color: var(--accent);
}

.comment-more {
  padding: 12px 0 6px;
  text-align: center;
}

.comment-editor {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 6px 6px 6px 13px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg-soft);
}

.comment-editor__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-size: 12.5px;
}

.comment-editor__input::placeholder {
  color: var(--muted);
}

.comment-editor__send {
  display: grid;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  color: #04241f;
  background: var(--accent);
}

.comment-editor__send:disabled {
  opacity: 0.4;
}
</style>
