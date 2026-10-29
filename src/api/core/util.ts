/**
 * 通用工具函数。
 *
 * 对应原库 `util/util.js`，去掉了 Node.js 的 Buffer 依赖：
 * - 随机串 / 随机数字（请求参数、设备标识）
 * - Cookie 字符串解析
 * - KRC 歌词解码（跳过 4 字节头 + XOR + zlib 解压）
 * - GUID / WebGL 指纹
 * - 图片 URL 规整
 */

import { inflate } from 'pako';
import { base64ToBytes, decodeUtf8 } from './buffer';

/** 生成随机字符串（大写字母 + 数字），用于 DEV、AES key 等 */
export function randomString(len = 16): string {
  const pool = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += pool.charAt(Math.floor(Math.random() * pool.length));
  }
  return out;
}

/** 生成随机数字字符串 */
export function randomNumber(len = 16): string {
  const pool = '1234567890';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += pool.charAt(Math.floor(Math.random() * pool.length));
  }
  return out;
}

/**
 * 清理 Set-Cookie 字符串。
 *
 * 原库只去掉 Domain/path/expires/HttpOnly；这里额外去掉常见属性，
 * 返回值仍然保持 `key=value` 形式，方便直接拼进 Cookie 数组。
 */
export function parseCookieString(cookie: string): string {
  if (!cookie) return '';
  return cookie
    .replace(/\s*(Domain|domain|path|Path|expires|Expires|Max-Age|max-age|SameSite|samesite|Secure|secure)=[^;]+;*/g, '')
    .replace(/;\s*(HttpOnly|httpOnly|Secure|secure)\b/g, '')
    .replace(/^\s*;\s*/, '')
    .trim();
}

/** Cookie 字符串 → 对象（只取第一段有效键值对） */
export function cookieToJson(cookie: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookie) return out;
  for (const part of cookie.split(';')) {
    const text = part.trim();
    if (!text) continue;
    const index = text.indexOf('=');
    if (index <= 0) continue;
    const key = text.slice(0, index).trim();
    const value = text.slice(index + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

/**
 * KRC 歌词解码。
 *
 * 文件结构：前 4 字节是头，剩余字节用固定 16 字节密钥循环 XOR，
 * 最后是 zlib 压缩的 UTF-8 文本。
 */
export function decodeLyrics(val: string | Uint8Array): string {
  const bytes = typeof val === 'string' ? base64ToBytes(val) : val;
  if (!bytes || bytes.length <= 4) return '';

  const key = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];
  const krcBytes = bytes.slice(4);
  for (let i = 0; i < krcBytes.length; i += 1) {
    krcBytes[i] ^= key[i % key.length];
  }

  try {
    return decodeUtf8(inflate(krcBytes));
  } catch {
    return '';
  }
}

/** 判断字符串是否是 UUID v4 */
export function isUUIDv4(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/** 生成 UUID v4；优先使用 Web Crypto，失败时退回 Math.random */
export function getGuid(): string {
  const bytes = new Uint8Array(16);
  try {
    globalThis.crypto?.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * 生成 WebGL 指纹哈希。
 *
 * 与原库一致：浏览器里用 canvas 画一个三角形，对像素和渲染器信息做
 * FNV-1a 64 位哈希；WebGL 不可用时退化为随机 uint64。
 */
export function generateWebGLHash(): string {
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      if (gl) {
        const vs = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vs, 'attribute vec4 position;void main(){gl_Position=position;}');
        gl.compileShader(vs);
        const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fs, 'void main(){gl_FragColor=vec4(1.0,1.0,1.0,1.0);}');
        gl.compileShader(fs);
        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        gl.viewport(0, 0, 200, 50);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        const pixels = new Uint8Array(200 * 50 * 4);
        gl.readPixels(0, 0, 200, 50, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        const vendor = debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : '';
        const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
        const version = String(gl.getParameter(gl.VERSION));

        let hash = BigInt('14695981039346656037');
        const prime = BigInt('1099511628211');
        const mask = BigInt('0xFFFFFFFFFFFFFFFF');
        for (let i = 0; i < pixels.length; i += 1) {
          hash = ((hash ^ BigInt(pixels[i])) * prime) & mask;
        }
        const meta = `${vendor}|${renderer}|${version}`;
        for (let i = 0; i < meta.length; i += 1) {
          hash = ((hash ^ BigInt(meta.charCodeAt(i))) * prime) & mask;
        }
        return hash.toString();
      }
    } catch {
      // 某些 WebView 会禁用 WebGL，继续走随机回退
    }
  }

  const hi = Math.floor(Math.random() * 0xffffffff);
  const lo = Math.floor(Math.random() * 0xffffffff);
  return (BigInt(hi) * BigInt(0x100000000) + BigInt(lo)).toString();
}

/**
 * 规整酷狗图片 URL。
 *
 * 酷狗封面地址里经常带 `{size}` 占位符（如 `.../{size}/2024...jpg`），
 * 需要替换成实际像素尺寸；部分接口返回 `//` 开头的协议相对地址。
 */
export function normalizeImage(url: string | undefined | null, size = 480): string {
  if (!url) return '';
  let out = String(url).trim();
  if (!out) return '';
  if (out.startsWith('//')) out = `https:${out}`;
  // 图片 CDN 同时支持 https；使用 https 可以避免 Android WebView 的混合内容拦截
  if (out.startsWith('http://')) out = `https://${out.slice(7)}`;
  if (out.includes('{size}')) out = out.replace(/\{size\}/g, String(size));
  return out;
}

/** 将 JSON 字符串安全解析为对象 */
export function safeJsonParse<T = unknown>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** 把任意值转成可读字符串（签名拼接时保持 JS 默认行为） */
export function toParamString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
