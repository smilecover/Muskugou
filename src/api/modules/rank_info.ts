// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/rank_info.js
 * 接口路由：/rank/info
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取排行榜详情
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const parmasMap = {
    rank_cid: params.rank_cid || 0,
    rankid: params.rankid,
    with_album_img: params.album_img || 1,
    zone: params.zone || '',
  };

  return useAxios({
    url: '/ocean/v6/rank/info',
    method: 'get',
    encryptType: 'android',
    params: parmasMap,
    cookie: params?.cookie || {},
  });
};

