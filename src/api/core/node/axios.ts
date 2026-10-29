/**
 * 最小 axios 兼容层。
 *
 * 全量移植的第三方登录/上传模块直接 `require('axios')`。App 里没有
 * axios，也不需要它完整的拦截器体系，因此用原生传输层实现常用能力：
 * - axios(config) / axios.get / axios.post
 * - params 查询串、data 请求体（对象 / 字符串 / Buffer / multipart）
 * - responseType: 'arraybuffer'
 * - 响应自动 JSON 解析、Set-Cookie 数组、非 2xx 抛错
 *
 * 不支持 proxy / 拦截器 / cancelToken（模块里这些参数会被忽略）。
 */

import { Buffer } from '../buffer';
import { nativeHttp } from '../transport';
import MultipartForm from './form-data';

export interface AxiosRequestConfig {
  url?: string;
  baseURL?: string;
  method?: string;
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, any>;
  responseType?: 'arraybuffer' | 'text';
  timeout?: number;
  proxy?: unknown;
  validateStatus?: (status: number) => boolean;
  [key: string]: any;
}

export interface AxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, any>;
  config: AxiosRequestConfig;
}

/** 与 axios 错误形状对齐，模块可读取 err.response?.data */
export class AxiosError extends Error {
  response?: AxiosResponse;
  config?: AxiosRequestConfig;

  constructor(message: string, response?: AxiosResponse, config?: AxiosRequestConfig) {
    super(message);
    this.name = 'AxiosError';
    this.response = response;
    this.config = config;
  }
}

/** 查询串序列化（与 axios 默认格式基本一致） */
function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) pairs.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(String(item))}`);
    } else {
      const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(text)}`);
    }
  }
  return pairs.join('&');
}

/** 判断 JSON 文本 */
function tryParseJson(text: string): any {
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (!/^[\[{]/.test(trimmed)) return text;
  try {
    return JSON.parse(trimmed);
  } catch {
    return text;
  }
}

/** 实际发送请求 */
async function dispatch(config: AxiosRequestConfig): Promise<AxiosResponse> {
  const method = (config.method || 'GET').toUpperCase();
  let url = config.url || '';
  if (config.baseURL && !/^https?:\/\//i.test(url)) {
    url = `${config.baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
  }
  const query = buildQuery(config.params);
  if (query) url += `${url.includes('?') ? '&' : '?'}${query}`;

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(config.headers || {})) {
    if (value !== undefined && value !== null) headers[key] = String(value);
  }

  let body: string | undefined;
  let bodyBase64: string | undefined;
  const data = config.data;

  if (data instanceof MultipartForm) {
    Object.assign(headers, data.getHeaders());
    bodyBase64 = data.getBuffer().toString('base64');
  } else if (data instanceof Uint8Array) {
    bodyBase64 = Buffer.from(data).toString('base64');
  } else if (typeof data === 'string' || data instanceof URLSearchParams) {
    body = String(data);
  } else if (data !== undefined && data !== null) {
    body = JSON.stringify(data);
    if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json;charset=utf-8';
    }
  }

  const raw = await nativeHttp({
    method,
    url,
    headers: Object.entries(headers),
    body,
    bodyBase64,
    responseType: config.responseType === 'arraybuffer' ? 'base64' : undefined,
  });

  const responseHeaders: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw.headers)) responseHeaders[key.toLowerCase()] = value;
  if (raw.setCookies.length) responseHeaders['set-cookie'] = raw.setCookies;

  let responseData: any;
  if (config.responseType === 'arraybuffer') {
    responseData = Buffer.from(raw.body, 'base64');
  } else {
    responseData = tryParseJson(raw.body);
  }

  const response: AxiosResponse = {
    data: responseData,
    status: raw.status,
    statusText: '',
    headers: responseHeaders,
    config,
  };

  const validateStatus = config.validateStatus || ((status: number) => status >= 200 && status < 300);
  if (!validateStatus(raw.status)) {
    throw new AxiosError(`Request failed with status code ${raw.status}`, response, config);
  }

  return response;
}

/** axios(config) */
function axios(config: AxiosRequestConfig): Promise<AxiosResponse>;
/** axios(url, config) */
function axios(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
async function axios(configOrUrl: AxiosRequestConfig | string, maybeConfig?: AxiosRequestConfig): Promise<AxiosResponse> {
  const config = typeof configOrUrl === 'string' ? { ...(maybeConfig || {}), url: configOrUrl } : configOrUrl;
  return dispatch(config);
}

/** axios.get(url, config) */
axios.get = (url: string, config?: AxiosRequestConfig) => axios({ ...(config || {}), url, method: 'GET' });
/** axios.post(url, data, config) */
axios.post = (url: string, data?: any, config?: AxiosRequestConfig) => axios({ ...(config || {}), url, method: 'POST', data });
/** axios.delete / put 等模块未使用，按同样方式补上 */
axios.delete = (url: string, config?: AxiosRequestConfig) => axios({ ...(config || {}), url, method: 'DELETE' });
axios.put = (url: string, data?: any, config?: AxiosRequestConfig) => axios({ ...(config || {}), url, method: 'PUT', data });

export default axios;
