// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/theme_playlist_track.js
 * 接口路由：/theme/playlist/track
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取主题歌单说有歌曲
import { clientver } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    platform: 'android',
    clientver,
    clienttime: Date.now(),
    area_code: 1,
    module_id: 1,
    userid: params?.userid || params?.cookie?.userid || 0,
    theme_id: params?.theme_id,
  };

  return useAxios({
    url: '/v2/gettheme_songidlist',
    method: 'POST',
    encryptType: 'android',
    data: dataMap,
    cookie: params?.cookie || {},
    headers: { 'x-router': 'everydayrec.service.kugou.com' },
  });
};

