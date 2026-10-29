// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/artist_albums.js
 * 接口路由：/artist/albums
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取歌手专辑

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    author_id: params.id,
    pagesize: params?.pagesize || 30,
    page: params?.page || 1,
    sort: params?.sort === 'hot' ? 3 : 1, // 3：最热，1：最新
    category: 1,
    area_code: 'all',
  };

  return useAxios({
    url: '/kmr/v1/author/albums',
    method: 'POST',
    data: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'openapi.kugou.com', 'kg-tid': 36 },
  });
};

