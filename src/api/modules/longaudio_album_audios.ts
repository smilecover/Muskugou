// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/longaudio_album_audios.js
 * 接口路由：/longaudio/album/audios
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: `/longaudio/v2/album_audios`,
    method: 'post',
    encryptType: 'android',
    data: {
      album_id: params.album_id,
      area_code: 1,
      tagid: 0,
      page: params.page || 1,
      pagesize: params.pagesize || 30,
    },
    cookie: params?.cookie || {},
    headers: { 'x-router': 'openapi.kugou.com', 'KG-TID': '78' },
  });
};

