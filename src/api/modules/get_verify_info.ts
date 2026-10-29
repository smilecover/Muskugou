// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/get_verify_info.js
 * 接口路由：/get/verify/info
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取验证码数据
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = Number(params?.userid || params?.cookie?.userid || '0');
  const dataMap = {
    eventid: params?.eventid,
    userid,
    platid: params?.platid || 2,
    rtype: 1,
    wasm: 1,
    i: '',
    sid: '',
    edt: '',
  };

  return useAxios({
    url: '/verifyservice/v3/get_verify_info',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

