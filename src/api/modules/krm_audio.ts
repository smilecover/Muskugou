// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/krm_audio.js
 * 接口路由：/krm/audio
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 根据 album_audio_id/MixSongID 获取歌曲 相对应的 歌手/专辑/歌曲信息
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const resource = (params?.album_audio_id || '').split(',').map((s) => ({ entity_id: Number(s) }));

  const paramsMap = {
    data: resource,
    fields: params.fields || 'base',
  };

  return useAxios({
    url: '/kmr/v2/audio',
    method: 'POST',
    data: paramsMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: {'x-router': 'openapi.kugou.com', 'KG-TID': 238},
  });
};

