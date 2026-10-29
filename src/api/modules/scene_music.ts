// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/scene_music.js
 * 接口路由：/scene/music
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/genesisapi/v1/scene_music/rec_music',
    params: { scene_id: params.id, page: params.page || 1, pagesize: params.pagesize || 30 },
    data: { exposure: [] },
    method: 'POST',
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

