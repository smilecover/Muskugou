// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/search_hot.js
 * 接口路由：/search/hot
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 热搜
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    navid: 1,
    plat: 2,
  };

  return useAxios({
    url: '/api/v3/search/hot_tab',
    method: 'GET',
    params: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: {'x-router': 'msearch.kugou.com'}
  });
};

