// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/song_barrage_send.js
 * 接口路由：/song/barrage/send
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 发送歌曲弹幕；仅传 hash 时先查询并解析 special_id
import { firstValue, badRequest, buildSongBarrageListConfig, buildSongBarrageSendConfig, extractResolvedResource } from './_comment';

export default async (params: any, useAxios: UseAxios): Promise<any> => {
  if (!`${params.content || ''}`.trim()) {
    return badRequest('content 不能为空');
  }

  let specialId = firstValue(params.special_id, params.childrenid, params.id);
  let name = firstValue(params.name, params.song_name, params.childrenname);

  if (!specialId) {
    const hash = firstValue(params.hash, params.schash, params.extdata);
    if (!hash) {
      return badRequest('special_id 和 hash 至少需要传入一个');
    }

    const lookupResponse = await useAxios(
      buildSongBarrageListConfig({
        ...params,
        page: 1,
        pagesize: 1,
      })
    );
    const resolved = extractResolvedResource(lookupResponse);
    specialId = resolved.id;
    name = name || resolved.name;
  }

  if (!specialId) {
    return badRequest('无法根据 hash 解析歌曲弹幕 special_id');
  }

  return useAxios(
    buildSongBarrageSendConfig({
      ...params,
      special_id: specialId,
      name,
    })
  );
};

