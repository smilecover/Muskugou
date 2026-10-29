// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/audio_related.js
 * 接口路由：/audio/related
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoMd5 } from '../core/compat';

const sortType = { all: 1, hot: 2, new: 3 };

// https://listkmrp3cdnretry.kugou.com/v3/album_audio/related
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const show_detail = Number(params.show_detail) === 0;

  let dataMap = {
    album_audio_id: Number(params.album_audio_id),
    appid: 1005,
    area_code: 1,
    clientver: 12329,
  };

  if (!show_detail) {
    dataMap = {
      ...dataMap,
      page: params.page || 1,
      pagesize: params.pagesize || 30,
      show_input: 1,
      show_type: params.show_type || 0,
      sort: sortType[params.sort] || 1,
      type: params.type || 0,
    };
  }

  dataMap['version'] = 1;

  const str = 'OIlwieks28dk2k092lksi2UIkp';
  const paramsString = Object.keys(dataMap)
    .sort()
    .map((key) => `${key}=${typeof dataMap[key] === 'object' ? JSON.stringify(dataMap[key]) : dataMap[key]}`)
    .join('');
  dataMap['signature'] = cryptoMd5(`${str}${paramsString}${str}`);

  return useAxios({
    baseURL: 'https://listkmrp3cdnretry.kugou.com',
    url: !show_detail ? '/v3/album_audio/related' : '/v2/audio_related/total',
    params: dataMap,
    method: 'get',
    encryptType: 'android',
    cookie: params?.cookie || {},
    clearDefaultParams: true,
  });
};

