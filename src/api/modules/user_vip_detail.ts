// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_vip_detail.js
 * 接口路由：/user/vip/detail
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    baseURL: 'https://kugouvip.kugou.com',
    url: '/v1/get_union_vip',
    method: 'GET',
    params: {busi_type: 'concept'},
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

