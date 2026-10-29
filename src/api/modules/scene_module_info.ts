// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/scene_module_info.js
 * 接口路由：/scene/module/info
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/scene/v1/scene/module_info',
    params: { scene_id: params.id, module_id: params.module_id },
    method: 'GET',
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

