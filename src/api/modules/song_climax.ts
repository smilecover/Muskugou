// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/song_climax.js
 * 接口路由：/song/climax
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取音频高潮部分

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const data = (params?.hash || '').split(',').map((s) => ({ hash: s }));

  return useAxios({
    baseURL: 'https://expendablekmrcdn.kugou.com',
    url: '/v1/audio_climax/audio',
    method: 'GET',
    params: { data: JSON.stringify(data) },
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

