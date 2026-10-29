// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/artist_audios.js
 * 接口路由：/artist/audios
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoMd5, signParamsKey, clientver, appid } from '../core/compat';
// 获取歌手单曲

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const clienttime = Math.floor(new Date().getTime() / 1000);
  const mid = params?.cookie?.KUGOU_API_MID;
  const dataMap = {
    appid,
    clientver,
    mid,
    clienttime,
    key: signParamsKey(clienttime),
    author_id: params.id,
    pagesize: params?.pagesize || 30,
    page: params?.page || 1,
    sort: params?.sort === 'hot' ? 1 : 2, // 1：最热，2：最新
    area_code: 'all',
  };

  return useAxios({
    baseURL: 'https://openapi.kugou.com',
    url: '/kmr/v1/audio_group/author',
    method: 'POST',
    data: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'openapi.kugou.com', 'kg-tid': 220 },
  });
};

