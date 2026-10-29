// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/login_wx_check.js
 * 接口路由：/login/wx/check
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import axios from '../core/node/axios';

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const answer = { status: 500, body: {}, cookie: [] };
  return new Promise(async (resolve, reject) => {
    try {
      const resp = await axios({ url: `https://long.open.weixin.qq.com/connect/l/qrconnect?f=json&uuid=${params?.uuid || ''}` });

      answer.status = 200;
      answer.body = resp.data;

      resolve(answer);
    } catch (err) {
      answer.status = 502;
      answer.body = { status: 0, msg: err };
      reject(answer);
    }
  });
}

