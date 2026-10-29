// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/everyday_history.js
 * 接口路由：/everyday/history
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// mode list ,song

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const paramsMap = {
   mode: params.mode || 'list',
   platform: params.platform || 'ios' 
  };

  if (params.history_name) paramsMap['history_name'] = params.history_name;
  if (params.date) paramsMap['date'] = params.date;

  return useAxios({
    url: '/everyday/api/v1/get_history',
    encryptType: 'android',
    method: 'POST',
    params: paramsMap,
    cookie: params?.cookie || {},
    headers: { 'x-router': 'everydayrec.service.kugou.com' },
  });
};

