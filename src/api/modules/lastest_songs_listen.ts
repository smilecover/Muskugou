// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/lastest_songs_listen.js
 * 接口路由：/lastest/songs/listen
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取继续播放信息
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const token = params?.token || params.cookie?.token || '';
  const userid = Number(params?.userid || params?.cookie?.userid || 0);
  const paramsMap = {
    area_code: '1',
    sources: ['pc', 'mobile', 'tv', 'car'],
    userid,
    ret_info: 1,
    token,
    pagesize: Number(params.pagesize || 30)
  }

  return useAxios({
    url: '/playque/devque/v1/get_latest_songs',
    encryptType: 'android',
    method: 'POST',
    data: paramsMap,
    cookie: params?.cookie || {},
  });
};

