/**
 * Node `zlib` 兼容层。
 * 听歌上报模块会用 deflate 压缩事件数据；这里直接映射到 pako。
 */

import { deflate, inflate } from 'pako';
import { Buffer } from '../buffer';

function deflateSync(data: Uint8Array): Buffer {
  return Buffer.from(deflate(data));
}

function inflateSync(data: Uint8Array): Buffer {
  return Buffer.from(inflate(data));
}

export const zlib = { deflateSync, inflateSync };
export { deflateSync, inflateSync };
