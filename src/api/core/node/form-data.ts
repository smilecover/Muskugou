/**
 * `form-data` 兼容层。
 *
 * 头像上传模块会构造 multipart/form-data 并交给 axios。浏览器原生
 * FormData 无法直接拿到最终字节，因此这里实现一个最小版本：
 * - append(name, value, options)
 * - getHeaders() 返回带 boundary 的 Content-Type
 * - getBuffer() 生成完整请求体
 */

import { Buffer } from '../buffer';

interface FormPart {
  name: string;
  value: string | Uint8Array;
  filename?: string;
  contentType?: string;
}

/** 生成随机 boundary */
function randomBoundary(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let text = '';
  for (let i = 0; i < 24; i += 1) text += chars[Math.floor(Math.random() * chars.length)];
  return `----MuskugouFormBoundary${text}`;
}

export default class FormData {
  private readonly boundary = randomBoundary();
  private readonly parts: FormPart[] = [];

  /** 添加字段；文件字段可带 filename */
  append(name: string, value: string | Uint8Array, options?: { filename?: string; contentType?: string }): void {
    this.parts.push({
      name,
      value,
      filename: options?.filename,
      contentType: options?.contentType,
    });
  }

  /** 请求头 */
  getHeaders(): Record<string, string> {
    return {
      'Content-Type': `multipart/form-data; boundary=${this.boundary}`,
    };
  }

  /** 生成完整 multipart 字节 */
  getBuffer(): Buffer {
    const chunks: Uint8Array[] = [];
    const encoder = new TextEncoder();

    for (const part of this.parts) {
      let head = `--${this.boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
      if (part.filename) head += `; filename="${part.filename}"`;
      head += '\r\n';
      if (part.contentType) head += `Content-Type: ${part.contentType}\r\n`;
      head += '\r\n';

      chunks.push(encoder.encode(head));
      chunks.push(typeof part.value === 'string' ? encoder.encode(part.value) : part.value);
      chunks.push(encoder.encode('\r\n'));
    }

    chunks.push(encoder.encode(`--${this.boundary}--\r\n`));
    return Buffer.concat(chunks);
  }
}
