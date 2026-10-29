/**
 * 概念版 VIP 状态与自动领取。
 *
 * 触发时机：
 *   - App 启动（已登录时）
 *   - 扫码登录成功（监听 Cookie 登录态变化）
 *   - App 从后台回到前台（每天首次回到前台时补领）
 *   - 用户在「我的」或「设置」中手动领取
 *
 * 去重：
 *   - 成功领取后把 `${userid}@${日期}` 写入本地，同一天不会重复请求；
 *   - 自动领取失败后 10 分钟内不再重试，避免触发酷狗风控。
 */

import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  claimDailyVip,
  clearUrlCache,
  getAuth,
  getTodayKey,
  getVipMonthStatus,
  hasLogin,
  onAuthChange,
  readJson,
  STORAGE_KEYS,
  toErrorMessage,
  writeJson,
} from '@/api';
import { useSettingsStore } from './settings';
import { useToastStore } from './toast';
import { useUserStore } from './user';

/** 本地持久化的领取状态（按账号区分） */
interface PersistedMembership {
  userId: string;
  /** 最近一次确认已领取的日期 */
  lastClaimDay: string;
  /** 当日 VIP 类型：tvip 表示待升级 */
  vipType: string;
  lastMessage: string;
  lastClaimAt: number;
}

const AUTO_RETRY_COOLDOWN = 10 * 60 * 1000;
const VISIBILITY_COOLDOWN = 5 * 60 * 1000;

