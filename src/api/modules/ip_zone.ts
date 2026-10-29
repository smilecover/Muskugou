// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/ip_zone.js
 * 接口路由：/ip/zone
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// ip 专区
export default (params: any, useAxios: UseAxios): Promise<any> => {
  return new Promise((resolve, reject) => {
    useAxios({
      url: `/v1/zone/index`,
      encryptType: 'android',
      method: 'GET',
      cookie: params?.cookie || {},
      headers: { 'x-router': 'yuekucategory.kugou.com' },
    })
      .then((resp) => {
        if (resp.body.status == 1) {
          if (resp.body.data?.list) {
            const list = Array.isArray(resp.body.data.list) ? resp.body.data?.list : [];
            for (let index = 0; index < list.length; index += 1) {
              if (list[index].special_link) {
                const urls = new URLSearchParams(list[index].special_link);
                if (urls.has('path')) {
                  const pathUrls = new URLSearchParams(urls.get('path') || '');
                  list[index]['ip_id'] = Number(pathUrls.get('ip_id') || '');
                }
              }
            }
            resp.body.data.list = list;
          }
        }
        resolve(resp);
      })
      .catch((e) => reject(e));
  });
};

