/**
 * 接口模块注册表。
 *
 * 原库由 Express 扫描 `module/` 目录并按文件名生成路由；App 端使用
 * Vite 的 `import.meta.glob` 做同样的事：
 *   - `search.ts`        -> `/search`
 *   - `user_detail.ts`   -> `/user/detail`
 *   - `_comment.ts`      -> 内部模块，不注册
 *
 * 这样 236 个移植模块无需逐个手写 import，同时保留原库的调用方式。
 */

import { getCookieJar, setCookieStrings } from './core/jar';
import { createRequest } from './core/request';
import type { CookieJar, KuGouModule, KuGouResponse, UseAxios } from './core/types';

interface RegisteredModule {
  /** 文件名（不含扩展名） */
  name: string;
  /** 对外路由，如 `/user/detail` */
  route: string;
  /** 模块实现 */
  handler: KuGouModule;
}

/** 所有生成模块（eager：App 启动时一次性注册） */
const moduleFiles = import.meta.glob<{ default?: KuGouModule }>('./modules/*.ts', { eager: true });

/** 路由 -> 模块 */
const registry = new Map<string, RegisteredModule>();

for (const [filePath, namespace] of Object.entries(moduleFiles)) {
  const fileName = filePath.split('/').pop() || '';
  const name = fileName.replace(/\.ts$/i, '');

  // 与参考库一致：下划线开头的文件是内部辅助模块
  if (name.startsWith('_')) continue;

  const handler = namespace.default;
  if (typeof handler !== 'function') continue;

  const route = `/${name.replace(/_/g, '/')}`;
  registry.set(route, { name, route, handler });
}

/** 归一化路由：允许传入 `search`、`/search`、`search?x=1` */
function normalizeRoute(route: string): string {
  const path = route.split('?')[0].trim();
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

/** 全部已注册路由（调试/文档页使用） */
export function getModuleRoutes(): string[] {
  return [...registry.keys()].sort();
}

/** 判断某个路由是否存在 */
export function hasModule(route: string): boolean {
  return registry.has(normalizeRoute(route));
}

/** 合并本次调用显式传入的 Cookie 与本地登录态 */
function buildQuery(params: Record<string, any>): Record<string, any> {
  const explicit = (params.cookie || {}) as CookieJar;
  const cookie: CookieJar = { ...getCookieJar(), ...explicit };
  return { ...params, cookie };
}

/**
 * 调用任意已移植模块。
 *
 * @param route  路由，例如 `/search`、`/song/url`
 * @param params 与原库相同；`params.cookie` 会与本地 Cookie 合并
 */
export async function callModule(route: string, params: Record<string, any> = {}): Promise<KuGouResponse> {
  const key = normalizeRoute(route);
  const entry = registry.get(key);
  if (!entry) {
    throw new Error(`未找到接口模块：${route}`);
  }

  // 与原库 server.js 一致：把当前 Cookie 表注入 params.cookie
  const query = buildQuery(params);
  const useAxios: UseAxios = (config) => createRequest(config);

  const response = await entry.handler(query, useAxios);

  // 登录类模块会通过 response.cookie 返回需要保存的 Cookie
  if (Array.isArray(response?.cookie) && response.cookie.length) {
    setCookieStrings(response.cookie);
  }

  return response as KuGouResponse;
}

/**
 * 调用模块并直接返回响应体。
 * UI 层大多只关心 body，这里提供一个更顺手的快捷方法。
 */
export async function callModuleBody<T = any>(route: string, params: Record<string, any> = {}): Promise<T> {
  const response = await callModule(route, params);
  return response?.body as T;
}
