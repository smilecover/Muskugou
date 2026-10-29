// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_friends.js
 * 接口路由：/user/friends
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import { processEnv as process } from '../core/node/env';
import type { UseAxios } from '../core/types';

// 获取好友列表（模块路由 /user/friends）
// 接口：POST https://relationuser.kugou.com/v1/friends_list
// 对应安卓 com.kugou.common.userCenter.protocol.l
import { cryptoRSAEncrypt, signParamsKey, appid, clientver } from '../core/compat';
import { liteAppid, liteClientver } from '../core/legacy-config';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const isLite = process.env.platform === 'lite';
  const appidUsed = isLite ? liteAppid : appid;
  const clientverUsed = isLite ? liteClientver : clientver;
  const token = params?.token || params?.cookie?.token || '';
  const userid = Number(params?.userid || params?.cookie?.userid || 0);
  const mid = String(params?.mid || params?.cookie?.KUGOU_API_MID || '');
  const dfid = params?.dfid || params?.cookie?.dfid || '-';
  const clienttime = Math.floor(Date.now() / 1000);

  const data = {
    userid,
    dfid,
    plat: 1,
    nickimg: 1,
    appid: appidUsed,
    clientver: clientverUsed,
    mid,
    clienttime,
    key: signParamsKey(String(clienttime), appidUsed, clientverUsed),
    p: cryptoRSAEncrypt({ clienttime, token }).toUpperCase(),
  };

  return useAxios({
    baseURL: 'https://relationuser.kugou.com',
    url: '/v1/friends_list',
    method: 'POST',
    data,
    params: { dfid },
    // 老协议：query 只保留 dfid，不注入默认参数也不签名（鉴权在 body 的 key/p）
    clearDefaultParams: true,
    notSignature: true,
    cookie: params?.cookie || {},
  });
};

