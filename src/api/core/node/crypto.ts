/**
 * Node `crypto` 兼容层。
 *
 * 全量移植的模块里有一部分直接使用 Node crypto：
 * - MD5/SHA1 哈希
 * - randomBytes / randomUUID
 * - RSA publicEncrypt（NO_PADDING / PKCS1_PADDING）
 * - AES-256-CBC createCipheriv / createDecipheriv（听歌上报）
 *
 * 这里用 crypto-js + node-forge + 自研 Buffer 实现同样的 API。
 * 只覆盖模块实际用到的部分。
 */

import CryptoJS from 'crypto-js';
import forge from 'node-forge';
import { Buffer } from '../buffer';
import { rsaPkcs1EncryptWithPem, rsaRawEncryptWithPem, wordArrayFromBuffer, wordArrayToBuffer } from '../crypto';
import { getGuid } from '../util';

/** Node 的 padding 常量值（模块只拿来做比较） */
const RSA_NO_PADDING = 1;
const RSA_PKCS1_PADDING = 4;

/** 增量哈希 */
class Hash {
  private hasher: any;

  constructor(algorithm: string) {
    const algorithms: Record<string, any> = {
      md5: CryptoJS.algo.MD5,
      sha1: CryptoJS.algo.SHA1,
      sha256: CryptoJS.algo.SHA256,
      sha512: CryptoJS.algo.SHA512,
    };
    const factory = algorithms[algorithm.toLowerCase()] || CryptoJS.algo.MD5;
    this.hasher = factory.create();
  }

  update(data: string | Uint8Array): this {
    if (typeof data === 'string') this.hasher.update(CryptoJS.enc.Utf8.parse(data));
    else this.hasher.update(wordArrayFromBuffer(data));
    return this;
  }

  digest(encoding: 'hex' | 'base64' = 'hex'): string {
    const wordArray = this.hasher.finalize();
    return encoding === 'base64' ? CryptoJS.enc.Base64.stringify(wordArray) : CryptoJS.enc.Hex.stringify(wordArray);
  }
}

/** AES-CBC 加/解密器；update 先缓存，final 一次性输出（与模块用法兼容） */
class AesCipher {
  private chunks: Uint8Array[] = [];

  constructor(
    private keyBytes: Uint8Array,
    private ivBytes: Uint8Array,
    private mode: 'encrypt' | 'decrypt',
  ) {}

  update(data: Uint8Array | Buffer): Buffer {
    this.chunks.push(new Uint8Array(data));
    return Buffer.alloc(0);
  }

  final(): Buffer {
    const input = Buffer.concat(this.chunks);
    if (this.mode === 'decrypt') {
      const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: wordArrayFromBuffer(input) });
      const decrypted = CryptoJS.AES.decrypt(cipherParams, wordArrayFromBuffer(this.keyBytes), {
        iv: wordArrayFromBuffer(this.ivBytes),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      return Buffer.from(wordArrayToBuffer(decrypted));
    }

    const encrypted = CryptoJS.AES.encrypt(wordArrayFromBuffer(input), wordArrayFromBuffer(this.keyBytes), {
      iv: wordArrayFromBuffer(this.ivBytes),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    return Buffer.from(wordArrayToBuffer(encrypted.ciphertext));
  }
}

/** 把 string / Buffer / Uint8Array 统一成字节数组 */
function toBytes(value: string | Uint8Array): Uint8Array {
  return typeof value === 'string' ? Buffer.from(value) : new Uint8Array(value);
}

function createHash(algorithm: string): Hash {
  return new Hash(algorithm);
}

function randomBytes(size: number): Buffer {
  const bytes = new Uint8Array(size);
  try {
    globalThis.crypto?.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < size; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Buffer.from(bytes);
}

function randomUUID(): string {
  return getGuid();
}

/**
 * 解析公钥。
 * 返回原 PEM 字符串即可：调用方只会把它传回 publicEncrypt。
 */
function createPublicKey(pem: string): string {
  // 提前解析一次，尽早暴露格式错误
  forge.pki.publicKeyFromPem(pem);
  return pem;
}

/**
 * RSA 公钥加密。
 * @param options `{ key: PEM, padding }`
 * @param data 明文字节
 */
function publicEncrypt(options: { key: string | forge.pki.rsa.PublicKey; padding?: number }, data: Uint8Array): Buffer {
  if (typeof options.key !== 'string') {
    throw new Error('publicEncrypt 兼容层只支持 PEM 字符串公钥');
  }
  const bytes =
    options.padding === RSA_NO_PADDING
      ? rsaRawEncryptWithPem(data, options.key)
      : rsaPkcs1EncryptWithPem(data, options.key);
  return Buffer.from(bytes);
}

/** 创建 AES 加密器 */
function createCipheriv(algorithm: string, key: string | Uint8Array, iv: string | Uint8Array): AesCipher {
  void algorithm;
  return new AesCipher(toBytes(key), toBytes(iv), 'encrypt');
}

/** 创建 AES 解密器 */
function createDecipheriv(algorithm: string, key: string | Uint8Array, iv: string | Uint8Array): AesCipher {
  void algorithm;
  return new AesCipher(toBytes(key), toBytes(iv), 'decrypt');
}

/** Node `crypto.constants` 子集（移植模块会按命名空间访问） */
export const constants = {
  RSA_NO_PADDING,
  RSA_PKCS1_PADDING,
};

/** 与 `require('crypto')` 对齐的导出对象 */
export const crypto = {
  createHash,
  randomBytes,
  randomUUID,
  createPublicKey,
  publicEncrypt,
  createCipheriv,
  createDecipheriv,
  constants,
};

/** 具名导出，方便按需导入 */
export {
  createHash,
  randomBytes,
  randomUUID,
  createPublicKey,
  publicEncrypt,
  createCipheriv,
  createDecipheriv,
};
