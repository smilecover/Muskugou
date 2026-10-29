// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/theme_playlist.js
 * 接口路由：/theme/playlist
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 主题歌单
import { clientver } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    platform: 'android',
    clientver,
    clienttime: Date.now(),
    area_code: 1,
    module_id: 1,
    userid: params?.userid || params?.cookie?.userid || 0,
  };

  return useAxios({
    url: '/v2/getthemelist',
    method: 'POST',
    encryptType: 'android',
    data: dataMap,
    cookie: params?.cookie || {},
    headers: { 'x-router': 'everydayrec.service.kugou.com' },
  });
};

