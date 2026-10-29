/**
 * 酷狗协议加密工具。
 *
 * 完全对应原库 `util/crypto.js`：
 * - MD5 / SHA1
 * - AES-CBC/PKCS7（登录参数、云歌单）
 * - RSA 原始模幂（`cryptoRSAEncrypt`，PKCS#1 v1.5 的去填充变体）
 * - RSAES-PKCS1-V1_5（`rsaEncrypt2`）
 * - 歌单删除/收藏用的随机 key AES（`playlistAesEncrypt/Decrypt`）
 *
 * 只依赖 crypto-js / node-forge，二者都能在 WebView、Android WebView 和
 * Node 验证脚本中运行。
 */

import CryptoJS from 'crypto-js';
import forge from 'node-forge';
import { bytesToHex, decodeUtf8, encodeUtf8, type Buffer } from './buffer';
import { getPlatformConfig } from './config';
import { PUBLIC_LITE_RSA_KEY, PUBLIC_RSA_KEY } from './keys';
import { randomString } from './util';

/** 兼容原库导出名 */
export const publicRasKey = PUBLIC_RSA_KEY;
export const publicLiteRasKey = PUBLIC_LITE_RSA_KEY;

/** crypto-js 的 WordArray 类型 */
export type WordArray = CryptoJS.lib.WordArray;

/** 归一化输入：字符串、对象、字节数组 → 字节数组 */
export function normalizeBuffer(data: string | Record<string, unknown> | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) return data;
  return encodeUtf8(typeof data === 'string' ? data : JSON.stringify(data));
}

/** 字节数组 → WordArray（大端序，保持原始字节） */
export function wordArrayFromBuffer(uint8: Uint8Array): WordArray {
  const words: number[] = [];
  for (let i = 0; i < uint8.length; i += 4) {
    words.push(((uint8[i] || 0) << 24) | ((uint8[i + 1] || 0) << 16) | ((uint8[i + 2] || 0) << 8) | (uint8[i + 3] || 0));
  }
  return CryptoJS.lib.WordArray.create(words, uint8.length);
}

/** WordArray → 字节数组 */
export function wordArrayToBuffer(wordArray: WordArray): Uint8Array {
  const { words, sigBytes } = wordArray;
  const out = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i += 1) {
    out[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }
  return out;
}

/** 将字符串或字节数组转成 WordArray */
function utf8WordArray(input: string | Uint8Array): WordArray {
  return typeof input === 'string' ? CryptoJS.enc.Utf8.parse(input) : wordArrayFromBuffer(input);
}

/** MD5（32 位小写 hex） */
export function cryptoMd5(data: string | Record<string, unknown>): string {
  const value = typeof data === 'object' ? JSON.stringify(data) : data;
  return CryptoJS.MD5(value).toString(CryptoJS.enc.Hex);
}

/** SHA1（40 位小写 hex） */
export function cryptoSha1(data: string | Record<string, unknown>): string {
  const value = typeof data === 'object' ? JSON.stringify(data) : data;
  return CryptoJS.SHA1(value).toString(CryptoJS.enc.Hex);
}

/** RSA 公钥缓存，避免每次请求都解析 PEM */
const rsaKeyCache = new Map<string, forge.pki.rsa.PublicKey>();

function getForgePublicKey(pem: string): forge.pki.rsa.PublicKey {
  let key = rsaKeyCache.get(pem);
  if (!key) {
    key = forge.pki.publicKeyFromPem(pem);
    rsaKeyCache.set(pem, key);
  }
  return key;
}

/** 字节数组 → 二进制字符串（forge 的输入格式） */
function bufferToBinaryString(buffer: Uint8Array): string {
  let out = '';
  for (let i = 0; i < buffer.length; i += 1) out += String.fromCharCode(buffer[i]);
  return out;
}

/**
 * RSA 原始模幂加密（无填充）。
 * 返回定长的十六进制字符串，长度 = 公钥字节数 * 2。
 */
export function rsaRawEncrypt(buffer: Uint8Array, publicKey: forge.pki.rsa.PublicKey): string {
  const keyLength = Math.ceil(publicKey.n.bitLength() / 8);
  const message = new forge.jsbn.BigInteger(bytesToHex(buffer), 16);
  const encrypted = message.modPow(publicKey.e, publicKey.n);
  return encrypted.toString(16).padStart(keyLength * 2, '0');
}

/**
 * RSA 加密（自动选择平台公钥）。
 * 与客户端一致：把明文放在缓冲区开头，右侧补 0 到 128 字节，再做模幂。
 */
export function cryptoRSAEncrypt(data: string | Record<string, unknown> | Uint8Array, publicKey?: string): string {
  const buffer = normalizeBuffer(data);
  const pem = publicKey || getPlatformConfig().rsaPublicKey;
  const key = getForgePublicKey(pem);
  const keyLength = Math.ceil(key.n.bitLength() / 8);

  if (buffer.length > keyLength) throw new Error('Data length exceeds key size');
  let padded = buffer;
  if (buffer.length < keyLength) {
    padded = new Uint8Array(keyLength);
    padded.set(buffer);
  }
  return rsaRawEncrypt(padded, key);
}

