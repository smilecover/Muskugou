// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/yueku_fm.js
 * 接口路由：/yueku/fm
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取乐库下的 fm

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/v1/time_fm_info',
    encryptType: 'android',
    method: 'GET',
    params: { operator: 7, plat: 0, type: 11, area_code: 1, req_multi: 1 },
    cookie: params?.cookie || {},
    headers: { 'x-router': 'fm.service.kugou.com' },
  });
};

