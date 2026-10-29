// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/album_detail.js
 * 接口路由：/album/detail
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 专辑详情
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const data = {
    data: [{ album_id: params.id }],
    is_buy: params?.is_buy || 0,
    fields: 'album_id,album_name,publish_date,sizable_cover,intro,language,is_publish,heat,type,quality,authors,exclusive,author_name,trans_param',
  };
  return useAxios({
    url: '/kmr/v2/albums',
    method: 'POST',
    data,
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'openapi.kugou.com', 'kg-tid': '255' },
  });
};

