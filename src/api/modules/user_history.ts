// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_history.js
 * 接口路由：/user/history
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取用户听歌排行
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || 0;
  const token = params?.token || params?.cookie?.token || '';

  const dataMap = {  token, userid, source_classify: 'app',  to_subdivide_sr: 1 };

  if (params.bp) dataMap['bp'] = params.bp;

  return useAxios({
    url: '/playhistory/v1/get_songs',
    data: dataMap,
    encryptType: 'android',
    method: 'POST',
    cookie: params?.cookie || {},
  });

};

