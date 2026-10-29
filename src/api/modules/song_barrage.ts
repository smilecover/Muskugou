// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/song_barrage.js
 * 接口路由：/song/barrage
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 歌曲弹幕（与歌曲评论 code=fc4... 为不同评论池）
import { firstValue, badRequest, buildSongBarrageListConfig } from './_comment';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const specialId = firstValue(params.special_id, params.childrenid, params.id);
  const hash = firstValue(params.hash, params.schash, params.extdata);

  if (!specialId && !hash) {
    return Promise.resolve(badRequest('special_id 和 hash 至少需要传入一个'));
  }

  return useAxios(buildSongBarrageListConfig(params));
};

