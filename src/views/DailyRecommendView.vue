<script setup lang="ts">
/**
 * 每日推荐。
 *
 * 三个子页：
 *  - 今日：30 首日推
 *  - 历史：按日期回看往期推荐
 *  - 风格：按曲风推荐
 */

import { computed, onMounted, ref } from 'vue';
import { CalendarDays, History, Music2, Play, RefreshCw, Shuffle, Sparkles } from 'lucide-vue-next';
import CoverImage from '@/components/CoverImage.vue';
import DetailHeader from '@/components/DetailHeader.vue';
import SongList from '@/components/SongList.vue';
import { fallback } from '@/api';
import {
  getDailyHistory,
  getDailyHistorySongs,
  getDailyRecommend,
  getStyleRecommend,
  type DailyHistoryItem,
  type DailyRecommend,
  type Song,
  type StyleRecommend,
  type StyleTag,
} from '@/api';
import { usePlayerStore } from '@/stores/player';
import { useToastStore } from '@/stores/toast';

defineOptions({ name: 'DailyRecommendView' });

type TabKey = 'today' | 'history' | 'style';

const player = usePlayerStore();
const toast = useToastStore();

const tab = ref<TabKey>('today');
const loading = ref(true);
const daily = ref<DailyRecommend | null>(null);
const history = ref<DailyHistoryItem[]>([]);
const style = ref<StyleRecommend | null>(null);
const styleLoading = ref(false);
const selectedDate = ref('');
const historySongs = ref<Song[]>([]);
const historyLoading = ref(false);

const tabs: { key: TabKey; label: string; icon: typeof CalendarDays }[] = [
  { key: 'today', label: '今日推荐', icon: CalendarDays },
  { key: 'history', label: '历史推荐', icon: History },
  { key: 'style', label: '风格推荐', icon: Sparkles },
];

const dateLabel = computed(() => {
  const value = daily.value?.date;
  if (!value || value.length !== 8) return '今天';
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
});

const styleTags = computed<StyleTag[]>(() => style.value?.tags || []);

async function loadAll(): Promise<void> {
  loading.value = true;
  try {
    const [nextDaily, nextHistory, nextStyle] = await Promise.all([
      fallback(getDailyRecommend, null as DailyRecommend | null),
      fallback(getDailyHistory, [] as DailyHistoryItem[]),
      fallback(() => getStyleRecommend(), null as StyleRecommend | null),
    ]);
    daily.value = nextDaily;
    history.value = nextHistory;
    style.value = nextStyle;
  } finally {
    loading.value = false;
  }
}

async function openDate(item: DailyHistoryItem): Promise<void> {
  selectedDate.value = item.date;
  historyLoading.value = true;
  try {
    historySongs.value = await getDailyHistorySongs(item.date);
    if (!historySongs.value.length) toast.error('这一天的推荐暂时不可用');
  } catch {
    historySongs.value = [];
    toast.error('往期推荐加载失败');
  } finally {
    historyLoading.value = false;
  }
}

async function loadStyle(tag?: StyleTag): Promise<void> {
  styleLoading.value = true;
  try {
    style.value = await getStyleRecommend(tag?.id || tag?.name || 'S14');
  } catch {
    toast.error('风格推荐加载失败');
  } finally {
    styleLoading.value = false;
  }
}

/** 随机播放今日推荐 */
function shuffleDaily(): void {
  const list = daily.value?.songs || [];
  if (!list.length) return;
  player.setMode('shuffle');
  void player.playSongs(list, Math.floor(Math.random() * list.length));
}

function selectTab(next: TabKey): void {
  tab.value = next;
  if (next === 'history' && !history.value.length) {
    void fallback(getDailyHistory, [] as DailyHistoryItem[]).then((items) => (history.value = items));
  }
}

onMounted(() => {
  void loadAll();
});
</script>

