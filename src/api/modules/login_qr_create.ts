// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/login_qr_create.js
 * 接口路由：/login/qr/create
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

import qrcode from '../core/node/qrcode';
// 酷狗二维码生成

export default (params: any, useAxios: UseAxios): Promise<any> => {
  return new Promise(async (resolve) => {
    const url = `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${params.key}`
    return resolve({
      code: 200,
      status: 200,
      body: {
        code: 200,
        data: {
          url: url,
          base64: params?.qrimg ? await qrcode.toDataURL(url) : '',
        },
      },
    })
  })
}
