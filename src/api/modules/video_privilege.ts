// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/video_privilege.js
 * 接口路由：/video/privilege
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoMd5, signParamsKey, clientver, appid } from '../core/compat';
// 获取视频特权

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dfid = params?.cookie?.dfid || '-';
  const mid = params?.cookie?.KUGOU_API_MID;

  const resource = (params?.hash || '').split(',').map((s) => ({ hash: s, id: 0, name: '' }));

  const dataMap = {
    appid,
    area_code: 1,
    behavior: 'play',
    clientver,
    dfid,
    mid,
    resource,
    token: params?.cookie?.token || '',
    userid: params?.cookie?.userid || 0,
    vip: params?.cookie?.vip_type || 0,
  };

  return useAxios({
    url: '/v1/get_video_privilege',
    method: 'POST',
    data: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'media.store.kugou.com' },
  });
};

