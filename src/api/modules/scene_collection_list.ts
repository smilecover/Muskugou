// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/scene_collection_list.js
 * 接口路由：/scene/collection/list
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { appid, clientver } from '../core/compat';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || 0;
  const token = params?.token || params.cookie?.token || '';

  const dataMap = {
    appid,
    clientver,
    token,
    userid,
    tag_id: params.tag_id,
    page: params.page || 1,
    page_size: params.pagesize || 30,
    exposed_data: [],
  };

  return useAxios({
    url: '/scene/v1/distribution/collection_list',
    method: 'POST',
    encryptType: 'android',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

