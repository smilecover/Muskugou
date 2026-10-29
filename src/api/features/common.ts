/**
 * 功能层共用的小工具。
 *
 * 酷狗接口的列表字段命名各不相同（list / lists / info / data_list / song_list…），
 * 这里集中做一次兼容，避免每个包装函数里重复写。
 */

import { normalizeImage } from '../core/util';

/** 依次尝试多个取值路径，返回第一个非空值 */
export function pick<T = any>(...values: T[]): any {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

/** 转字符串（null/undefined -> ''） */
export function text(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/** 转数字（非法值 -> 0） */
export function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 从一个响应体里找出第一个非空数组。
 * 传入字段名会比遍历整个 body 更可控，因此调用方按优先级列出候选。
 */
export function arrayFrom(body: any, ...keys: string[]): any[] {
  for (const key of keys) {
    let value = body;
    for (const part of key.split('.')) {
      value = value?.[part];
    }
    if (Array.isArray(value) && value.length) return value;
  }
  for (const key of keys) {
    let value = body;
    for (const part of key.split('.')) {
      value = value?.[part];
    }
    if (Array.isArray(value)) return value;
  }
  return [];
}

/** 把封面 URL 里的 {size} 占位替换成实际尺寸 */
export function image(value: unknown, size = 480): string {
  return normalizeImage(value as string | undefined | null, size);
}

/** 接口失败时返回兜底值，用于“一个区块失败不影响整页”的场景 */
export async function fallback<T>(task: () => Promise<T>, value: T): Promise<T> {
  try {
    return await task();
  } catch {
    return value;
  }
}

/** 是否登录才能使用的接口错误 */
export function isAuthError(error: unknown): boolean {
  const body = (error as any)?.body;
  const code = Number(body?.error_code ?? body?.errcode ?? (error as any)?.status);
  return (
    code === 20010 || code === 20017 || code === 20018 || code === 20002 || code === 401
  );
}

/** 把歌手数组 / 字符串统一成“、”分隔的文本 */
export function artistText(value: any): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => item?.author_name || item?.name || item?.singername || item)
      .filter(Boolean)
      .join('、');
  }
  return text(value);
}
