/**
 * 浏览器可用的 Buffer 兼容实现。
 *
 * 原库的部分模块（设备注册、歌词、直播上报、头像上传等）直接使用 Node 的
 * `Buffer`。Tauri WebView 没有 Node 运行时，因此这里用 `Uint8Array` 实现
 * 移植所需的最小 Buffer API，并在全量模块中统一从本文件导入 `Buffer`。
 *
 * 只实现实际用到的部分：from / alloc / concat / isBuffer、
 * toString / slice / copy / write。
 */

export type BufferEncoding = 'utf8' | 'utf-8' | 'hex' | 'base64' | 'binary' | 'latin1' | 'ascii';

/** UTF-8 编码 */
export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** UTF-8 解码 */
export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** 字节数组 → 二进制字符串（btoa 的输入） */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

/** 字节数组 → Base64 */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') return btoa(bytesToBinaryString(bytes));
  // 极少数环境没有 btoa，用查表法兜底
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;
    out += table[(triplet >> 18) & 0x3f];
    out += table[(triplet >> 12) & 0x3f];
    out += i + 1 < bytes.length ? table[(triplet >> 6) & 0x3f] : '=';
    out += i + 2 < bytes.length ? table[triplet & 0x3f] : '=';
  }
  return out;
}

/** Base64 → 字节数组 */
export function base64ToBytes(input: string): Uint8Array {
  const text = input.replace(/\s+/g, '');
  if (!text) return new Uint8Array(0);
  if (typeof atob === 'function') {
    const binary = atob(text);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = text.replace(/=+$/, '');
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = table.indexOf(char);
    if (index < 0) continue;
    value = (value << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** 字节数组 → 小写 Hex */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/** Hex → 字节数组 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Buffer 兼容类。
 *
 * 注意：`slice` 在原库中常被用来截取字节；这里返回副本而不是视图，
 * 对现有调用方语义一致且更安全。
 */
// Node Buffer 的 `from(input, encoding)` 与 Uint8Array.from(input, mapfn)
// 签名不同；这里刻意保留 Node 语义，因此忽略静态侧的类型兼容检查。
// @ts-expect-error Buffer 静态 API 是 Uint8Array 的超集/变体
export class Buffer extends Uint8Array {
  /** 从字符串 / 数组 / ArrayBuffer / 另一个 Buffer 创建 */
  static from(input: string | ArrayLike<number> | ArrayBuffer | Uint8Array, encoding: BufferEncoding = 'utf8'): Buffer {
    if (typeof input === 'string') {
      switch (encoding) {
        case 'hex':
          return new Buffer(hexToBytes(input)) as Buffer;
        case 'base64':
          return new Buffer(base64ToBytes(input)) as Buffer;
        case 'binary':
        case 'latin1':
          return new Buffer(Uint8Array.from(input, (c) => c.charCodeAt(0) & 0xff)) as Buffer;
        case 'ascii':
          return new Buffer(Uint8Array.from(input, (c) => c.charCodeAt(0) & 0x7f)) as Buffer;
        default:
          return new Buffer(encodeUtf8(input)) as Buffer;
      }
    }
    if (input instanceof ArrayBuffer) return new Buffer(new Uint8Array(input)) as Buffer;
    return new Buffer(input as ArrayLike<number>) as Buffer;
  }

  /** 分配指定长度并用 0 填充 */
  static alloc(size: number, fill: number | string = 0): Buffer {
    const buffer = new Buffer(size) as Buffer;
    if (fill !== 0) {
      const value = typeof fill === 'string' ? fill.charCodeAt(0) & 0xff : fill & 0xff;
      buffer.fill(value);
    }
    return buffer;
  }

  /** 拼接多个 Buffer */
  static concat(list: readonly Uint8Array[], totalLength?: number): Buffer {
    const length = totalLength ?? list.reduce((sum, item) => sum + item.length, 0);
    const out = Buffer.alloc(length);
    let offset = 0;
    for (const item of list) {
      out.set(item.subarray(0, Math.max(0, length - offset)), offset);
      offset += item.length;
      if (offset >= length) break;
    }
    return out;
  }

  /** 判断是否为 Buffer（含子类） */
  static isBuffer(value: unknown): value is Buffer {
    return value instanceof Buffer;
  }

  /** 按编码输出字符串 */
  toString(encoding: BufferEncoding = 'utf8', start = 0, end = this.length): string {
    const view = this.subarray(start, end);
    switch (encoding) {
      case 'hex':
        return bytesToHex(view);
      case 'base64':
        return bytesToBase64(view);
      case 'binary':
      case 'latin1':
        return Array.from(view, (b) => String.fromCharCode(b)).join('');
      case 'ascii':
        return Array.from(view, (b) => String.fromCharCode(b & 0x7f)).join('');
      default:
        return decodeUtf8(view);
    }
  }

  /** 复制到目标 Buffer，返回复制的字节数 */
  copy(target: Uint8Array, targetStart = 0, sourceStart = 0, sourceEnd = this.length): number {
    const source = this.subarray(sourceStart, sourceEnd);
    const length = Math.min(source.length, Math.max(0, target.length - targetStart));
    target.set(source.subarray(0, length), targetStart);
    return length;
  }

  /** 写入字符串，返回写入字节数 */
  write(value: string, offset = 0, length?: number, encoding: BufferEncoding = 'utf8'): number {
    const bytes = Buffer.from(value, encoding);
    const count = Math.min(bytes.length, length ?? bytes.length, this.length - offset);
    this.set(bytes.subarray(0, count), offset);
    return count;
  }

  /** 截取并复制为新的 Buffer */
  slice(start?: number, end?: number): Buffer {
    return Buffer.from(this.subarray(start, end)) as Buffer;
  }
}
