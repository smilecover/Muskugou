<script setup lang="ts">
/**
 * 听书首页。
 *
 * 每日/每周/VIP 推荐 + 分类标签 + 书库分页；顶部可以按关键词搜索章节。
 */

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BookOpen, Loader2, Search, X } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import SectionHeader from '@/components/SectionHeader.vue';
import SongList from '@/components/SongList.vue';
import {
  fallback,
  getAudiobookHome,
  getAudiobookTags,
  getAudiobooks,
  searchAudiobooks,
  type Audiobook,
  type AudiobookTag,
  type AudiobookTagGroup,
  type Song,
} from '@/api';

defineOptions({ name: 'AudiobookView' });

const router = useRouter();

const daily = ref<Audiobook[]>([]);
const weekly = ref<Audiobook[]>([]);
const vip = ref<Audiobook[]>([]);
const shelf = ref<Audiobook[]>([]);
const tagGroups = ref<AudiobookTagGroup[]>([]);
const activeTag = ref('906');
const loading = ref(true);
const shelfLoading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(true);
const page = ref(1);

const keyword = ref('');
const searching = ref(false);
const searchResults = ref<Song[]>([]);
const searched = ref('');

const activeTagName = computed(() => {
  for (const group of tagGroups.value) {
    const found = group.tags.find((tag) => tag.id === activeTag.value);
    if (found) return found.name;
  }
  return '书库';
});

const hotTags = computed<AudiobookTag[]>(() => tagGroups.value.flatMap((group) => group.tags).slice(0, 24));

async function loadShelf(reset = true): Promise<void> {
  if (reset) {
    page.value = 1;
    hasMore.value = true;
    shelfLoading.value = true;
  } else {
    loadingMore.value = true;
  }
  try {
    const result = await getAudiobooks(activeTag.value, page.value, 30);
    shelf.value = reset ? result.albums : [...shelf.value, ...result.albums];
    hasMore.value = result.hasMore;
    if (result.hasMore) page.value += 1;
  } catch {
    if (reset) shelf.value = [];
  } finally {
    shelfLoading.value = false;
    loadingMore.value = false;
  }
}

async function selectTag(tag: AudiobookTag): Promise<void> {
  activeTag.value = tag.id;
  await loadShelf(true);
}

async function loadAll(): Promise<void> {
  loading.value = true;
  try {
    const [home, tags] = await Promise.all([
      fallback(getAudiobookHome, { daily: [], weekly: [], vip: [] }),
      fallback(getAudiobookTags, [] as AudiobookTagGroup[]),
    ]);
    daily.value = home.daily;
    weekly.value = home.weekly;
    vip.value = home.vip;
    tagGroups.value = tags;
  } finally {
    loading.value = false;
  }
  await loadShelf(true);
}

async function submitSearch(): Promise<void> {
  const value = keyword.value.trim();
  if (!value) {
    searched.value = '';
    searchResults.value = [];
    return;
  }
  searching.value = true;
  searched.value = value;
  try {
    searchResults.value = await searchAudiobooks(value, 1, 30);
  } catch {
    searchResults.value = [];
  } finally {
    searching.value = false;
  }
}

function clearSearch(): void {
  keyword.value = '';
  searched.value = '';
  searchResults.value = [];
}

onMounted(loadAll);
</script>

