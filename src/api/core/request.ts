/**
 * 请求核心：参数注入、签名、发送、Cookie 与响应解析。
 *
 * 对应原库 `util/request.js`。与 Node 版最大的区别是：
 * - HTTP 由 `transport.ts` 发送（Tauri 原生 / fetch 回退），不依赖 axios；
 * - Cookie 由 `jar.ts` 持久化，而不是依赖浏览器；
 * - 响应类型 arraybuffer 时返回 Buffer 兼容对象，保持原模块的
 *   `res.body.toString('base64')` 写法可用。
 */

import CryptoJS from 'crypto-js';
import { Buffer } from './buffer';
import { DEFAULT_BASE_URL, DEFAULT_KG_HEADERS, DEFAULT_USER_AGENT, LITE_SALT, STANDARD_SALT } from './constants';
import { getPlatformConfig } from './config';
import { cryptoMd5, rsaEncrypt2 } from './crypto';
import { signKey, signatureAndroidParams, signatureRegisterParams, signatureWebParams } from './helper';
import { mergeRequestCookie, setCookieStrings } from './jar';
import { generateSimulate } from './simulate';
import { nativeHttp } from './transport';
import { KuGouApiError, type KuGouResponse, type RequestConfig } from './types';
import { parseCookieString } from './util';

/** 去掉 undefined/null，避免签名里出现 key=undefined 而 URL 中又被丢弃 */
function cleanParams(params: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

/** 参数序列化（数组按 axios 风格展开成 key[]） */
function serializeParams(params: Record<string, any>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = typeof item === 'object' ? JSON.stringify(item) : String(item);
        pairs.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(text)}`);
      }
    } else {
      const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(text)}`);
    }
  }
  return pairs.join('&');
}

