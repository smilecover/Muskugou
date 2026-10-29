// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/comment_music_send.js
 * 接口路由：/comment/music/send
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 发送普通歌曲评论（code=fc4...，与歌曲弹幕池分离）
import commentMusic from './comment_music';
import { SONG_COMMENT_CODE, firstValue, badRequest, buildCommentSendConfig, extractResolvedResource } from './_comment';

export default async (params: any, useAxios: UseAxios): Promise<any> => {
  if (!`${params.content || ''}`.trim()) {
    return badRequest('content 不能为空');
  }

  const mixsongid = firstValue(params.mixsongid, params.album_audio_id);
  let specialId = firstValue(params.special_id, params.childrenid, params.id);
  let name = firstValue(params.name, params.song_name, params.childrenname);

  if ((!specialId || !name) && mixsongid) {
    const lookupResponse = await commentMusic({ ...params, mixsongid, page: 1, pagesize: 1 }, useAxios);
    const resolved = extractResolvedResource(lookupResponse);
    specialId = specialId || resolved.id;
    name = name || resolved.name;
  }

  if (!specialId) {
    return badRequest('无法解析歌曲评论 special_id，请传入 mixsongid 或 special_id');
  }

  return useAxios(
    buildCommentSendConfig(
      {
        ...params,
        special_id: specialId,
        mixsongid,
        name,
      },
      SONG_COMMENT_CODE
    )
  );
};

