// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/longaudio_vip_recommend.js
 * 接口路由：/longaudio/vip/recommend
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: `/longaudio/v1/home_new/vip_select_recommend`,
    method: 'post',
    encryptType: 'android',
    data: {album_playlist: []},
    params: {position: '2', clientver: 12329},
    cookie: params?.cookie || {},
  });
};

