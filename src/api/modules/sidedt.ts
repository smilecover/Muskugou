// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/sidedt.js
 * 接口路由：/sidedt
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

/**
 * sidEdt.js
 * ----------
 * 完整移植自你提供的浏览器 script（未删减任何函数），
 * 只把浏览器专属的 API 替换为 Node 等价实现。
 *
 * 使用方法:
 *   const { generateSidEdt } = require('./sidEdt');
 *   const { sid, edt } = await generateSidEdt({ userid, dfid, mid });
 *
 *   // sid、edt 均为 Base64 编码，可直接放到登录请求的 URL/JSON 中
 */


import { generateSimulate } from '../core/simulate';
import { generateWebGLHash } from '../core/util';
import verifyUserInfo from './verify_user_info';

export default async (params: any, useAxios: UseAxios): Promise<any> => {
  const webglHash = params?.cookie.KUGOU_API_WEBGL || generateWebGLHash(); // WebGL 指纹哈希
  const userid = params?.userid || params?.cookie.userid || '0';
  const dfid = params?.dfid || params?.cookie.dfid || '0';
  const mid = params?.mid || params?.cookie.KUGOU_API_MID || '0';
  const value = generateSimulate(mid, userid, dfid, webglHash);
  const userParams = { ...params, edt: value.edt, sid: value.sid };
  return verifyUserInfo(userParams, useAxios);
};

