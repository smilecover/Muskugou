/**
 * Node `fs` 兼容层（占位）。
 *
 * 原库的图片上传接口接收“本地文件路径”，这在手机 App 的 WebView 里
 * 没有意义。App 侧的图片上传请通过 Tauri 文件选择器读取字节后传
 * `data`（Buffer/base64）。为了保持全量模块可加载，这里提供最小实现：
 * - existsSync 永远返回 false
 * - readFileSync 抛出明确错误
 */

const UNSUPPORTED = 'App 运行时没有文件系统路径，请改为传入二进制 data';

function existsSync(_path: string): boolean {
  void _path;
  return false;
}

function readFileSync(_path: string): never {
  void _path;
  throw new Error(UNSUPPORTED);
}

export const fs = { existsSync, readFileSync };
export { existsSync, readFileSync };