/** 把响应体解析成对象；非 JSON 时保留原始文本 */
function parseBody(text: string): any {
  if (!text) return '';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** 判断业务是否失败（与原库一致） */
function isBusinessFailure(body: any): boolean {
  if (!body || typeof body !== 'object') return false;
  // 服务端可能把 status / error_code 返回成字符串 "0"，统一按数字判断
  if (body.status !== undefined && body.status !== null && Number(body.status) === 0) return true;
  return Boolean(body.error_code) && Number(body.error_code) !== 0;
}

/** 把错误响应包装成可读错误 */
function makeError(response: KuGouResponse, fallback?: unknown): KuGouApiError {
  if (response.body && typeof response.body === 'object') return new KuGouApiError(response);
  return new KuGouApiError({
    ...response,
    body: { status: 0, msg: typeof fallback === 'string' ? fallback : 'KuGou 请求失败' },
  });
}

/**
 * 发送一次酷狗接口请求。
 *
 * 所有模块最终都通过这里发出请求；返回统一的 `{status, body, cookie, headers}`。
 */
export async function createRequest(options: RequestConfig): Promise<KuGouResponse> {
  const clientConfig = getPlatformConfig();

  // ---------- 1. Cookie 与设备标识 ----------
  const cookie = mergeRequestCookie(options.cookie);
  const dfid = cookie.dfid || '-';
  const mid = String(cookie.KUGOU_API_MID ?? cookie.mid ?? '');
  const token = cookie.token || '';
  const userid = cookie.userid || 0;
  const clienttime = Math.floor(Date.now() / 1000);
  const ip = options.realIP || options.ip || '';
  const webglHash = cookie.KUGOU_API_WEBGL;

  // ---------- 2. 默认请求头 ----------
  const defaultHeaders: Record<string, string> = {
    dfid,
    clienttime: String(clienttime),
    mid,
    ...DEFAULT_KG_HEADERS,
  };
  if (ip) {
    defaultHeaders['X-Real-IP'] = ip;
    defaultHeaders['X-Forwarded-For'] = ip;
  }

  // ---------- 3. 默认参数 ----------
  const defaultParams: Record<string, any> = {
    dfid,
    mid,
    uuid: '-',
    appid: clientConfig.appid,
    clientver: clientConfig.clientver,
    clienttime,
  };
  if (token) defaultParams.token = token;
  if (userid && userid !== '0') defaultParams.userid = userid;

  let params = cleanParams(options.clearDefaultParams ? options.params || {} : { ...defaultParams, ...(options.params || {}) });

  // clienttime 同步到请求头；clearDefaultParams 且模块未提供时保持缺失
  if (params.clienttime !== undefined) defaultHeaders.clienttime = String(params.clienttime);

  // ---------- 4. song_url 的 key ----------
  if (options.encryptKey) {
    params.key = signKey(params.hash, params.mid, params.userid, params.appid);
  }

  // ---------- 5. 请求体序列化 ----------
  const data = options.data;
  const isBinary = data instanceof Uint8Array;
  const isObjectBody = data !== undefined && data !== null && !isBinary && typeof data === 'object';
  const bodyText = isBinary ? '' : typeof data === 'string' ? data : isObjectBody ? JSON.stringify(data) : data === undefined || data === null ? '' : String(data);

  // ---------- 6. 签名 ----------
  if (!params.signature && !options.notSignature) {
    switch (options.encryptType) {
      case 'register':
        params.signature = signatureRegisterParams(params);
        break;
      case 'web':
        params.signature = signatureWebParams(params, bodyText);
        break;
      case 'android':
      default:
        params.signature = signatureAndroidParams(params, isBinary ? (data as Uint8Array) : bodyText);
        break;
    }
  }

  // ---------- 7. 请求头合并 ----------
  const explicitHeaders = options.headers || {};
  const finalHeaders: Record<string, string> = {};
  if (options.clearDefaultHeaders) {
    for (const [key, value] of Object.entries(explicitHeaders)) {
      if (value !== undefined && value !== null) finalHeaders[key] = String(value);
    }
  } else {
    finalHeaders['User-Agent'] = DEFAULT_USER_AGENT;
    for (const [key, value] of Object.entries(explicitHeaders)) {
      if (value !== undefined && value !== null) finalHeaders[key] = String(value);
    }
    // 默认头覆盖模块声明，保持与原库一致的优先级
    Object.assign(finalHeaders, defaultHeaders);
    if (isObjectBody && !Object.keys(finalHeaders).some((key) => key.toLowerCase() === 'content-type')) {
      finalHeaders['Content-Type'] = 'application/json;charset=utf-8';
    }
  }

  // ---------- 8. URL ----------
  const baseURL = (options.baseURL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  let url: string;
  if (/^https?:\/\//i.test(options.url)) {
    url = options.url;
  } else {
    url = `${baseURL}${options.url.startsWith('/') ? '' : '/'}${options.url}`;
  }

  if (baseURL.includes('openapicdn')) {
    // 原库对 openapicdn 的接口不编码、直接把参数拼到 URL 上
    const raw = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    url += `${url.includes('?') ? '&' : '?'}${raw}`;
  } else {
    const query = serializeParams(params);
    if (query) url += `${url.includes('?') ? '&' : '?'}${query}`;
  }

  // ---------- 9. 发送 ----------
  const headers: [string, string][] = Object.entries(finalHeaders);
  const requestBody = isBinary ? undefined : bodyText || undefined;
  const bodyBase64 = isBinary ? Buffer.from(data as Uint8Array).toString('base64') : undefined;

  const answer: KuGouResponse = { status: 500, body: {}, cookie: [], headers: {} };

  try {
    const raw = await nativeHttp({
      method: (options.method || 'GET').toUpperCase(),
      url,
      headers,
      body: requestBody,
      bodyBase64,
      responseType: options.responseType === 'arraybuffer' ? 'base64' : undefined,
    });

    answer.cookie = raw.setCookies.map(parseCookieString).filter(Boolean);
    // 响应里的 Set-Cookie 立即落库（如 register_dev 的 dfid）
    setCookieStrings(raw.setCookies);

    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.headers)) responseHeaders[key.toLowerCase()] = value;
    answer.headers = responseHeaders;

    if (options.responseType === 'arraybuffer') {
      answer.body = Buffer.from(raw.body, 'base64');
      answer.status = raw.status;
      return answer;
    }

    answer.body = parseBody(raw.body);

    if (isBusinessFailure(answer.body)) {
      answer.status = 502;
      // SSA 二次验证：附带模拟行为指纹，方便后续验证请求使用
      const ssaCode = responseHeaders['ssa-code'];
      if (ssaCode && answer.body && typeof answer.body === 'object') {
        const { edt, sid } = generateSimulate(mid, userid, dfid, webglHash);
        if (edt) answer.body.edt = edt;
        if (sid) answer.body.sid = sid;
        answer.body.ssaCode = ssaCode;
      }
      throw makeError(answer);
    }

    answer.status = 200;
    const ssaCode = responseHeaders['ssa-code'];
    if (ssaCode && answer.body && typeof answer.body === 'object') {
      const { edt, sid } = generateSimulate(mid, userid, dfid, webglHash);
      if (edt) answer.body.edt = edt;
      if (sid) answer.body.sid = sid;
      answer.body.ssaCode = ssaCode;
    }
    return answer;
  } catch (error) {
    if (error instanceof KuGouApiError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    answer.status = 502;
    answer.body = { status: 0, msg: message };
    throw makeError(answer, message);
  }
}

/**
 * 云歌单服务（cloudlist）请求。
 *
 * 修改/排序歌单、修改歌单封面等操作走这套协议：
 * - 查询参数 key = MD5(appid + appkey + clientver + clienttime)
 * - p = RSA-PKCS1({ aes, uid, token })
 * - body 用 AES-CBC 加密（MD5(aes) 前后各 16 位作为 key/iv）
 * - 响应同样是 AES 密文
 */
export async function createCloudRequest(options: {
  url: string;
  data?: Record<string, unknown> | string;
  cookie?: Record<string, string>;
  baseURL?: string;
  ip?: string;
  realIP?: string;
}): Promise<KuGouResponse> {
  const config = getPlatformConfig();
  const cookie = mergeRequestCookie(options.cookie);
  const mid = String(cookie.KUGOU_API_MID || cookie.mid || '');
  const dfid = cookie.dfid || '-';
  const userid = cookie.userid || 0;
  const token = cookie.token || '';
  const ip = options.realIP || options.ip || '';

  // 随机 6 位会话串，大小写混合
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let aes = '';
  for (let i = 0; i < 6; i += 1) aes += alphabet[Math.floor(Math.random() * alphabet.length)];

  const md5 = cryptoMd5(aes);
  const aesKey = md5.substring(0, 16);
  const aesIv = md5.substring(16, 32);

  const clienttime = Math.floor(Date.now() / 1000);
  const appkey = config.isLite ? LITE_SALT : STANDARD_SALT;
  const key = cryptoMd5(`${config.appid}${appkey}${config.clientver}${clienttime}`).toLowerCase();
  const portrait = rsaEncrypt2(JSON.stringify({ aes, uid: userid, token })).toUpperCase();

  const params: Record<string, string | number> = {
    appid: config.appid,
    clientver: config.clientver,
    mid,
    clienttime,
    key,
    dfid,
    p: portrait,
  };

  const plain = typeof options.data === 'object' ? JSON.stringify(options.data) : options.data || '';
  const cipher = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(plain), CryptoJS.enc.Utf8.parse(aesKey), {
    iv: CryptoJS.enc.Utf8.parse(aesIv),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const bodyBytes = Buffer.from(cipher.ciphertext.toString(CryptoJS.enc.Hex), 'hex');

  const headers: Record<string, string> = {
    'x-router': 'cloudlist.service.kugou.com',
    dfid,
    clienttime: String(clienttime),
    mid,
    ...DEFAULT_KG_HEADERS,
    'Content-Type': 'application/json;charset=utf-8',
  };
  if (ip) {
    headers['X-Real-IP'] = ip;
    headers['X-Forwarded-For'] = ip;
  }

  const baseURL = (options.baseURL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${baseURL}${options.url.startsWith('/') ? '' : '/'}${options.url}`;
  const query = serializeParams(params);

  const answer: KuGouResponse = { status: 500, body: {}, cookie: [], headers: {} };

  try {
    const raw = await nativeHttp({
      method: 'POST',
      url: `${url}?${query}`,
      headers: Object.entries(headers),
      bodyBase64: bodyBytes.toString('base64'),
      responseType: 'base64',
    });

    answer.cookie = raw.setCookies.map(parseCookieString).filter(Boolean);
    setCookieStrings(raw.setCookies);

    const rawBytes = Buffer.from(raw.body, 'base64');
    let text = '';
    try {
      const decipher = CryptoJS.AES.decrypt(
        CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Hex.parse(rawBytes.toString('hex')) }),
        CryptoJS.enc.Utf8.parse(aesKey),
        { iv: CryptoJS.enc.Utf8.parse(aesIv), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
      );
      text = decipher.toString(CryptoJS.enc.Utf8);
    } catch {
      text = '';
    }
    if (!text) text = rawBytes.toString('utf8');

    try {
      answer.body = JSON.parse(text);
    } catch {
      answer.body = { status: 0, msg: text };
      answer.status = 502;
      throw makeError(answer);
    }

    if (isBusinessFailure(answer.body)) {
      answer.status = 502;
      throw makeError(answer);
    }

    answer.status = 200;
    return answer;
  } catch (error) {
    if (error instanceof KuGouApiError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    answer.status = 502;
    answer.body = { status: 0, msg: message };
    throw makeError(answer, message);
  }
}
