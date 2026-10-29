/**
 * 设备身份。
 *
 * 酷狗服务端通过以下 Cookie 识别“一台设备”：
 *   KUGOU_API_GUID  = MD5(UUID v4)
 *   KUGOU_API_MID   = MD5(GUID) 的十进制大整数
 *   KUGOU_API_DEV   = 10 位大写随机串
 *   KUGOU_API_MAC   = 固定 02:00:00:00:00:00
 *   KUGOU_API_WEBGL = WebGL 指纹（不可用时为随机 uint64）
 *
 * 这些值必须持久化：一旦变化，登录态、dfid、推荐结果都会失效。
 */

import { STORAGE_KEYS } from './constants';
import { cryptoMd5 } from './crypto';
import { readJson, writeJson } from './storage';
import { generateWebGLHash, getGuid, randomString } from './util';

export interface DeviceIdentity {
  /** MD5(UUID) */
  guid: string;
  /** GUID 的十进制大整数表示 */
  mid: string;
  /** 10 位大写设备标识 */
  dev: string;
  mac: string;
  /** WebGL 指纹 */
  webgl: string;
}

let cached: DeviceIdentity | null = null;

/** 计算 MID：把 32 位 MD5 hex 当作 16 进制大整数转成十进制 */
export function calculateMid(guid: string): string {
  return BigInt(`0x${cryptoMd5(guid)}`).toString();
}

function createDevice(): DeviceIdentity {
  const guid = cryptoMd5(getGuid());
  return {
    guid,
    mid: calculateMid(guid),
    dev: randomString(10).toUpperCase(),
    mac: '02:00:00:00:00:00',
    webgl: generateWebGLHash(),
  };
}

/** 读取或创建设备身份 */
export function getDevice(): DeviceIdentity {
  if (cached) return cached;
  const stored = readJson<Partial<DeviceIdentity>>(STORAGE_KEYS.device, {});
  const identity = createDevice();

  cached = {
    guid: stored.guid || identity.guid,
    mid: stored.mid || (stored.guid ? calculateMid(stored.guid) : identity.mid),
    dev: stored.dev || identity.dev,
    mac: stored.mac || identity.mac,
    webgl: stored.webgl || identity.webgl,
  };
  writeJson(STORAGE_KEYS.device, cached);
  return cached;
}

/** 设备 Cookie（每次请求都会合并进 Cookie 表） */
export function getDeviceCookies(): Record<string, string> {
  const device = getDevice();
  return {
    KUGOU_API_GUID: device.guid,
    KUGOU_API_MID: device.mid,
    KUGOU_API_DEV: device.dev,
    KUGOU_API_MAC: device.mac,
    KUGOU_API_WEBGL: device.webgl,
  };
}

/** 重置设备身份（设置页“清除设备标识”）；会同时清除登录态 */
export function resetDevice(): DeviceIdentity {
  cached = null;
  const identity = createDevice();
  cached = identity;
  writeJson(STORAGE_KEYS.device, identity);
  return identity;
}
