<script setup lang="ts">
/**
 * 听歌等级卡片。
 *
 * 数据来自 `/user/grade/info`（当前账号）。完整模式用于账号页和主页，
 * compact 模式嵌入“我的”页顶部账号卡片，只保留等级、进度和积分。
 */

import { computed } from 'vue';
import { Headphones, Loader2, RefreshCw } from 'lucide-vue-next';
import type { UserGrade } from '@/api';
import { formatListenTime } from '@/utils/format';

defineOptions({ name: 'UserLevelCard' });

const props = withDefaults(
  defineProps<{
    grade: UserGrade | null;
    loading?: boolean;
    error?: string;
    compact?: boolean;
    /** 是否显示刷新按钮（等级读取失败时同时显示重试） */
    refreshable?: boolean;
  }>(),
  { loading: false, error: '', compact: false, refreshable: false },
);

const emit = defineEmits<{ retry: [] }>();

const percent = computed(() => Math.round((props.grade?.progress || 0) * 100));
const listenText = computed(() => {
  const grade = props.grade;
  if (!grade) return '0 分钟';
  return formatListenTime(grade.listenSeconds || grade.listenMinutes * 60);
});
</script>

<template>
  <section
    v-if="grade || loading || error"
    class="level-card"
    :class="{ 'level-card--compact': compact }"
  >
    <template v-if="grade">
      <div class="level-card__head">
        <span class="level-card__badge">Lv.{{ grade.level }}</span>
        <div class="level-card__info">
          <p>听歌等级</p>
          <span>
            <Headphones :size="11" />
            累计听歌 {{ listenText }}
          </span>
        </div>
        <button
          v-if="refreshable"
          class="level-card__refresh"
          type="button"
          aria-label="刷新听歌等级"
          :disabled="loading"
          @click="emit('retry')"
        >
          <RefreshCw :size="13" :class="{ 'spin-icon': loading }" />
        </button>
      </div>

      <div
        class="level-card__bar"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="percent"
        :aria-label="`听歌等级 Lv.${grade.level} 升级进度`"
      >
        <span :style="{ width: `${percent}%` }" />
      </div>

      <div class="level-card__foot">
        <span>{{ grade.currentPoint }} / {{ grade.nextLevelPoint }} 积分</span>
        <span v-if="grade.maxLevel">已达最高等级</span>
        <span v-else>距 Lv.{{ grade.nextLevel }} 还差 {{ grade.pointsToNext }}</span>
      </div>
    </template>

    <div v-else-if="loading" class="level-card__state">
      <Loader2 :size="14" class="spin-icon" />
      正在读取听歌等级…
    </div>

    <div v-else class="level-card__state level-card__state--error">
      <span>{{ error || '听歌等级暂时不可用' }}</span>
      <button v-if="refreshable" type="button" @click="emit('retry')">重试</button>
    </div>
  </section>
</template>

<style scoped>
.level-card {
  padding: 13px 14px;
  border: 1px solid rgba(56, 225, 198, 0.16);
  border-radius: 18px;
  background:
    radial-gradient(140% 180% at 100% 0%, rgba(56, 225, 198, 0.1), transparent 62%),
    rgba(255, 255, 255, 0.025);
}

.level-card--compact {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.level-card__head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.level-card__badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 42px;
  height: 28px;
  padding: 0 9px;
  border-radius: 9px;
  color: #04241f;
  font-size: 11.5px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, #8cf5e1, #38e1c6);
}

.level-card__info {
  flex: 1;
  min-width: 0;
}

.level-card__info p {
  margin: 0;
  color: var(--text);
  font-size: 12.5px;
  font-weight: 650;
}

.level-card__info > span {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  color: var(--muted);
  font-size: 9.5px;
}

.level-card__refresh {
  display: grid;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.05);
}

.level-card__refresh:disabled {
  opacity: 0.55;
}

.level-card__bar {
  height: 4px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.level-card__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #38e1c6, #6fe3ff);
  transition: width 0.3s ease;
}

.level-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 6px;
  color: var(--muted);
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
}

.level-card__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  color: var(--muted);
  font-size: 10.5px;
}

.level-card__state--error {
  flex-wrap: wrap;
  color: var(--danger);
  text-align: center;
}

.level-card__state--error button {
  padding: 3px 10px;
  border: 1px solid rgba(56, 225, 198, 0.25);
  border-radius: 999px;
  color: var(--accent);
  font-size: 10px;
  background: var(--accent-soft);
}

.level-card--compact .level-card__head {
  gap: 8px;
}

.level-card--compact .level-card__badge {
  min-width: 36px;
  height: 22px;
  padding: 0 8px;
  border-radius: 7px;
  font-size: 10px;
}

.level-card--compact .level-card__info p {
  font-size: 11px;
}

.level-card--compact .level-card__info > span {
  display: none;
}

.level-card--compact .level-card__bar {
  margin-top: 8px;
  height: 3px;
}

.level-card--compact .level-card__foot {
  margin-top: 5px;
  font-size: 9px;
}

.level-card--compact .level-card__state {
  min-height: 24px;
  justify-content: flex-start;
  font-size: 9.5px;
}

.spin-icon {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
