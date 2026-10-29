// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/effects_car_brand_lists.js
 * 接口路由：/effects/car/brand/lists
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 音效 - 汽车列表

export default (params: any, useAxios: UseAxios): Promise<any> => {

  const paramsMap = 
  {
    plat: 2,
    version: 12460,
    apiver: 2,
    sort: 1,
    pagesize: params.pagesize || 30,
    page: params.page || 1,
    classify: 5,
    rel_id: params.rel_id || 0,
  }
  
  return useAxios({
    baseURL: 'http://mobilecdngz.kugou.com',
    url: '/api/v3/sound/list',
    method: 'GET',
    params: paramsMap,
    encryptType: 'android',
    clearDefaultParams: true,
    cookie: params?.cookie || {},
  });
};

