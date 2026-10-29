// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/search_suggest.js
 * 接口路由：/search/suggest
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/v2/getSearchTip',
    method: 'GET',
    params: {
      keyword: params.keywords,
      AlbumTipCount: params.albumTipCount || 10,
      CorrectTipCount: params.correctTipCount || 10,
      MVTipCount: params.mvTipCount || 10,
      MusicTipCount: params.musicTipCount || 10,
      radiotip: 1
    },
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'searchtip.kugou.com' },
  });
};

