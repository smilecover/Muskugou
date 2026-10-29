// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/video_detail.js
 * 接口路由：/video/detail
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { appid, clientver, signParamsKey, cryptoMd5 } from '../core/compat';
// 获取视频详情
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dfid = params?.cookie?.dfid || '-'; // 自定义
  const mid = params?.cookie?.KUGOU_API_MID; // 可以自定义
  const uuid = cryptoMd5(`${dfid}${mid}`); // 可以自定义
  const token = params?.token || params?.cookie?.token || '';
  const clienttime = Math.floor(new Date().getTime() / 1000);

  const resource = (params.id || '').split(',').map((s) => ({ video_id: s }));

  const dataMap = {
    appid,
    clientver,
    clienttime,
    mid,
    uuid,
    dfid,
    token: token || '',
    key: signParamsKey(clienttime.toString()),
    show_resolution: 1,
    data: resource,
  };
  return useAxios({
    url: '/v1/video',
    method: 'POST',
    data: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
    clearDefaultParams: true,
    headers: { 'x-router': 'kmr.service.kugou.com' },
  });
};

