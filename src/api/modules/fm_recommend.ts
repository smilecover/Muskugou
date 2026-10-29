// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/fm_recommend.js
 * 接口路由：/fm/recommend
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { appid, clientver, signParamsKey } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dateTime = Date.now();
  const dfid = params?.cookie?.dfid || params?.dfid || '-';
  const dataMap = {
    appid,
    clientver,
    clienttime: dateTime,
    mid: params?.cookie?.KUGOU_API_MID,
    key: signParamsKey(dateTime),
    rcmdsongcount: 1,
    level: 0,
    area_code: 1,
    get_tracker: 1,
    uid: 0,
  };

  return useAxios({
    url: '/v1/rcmd_list',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
    headers: { 'x-router': 'fm.service.kugou.com' },
  });
};

