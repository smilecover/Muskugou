/**
 * SSA 行为指纹模拟。
 *
 * 对应原库 `util/generate_simulate.js`。当接口返回 `ssa-code` 响应头时，
 * 服务端要求客户端补充一次行为验证；原库通过生成鼠标轨迹并加密成
 * edt/sid 来模拟。
 *
 * 说明：这是协议兼容层的一部分，只在本机生成随机轨迹，不采集任何真实
 * 用户行为数据。
 */

import CryptoJS from 'crypto-js';
import forge from 'node-forge';
import { SIMULATE_RSA_KEY } from './keys';
import { generateWebGLHash, randomString } from './util';

/** 固定 IV，ASCII 为 kugousecurity123 */
const IV = 'kugousecurity123';

/** 哨兵值：标记一类事件的结束 */
let SENTINEL = 0xffffffff - Math.floor(Math.random() * 20);

/** 生成 [min, max] 的随机整数 */
function ri(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** type-3 事件：鼠标移动 */
const f3 = (t: number, i: number, x: number, y: number) => `3,${t},${i},${x},${y}`;
/** type-5 事件：滚动/计时 */
const f5 = (t: number, i: number) => `5,${t},${i}`;
/** type-6 事件：窗口 */
const f6 = (t: number, i: number, x: number, y: number) => `6,${t},${i},${x},${y}`;
/** type-3 哨兵 */
const fs3 = (i: number, x: number, y: number) => `3,${SENTINEL},${i},${x},${y}`;
/** type-5 哨兵 */
const fs5 = (i: number) => `5,${SENTINEL},${i}`;
/** type-6 哨兵 */
const fs6 = (i: number, x: number, y: number) => `6,${SENTINEL},${i},${x},${y}`;

/** 三阶贝塞尔曲线鼠标轨迹 */
function bezierPath(sx: number, sy: number, ex: number, ey: number, n: number): Array<{ x: number; y: number }> {
  const c1x = sx + (ex - sx) * 0.3 + ri(-80, 80);
  const c1y = sy + (ey - sy) * 0.2 + ri(-60, 60);
  const c2x = sx + (ex - sx) * 0.7 + ri(-60, 60);
  const c2y = sy + (ey - sy) * 0.8 + ri(-40, 40);

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex;
    const y = u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey;
    const jitter = Math.max(0.5, 3 - t * 2.5);
    points.push({ x: x + (Math.random() - 0.5) * jitter, y: y + (Math.random() - 0.5) * jitter });
  }
  return points;
}

/** 生成行为事件串（滚动 + 窗口 + 鼠标轨迹） */
function generateEDTData(opts: { startX: number; startY: number; endX: number; endY: number; mousePoints: number }): string {
  const { startX, startY, endX, endY, mousePoints } = opts;
  const entries: string[] = [];
  let ts = 0;
  let ei = 0;

  entries.push(f5(0, 0), fs5(0), f5(0, 0), fs5(0));

  ts += ri(5, 20);
  entries.push(f6(ts, ei, 750, 500), fs6(ei, 750, 500));
  ei += 1;

  for (let i = 0; i < 3; i += 1) {
    ts += ri(80, 600);
    entries.push(f5(ts, ei), fs5(ei));
    ei += 1;
  }

  const path = bezierPath(startX, startY, endX, endY, mousePoints);
  let si = 0;
  for (let i = 0; i < path.length; i += 1) {
    const { x, y } = path[i];
    ts += ri(8, 50);
    entries.push(f3(ts, si, Math.round(x), Math.round(y)), fs3(si, Math.round(x), Math.round(y)));
    if (i > 0 && i % 12 === 0) {
      ts += ri(20, 60);
      entries.push(f5(ts, ei), fs5(ei));
      ei += 1;
    }
    si = (si + 1) % 2;
  }

  ts += ri(5, 30);
  entries.push(f3(ts, 1, Math.round(endX + ri(-5, 5)), Math.round(endY + ri(-5, 5))), fs3(1, Math.round(endX), Math.round(endY)));
  return entries.join(':');
}

/**
 * 生成 SSA 所需的 edt/sid。
 * @returns edt：AES 加密的行为数据（Base64）；sid：RSA-OAEP(SHA-256) 加密的 AES key（Base64）
 */
export function generateSimulate(
  mid: string | number,
  userid: string | number,
  dfid: string | number,
  webglHash?: string,
): { edt: string; sid: string } {
  SENTINEL = 0xffffffff - Math.floor(Math.random() * 20);

  const key = CryptoJS.MD5(randomString(16)).toString(CryptoJS.enc.Hex).substring(0, 16);
  const points = ri(30, 60);
  const startX = ri(200, 600);
  const startY = ri(200, 500);
  const endX = ri(500, 700);
  const endY = ri(80, 150);

  const plaintext = `mid=${mid || 0};userid=${userid || 0};dfid=${dfid || 0};webgl=${webglHash || generateWebGLHash()};webdriver=0;ts=${Date.now()};data=${generateEDTData(
    { startX, startY, endX, endY, mousePoints: points },
  )}`;

  const edt = CryptoJS.AES.encrypt(plaintext, CryptoJS.enc.Utf8.parse(key), {
    iv: CryptoJS.enc.Utf8.parse(IV),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();

  const rsaKey = forge.pki.publicKeyFromPem(SIMULATE_RSA_KEY);
  const encrypted = rsaKey.encrypt(key, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha256.create() },
  });
  const sid = forge.util.encode64(encrypted);

  return { edt, sid };
}