<template>
  <div class="page audiobook-page">
    <DetailHeader title="听书" />

    <form class="ab-search" @submit.prevent="submitSearch">
      <Search :size="17" class="ab-search__icon" />
      <input v-model="keyword" class="ab-search__input" placeholder="搜索有声书、广播剧、章节" />
      <button v-if="keyword" type="button" class="ab-search__clear" aria-label="清空" @click="clearSearch">
        <X :size="15" />
      </button>
      <button type="submit" class="ab-search__submit" :disabled="searching">搜索</button>
    </form>

    <!-- 搜索结果 -->
    <template v-if="searched">
      <div class="section-head" style="margin-top: 18px">
        <h2 class="section-title">“{{ searched }}” 的章节</h2>
        <button class="text-btn text-btn--muted" @click="clearSearch">返回书库</button>
      </div>
      <SongList
        :songs="searchResults"
        :loading="searching"
        empty-title="没有找到相关有声内容"
        empty-desc="换个关键词试试"
      />
    </template>

    <!-- 书库首页 -->
    <template v-else>
      <section v-if="daily.length" class="section">
        <SectionHeader title="每日推荐" />
        <div class="hscroll">
          <button
            v-for="book in daily"
            :key="`daily-${book.id}`"
            class="book-tile"
            @click="router.push(`/audiobooks/${book.id}`)"
          >
            <span class="book-tile__cover cover-frame">
              <CoverImage :src="book.cover" :alt="book.name" />
            </span>
            <span class="book-tile__name ellipsis">{{ book.name }}</span>
            <span class="book-tile__author ellipsis">{{ book.author || `${book.chapterCount} 集` }}</span>
          </button>
        </div>
      </section>

      <section v-if="weekly.length" class="section">
        <SectionHeader title="本周上新" />
        <div class="hscroll">
          <button
            v-for="book in weekly"
            :key="`weekly-${book.id}`"
            class="book-tile book-tile--small"
            @click="router.push(`/audiobooks/${book.id}`)"
          >
            <span class="book-tile__cover cover-frame">
              <CoverImage :src="book.cover" :alt="book.name" />
            </span>
            <span class="book-tile__name ellipsis">{{ book.name }}</span>
            <span class="book-tile__author ellipsis">{{ book.recommendReason || book.author }}</span>
          </button>
        </div>
      </section>

      <section v-if="vip.length" class="section">
        <SectionHeader title="会员精选" />
        <div class="hscroll">
          <button
            v-for="book in vip"
            :key="`vip-${book.id}`"
            class="book-tile book-tile--small"
            @click="router.push(`/audiobooks/${book.id}`)"
          >
            <span class="book-tile__cover cover-frame">
              <CoverImage :src="book.cover" :alt="book.name" />
              <span class="book-tile__vip">VIP</span>
            </span>
            <span class="book-tile__name ellipsis">{{ book.name }}</span>
            <span class="book-tile__author ellipsis">{{ book.author }}</span>
          </button>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2 class="section-title">书库</h2>
          <span class="muted" style="font-size: 11px">{{ activeTagName }}</span>
        </div>

        <div class="chip-row ab-tags">
          <button
            v-for="tag in hotTags"
            :key="tag.id"
            class="chip"
            :class="{ 'chip--active': activeTag === tag.id }"
            @click="selectTag(tag)"
          >
            {{ tag.name }}
            <span v-if="tag.showVip" class="ab-tag-vip">VIP</span>
          </button>
        </div>

        <div v-if="shelf.length" class="book-grid">
          <button
            v-for="book in shelf"
            :key="`shelf-${book.id}`"
            class="book-card"
            @click="router.push(`/audiobooks/${book.id}`)"
          >
            <span class="book-card__cover cover-frame">
              <CoverImage :src="book.cover" :alt="book.name" />
            </span>
            <span class="book-card__name ellipsis">{{ book.name }}</span>
            <span class="book-card__meta ellipsis">
              {{ book.author || '佚名' }}<template v-if="book.chapterCount"> · {{ book.chapterCount }} 集</template>
            </span>
          </button>
        </div>

        <div v-else-if="shelfLoading" class="book-grid">
          <div v-for="n in 6" :key="n" class="skeleton book-skeleton" />
        </div>

        <div v-else class="empty-state" style="padding-top: 30px">
          <div class="empty-state__icon"><BookOpen :size="24" /></div>
          <p class="empty-state__title">这个分类暂时没有书</p>
          <p class="empty-state__desc">换一个分类看看</p>
        </div>

        <div v-if="shelf.length && hasMore" class="load-more">
          <button class="btn btn--soft btn--block btn--sm" :disabled="loadingMore" @click="loadShelf(false)">
            <Loader2 v-if="loadingMore" :size="14" class="spin-icon" />
            {{ loadingMore ? '加载中' : '加载更多' }}
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ab-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 18px 4px;
  padding: 8px 10px 8px 13px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}

.ab-search__icon {
  flex: 0 0 auto;
  color: var(--muted);
}

.ab-search__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-size: 13px;
}

.ab-search__input::placeholder {
  color: var(--muted);
}

.ab-search__clear {
  display: grid;
  border: 0;
  background: none;
  color: var(--muted);
  place-items: center;
}

.ab-search__submit {
  flex: 0 0 auto;
  padding: 5px 11px;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: #04241f;
  font-size: 11.5px;
  font-weight: 700;
}

.ab-search__submit:disabled {
  opacity: 0.6;
}

.book-tile {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 4px;
  width: 104px;
  border: 0;
  background: none;
  color: var(--text);
  text-align: left;
}

.book-tile__cover {
  position: relative;
  width: 104px;
  height: 138px;
  border-radius: 12px;
}

.book-tile--small {
  width: 92px;
}

.book-tile--small .book-tile__cover {
  width: 92px;
  height: 122px;
}

.book-tile__name {
  font-size: 11.5px;
  font-weight: 620;
}

.book-tile__author {
  margin-top: -3px;
  color: var(--muted);
  font-size: 9.5px;
}

.book-tile__vip {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 1px 4px;
  border-radius: 3px;
  background: linear-gradient(135deg, #ffd78a, #ffb340);
  color: #3a2600;
  font-size: 8px;
  font-weight: 800;
}

.ab-tags {
  padding: 0 18px 14px;
}

.ab-tag-vip {
  margin-left: 3px;
  color: var(--warning);
  font-size: 8px;
  font-weight: 700;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 10px;
  padding: 0 18px;
}

.book-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  text-align: left;
}

.book-card__cover {
  width: 100%;
  height: 132px;
  border-radius: 12px;
}

.book-card__name {
  font-size: 11.5px;
  font-weight: 620;
}

.book-card__meta {
  color: var(--muted);
  font-size: 9.5px;
}

.book-skeleton {
  height: 160px;
  border-radius: 12px;
}

.load-more {
  padding: 16px 18px 0;
}
</style>
