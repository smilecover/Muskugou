// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/sheet_detail.js
 * 接口路由：/sheet/detail
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 乐谱详情
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const paramsMap = {
    opern_id: params.id,
  }
  return useAxios({
    url: '/opern/v1/detail/info',
    encryptType: 'android',
    method: 'GET',
    params: paramsMap,
    cookie: params?.cookie || {},
  });
};

