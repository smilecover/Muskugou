/**
 * `process.env` 兼容层。
 *
 * 原库通过环境变量读取平台、设备标识等；App 里这些值来自设置和
 * `device.ts`，但大量移植模块仍直接写 `process.env.xxx`，因此提供
 * 一个只读的 Proxy，按当前运行状态动态返回值。
 */

import { getSettings } from '../config';

const env = new Proxy({} as Record<string, string | undefined>, {
  get(_target, property) {
    if (typeof property !== 'string') return undefined;
    switch (property) {
      case 'platform':
        return getSettings().platform === 'lite' ? 'lite' : 'standard';
      case 'CMT_VER':
        // 评论区接口的版本号，原库默认 6
        return '6';
      case 'KUGOU_API_DEV':
        // 设备标识由 device.ts 管理，这里留空让模块使用默认值
        return '';
      case 'KUGOU_API_PROXY':
        return '';
      default:
        return undefined;
    }
  },
});

/** 与 Node `process` 形状对齐的最小对象 */
export const processEnv = {
  env,
  argv: [] as string[],
};
