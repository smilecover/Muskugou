// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/audio_match.js
 * 接口路由：/audio/match
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 听歌识曲
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const paramsMap = {
    fpid: Date.now(),
    area_code: 1,
    include_unpublish: 1,
    useid: params?.userid || params?.cookie?.userid || 0,
    multi_result: 1,
  };

  return useAxios({
    url: '/fingerprint.service/v1/music_trackid_mulit',
    encryptType: 'android',
    method: 'POST',
    data: params.data,
    params: paramsMap,
    cookie: params?.cookie || {},
    headers: { 'content-type': 'application/octet-stream', 'user-agent': 'KuGou/11490 (Android)' },
  });
};

