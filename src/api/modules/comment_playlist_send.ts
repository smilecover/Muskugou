// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/comment_playlist_send.js
 * 接口路由：/comment/playlist/send
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 发送歌单评论
import commentPlaylist from './comment_playlist';
import { PLAYLIST_COMMENT_CODE, firstValue, badRequest, buildCommentSendConfig, extractResolvedResource } from './_comment';

export default async (params: any, useAxios: UseAxios): Promise<any> => {
  if (!`${params.content || ''}`.trim()) {
    return badRequest('content 不能为空');
  }

  const playlistId = firstValue(params.playlist_id, params.special_id, params.childrenid, params.id);
  if (!playlistId) {
    return badRequest('id 不能为空');
  }

  let name = firstValue(params.name, params.playlist_name, params.childrenname);
  if (!name) {
    const lookupResponse = await commentPlaylist({ ...params, id: playlistId, page: 1, pagesize: 1 }, useAxios);
    name = extractResolvedResource(lookupResponse).name;
  }

  return useAxios(
    buildCommentSendConfig(
      {
        ...params,
        special_id: playlistId,
        name,
      },
      PLAYLIST_COMMENT_CODE
    )
  );
};

