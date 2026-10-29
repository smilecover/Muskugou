// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/ip.js
 * 接口路由：/ip
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 根据 ip id 获取相对应的 歌曲/专辑/视频/歌手
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    is_publish: 1,
    ip_id: params?.id,
    sort: 3,
    page: params?.page || 1,
    pagesize: params?.pagesize || 30,
    query: 1,
  };

  const type = ['audios', 'albums', 'videos', 'author_list'].includes(params?.type) ? params.type : 'audios';

  return useAxios({
    url: `/openapi/v1/ip/${type}`,
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
  });
};

