// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_preference.js
 * 接口路由：/user/preference
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import { processEnv as process } from '../core/node/env';
import type { UseAxios } from '../core/types';

// 获取用户的听歌偏好设置（性别、年龄段、语言、风格、推荐模式等）。
import * as crypto from '../core/node/crypto';
import { cryptoAesEncrypt, rsaEncrypt2 } from '../core/compat';
import { appid, clientver, liteAppid, liteClientver } from '../core/legacy-config';

export default (params: any = {}, useAxios: UseAxios): Promise<any> => {
  const token = params?.token || params?.cookie?.token || '';
  const userid = Number(params?.userid || params?.cookie?.userid || 0);
  const mid = params?.mid || params?.cookie?.mid || params?.cookie?.KUGOU_API_MID || '-';
  const uuid = params?.uuid || params?.cookie?.uuid || params?.cookie?.KUGOU_API_GUID || '-';
  const dfid = params?.dfid || params?.cookie?.dfid || '-';
  const isLite = process.env.platform === 'lite';
  const appId = isLite ? liteAppid : appid;
  const clientVer = isLite ? liteClientver : clientver;
  const clienttime = Math.floor(Date.now() / 1000);

  const strG2 = crypto.randomBytes(8).toString('hex');

  const body = { plat: 1, userid };
  body.p = rsaEncrypt2(JSON.stringify({ key: strG2, clienttime: String(clienttime) }));
  body.params = cryptoAesEncrypt(JSON.stringify({ token }), { key: strG2 });

  return useAxios({
    baseURL: 'https://gateway.kugou.com',
    url: '/userpreferservice/v1/get_user_conf',
    method: 'POST',
    params: { appid: appId, clientver: clientVer, clienttime, mid, dfid, uuid },
    data: body,
    clearDefaultParams: true,
    encryptType: 'android',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `Android15-1070-${clientVer}-201-0-get_user_conf-wifi`,
      'KG-Rec': '1',
      'KG-RC': '1',
    },
    cookie: params?.cookie || {},
  });
};

