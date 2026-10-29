/**
 * 协议层公共类型。
 *
 * 移植模块全部以 `(params, useAxios)` 的形式导出；这里给出这两个参数的
 * 类型，既保留原库的调用方式，也让 TS 能检查明显的笔误。
 */

/** Cookie 键值对（含设备标识与登录态） */
export type CookieJar = Record<string, string>;

/** 一次请求的配置（与原库 createRequest 对齐） */
export interface RequestConfig {
  url: string;
  method?: string;
  baseURL?: string;
  params?: Record<string, any>;
  /** 请求体：对象会被 JSON 序列化，字符串原样发送，Uint8Array 走二进制 */
  data?: any;
  headers?: Record<string, string | number | undefined>;
  /** 签名类型，默认 android */
  encryptType?: 'android' | 'web' | 'register';
  /** 请求 Cookie（设备标识 + 登录态） */
  cookie?: CookieJar;
  /** 是否生成 song_url 的 key 参数 */
  encryptKey?: boolean;
  /** 是否跳过默认参数（dfid/mid/appid/clientver/clienttime） */
  clearDefaultParams?: boolean;
  /** 是否跳过默认请求头 */
  clearDefaultHeaders?: boolean;
  /** 是否跳过签名 */
  notSignature?: boolean;
  /** 响应类型：arraybuffer 时 body 为 Uint8Array */
  responseType?: 'arraybuffer' | 'text';
  /** 代理/透传 IP（App 内不使用） */
  ip?: string;
  realIP?: string;
}

/** 统一响应结构 */
export interface KuGouResponse {
  status: number;
  body: any;
  /** 响应头中的 Set-Cookie（已清理属性） */
  cookie: string[];
  headers: Record<string, string>;
}

/** 模块使用的请求函数 */
export type UseAxios = (config: RequestConfig) => Promise<KuGouResponse>;

/** 一个 API 模块的签名（少数模块返回同步对象，因此用联合类型） */
export type KuGouModule = (params: any, useAxios: UseAxios) => Promise<any> | any;

/** 请求失败时抛出的错误；保留原库的 status/body/cookie 字段 */
export class KuGouApiError extends Error {
  status: number;
  body: any;
  cookie: string[];
  headers: Record<string, string>;

  constructor(response: Pick<KuGouResponse, 'status' | 'body' | 'cookie' | 'headers'>) {
    const body = response.body ?? {};
    const message =
      body.msg || body.errmsg || body.error_msg || body.message || body.error || `KuGou request failed (${response.status})`;
    super(String(message));
    this.name = 'KuGouApiError';
    this.status = response.status;
    this.body = body;
    this.cookie = response.cookie ?? [];
    this.headers = response.headers ?? {};
  }
}
