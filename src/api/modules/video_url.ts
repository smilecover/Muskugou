// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/video_url.js
 * 接口路由：/video/url
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取视频urls
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const paramsMap = {
    backupdomain: 1,
    cmd: 123,
    ext: 'mp4',
    ismp3: 0,
    hash: params.hash,
    pid: 1,
    type: 1,
  };

  return useAxios({
    url: '/v2/interface/index',
    method: 'GET',
    params: paramsMap,
    encryptType: 'android',
    encryptKey: true,
    headers: { 'x-router': 'trackermv.kugou.com' },
  });
};

