// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/comment_music_del.js
 * 接口路由：/comment/music/del
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 删除评论，支持歌曲、专辑和歌单评论池；传 tid 时删除楼层回复
import commentMusic from './comment_music';
import { firstValue, badRequest, buildCommentDelConfig, resolveCommentCode, extractResolvedResource } from './_comment';

export default async (params: any, useAxios: UseAxios): Promise<any> => {
  const cid = firstValue(params.cid, params.comment_id);
  if (!cid) {
    return badRequest('cid（评论 ID）不能为空，可从评论列表接口获取');
  }

  const mixsongid = firstValue(params.mixsongid, params.album_audio_id);
  let specialId = firstValue(params.special_id, params.childrenid);

  if (!specialId && mixsongid) {
    const lookupResponse = await commentMusic({ ...params, mixsongid, page: 1, pagesize: 1 }, useAxios);
    specialId = extractResolvedResource(lookupResponse).id;
  }

  if (!specialId) {
    return badRequest('无法解析评论资源 special_id，请传入 special_id 或 mixsongid');
  }

  return useAxios(
    buildCommentDelConfig(
      {
        ...params,
        special_id: specialId,
        cid,
      },
      resolveCommentCode(params)
    )
  );
};

