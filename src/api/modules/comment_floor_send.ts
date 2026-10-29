// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/comment_floor_send.js
 * 接口路由：/comment/floor/send
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 发送楼层回复，支持歌曲、专辑和歌单评论池
import commentFloor from './comment_floor';
import { SONG_COMMENT_CODE, ALBUM_COMMENT_CODE, PLAYLIST_COMMENT_CODE, firstValue, badRequest, buildCommentReplyConfig, extractResolvedResource } from './_comment';

const resolveCode = (params = {}) => {
  const explicitCode = firstValue(params.code);
  if (explicitCode) return `${explicitCode}`;

  const resourceType = `${firstValue(params.resource_type, params.resourceType, 'song')}`.toLowerCase();
  if (resourceType === 'album') return ALBUM_COMMENT_CODE;
  if (resourceType === 'playlist') return PLAYLIST_COMMENT_CODE;
  return SONG_COMMENT_CODE;
};

export default async (params: any, useAxios: UseAxios): Promise<any> => {
  if (!`${params.content || ''}`.trim()) {
    return badRequest('content 不能为空');
  }

  const specialId = firstValue(params.special_id, params.childrenid, params.id);
  if (!specialId) {
    return badRequest('special_id 不能为空');
  }
  if (!firstValue(params.tid)) {
    return badRequest('tid 不能为空');
  }

  const code = resolveCode(params);
  let name = firstValue(params.name, params.song_name, params.album_name, params.playlist_name, params.childrenname);

  if (!name) {
    const lookupResponse = await commentFloor(
      {
        ...params,
        special_id: specialId,
        code,
        page: 1,
        pagesize: 1,
      },
      useAxios
    );
    name = extractResolvedResource(lookupResponse).name;
  }

  return useAxios(
    buildCommentReplyConfig(
      {
        ...params,
        special_id: specialId,
        name,
      },
      code
    )
  );
};

export { resolveCode };

