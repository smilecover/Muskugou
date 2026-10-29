// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/recommend_songs.js
 * 接口路由：/recommend/songs
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 每日推荐歌曲

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    platform: params?.platform || 'android',
    userid: params?.userid || params?.cookie?.userid || '0',
  };

  return useAxios({
    url: '/everyday_song_recommend',
    method: 'POST',
    data: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'everydayrec.service.kugou.com' },
  });
};

