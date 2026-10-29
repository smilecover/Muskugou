// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/scene_lists_v2.js
 * 接口路由：/scene/lists/v2
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || '0';

  const sortType = { rec: 1, hot: 2, new: 3 };

  return useAxios({
    url: '/scene/v1/scene/list_v2',
    params: {
      scene_id: params.id,
      page: params.page || 1,
      pagesize: params.pagesize || 30,
      sort_type: sortType[params.sort || 'rec'] || 1,
      kugouid: userid,
    },
    data: { exposure: [] },
    method: 'POST',
    encryptType: 'android',
    cookie: params?.cookie || {},
  });
};

