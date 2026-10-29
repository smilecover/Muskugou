// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/search_complex.js
 * 接口路由：/search/complex
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 综合搜索
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    platform: 'AndroidFilter',
    keyword: params.keywords,
    page: params?.page || 1,
    pagesize: params?.pagesize || 30,
    cursor: 0,
  };

  return useAxios({
    baseURL: 'https://complexsearch.kugou.com',
    url: '/v6/search/complex',
    method: 'GET',
    params: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

