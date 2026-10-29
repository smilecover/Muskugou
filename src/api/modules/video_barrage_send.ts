// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/video_barrage_send.js
 * 接口路由：/video/barrage/send
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 发送 MV 视频弹幕；仅传 hash 时先查询并解析 video_id
import { firstValue, badRequest, buildVideoBarrageListConfig, buildVideoBarrageSendConfig, extractResolvedResource } from './_comment';

export default async (params: any, useAxios: UseAxios): Promise<any> => {
  if (!`${params.content || ''}`.trim()) {
    return badRequest('content 不能为空');
  }

  let videoId = firstValue(params.video_id, params.childrenid, params.id);
  let name = firstValue(params.name, params.video_name, params.childrenname);

  if (!videoId) {
    const hash = firstValue(params.hash, params.mvhash, params.extdata);
    if (!hash) {
      return badRequest('video_id 和 hash 至少需要传入一个');
    }

    const lookupResponse = await useAxios(
      buildVideoBarrageListConfig({
        ...params,
        page: 1,
        pagesize: 1,
      })
    );
    const resolved = extractResolvedResource(lookupResponse);
    videoId = resolved.id;
    name = name || resolved.name;
  }

  if (!videoId) {
    return badRequest('无法根据 hash 解析视频弹幕 video_id');
  }

  return useAxios(
    buildVideoBarrageSendConfig({
      ...params,
      video_id: videoId,
      name,
    })
  );
};

