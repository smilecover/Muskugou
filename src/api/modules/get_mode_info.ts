// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/get_mode_info.js
 * 接口路由：/get/mode/info
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取音效详情
import { signParamsKey } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    model_id: Number(params.model_id || 0),
    req_src: 'collection',
    earphone_vip: 1,
    sound_ver: 2,
    key: signParamsKey(Date.now()),
    page: params.page || 1,
    pagesize: params.pagesize || 30,
  };

  

  return useAxios({
    baseURL: 'http://mobileservice.kugou.com',
    url: '/api/v5/earphone/get_model_info',
    encryptType: 'android',
    method: 'GET',
    params: dataMap,
    cookie: params?.cookie || {},
  });
};