<template>
  <div class="page daily-page">
    <DetailHeader title="每日推荐">
      <template #actions>
        <button class="icon-btn icon-btn--ghost" aria-label="刷新" @click="loadAll">
          <RefreshCw :size="18" />
        </button>
      </template>
    </DetailHeader>

    <div class="segmented daily-tabs">
      <button
        v-for="item in tabs"
        :key="item.key"
        class="segmented__item"
        :class="{ 'segmented__item--active': tab === item.key }"
        @click="selectTab(item.key)"
      >
        <component :is="item.icon" :size="14" />
        {{ item.label }}
      </button>
    </div>

    <!-- 今日 -->
    <template v-if="tab === 'today'">
      <section v-if="daily" class="daily-hero">
        <div class="daily-hero__cover cover-frame">
          <CoverImage :src="daily.cover || daily.songs[0]?.cover" :alt="daily.subtitle" />
        </div>
        <div class="daily-hero__info">
          <p class="daily-hero__eyebrow">DAILY RECOMMEND</p>
          <h1>{{ dateLabel }}</h1>
          <p class="daily-hero__sub ellipsis">{{ daily.subtitle }}</p>
          <div class="daily-hero__actions">
            <button class="btn btn--primary btn--sm" :disabled="!daily.songs.length" @click="player.playSongs(daily.songs, 0)">
              <Play :size="14" fill="currentColor" :stroke-width="0" />
              播放全部
            </button>
            <button class="btn btn--soft btn--sm" :disabled="!daily.songs.length" @click="shuffleDaily">
              <Shuffle :size="14" />
              随机
            </button>
          </div>
        </div>
      </section>

      <section class="section daily-list">
        <div class="section-head">
          <h2 class="section-title">共 {{ daily?.songs.length || 0 }} 首</h2>
          <span class="muted" style="font-size: 11px">每日 0 点更新</span>
        </div>
        <SongList
          :songs="daily?.songs || []"
          :loading="loading"
          empty-title="今天还没有推荐"
          empty-desc="稍后再来看看，或去搜索喜欢的歌"
        />
      </section>
    </template>

    <!-- 历史 -->
    <template v-else-if="tab === 'history'">
      <div v-if="history.length" class="date-list">
        <button
          v-for="item in history"
          :key="item.date"
          class="date-row"
          :class="{ 'date-row--active': selectedDate === item.date }"
          @click="openDate(item)"
        >
          <span class="date-row__icon"><History :size="16" /></span>
          <span class="date-row__text">
            <strong>{{ item.title || item.date }}</strong>
            <small>{{ item.songCount ? `${item.songCount} 首` : '查看当天推荐' }}</small>
          </span>
          <span class="date-row__chevron">›</span>
        </button>
      </div>
      <div v-else class="empty-state" style="padding-top: 50px">
        <div class="empty-state__icon"><History :size="24" /></div>
        <p class="empty-state__title">暂无历史推荐</p>
        <p class="empty-state__desc">登录并多听几首歌后再来</p>
      </div>

      <section v-if="selectedDate" class="section">
        <div class="section-head">
          <h2 class="section-title">{{ selectedDate }} 的推荐</h2>
        </div>
        <SongList
          :songs="historySongs"
          :loading="historyLoading"
          empty-title="这一天的推荐没有数据"
          empty-desc="换一天试试"
        />
      </section>
    </template>

    <!-- 风格 -->
    <template v-else>
      <section class="style-head">
        <div>
          <p class="style-head__eyebrow">STYLE RADIO</p>
          <h1>{{ style?.title || '风格推荐' }}</h1>
          <p class="muted">按曲风挑选，常听常新</p>
        </div>
        <button class="icon-btn" aria-label="换一批" @click="loadStyle()">
          <RefreshCw :size="18" :class="{ 'spin-icon': styleLoading }" />
        </button>
      </section>

      <div v-if="styleTags.length" class="chip-row">
        <button
          v-for="tag in styleTags"
          :key="tag.id || tag.name"
          class="chip"
          :class="{ 'chip--active': style?.tagIds === tag.id }"
          @click="loadStyle(tag)"
        >
          {{ tag.name }}
        </button>
      </div>

      <div class="style-play">
        <button class="btn btn--soft btn--sm" :disabled="!style?.songs.length" @click="style && player.playSongs(style.songs, 0)">
          <Music2 :size="14" />
          播放风格歌单
        </button>
      </div>

      <SongList
        :songs="style?.songs || []"
        :loading="styleLoading"
        empty-title="暂无风格推荐"
        empty-desc="换一个风格试试"
      />
    </template>
  </div>
</template>

<style scoped>
.daily-tabs {
  margin: 4px 18px 16px;
}

.daily-hero {
  display: flex;
  gap: 16px;
  margin: 0 18px;
  padding: 16px;
  border: 1px solid rgba(56, 225, 198, 0.14);
  border-radius: 22px;
  background:
    radial-gradient(120% 160% at 0% 0%, rgba(56, 225, 198, 0.18), transparent 55%),
    radial-gradient(120% 160% at 100% 10%, rgba(91, 155, 255, 0.15), transparent 55%),
    #0e1725;
}

.daily-hero__cover {
  flex: 0 0 110px;
  width: 110px;
  height: 110px;
  border-radius: 18px;
  box-shadow: var(--shadow-card);
}

.daily-hero__info {
  flex: 1;
  min-width: 0;
}

.daily-hero__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.daily-hero__info h1 {
  margin: 4px 0 2px;
  font-size: 24px;
  font-weight: 780;
  letter-spacing: -0.03em;
}

.daily-hero__sub {
  margin: 0;
  color: var(--text-2);
  font-size: 11.5px;
}

.daily-hero__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.daily-list {
  margin-top: 22px;
}

.date-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px;
}

.date-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  color: var(--text);
  text-align: left;
}

.date-row--active {
  border-color: rgba(56, 225, 198, 0.36);
  background: rgba(56, 225, 198, 0.08);
}

.date-row__icon {
  display: grid;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(56, 225, 198, 0.12);
  color: var(--accent);
  place-items: center;
}

.date-row__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.date-row__text strong {
  font-size: 13px;
  font-weight: 650;
}

.date-row__text small {
  color: var(--muted);
  font-size: 10.5px;
}

.date-row__chevron {
  color: var(--muted);
  font-size: 18px;
}

.style-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 4px 18px 12px;
}

.style-head__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.style-head h1 {
  margin: 2px 0 1px;
  font-size: 22px;
  font-weight: 750;
}

.style-head .muted {
  margin: 0;
  font-size: 11.5px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 0 18px;
}

.chip {
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 11.5px;
}

.chip--active {
  border-color: rgba(56, 225, 198, 0.42);
  background: rgba(56, 225, 198, 0.12);
  color: var(--accent);
}

.style-play {
  display: flex;
  justify-content: flex-end;
  padding: 12px 18px 4px;
}
</style>
