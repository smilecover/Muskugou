// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/server_now.js
 * 接口路由：/server/now
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取服务器时间
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || 0;
  const token = params?.token || params?.cookie?.token || '';

  return useAxios({
    url: '/v1/server_now',
    data: { token, userid },
    encryptType: 'android',
    method: 'POST',
    params: { plat: 3 },
    cookie: params?.cookie || {},
    headers: { 'x-router': 'usercenter.kugou.com' },
  });
};

