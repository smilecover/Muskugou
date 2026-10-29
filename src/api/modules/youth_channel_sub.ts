// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/youth_channel_sub.js
 * 接口路由：/youth/channel/sub
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const t = Number(params.t) === 0 ? 0 : 1;
  return useAxios({
    url: `/youth/v1/channel${t === 0 ? '_un' : ''}_subscribe`,
    encryptType: 'android',
    method: t === 0 ? 'delete': 'post',
    params: { global_collection_id: params.global_collection_id, source: 1},
    cookie: params?.cookie,
  });
};

