// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/artist_lists.js
 * 接口路由：/artist/lists
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 歌手列表
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const paramsMap = {
    musician: Number(params.musician || 0),
    sextype: params.sextypes || 0,
    showtype: 2,
    type: params.type || 0,
    hotsize:  Number(params.hotsize || 30)
  };

  return useAxios({
    url: '/ocean/v6/singer/list',
    method: 'GET',
    params: paramsMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

