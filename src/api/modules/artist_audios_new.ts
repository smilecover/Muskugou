// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/artist_audios_new.js
 * 接口路由：/artist/audios/new
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取歌手单曲（新版接口，返回每条歌曲的作者列表，支持多歌手）
// 注意：本接口 pagesize 上限为 100，超过会返回 error_code=20010
export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    baseURL: 'https://gateway.kugou.com',
    url: '/openapi/kmr/v2/audio_group/author',
    method: 'GET',
    params: {
      author_id: params.id,
      area_code: 'all',
      sort: params?.sort === 'hot' ? 1 : 2, // 1：最热，2：最新
      page: params?.page || 1,
      pagesize: params?.pagesize || 30,
      replace_api_version: 1,
      mvdata_need: 1,
      show_audio_honor: 1,
      show_audio_tag: 1,
      replace_need: 1,
    },
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'kg-tid': 36 },
  });
};
