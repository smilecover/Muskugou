// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/longaudio_album_detail.js
 * 接口路由：/longaudio/album/detail
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const data =  (params.album_id || '').split(',').map((s) => ({ album_id: s }));
  return useAxios({
    url: `/openapi/v2/broadcast`,
    method: 'post',
    encryptType: 'android',
    data: {
      data,
      show_album_tag: 1,
      fields: "album_name,album_id,category,authors,sizable_cover,intro,author_name,trans_param,album_tag,mix_intro,full_intro,is_publish"
    },
    cookie: params?.cookie || {},
    headers: {'KG-TID': '78'}
  });
};

