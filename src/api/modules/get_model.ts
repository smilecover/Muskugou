// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/get_model.js
 * 接口路由：/get/model
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取社区音效

export default (params: any, useAxios: UseAxios): Promise<any> => {
  const dataMap = {
    super_vip: 1,
    sound_ver: 2,
    page: params.page || 1,
    pagesize: params.pagesize || 30,
    apiver: 3,
    classify: '2,3',
    plat: 2,
    privilege: 1,
    sort: params.sort || 2
  };




  return useAxios({
    url: '/ocean/v6/sound/list',
    encryptType: 'android',
    method: 'GET',
    params: dataMap,
    cookie: params?.cookie || {},
  });
};

