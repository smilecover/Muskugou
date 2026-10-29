/**
 * 本地持久化封装。
 *
 * 应用运行在 Tauri WebView 中，`localStorage` 在桌面端和移动端都可用；
 * Node 验证脚本（`scripts/verify-api.ts`）中没有 Web Storage，因此这里提供
 * 一个内存回退，保证同一套协议代码可以在两边运行。
 */

const memory = new Map<string, string>();

/** 获取可用的 Storage；隐私模式或受限 WebView 下返回 null */
function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Safari 隐私模式等会直接抛错，退回内存存储
  }
  return null;
}

/** 读取原始字符串 */
export function readRaw(key: string): string | null {
  const storage = getStorage();
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }
  return memory.get(key) ?? null;
}

/** 写入原始字符串（失败时静默，避免存储配额问题打断播放） */
export function writeRaw(key: string, value: string): void {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
      return;
    } catch {
      // 配额溢出时继续尝试内存回退
    }
  }
  memory.set(key, value);
}

/** 删除一个键 */
export function removeRaw(key: string): void {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  }
  memory.delete(key);
}

/** 读取 JSON，解析失败返回 fallback */
export function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 写入 JSON */
export function writeJson(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    // 循环引用等异常不应影响主流程
  }
}

/** 清空本应用写入的所有键（设置页“清除本地数据”使用） */
export function clearByPrefix(prefix: string): void {
  const storage = getStorage();
  if (storage) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key && key.startsWith(prefix)) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch {
      // ignore
    }
  }
  for (const key of Array.from(memory.keys())) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}
