// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_del.js
 * 接口路由：/playlist/del
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { playlistAesEncrypt, playlistAesDecrypt, rsaEncrypt2, signParamsKey, clientver, appid } from '../core/compat';

// 取消收藏歌单
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const answer = { status: 500, body: {}, cookie: [] };
  return new Promise(async (resolve) => {
    try {
      const userid = params?.userid || params?.cookie?.userid || 0;
      const token = params?.token || params.cookie?.token || '';
      const clienttime = Math.floor(Date.now() / 1000);

      const dataMap = {
        listid: Number(params.listid),
        total_ver: 0,
        type: 1,
      };

      const aesEncrypt = playlistAesEncrypt(dataMap);

      const p = rsaEncrypt2({ aes: aesEncrypt.key, uid: userid, token }).toUpperCase();

      const paramsMap = {
        clienttime,
        key: signParamsKey(clienttime.toString()),
        last_area: 'gztx',
        clientver,
        appid,
        last_time: clienttime,
        p,
      };

      const respone = await useAxios({
        url: '/v2/delete_list',
        params: paramsMap,
        data: aesEncrypt.str,
        method: 'post',
        encryptType: 'android',
        headers: { 'x-router': 'cloudlist.service.kugou.com' },
        responseType: 'arraybuffer',
        cookie: params?.cookie || {},
      });

      respone.body = playlistAesDecrypt({ str: respone.body.toString('base64'), key: aesEncrypt.key });

      resolve(respone);
    } catch (error) {
      console.log(error);
      answer.body = error;
      resolve(answer);
    }
  });
};

