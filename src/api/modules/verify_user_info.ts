// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/verify_user_info.js
 * 接口路由：/verify/user/info
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { cryptoAesEncrypt, cryptoRSAEncrypt } from '../core/compat';
// 验证验证码数据
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const clienttime = Date.now();
  const v_type = Number(params?.v_type || 23);
  const userid = Number(params?.userid || params?.cookie?.userid || '0');
  //
  let dataMap = {
    eventid: params?.eventid,
    userid,
    platid: params?.platid || 2,
    v_type,
    wasm: 1,
    i: '',
    sid: decodeURIComponent(params?.sid || ''),
    edt: decodeURIComponent(params?.edt || ''),
  };

  if (v_type === 23) {
    const encrypt = cryptoAesEncrypt({});
    dataMap = {
      ...dataMap,
      verifycode: decodeURIComponent(params?.verifycode || ''),
      pk: cryptoRSAEncrypt({ key: encrypt.key }),
      params: encrypt.str,
    };
  }

  if (v_type === 32) {
    const encrypt = cryptoAesEncrypt({ code: params?.verifycode || '' });
    dataMap = {
      ...dataMap,
      code: decodeURIComponent(params?.verifycode || ''),
      pk: cryptoRSAEncrypt({ key: encrypt.key }),
      params: encrypt.str,
    };
  }


  return useAxios({
    baseURL: 'https://verifyservice.kugou.com',
    url: '/v4/verify_user_info',
    encryptType: 'android',
    method: 'POST',
    data: dataMap,
    params: { clientver: 11510 },
    cookie: params?.cookie || {},
  });
};

