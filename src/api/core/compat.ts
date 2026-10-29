/**
 * 原库 `require('../util')` 的统一导出。
 *
 * 全量移植的 200 多个模块都通过 `const { xxx } = require('../util')`
 * 取工具函数。这里保持同名导出，让生成后的模块只需要把 require 换成
 * 对本文件的 import 即可。
 *
 * `appid` / `clientver` / `isLite` 使用 live binding：用户在设置页切换
 * 标准版/概念版后，模块里读取到的值会同步变化。
 */

import { getPlatformConfig, getSettings, onSettingsChange } from './config';
import {
  APIVER,
  APPID,
  CLIENTVER,
  LITE_APPID,
  LITE_CLIENTVER,
  QQ_APPID,
  QQ_LITE_APPID,
  SRC_APPID,
  WX_APPID,
  WX_LITE_APPID,
  WX_LITE_SECRET,
  WX_SECRET,
} from './constants';
import {
  cryptoAesDecrypt,
  cryptoAesEncrypt,
  cryptoMd5,
  cryptoRSAEncrypt,
  cryptoSha1,
  playlistAesDecrypt,
  playlistAesEncrypt,
  publicLiteRasKey,
  publicRasKey,
  rsaEncrypt2,
} from './crypto';
import { calculateMid } from './device';
import {
  signCloudKey,
  signKey,
  signParams,
  signParamsKey,
  signatureAndroidParams,
  signatureRegisterParams,
  signatureWebParams,
} from './helper';
import { createCloudRequest, createRequest } from './request';
import { cookieToJson, decodeLyrics, isUUIDv4, parseCookieString, randomNumber, randomString } from './util';

// ---------------------------------------------------------------------------
// 平台相关常量（live binding）
// ---------------------------------------------------------------------------

/** 当前是否为概念版 */
export let isLite = getSettings().platform === 'lite';
/** 当前客户端 appid（随平台切换） */
export let appid = isLite ? LITE_APPID : APPID;
/** 当前客户端 clientver（随平台切换） */
export let clientver = isLite ? LITE_CLIENTVER : CLIENTVER;

/** 设置变化时同步 live binding */
function refreshPlatformExports(): void {
  const config = getPlatformConfig();
  isLite = config.isLite;
  appid = config.appid;
  clientver = config.clientver;
}

// 立即注册监听；compat 是模块加载入口，设置变化不会漏掉
onSettingsChange(refreshPlatformExports);

/** 原始常量（config.json 中的固定值） */
export {
  LITE_APPID as liteAppid,
  LITE_CLIENTVER as liteClientver,
  WX_APPID as wx_appid,
  WX_LITE_APPID as wx_lite_appid,
  WX_SECRET as wx_secret,
  WX_LITE_SECRET as wx_lite_secret,
  QQ_APPID as qq_appid,
  QQ_LITE_APPID as qq_lite_appid,
  SRC_APPID as srcappid,
  APIVER as apiver,
};

// ---------------------------------------------------------------------------
// 加密 / 签名 / 请求
// ---------------------------------------------------------------------------

export {
  cryptoAesDecrypt,
  cryptoAesEncrypt,
  cryptoMd5,
  cryptoRSAEncrypt,
  cryptoSha1,
  rsaEncrypt2,
  playlistAesEncrypt,
  playlistAesDecrypt,
  publicLiteRasKey,
  publicRasKey,
  signKey,
  signParams,
  signParamsKey,
  signCloudKey,
  signatureAndroidParams,
  signatureRegisterParams,
  signatureWebParams,
  createRequest,
  createCloudRequest,
};

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

export { randomString, randomNumber, parseCookieString, cookieToJson, decodeLyrics, calculateMid, isUUIDv4 };

/**
 * 原库 `util/index.js` 并未导出 userid，但 `playlist_share_official.js`
 * 误引用了它。为保持模块可加载，这里补一个占位值（该模块实际使用的是
 * cookie 里的 userid，不受影响）。
 */
export const userid = 0;

/**
 * 代理解析兼容函数。
 * App 运行在手机本地，不支持 HTTP 代理配置，统一返回 null。
 */
export function resolveProxy(): null {
  return null;
}
