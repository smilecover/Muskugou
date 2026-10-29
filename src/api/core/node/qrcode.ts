/**
 * `qrcode` 兼容导出。
 * 只有 `login_qr_create`（本地生成登录二维码图片）会用到。
 */

import QRCode from 'qrcode';

export const qrcode = {
  toDataURL(text: string, options?: QRCode.QRCodeToDataURLOptions): Promise<string> {
    return QRCode.toDataURL(text, options);
  },
};

export default qrcode;
