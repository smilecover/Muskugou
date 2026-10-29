// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/login_qr_key.js
 * 接口路由：/login/qr/key
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import { srcappid, appid } from '../core/compat';

// 二维码 key 生成接口
export default (params: any, useAxios: UseAxios): Promise<any> => {
  return useAxios({
    baseURL: 'https://login-user.kugou.com',
    url: '/v2/qrcode',
    method: 'GET',
    params: {
      appid: params?.type === 'web' ? 1014 : 1001,
      type: 1,
      plat: 4,
      qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${appid}&`,
      srcappid,
    },
    encryptType: 'web',
    cookie: params?.cookie || {},
  });
};

