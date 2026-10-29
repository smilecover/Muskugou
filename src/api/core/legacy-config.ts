/**
 * 原 `util/config.json` 的 TypeScript 版本（小写命名，保持移植模块的
 * 解构写法不变）。
 *
 * 注意：这里的 appid/clientver 是“标准版固定值”。需要跟随平台切换的
 * 值请从 `compat.ts` 导入（它们是 live binding）。
 */

import {
  APIVER,
  APPID,
  CLIENTVER,
  LITE_APPID,
  LITE_CLIENTVER,
  QQ_APPID,
  QQ_LITE_APPID,
  SRC_APPID,
  WX_APPID,
  WX_LITE_APPID,
  WX_LITE_SECRET,
  WX_SECRET,
} from './constants';

export const wx_appid = WX_APPID;
export const wx_lite_appid = WX_LITE_APPID;
export const wx_secret = WX_SECRET;
export const wx_lite_secret = WX_LITE_SECRET;
export const qq_appid = QQ_APPID;
export const qq_lite_appid = QQ_LITE_APPID;
export const srcappid = SRC_APPID;
export const apiver = APIVER;
export const appid = APPID;
export const clientver = CLIENTVER;
export const liteAppid = LITE_APPID;
export const liteClientver = LITE_CLIENTVER;
