/**
 * 请求签名算法。
 *
 * 酷狗所有开放接口都会校验 `signature`（或 `key`/`sign`）参数，算法都是
 * “盐值 + 排序后的参数串 + 请求体 + 盐值”取 MD5。不同端只是盐值和拼接
 * 细节不同：
 * - Android：`key=value`，按 key 排序，对象值 JSON.stringify
 * - Web：`key=value`，按 key 排序，POST 时把 JSON body 拼进去
 * - 设备注册：只取值、排序，盐值为 "1014"
 */

import CryptoJS from 'crypto-js';
import { getPlatformConfig } from './config';
import { cryptoMd5, wordArrayFromBuffer } from './crypto';
import { REGISTER_SALT, WEB_SIGNATURE_SALT } from './constants';

/** 参与签名的参数表 */
export type SignParams = Record<string, unknown>;

/** 参数值转字符串：对象按 JSON 处理，保持与原库一致的输出 */
function valueToString(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Web 版签名：H5 的 kGRequest 对带 body 的 POST 会把 body 拼进签名 */
export function signatureWebParams(params: SignParams, data?: string): string {
  const paramsString = Object.keys(params)
    .map((key) => `${key}=${valueToString(params[key])}`)
    .sort()
    .join('');
  return cryptoMd5(`${WEB_SIGNATURE_SALT}${paramsString}${data || ''}${WEB_SIGNATURE_SALT}`);
}

/**
 * Android 版签名。
 *
 * 当请求体是二进制时（极少数上传接口），使用 crypto-js 的增量 MD5，
 * 避免先把二进制转成字符串导致字节变化。
 */
export function signatureAndroidParams(params: SignParams, data?: string | Uint8Array): string {
  const { salt } = getPlatformConfig();
  const paramsString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${valueToString(params[key])}`)
    .join('');

  if (data instanceof Uint8Array) {
    const hasher = CryptoJS.algo.MD5.create();
    hasher.update(CryptoJS.enc.Utf8.parse(salt));
    hasher.update(CryptoJS.enc.Utf8.parse(paramsString));
    hasher.update(wordArrayFromBuffer(data));
    hasher.update(CryptoJS.enc.Utf8.parse(salt));
    return hasher.finalize().toString(CryptoJS.enc.Hex);
  }

  return cryptoMd5(`${salt}${paramsString}${data || ''}${salt}`);
}

/** 设备注册接口签名：只对值排序，盐值为 1014 */
export function signatureRegisterParams(params: SignParams): string {
  const paramsString = Object.keys(params)
    .map((key) => valueToString(params[key]))
    .sort()
    .join('');
  return cryptoMd5(`${REGISTER_SALT}${paramsString}${REGISTER_SALT}`);
}

/** 通用 sign：key+value 直接拼接，追加 body 和固定盐 */
export function signParams(params: SignParams, data?: string): string {
  const salt = 'R6snCXJgbCaj9WFRJKefTMIFp0ey6Gza';
  const paramsString = Object.keys(params)
    .sort()
    .map((key) => `${key}${valueToString(params[key])}`)
    .join('');
  return cryptoMd5(`${paramsString}${data || ''}${salt}`);
}

/**
 * signKey：song_url 等接口的 `key` 参数。
 * 算法：MD5(hash + 平台盐 + appid + mid + userid)
 */
export function signKey(hash: unknown, mid: unknown, userid?: unknown, appid?: unknown): string {
  const config = getPlatformConfig();
  return cryptoMd5(
    `${valueToString(hash)}${config.signSalt}${valueToString(appid ?? config.appid)}${valueToString(mid)}${valueToString(userid || 0)}`,
  );
}

/** 云盘接口 key（保留原库实现，当前 App 未使用） */
export function signCloudKey(hash: unknown, pid: unknown): string {
  const salt = 'ebd1ac3134c880bda6a2194537843caa0162e2e7';
  return cryptoMd5(`musicclound${valueToString(hash)}${valueToString(pid)}${salt}`);
}

/**
 * signParamsKey：推荐/歌单列表等接口的 `key` 参数。
 * 算法：MD5(appid + 平台盐 + clientver + data)
 */
export function signParamsKey(data: unknown, appid?: unknown, clientver?: unknown): string {
  const config = getPlatformConfig();
  const salt = config.isLite ? 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA' : 'OIlwieks28dk2k092lksi2UIkp';
  return cryptoMd5(
    `${valueToString(appid ?? config.appid)}${salt}${valueToString(clientver ?? config.clientver)}${valueToString(data)}`,
  );
}
