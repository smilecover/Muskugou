// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/sheet_rank.js
 * 接口路由：/sheet/rank
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取排行榜 // 乐谱列表  3、钢琴（0：基础，1：进阶)，1、吉他(1: 进阶, 2：基础，0：中级)，2、尤克里里（0：基础，1：进阶），4：简谱（0：基础）
export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    url: '/opern/v1/home/get_rank_opern',
    encryptType: 'android',
    method: 'POST',
    params: { pagesize: params?.pagesize || 30, page: params?.page || 1, opern_level: params?.level || 0, instruments: params?.instruments || 1, tagid: params?.tagid || 0 },
    cookie: params?.cookie || {},
  });
};


