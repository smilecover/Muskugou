// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_channel_all.js
 * 接口路由：/youth/channel/all
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/youth/v2/channel/channel_all_list',
    encryptType: 'android',
    method: 'get',
    params: { page: params.page || 1, pagesize: params.pagesize || 30, type: 1},
    cookie: params?.cookie,
  });
};

