/**
 * 运行时设置与平台配置。
 *
 * 原库通过环境变量 `platform=lite` 在启动时决定使用标准版还是概念版。
 * Muskugou 只使用「酷狗概念版（Young / lite）」接口：
 *   - 概念版可以在登录后通过 Auth 接口获得完整的 128K 免费听地址；
 *   - 每日可领取概念版 VIP，解锁更高音质。
 *
 * 因此 `platform` 在运行时被固定为 `lite`，设置页不再提供线路切换。
 * `getPlatformConfig()` 仍保留 `standard` 分支，方便协议层联调脚本复用。
 */

import {
  APPID,
  CLIENTVER,
  LITE_APPID,
  LITE_CLIENTVER,
  LITE_SALT,
  LITE_SIGN_KEY_SALT,
  LITE_SONG_URL_PAGE_ID,
  LITE_SONG_URL_PID,
  LITE_SONG_URL_PPAGE_ID,
  SONG_URL_PAGE_ID,
  SONG_URL_PID,
  SONG_URL_PPAGE_ID,
  STANDARD_SALT,
  SIGN_KEY_SALT,
  STORAGE_KEYS,
} from './constants';
import { PUBLIC_LITE_RSA_KEY, PUBLIC_RSA_KEY } from './keys';
import { readJson, writeJson } from './storage';

/**
 * 平台：标准版 / 概念版（lite，又称 Young）。
 * App 运行时只会使用 `lite`；`standard` 仅用于兼容旧数据和协议联调。
 */
export type Platform = 'standard' | 'lite';

/** 音质等级，对应 song_url 的 quality 参数 */
export type AudioQuality = '128' | '320' | 'flac' | 'high' | 'super';

/** 应用设置（只保存用户可调项） */
export interface AppSettings {
  /** 接口平台 */
  platform: Platform;
  /** 默认播放音质 */
  quality: AudioQuality;
  /** 歌词页是否显示翻译 */
  showTranslation: boolean;
  /** 播放完当前歌曲后自动下一首 */
  autoPlayNext: boolean;
  /** 搜索页是否展示热搜 */
  showHotSearch: boolean;
  /** 登录后每天自动领取概念版 VIP */
  autoClaimVip: boolean;
  /** 领取后自动升级为畅听 VIP（tvip -> 完整权益） */
  autoUpgradeVip: boolean;
}

/** 一个平台的完整客户端参数 */
export interface PlatformConfig {
  platform: Platform;
  isLite: boolean;
  appid: number;
  clientver: number;
  /** Android 请求签名盐值 */
  salt: string;
  /** signKey 参数签名盐值 */
  signSalt: string;
  /** RSA 公钥 */
  rsaPublicKey: string;
  /** song_url 页面标识 */
  pageId: number;
  ppageId: string;
  pid: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  // 固定概念版：免费听 + 每日 VIP 都依赖概念版接口
  platform: 'lite',
  // 概念版免费听最高为标准音质，默认 320 会在 VIP 歌曲上多走一次回退
  quality: '320',
  showTranslation: true,
  autoPlayNext: true,
  showHotSearch: true,
  autoClaimVip: true,
  autoUpgradeVip: true,
};

let cached: AppSettings | null = null;
const listeners = new Set<(settings: AppSettings) => void>();

/** 读取设置；首次调用时从 localStorage 加载并合并默认值 */
export function getSettings(): AppSettings {
  if (!cached) {
    const stored = readJson<Partial<AppSettings>>(STORAGE_KEYS.settings, {});
    cached = { ...DEFAULT_SETTINGS, ...stored };
    // App 只使用概念版；旧版本保存的 standard 在这里自动迁移。
    // 强制覆盖而不是读取，避免旧 localStorage 让请求退回标准版。
    cached.platform = 'lite';
    // 兼容旧版本没有这两个开关的设置对象
    if (typeof cached.autoClaimVip !== 'boolean') cached.autoClaimVip = true;
    if (typeof cached.autoUpgradeVip !== 'boolean') cached.autoUpgradeVip = true;
  }
  return cached;
}

/** 更新设置并持久化，返回新的设置对象 */
export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  // platform 是只读的：即使调用方传入 standard，也保持概念版
  cached = { ...getSettings(), ...patch, platform: 'lite' };
  writeJson(STORAGE_KEYS.settings, cached);
  for (const listener of listeners) {
    try {
      listener(cached);
    } catch {
      // 监听器异常不应影响设置保存
    }
  }
  return cached;
}

/** 订阅设置变化（返回取消订阅函数） */
export function onSettingsChange(listener: (settings: AppSettings) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 根据平台生成客户端参数 */
export function getPlatformConfig(platform: Platform = getSettings().platform): PlatformConfig {
  const isLite = platform === 'lite';
  return {
    platform,
    isLite,
    appid: isLite ? LITE_APPID : APPID,
    clientver: isLite ? LITE_CLIENTVER : CLIENTVER,
    salt: isLite ? LITE_SALT : STANDARD_SALT,
    signSalt: isLite ? LITE_SIGN_KEY_SALT : SIGN_KEY_SALT,
    rsaPublicKey: isLite ? PUBLIC_LITE_RSA_KEY : PUBLIC_RSA_KEY,
    pageId: isLite ? LITE_SONG_URL_PAGE_ID : SONG_URL_PAGE_ID,
    ppageId: isLite ? LITE_SONG_URL_PPAGE_ID : SONG_URL_PPAGE_ID,
    pid: isLite ? LITE_SONG_URL_PID : SONG_URL_PID,
  };
}