/**
 * RSAES-PKCS1-V1_5 加密。
 * 用于设备注册、云歌单会话串等场景。
 */
export function rsaEncrypt2(data: string | Record<string, unknown> | Uint8Array): string {
  const buffer = normalizeBuffer(data);
  const key = getForgePublicKey(getPlatformConfig().rsaPublicKey);
  const encrypted = key.encrypt(bufferToBinaryString(buffer), 'RSAES-PKCS1-V1_5');
  return forge.util.bytesToHex(encrypted);
}

/**
 * AES-CBC/PKCS7 加密。
 *
 * - 传 `{ key, iv }` 时使用指定密钥，返回 hex 字符串；
 * - 不传时随机生成 16 位 key（MD5 后切 32+16），返回 `{ str, key }`。
 */
export function cryptoAesEncrypt(
  data: string | Record<string, unknown> | Uint8Array,
  opt?: { key?: string; iv?: string },
): string | { str: string; key: string } {
  const buffer = normalizeBuffer(data);
  let key: string;
  let iv: string;
  let tempKey = '';

  if (opt?.key && opt?.iv) {
    key = opt.key;
    iv = opt.iv;
  } else {
    tempKey = opt?.key || randomString(16).toLowerCase();
    key = cryptoMd5(tempKey).substring(0, 32);
    iv = key.substring(key.length - 16);
  }

  const encrypted = CryptoJS.AES.encrypt(wordArrayFromBuffer(buffer), utf8WordArray(key), {
    iv: utf8WordArray(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const hex = CryptoJS.enc.Hex.stringify(encrypted.ciphertext);
  // 原库逻辑：只要传了 key 就返回 hex，即使没有 iv（此时走随机派生 key）
  if (opt?.key) return hex;
  return { str: hex, key: tempKey };
}

/** AES-CBC/PKCS7 解密；自动尝试解析 JSON */
export function cryptoAesDecrypt(data: string, key: string, iv?: string): any {
  let useKey = key;
  if (!iv) useKey = cryptoMd5(key).substring(0, 32);
  const useIv = iv || useKey.substring(useKey.length - 16);

  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Hex.parse(data),
  });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, utf8WordArray(useKey), {
    iv: utf8WordArray(useIv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const text = decodeUtf8(wordArrayToBuffer(decrypted));
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * 歌单接口专用 AES：
 * 随机 6 位 key（小写）→ MD5(key) 前 16 位作 key、后 16 位作 iv，
 * 密文用 Base64 编码。返回的 key 需要随请求一起发给服务端。
 */
export function playlistAesEncrypt(data: string | Record<string, unknown>): { key: string; str: string } {
  const useData = typeof data === 'object' ? JSON.stringify(data) : data;
  const key = randomString(6).toLowerCase();
  const encryptKey = cryptoMd5(key).substring(0, 16);
  const iv = cryptoMd5(key).substring(16, 32);

  const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(useData), utf8WordArray(encryptKey), {
    iv: utf8WordArray(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return { key, str: CryptoJS.enc.Base64.stringify(encrypted.ciphertext) };
}

/** 歌单接口专用 AES 解密（Base64 密文） */
export function playlistAesDecrypt(data: { key: string; str: string }): any {
  const encryptKey = cryptoMd5(data.key).substring(0, 16);
  const iv = cryptoMd5(data.key).substring(16, 32);

  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(data.str),
  });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, utf8WordArray(encryptKey), {
    iv: utf8WordArray(iv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const text = decodeUtf8(wordArrayToBuffer(decrypted));
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * 供 Node crypto 兼容层使用：用指定 PEM 做原始 RSA 加密。
 * `data` 必须已经是定长缓冲区（调用方负责补零）。
 */
export function rsaRawEncryptWithPem(data: Uint8Array, pem: string): Uint8Array {
  const key = getForgePublicKey(pem);
  const keyLength = Math.ceil(key.n.bitLength() / 8);
  let padded = data;
  if (data.length < keyLength) {
    padded = new Uint8Array(keyLength);
    padded.set(data);
  } else if (data.length > keyLength) {
    padded = data.slice(0, keyLength);
  }
  const hex = rsaRawEncrypt(padded, key);
  const out = new Uint8Array(keyLength);
  for (let i = 0; i < keyLength; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** 供 Node crypto 兼容层使用：用指定 PEM 做 PKCS#1 v1.5 加密 */
export function rsaPkcs1EncryptWithPem(data: Uint8Array, pem: string): Uint8Array {
  const key = getForgePublicKey(pem);
  const encrypted = key.encrypt(bufferToBinaryString(data), 'RSAES-PKCS1-V1_5');
  const out = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i += 1) out[i] = encrypted.charCodeAt(i) & 0xff;
  return out;
}

/** 类型辅助：让调用方可以拿到 Buffer 类型而不引入 Node 类型 */
export type { Buffer };
