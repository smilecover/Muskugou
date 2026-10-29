// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/everyday_recommend.js
 * 接口路由：/everyday/recommend
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/everyday_song_recommend',
    encryptType: 'android',
    method: 'POST',
    params: { platform: params.platform || 'ios' },
    cookie: params?.cookie || {},
    headers: { 'x-router': 'everydayrec.service.kugou.com' },
  });
};