export const useMembershipStore = defineStore('membership', () => {
  const settings = useSettingsStore();
  const toast = useToastStore();
  const user = useUserStore();

  const loading = ref(false);
  const claiming = ref(false);
  const loaded = ref(false);
  const todayClaimed = ref(false);
  const todayVipType = ref('');
  const lastMessage = ref('');
  const lastClaimAt = ref(0);
  const error = ref('');

  let initialized = false;
  let autoRun: Promise<void> | null = null;
  let lastAutoAttempt = 0;
  let lastVisibilityCheck = 0;

  const loggedIn = computed(() => user.loggedIn);
  const vipActive = computed(() => Boolean(user.profile?.vipType) || todayClaimed.value);
  const pendingUpgrade = computed(() => todayClaimed.value && todayVipType.value === 'tvip');
  const canClaim = computed(
    () => loggedIn.value && !claiming.value && (!todayClaimed.value || pendingUpgrade.value),
  );

  /** 会员卡片主文案 */
  const statusText = computed(() => {
    if (!loggedIn.value) return '登录后每天可领取 1 天概念版 VIP';
    if (claiming.value) return '正在领取今日 VIP…';
    if (error.value) return error.value;
    if (loading.value && !loaded.value) return '正在同步会员状态…';
    if (pendingUpgrade.value) return '今日已领取，可升级为畅听 VIP';
    if (todayClaimed.value) return '今日已领取，会员权益生效中';
    return '今日可领取 1 天概念版 VIP';
  });

  const actionText = computed(() => {
    if (claiming.value) return '领取中…';
    if (pendingUpgrade.value) return '升级';
    if (todayClaimed.value) return '已领取';
    return '立即领取';
  });

  const autoStatusText = computed(() =>
    settings.state.autoClaimVip ? '每日自动领取已开启' : '每日自动领取已关闭',
  );

  // 用户资料刷新后同步 VIP 生效状态
  watch(
    () => user.profile?.vipType,
    (vipType) => {
      if (Number(vipType || 0) > 0) loaded.value = true;
    },
  );

  function currentUserId(): string {
    return String(user.profile?.userid || getAuth().userid || '0');
  }

  function readPersisted(): Partial<PersistedMembership> {
    return readJson<Partial<PersistedMembership>>(STORAGE_KEYS.membership, {});
  }

  function persist(day: string, vipType: string, message: string): void {
    const data: PersistedMembership = {
      userId: currentUserId(),
      lastClaimDay: day,
      vipType,
      lastMessage: message,
      lastClaimAt: Date.now(),
    };
    writeJson(STORAGE_KEYS.membership, data);
    lastMessage.value = message;
    lastClaimAt.value = data.lastClaimAt;
  }

  /** 启动时恢复本地状态，避免每次冷启动都先闪一下“未领取” */
  function hydrate(): void {
    if (!hasLogin()) return;
    const saved = readPersisted();
    if (saved.userId && saved.userId !== currentUserId()) return;
    lastMessage.value = saved.lastMessage || '';
    lastClaimAt.value = Number(saved.lastClaimAt || 0);
    if (saved.lastClaimDay === getTodayKey()) {
      todayClaimed.value = true;
      todayVipType.value = saved.vipType || '';
    }
  }

  function reset(): void {
    loading.value = false;
    claiming.value = false;
    loaded.value = false;
    todayClaimed.value = false;
    todayVipType.value = '';
    lastMessage.value = '';
    lastClaimAt.value = 0;
    error.value = '';
    autoRun = null;
    lastAutoAttempt = 0;
  }

  /** 从服务端同步当月记录（不领取） */
  async function refresh(): Promise<void> {
    if (!hasLogin()) {
      reset();
      return;
    }

    loading.value = true;
    error.value = '';
    try {
      const status = await getVipMonthStatus();
      todayClaimed.value = Boolean(status.today);
      todayVipType.value = status.today?.vipType || '';
      loaded.value = true;

      if (status.today) {
        const message = status.today.vipType === 'tvip' ? '今日 VIP 已领取（待升级）' : '今日 VIP 已领取';
        persist(status.today.day, status.today.vipType, message);
      } else {
        // 服务端记录比本地缓存新（例如活动重置），以服务端为准
        lastMessage.value = '';
        lastClaimAt.value = 0;
        const saved = readPersisted();
        if (saved.userId === currentUserId() && saved.lastClaimDay === getTodayKey()) {
          writeJson(STORAGE_KEYS.membership, { ...saved, lastClaimDay: '', vipType: '' });
        }
      }
    } catch (err) {
      error.value = toErrorMessage(err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 领取今日 VIP。
   *
   * @param upgrade 是否升级为畅听 VIP
   * @param quiet   自动领取时为 true，不弹成功提示
   */
  async function claim(upgrade = true, quiet = false): Promise<boolean> {
    if (!hasLogin()) {
      toast.info('请先登录酷狗账号');
      return false;
    }
    if (claiming.value) return false;

    claiming.value = true;
    error.value = '';
    try {
      const result = await claimDailyVip({ upgrade });
      todayClaimed.value = result.claimed;
      todayVipType.value = result.upgraded ? 'concept' : 'tvip';
      loaded.value = true;
      persist(getTodayKey(), todayVipType.value, result.message);

      // VIP 生效后，之前缓存的试听地址可以换成完整地址
      clearUrlCache();
      await user.refresh().catch(() => null);

      if (!quiet) {
        if (result.alreadyClaimed && pendingUpgrade.value) toast.success('今日 VIP 已领取，可升级');
        else toast.success(result.message);
      } else if (!result.alreadyClaimed) {
        toast.success('已自动领取今日概念版 VIP');
      }
      return true;
    } catch (err) {
      error.value = toErrorMessage(err);
      if (!quiet) toast.error(error.value);
      return false;
    } finally {
      claiming.value = false;
    }
  }

  /**
   * 自动领取入口：已登录 + 开关开启时执行。
   *
   * 同一天成功领取后不再请求；失败后 10 分钟内冷却。
   */
  async function maybeAutoClaim(force = false): Promise<void> {
    if (!hasLogin() || !settings.state.autoClaimVip) return;
    if (autoRun) return autoRun;

    const day = getTodayKey();
    if (!force) {
      const saved = readPersisted();
      if (saved.userId === currentUserId() && saved.lastClaimDay === day) {
        todayClaimed.value = true;
        todayVipType.value = saved.vipType || todayVipType.value;
        return;
      }
      if (lastAutoAttempt && Date.now() - lastAutoAttempt < AUTO_RETRY_COOLDOWN) return;
    }
    lastAutoAttempt = Date.now();

    autoRun = (async () => {
      loading.value = true;
      try {
        const status = await getVipMonthStatus().catch(() => null);
        if (status?.today) {
          todayClaimed.value = true;
          todayVipType.value = status.today.vipType;
          persist(day, status.today.vipType, statusText.value);
          // 已领取但仍是 tvip：只有开启自动升级时才补升级
          if (status.today.vipType === 'tvip' && settings.state.autoUpgradeVip) {
            await claim(true, true);
          }
          loaded.value = true;
          return;
        }
        await claim(settings.state.autoUpgradeVip, true);
      } catch (err) {
        error.value = toErrorMessage(err);
      } finally {
        loading.value = false;
        autoRun = null;
      }
    })();

    return autoRun;
  }

  /** 手动领取（始终尝试升级，不受自动升级开关限制） */
  async function manualClaim(): Promise<boolean> {
    return claim(true, false);
  }

  /** App 回到前台：跨天时补领 */
  function handleVisibility(): void {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    if (Date.now() - lastVisibilityCheck < VISIBILITY_COOLDOWN) return;
    lastVisibilityCheck = Date.now();
    void refresh();
    void maybeAutoClaim();
  }

  /** 只初始化一次；在 main.ts 中调用 */
  function init(): void {
    if (initialized) return;
    initialized = true;

    hydrate();

    onAuthChange(() => {
      if (hasLogin()) {
        // 登录成功：等 user.refresh 把资料取回来后再领取，展示更准确
        void refresh();
        void maybeAutoClaim();
      } else {
        reset();
      }
    });

    if (hasLogin()) {
      void refresh();
      void maybeAutoClaim();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }
  }

  return {
    loading,
    claiming,
    loaded,
    todayClaimed,
    todayVipType,
    lastMessage,
    lastClaimAt,
    error,
    loggedIn,
    vipActive,
    pendingUpgrade,
    canClaim,
    statusText,
    actionText,
    autoStatusText,
    init,
    refresh,
    claim,
    maybeAutoClaim,
    manualClaim,
  };
});
