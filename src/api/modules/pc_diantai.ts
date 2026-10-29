// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/pc_diantai.js
 * 接口路由：/pc/diantai
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 电台 banner
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.cookie?.userid || params?.userid || 0;
  const dataMap = {
    isvip: 0,
    userid,
    vipType: 0,
  };
  return useAxios({
    baseURL: 'https://adservice.kugou.com',
    url: '/v3/pc_diantai',
    data: dataMap,
    method: 'post',
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

