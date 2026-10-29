// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/rank_audio.js
 * 接口路由：/rank/audio
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取排行榜音乐列表
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    show_portrait_mv: 1,
    show_type_total: 1,
    filter_original_remarks: 1,
    area_code: 1,
    pagesize: params.pagesize || 30,
    rank_cid: params.rank_cid || 0,
    type: 1,
    page: params.page || 1,
    rank_id: params.rankid,
  };
  return useAxios({
    url: '/openapi/kmr/v2/rank/audio',
    method: 'post',
    data: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'kg-tid': '369' },
  });
};

