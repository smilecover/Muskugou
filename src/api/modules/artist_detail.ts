// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/artist_detail.js
 * 接口路由：/artist/detail
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 歌手详情
export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/kmr/v3/author',
    method: 'POST',
    data: { author_id: params.id },
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'openapi.kugou.com', 'kg-tid': 36 },
  });
};

