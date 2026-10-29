// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/top_ip.js
 * 接口路由：/top/ip
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

/**
 *
 * @param {Record<string, any>} params
 * @param {useAxios} useAxios
 * @returns
 */
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = { tags: {} };
  return new Promise((resolve, reject) => {
    useAxios({
      baseURL: 'http://musicadservice.kugou.com',
      url: '/v1/daily_recommend',
      encryptType: 'android',
      method: 'POST',
      data: dataMap,
      params: {
        clientver: 12349,
        area_code: 1,
      },
      cookie: params?.cookie || {},
    })
      .then((resp) => {
        if (resp.body.status == 1) {
          const list = Array.isArray(resp.body.data.list) ? [...resp.body.data.list] : [];
          list.forEach((s, index) => {
            const inner_url = s?.extra?.inner_url;
            if (inner_url) {
              const findIndex = inner_url.lastIndexOf('ip_id');
              if (findIndex !== -1) {
                list[index]['extra']['ip_id'] = Number(inner_url.substring(findIndex + 6));
              }
            }
          });
          resp.body.data.list = list;
        }
        resolve(resp);
      })
      .catch((e) => reject(e));
  });
};

