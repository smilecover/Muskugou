// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/login_qr_check.js
 * 接口路由：/login/qr/check
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { srcappid, appid } from '../core/compat';

// 酷狗二维码状态检测
// 0 为二维码过期，1 为等待扫码，2 为待确认，4 为授权登录成功（4 状态码下会返回 token）
export default (params: any, useAxios: UseAxios): Promise<any> => {
  return new Promise((resolve, reject) => {
    useAxios({
      baseURL: 'https://login-user.kugou.com',
      url: '/v2/get_userinfo_qrcode',
      method: 'GET',
      params: {
        plat: 4,
        appid,
        srcappid,
        qrcode: params?.key,
        dev: params?.cookie?.KUGOU_API_DEV,
      },
      encryptType: 'web',
      cookie: params?.cookie || {},
    })
      .then((resp) => {
        if (Number(resp.body?.data?.status) === 4) {
          // 扫码成功除了 token/userid，概念版还可能返回 t1、vip_type、
          // vip_token。这些字段后续刷新登录态时要用，必须一起落库。
          const data = resp.body?.data || {};
          for (const key of ['token', 'userid', 't1', 'vip_type', 'vip_token']) {
            const raw = data[key];
            if (raw === undefined || raw === null) continue;
            const value = String(raw).trim();
            if (!value || value === 'undefined' || value === 'null') continue;
            if (key === 'userid' && value === '0') continue;
            resp.cookie.push(`${key}=${value}`);
          }
        }
        resolve(resp);
      })
      .catch((e) => reject(e));
  });
};

