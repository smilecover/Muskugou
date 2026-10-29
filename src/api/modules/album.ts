// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/album.js
 * 接口路由：/album
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { clientver, appid, cryptoMd5, signParamsKey } from '../core/compat';


export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dateTime = Date.now();
  const data = (params?.album_id || '').split(',').map((s) => ({ album_id: s, album_name: '', author_name: '' }));
  const dfid = params?.cookie?.dfid || params?.dfid || '-';
  const userid = params?.cookie?.userid || params?.userid || 0;
  const token = params?.cookie?.token || params?.token || 0;

  const dataMap = {
    appid,
    clienttime: dateTime,
    clientver,
    data,
    dfid,
    fields: params?.fields || '',
    key: signParamsKey(dateTime),
    mid: params?.cookie?.KUGOU_API_MID,
  };

  if (token) dataMap['token'] = token;
  if (userid) dataMap['userid'] = userid;

  return useAxios({
    baseURL: 'http://kmr.service.kugou.com',
    url: '/v1/album',
    method: 'POST',
    data: dataMap,
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'kmr.service.kugou.com', 'Content-Type': 'application/json' },
  });
};

