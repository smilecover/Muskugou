/**
 * API 层统一出口。
 *
 * - `client`：App 使用的类型化接口
 * - `registry`：底层模块注册表（调试/高级用法）
 * - `normalize`：统一数据结构
 * - `core/config`：设置与平台切换
 */

export * from './client';
export * from './normalize';
export * from './vip';
export * from './features';
export { callModule, callModuleBody, getModuleRoutes, hasModule } from './registry';
export {
  getSettings,
  updateSettings,
  onSettingsChange,
  getPlatformConfig,
  type AppSettings,
  type Platform,
} from './core/config';
export { hasLogin, getAuth, clearAuth as clearLogin, onAuthChange } from './core/jar';
export { resetDevice, getDevice } from './core/device';
export { STORAGE_KEYS } from './core/constants';
export { readJson, writeJson, clearByPrefix } from './core/storage';
