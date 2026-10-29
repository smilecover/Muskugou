// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playhistory_upload.js
 * 接口路由：/playhistory/upload
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 提交听歌历史
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || 0;
  const token = params?.token || params?.cookie?.token || '';

  const songs = [{ mxid: Number(params.mxid), op: 1, ot: Number(params.time || Math.floor(Date.now() / 1000)), pc: Number(params.pc || 1) }];
  const dataMap = { songs, token, userid };

  return useAxios({
    url: '/playhistory/v1/upload_songs',
    data: dataMap,
    encryptType: 'android',
    method: 'POST',
    params: { plat: 3 },
    cookie: params?.cookie || {},
  });
};

