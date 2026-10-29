// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_cloud.js
 * 接口路由：/user/cloud
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import { Buffer } from '../core/buffer';
import type { UseAxios } from '../core/types';

import { playlistAesEncrypt, playlistAesDecrypt, rsaEncrypt2, signParamsKey, clientver, appid } from '../core/compat';
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const answer = { status: 500, body: {}, cookie: [] };
  return new Promise(async (resolve) => {
    try {
      const userid = params?.userid || params?.cookie?.userid || 0;
      const token = params?.token || params.cookie?.token || '';
      const mid = params?.cookie?.KUGOU_API_MID; // 可以自定义
      const clienttime = Math.floor(Date.now() / 1000);

      const dataMap = {
        page: params.page ?? 1,
        pagesize: params.pagesize ?? 30,
        getkmr: 1,
      };

      const aesEncrypt = playlistAesEncrypt(dataMap);

      const p = rsaEncrypt2({ aes: aesEncrypt.key, uid: userid, token }).toUpperCase();

      const paramsMap = {
        clienttime,
        mid,
        key: signParamsKey(clienttime.toString(), appid),
        clientver,
        appid,
        p,
      };

      const respone = await useAxios({
        baseURL: 'https://mcloudservice.kugou.com',
        url: '/v1/get_list',
        params: paramsMap,
        data: Buffer.from(aesEncrypt.str, 'base64'),
        method: 'post',
        encryptType: 'android',
        responseType: 'arraybuffer',
        cookie: params?.cookie || {},
        clearDefaultParams: true,
        notSignature: true,
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

