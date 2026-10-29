// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/artist_videos.js
 * 接口路由：/artist/videos
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取歌手mv

const tag_idx = { official: 18, live: 20, fan: 23, artist: 42419, all: '' };

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const paramsMap = {
    author_id: params.id,
    is_fanmade: '',
    tag_idx: tag_idx[params?.tag || 'all'] || '', // 18:官方版本，20：现场版本，23：饭制版本，42419：歌手发布
    pagesize: params.pagesize || 30,
    page: params.page || 1,
  };

  return useAxios({
    baseURL: 'https://openapicdn.kugou.com',
    url: '/kmr/v1/author/videos',
    method: 'GET',
    params: paramsMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

