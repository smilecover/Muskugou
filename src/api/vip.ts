/**
 * 概念版 VIP 领取。
 *
 * 酷狗概念版每天可以领取 1 天 VIP（`/youth/day/vip`），领取后调用
 * `/youth/day/vip/upgrade` 可以升级为「畅听 VIP」。接口来自概念版活动，
 * 是否可用由酷狗服务端决定，App 只负责按官方流程调用并把结果反馈到界面。
 *
 * 流程（与概念版客户端一致）：
 *   1. `/youth/month/vip/record` 查询当月已领取日期；
 *   2. 今天还没有记录 → `/youth/day/vip`（receive_day=今天）；
 *   3. 等待 1 秒 → `/youth/day/vip/upgrade`；
 *   4. 今天已有 `tvip` 记录 → 说明已领取但未升级，可直接补升级。
 */

import { toErrorMessage } from './client';
import { getAuth, hasLogin } from './core/jar';
import { callModuleBody } from './registry';

/** 一条领取记录 */
export interface VipRecord {
  /** 日期，格式 YYYY-MM-DD */
  day: string;
  /** 当日领取天数（通常为 1） */
  receiveVip: number;
  /** 记录类型：tvip 表示已领取待升级，其它值表示已升级/畅听 */
  vipType: string;
  raw: any;
}

/** 当月领取情况 */
export interface VipMonthStatus {
  month: string;
  serverTime: number;
  records: VipRecord[];
  /** 今天的记录；不存在表示今天还没领取 */
  today: VipRecord | null;
}

/** 领取结果 */
export interface VipClaimResult {
  ok: boolean;
  /** 是否已经拥有今天的领取记录 */
  claimed: boolean;
  /** 是否成功升级为畅听 VIP */
  upgraded: boolean;
  /** 本次调用前就已经领取过 */
  alreadyClaimed: boolean;
  message: string;
}

const UPGRADE_DELAY = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 本地日期 YYYY-MM-DD（与概念版客户端一致，按设备时区计算） */
export function getTodayKey(date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 接口有时把数据放在 data 里，有时直接放在根节点 */
function pickData(body: any): any {
  if (!body || typeof body !== 'object') return {};
  return body.data ?? body;
}

function normalizeRecord(item: any): VipRecord | null {
  if (!item || typeof item !== 'object') return null;
  const day = String(item.day ?? item.date ?? item.receive_day ?? '').trim();
  if (!day) return null;
  return {
    day,
    receiveVip: Number(item.receive_vip ?? item.receiveVip ?? 0),
    vipType: String(item.vip_type ?? item.vipType ?? '').trim(),
    raw: item,
  };
}

/**
 * 查询当月领取记录。
 * 未登录时直接抛错，避免发出必然失败的请求。
 */
export async function getVipMonthStatus(): Promise<VipMonthStatus> {
  if (!hasLogin()) throw new Error('请先登录酷狗账号');

  const body = await callModuleBody('/youth/month/vip/record');
  const data = pickData(body);
  const rawList = data?.list ?? data?.records ?? data?.info ?? (Array.isArray(data) ? data : []);
  const records = (Array.isArray(rawList) ? rawList : [])
    .map(normalizeRecord)
    .filter((item): item is VipRecord => Boolean(item));

  const todayKey = getTodayKey();
  return {
    month: String(data?.month ?? ''),
    serverTime: Number(data?.server_time ?? 0),
    records,
    today: records.find((item) => item.day === todayKey) || null,
  };
}

/** 调用升级接口；失败不抛出，由调用方决定如何展示 */
async function upgradeVip(): Promise<{ ok: boolean; message: string }> {
  try {
    await callModuleBody('/youth/day/vip/upgrade', { userid: Number(getAuth().userid || 0) });
    return { ok: true, message: '已升级为畅听 VIP' };
  } catch (error) {
    return { ok: false, message: toErrorMessage(error) };
  }
}

/**
 * 领取今天的 VIP。
 *
 * @param upgrade 是否在领取后升级为畅听 VIP
 */
export async function claimDailyVip(options: { upgrade?: boolean } = {}): Promise<VipClaimResult> {
  if (!hasLogin()) throw new Error('请先登录酷狗账号');

  const todayKey = getTodayKey();

  // 先查记录：今天已经领过就不再重复请求领取接口
  const month = await getVipMonthStatus().catch(() => null);
  if (month?.today) {
    const record = month.today;
    if (options.upgrade && record.vipType === 'tvip') {
      const upgraded = await upgradeVip();
      return {
        ok: true,
        claimed: true,
        upgraded: upgraded.ok,
        alreadyClaimed: true,
        message: upgraded.ok ? '今日 VIP 已升级为畅听 VIP' : `今日已领取，升级失败：${upgraded.message}`,
      };
    }
    return {
      ok: true,
      claimed: true,
      upgraded: record.vipType !== 'tvip',
      alreadyClaimed: true,
      message: record.vipType === 'tvip' ? '今日 VIP 已领取（尚未升级）' : '今日 VIP 已领取',
    };
  }

  try {
    await callModuleBody('/youth/day/vip', { receive_day: todayKey });
  } catch (error) {
    // 并发/重复点击时服务端可能返回“已领取”；以当月记录为准再判断一次
    const retry = await getVipMonthStatus().catch(() => null);
    if (retry?.today) {
      return {
        ok: true,
        claimed: true,
        upgraded: retry.today.vipType !== 'tvip',
        alreadyClaimed: true,
        message: '今日 VIP 已领取',
      };
    }
    throw error;
  }

  let upgraded = false;
  let upgradeMessage = '';
  if (options.upgrade) {
    // 官方客户端在领取后等待 1 秒再升级，接口有先后顺序要求
    await delay(UPGRADE_DELAY);
    const result = await upgradeVip();
    upgraded = result.ok;
    upgradeMessage = result.message;
  }

  return {
    ok: true,
    claimed: true,
    upgraded,
    alreadyClaimed: false,
    message: upgraded
      ? '已领取并升级为畅听 VIP'
      : upgradeMessage
        ? `已领取今日 VIP，升级失败：${upgradeMessage}`
        : '已领取今日概念版 VIP',
  };
}
