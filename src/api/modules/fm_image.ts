// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/fm_image.js
 * 接口路由：/fm/image
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { appid, clientver, signParamsKey } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dateTime = Date.now();
  const dfid = params?.cookie?.dfid || params?.dfid || '-';
  const userid = params?.cookie?.userid || params?.userid;
  const token = params?.cookie?.token || params?.token;

  const fmData = (params?.fmid || '').split(',').map((s) => ({ fields: 'imgUrl100,imgUrl50', fmid: s, fmtype: 2 }));

  const dataMap = {
    appid,
    clienttime: dateTime,
    clientver,
    data: fmData,
    dfid,
    key: signParamsKey(dateTime),
    mid: params?.cookie?.KUGOU_API_MID,
  };
  if (userid) dataMap['userid'] = userid;
  if (token) dataMap['token'] = token;

  return useAxios({
    url: '/v1/fm_info',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    cookie: params?.cookie || {},
    headers: { 'x-router': 'fm.service.kugou.com', 'Content-Type': 'application/json' },
  });
};

