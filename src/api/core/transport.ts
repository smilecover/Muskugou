/**
 * HTTP 传输层。
 *
 * Tauri 运行时：调用 Rust 命令 `http_request`，绕开 WebView 的 CORS 限制，
 * 并且能拿到 `Set-Cookie`（WebView 的 fetch 读不到这个响应头）。
 *
 * 浏览器 / Node 验证脚本：回退到标准 fetch。
 * 注意：直接用浏览器打开 Vite 页面会被酷狗接口的 CORS 拦截，开发时请用
 * `pnpm tauri dev`，Node 脚本则不受 CORS 限制。
 */

import { base64ToBytes, bytesToBase64 } from './buffer';

/** 传给 Rust 的请求结构（与 src-tauri/src/lib.rs 保持一致） */
export interface NativeRequest {
  method: string;
  url: string;
  headers: [string, string][];
  body?: string;
  bodyBase64?: string;
  responseType?: string;
}

/** Rust / fetch 统一后的响应 */
export interface NativeResponse {
  status: number;
  headers: Record<string, string>;
  /** 一个个 Set-Cookie 的值 */
  setCookies: string[];
  /** 文本响应，或 base64 编码的二进制响应 */
  body: string;
}

/** 判断是否运行在 Tauri WebView 中 */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** 调用 Rust 原生 HTTP 命令（动态导入，Node 环境不会加载 Tauri 包） */
async function invokeNative(request: NativeRequest): Promise<NativeResponse> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<NativeResponse>('http_request', { request });
}

/** Node / 浏览器 fetch 回退实现 */
async function fetchFallback(request: NativeRequest): Promise<NativeResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const headers = new Headers();
    for (const [name, value] of request.headers) {
      // fetch 会拒绝部分受限头（如 Host），忽略即可
      try {
        headers.set(name, value);
      } catch {
        // ignore forbidden header
      }
    }

    let body: BodyInit | undefined;
    if (request.bodyBase64) {
      // 复制到新的 ArrayBuffer，满足 fetch BodyInit 的类型要求
      body = new Uint8Array(base64ToBytes(request.bodyBase64));
    } else if (request.body !== undefined) {
      body = request.body;
    }

    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'follow',
    });

    const headerMap: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headerMap[key.toLowerCase()] = value;
    });

    // 标准 Headers.getSetCookie() 在新版 Node/Chrome 可用
    let setCookies: string[] = [];
    const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    if (typeof getSetCookie === 'function') {
      setCookies = getSetCookie.call(response.headers);
    } else {
      const raw = response.headers.get('set-cookie');
      if (raw) setCookies = [raw];
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const responseBody = request.responseType === 'base64' ? bytesToBase64(bytes) : new TextDecoder().decode(bytes);

    return {
      status: response.status,
      headers: headerMap,
      setCookies,
      body: responseBody,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`网络请求失败：${message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** 发送请求（自动选择原生或 fetch） */
export async function nativeHttp(request: NativeRequest): Promise<NativeResponse> {
  if (isTauriRuntime()) {
    try {
      return await invokeNative(request);
    } catch (error) {
      const message = typeof error === 'string' ? error : error instanceof Error ? error.message : String(error);
      throw new Error(`原生请求失败：${message}`);
    }
  }
  return fetchFallback(request);
}
