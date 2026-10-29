// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/login_token.js
 * 接口路由：/login/token
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 刷新登录
import { cryptoAesDecrypt, cryptoAesEncrypt, cryptoRSAEncrypt, isLite } from '../core/compat';

const key = '90b8382a1bb4ccdcf063102053fd75b8';
const iv = 'f063102053fd75b8';

const liteKey = 'c24f74ca2820225badc01946dba4fdf7';
const liteIv = 'adc01946dba4fdf7';

let liteT2Key = 'fd14b35e3f81af3817a20ae7adae7020';
let liteT2Iv = '17a20ae7adae7020';
let liteT1Key = '5e4ef500e9597fe004bd09a46d8add98';
let liteT1Iv = '04bd09a46d8add98';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dateNow = Date.now();
  const token = params?.token || params?.cookie?.token || '';
  const userid = params?.userid || params?.cookie?.userid || '0';
  const encrypt = cryptoAesEncrypt({ clienttime: Math.floor(dateNow / 1000), token }, { key: isLite ? liteKey : key, iv: isLite ? liteIv : iv });
  const encryptParams = cryptoAesEncrypt({});
  const pk = cryptoRSAEncrypt({ clienttime_ms: dateNow, key: encryptParams.key });

  const t2 = cryptoAesEncrypt(
    `${params.cookie?.KUGOU_API_GUID}|0f607264fc6318a92b9e13c65db7cd3c|${params.cookie?.KUGOU_API_MAC}|${params.cookie?.KUGOU_API_DEV}|${dateNow}`,
    { key: liteT2Key, iv: liteT2Iv }
  );
  const t1 = cryptoAesEncrypt(params.cookie?.t1 ? `${params.cookie?.t1}|${dateNow}` : `|${dateNow}`, { key: liteT1Key, iv: liteT1Iv });

  const dataMap = {
    dfid: params?.cookie?.dfid || '-',
    p3: encrypt,
    plat: 1,
    t1: isLite ? t1 : 0,
    t2: isLite ? t2 : 0,
    t3: 'MCwwLDAsMCwwLDAsMCwwLDA=',
    pk,
    params: encryptParams.str,
    userid,
    clienttime_ms: dateNow,
  };

  if (isLite) {
    dataMap['dev'] = params.cookie?.KUGOU_API_DEV;
  }
  

  return new Promise((resolve, reject) => {
    useAxios({
      baseURL: 'http://login.user.kugou.com',
      url: `/v5/login_by_token`,
      method: 'POST',
      data: dataMap,
      cookie: params?.cookie,
      encryptType: 'android',
    })
      .then((res) => {
        const { body } = res;
        // 服务端可能把 status 返回成字符串 "1"，统一按数字判断
        if (Number(body?.status) === 1 && body?.data && typeof body.data === 'object') {
          if (body.data.secu_params) {
            const getToken = cryptoAesDecrypt(body.data.secu_params, encryptParams.key);
            if (getToken && typeof getToken === 'object') {
              res.body.data = { ...body.data, ...getToken };
            } else if (typeof getToken === 'string' && getToken) {
              // 个别版本只返回新的 token 字符串
              res.body.data['token'] = getToken;
            }
          }

          /*
           * 只落库服务端真正返回的字段。
           *
           * 原实现无条件写入 t1/token/userid/vip_*；刷新响应如果没有这些
           * 字段，就会用 "undefined" / 0 覆盖本地仍然有效的登录态，导致
           * 点一次“刷新登录状态”反而掉登录。刷新成功但 token 不变是正常
           * 情况（服务端只续期），此时不应改动本地凭证。
           */
          const data = res.body.data || {};
          const authKeys = ['t1', 'token', 'userid', 'vip_type', 'vip_token'];
          for (const key of authKeys) {
            const raw = data[key];
            if (raw === undefined || raw === null) continue;
            const value = String(raw).trim();
            if (!value || value === 'undefined' || value === 'null') continue;
            if ((key === 'token' || key === 'userid') && value === '0') continue;
            res.cookie.push(`${key}=${value}`);
          }

          // secu_params 可能还带有 auth/user_type 等后续请求需要的字段
          for (const [key, raw] of Object.entries(data)) {
            if (authKeys.includes(key)) continue;
            if (typeof raw !== 'string' && typeof raw !== 'number') continue;
            const value = String(raw).trim();
            if (!value || value === 'undefined' || value === 'null') continue;
            res.cookie.push(`${key}=${value}`);
          }
        }
        resolve(res);
      })
      .catch((e) => reject(e));
  });
};

