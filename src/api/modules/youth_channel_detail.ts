// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_channel_detail.js
 * 接口路由：/youth/channel/detail
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const data = (params.global_collection_id || '').split(',').map((s) => ({ global_collection_id: s }));
  return useAxios({
    url: '/youth/api/channel/v1/channel_list_by_id',
    encryptType: 'android',
    method: 'post',
    data: { data },
    cookie: params?.cookie,
  });
};

