// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_union_vip.js
 * 接口路由：/youth/union/vip
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 领取vip 需要登录
export default (params: any, useAxios: UseAxios): Promise<any> => {
 const paramsMap = {
  busi_type: 'concept',
  opt_product_types: 'dvip,qvip',
  product_type: 'svip',
 }

  return useAxios({
    baseURL: 'https://kugouvip.kugou.com',
    url: '/v1/get_union_vip',
    encryptType: 'android',
    method: 'get',
    params: paramsMap,
    cookie: params?.cookie,
  });
};

