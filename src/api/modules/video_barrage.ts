// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/video_barrage.js
 * 接口路由：/video/barrage
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// MV 视频弹幕（底层复用 MV 评论池）
import { firstValue, badRequest, buildVideoBarrageListConfig } from './_comment';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const videoId = firstValue(params.video_id, params.childrenid, params.id);
  const hash = firstValue(params.hash, params.mvhash, params.extdata);

  if (!videoId && !hash) {
    return Promise.resolve(badRequest('video_id 和 hash 至少需要传入一个'));
  }

  return useAxios(buildVideoBarrageListConfig(params));
};

