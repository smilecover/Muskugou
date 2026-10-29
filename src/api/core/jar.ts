/**
 * Cookie 管理。
 *
 * 原库由浏览器/服务端负责保存 Cookie；App 里必须自己维护：
 * - 设备 Cookie 由 `device.ts` 生成，每次读取时合并进来；
 * - `dfid` 由 `/register/dev` 返回，必须持久化；
 * - 登录成功后 `token/userid/vip_type/...` 也要持久化；
 * - 标准版与概念版使用两套独立的 Cookie。
 */

import { STORAGE_KEYS } from './constants';
import { getSettings, type Platform } from './config';
import { getDeviceCookies } from './device';
import { readJson, writeJson } from './storage';
import type { CookieJar } from './types';
import { parseCookieString } from './util';

const DEVICE_KEYS = ['KUGOU_API_GUID', 'KUGOU_API_MID', 'KUGOU_API_DEV', 'KUGOU_API_MAC', 'KUGOU_API_WEBGL'];

const cache = new Map<Platform, CookieJar>();
const authListeners = new Set<(auth: { token: string; userid: string }) => void>();

/** Cookie 存储键（按平台隔离） */
function storageKey(platform: Platform): string {
  return `${STORAGE_KEYS.cookies}.${platform}`;
}

/** 从本地加载并合并设备 Cookie */
function load(platform: Platform): CookieJar {
  const stored = readJson<CookieJar>(storageKey(platform), {});
  const jar: CookieJar = { ...stored, ...getDeviceCookies() };
  cache.set(platform, jar);
  return jar;
}

/** 获取当前平台的 Cookie 表（可变对象，模块只读） */
export function getCookieJar(platform: Platform = getSettings().platform): CookieJar {
  return cache.get(platform) ?? load(platform);
}

/** 只持久化非设备字段，设备字段由 device.ts 统一管理 */
function persist(platform: Platform): void {
  const jar = getCookieJar(platform);
  const stored: CookieJar = {};
  for (const [key, value] of Object.entries(jar)) {
    if (!DEVICE_KEYS.includes(key) && value !== undefined && value !== null) {
      stored[key] = value;
    }
  }
  writeJson(storageKey(platform), stored);
}

/** 当前登录态快照 */
export function getAuth(platform: Platform = getSettings().platform): { token: string; userid: string } {
  const jar = getCookieJar(platform);
  return { token: jar.token || '', userid: jar.userid || '0' };
}

/** 是否已登录 */
export function hasLogin(platform: Platform = getSettings().platform): boolean {
  const { token, userid } = getAuth(platform);
  return Boolean(token) && userid !== '0' && userid !== '';
}

/** 通知 UI 登录态变化 */
function emitAuth(platform: Platform): void {
  const auth = getAuth(platform);
  for (const listener of authListeners) {
    try {
      listener(auth);
    } catch {
      // ignore
    }
  }
}

/** 订阅登录态变化 */
export function onAuthChange(listener: (auth: { token: string; userid: string }) => void): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

/** 合并响应头里的 Set-Cookie 数组 */
export function setCookieStrings(cookies: string[], platform: Platform = getSettings().platform): CookieJar {
  const jar = getCookieJar(platform);
  let changed = false;

  for (const raw of cookies) {
    const cleaned = parseCookieString(raw);
    if (!cleaned) continue;
    // Set-Cookie 可能带多个属性，只取第一段 key=value
    const first = cleaned.split(';')[0].trim();
    const index = first.indexOf('=');
    if (index <= 0) continue;
    const key = first.slice(0, index).trim();
    const value = first.slice(index + 1).trim();
    if (!key) continue;

    /*
     * 模块层用模板字符串拼 Cookie，字段缺失时可能产生 "undefined"/"null"。
     * 这类值一旦覆盖 token/userid 会让登录态直接失效（刷新登录接口尤其
     * 容易遇到），落库前统一丢弃。空 token/userid 与 userid=0 同理。
     */
    if (value === 'undefined' || value === 'null') continue;
    if ((key === 'token' || key === 'userid' || key === 't1') && !value) continue;
    if (key === 'userid' && value === '0') continue;

    jar[key] = value;
    changed = true;
  }

  if (changed) {
    persist(platform);
    emitAuth(platform);
  }
  return jar;
}

/** 合并一个 Cookie 对象（登录模块/手动注入时使用） */
export function setCookieObject(cookies: CookieJar, platform: Platform = getSettings().platform): CookieJar {
  const jar = getCookieJar(platform);
  Object.assign(jar, cookies);
  persist(platform);
  emitAuth(platform);
  return jar;
}

/** 设置单个 Cookie */
export function setCookieValue(key: string, value: string, platform: Platform = getSettings().platform): void {
  const jar = getCookieJar(platform);
  jar[key] = value;
  persist(platform);
  if (key === 'token' || key === 'userid') emitAuth(platform);
}

/** 删除单个 Cookie（例如无效的 dfid） */
export function removeCookieValue(key: string, platform: Platform = getSettings().platform): void {
  const jar = getCookieJar(platform);
  if (!(key in jar)) return;
  delete jar[key];
  persist(platform);
  if (key === 'token' || key === 'userid') emitAuth(platform);
}

/** 清除登录态（保留设备标识与 dfid） */
export function clearAuth(platform: Platform = getSettings().platform): void {
  const jar = getCookieJar(platform);
  for (const key of ['token', 'userid', 'vip_type', 'vip_token', 't1', 'auth', 'user_type']) {
    delete jar[key];
  }
  persist(platform);
  emitAuth(platform);
}

/** 清空某个平台的全部 Cookie（包括 dfid） */
export function clearCookies(platform: Platform = getSettings().platform): void {
  cache.delete(platform);
  writeJson(storageKey(platform), {});
  load(platform);
  emitAuth(platform);
}

/** 清空两个平台的 Cookie（设置页“退出并清除数据”） */
export function clearAllCookies(): void {
  clearCookies('standard');
  clearCookies('lite');
}

/**
 * 请求使用的 Cookie：设备 + 当前平台 Cookie。
 * 模块传入的 cookie 放在后面，允许模块临时覆盖（例如 song_url 的随机 dfid）。
 */
export function mergeRequestCookie(cookie?: CookieJar, platform: Platform = getSettings().platform): CookieJar {
  return { ...getCookieJar(platform), ...(cookie || {}) };
}
