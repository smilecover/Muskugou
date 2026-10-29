// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/personal_fm.js
 * 接口路由：/personal/fm
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { signParamsKey, appid, clientver } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.cookie?.userid || params?.userid || 0;
  const token = params?.cookie?.token || params?.token || 0;
  const vip_type = params?.cookie?.vip_type || params?.vipType || 0;
  const dateTime = Date.now();

  const dataMap = {
    appid,
    clienttime: dateTime,
    mid: params?.cookie?.KUGOU_API_MID,
    action: params?.action || 'play',
    recommend_source_locked: 0,
    song_pool_id: Number(params?.song_pool_id || 0),
    callerid: 0,
    m_type: 1,
    platform: params?.platform || 'ios',
    area_code: 1,
    remain_songcnt: Number(params?.remain_songcnt || 0),
    clientver,
    is_overplay: params?.is_overplay ? 1 : 0,
    mode: params?.mode || 'normal',
    fakem: 'ca981cfc583a4c37f28d2d49000013c16a0a',
    key: signParamsKey(dateTime),
  };

  if (userid) {
    dataMap['userid'] = userid;
    dataMap['kguid'] = userid;
  }
  if (token) dataMap['token'] = token;
  if (vip_type) dataMap['vip_type'] = vip_type;

  if (params?.hash) dataMap['hash'] = params.hash;
  if (params?.songid) dataMap['songid'] = params.songid;
  if (params?.playtime) dataMap['playtime'] = params.playtime;
  if (params?.cur_mark) dataMap['cur_mark'] = params.cur_mark;

  return useAxios({
    url: '/v2/personal_recommend',
    data: dataMap,
    method: 'post',
    encryptType: 'android',
    cookie: params?.cookie || {},
    headers: { 'x-router': 'persnfm.service.kugou.com' },
  });
};

