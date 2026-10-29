// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/artist_honour.js
 * 接口路由：/artist/honour
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 歌手荣誉详情
export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    baseURL: 'http://h5activity.kugou.com',
    url: '/v1/query_singer_honour_detail',
    method: 'POST',
    params: { singer_id: params.id, pagesize: params?.pagesize || 30, page: params?.page || 1 },
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

