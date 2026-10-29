// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/fm_class.js
 * 接口路由：/fm/class
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { appid, clientver, cryptoMd5, signParamsKey } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dateTime = Date.now();
  const userid = params?.cookie?.userid || params?.userid || 0;
  const dataMap = {
    kguid: userid,
    clienttime: dateTime,
    mid: params?.cookie?.KUGOU_API_MID,
    platform: 'android',
    clientver,
    uid: userid,
    get_tracker: 1,
    key: signParamsKey(dateTime),
    appid,
  };

  return useAxios({
    url: '/v1/class_fm_song',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
    headers: { 'x-router': 'fm.service.kugou.com' },
  });
};

