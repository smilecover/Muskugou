// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/fm_songs.js
 * 接口路由：/fm/songs
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { appid, clientver, signParamsKey } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dateTime = Date.now();
  const userid = params?.cookie?.userid || params?.userid;

  const fmData = (params?.fmid || '').split(',').map((s) => ({
    fmid: s,
    fmtype: params?.type || 2,
    offset: params?.offset || -1,
    size: params?.size || 20,
    singername: s.singername || '',
  }));

  // fmType 生成
  (params?.fmtype || '').split(',').forEach((s, l) => (fmData[l].fmtype = s || fmData[l].fmtype));

  (params?.fmoffset || '').split(',').forEach((s, l) => (fmData[l].offset = s || fmData[l].offset));

  (params?.fmsize || '').split(',').forEach((s, l) => (fmData[l].size = s || fmData[l].size));

  const dataMap = {
    appid,
    area_code: 1,
    clienttime: dateTime,
    clientver,
    data: fmData,
    get_tracker: 1,
    key: signParamsKey(dateTime),
    mid: params?.cookie?.KUGOU_API_MID,
    uid: userid,
  };

  return useAxios({
    url: '/v1/app_song_list_offset',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
    headers: { 'x-router': 'fm.service.kugou.com', 'Content-Type': 'application/json' },
  });
};

