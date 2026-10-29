// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/playlist_track_all_new.js
 * 接口路由：/playlist/track/all/new
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

// 获取歌单所有歌曲（v3 已是最新版本，App 云歌单当前使用该端点）
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || '0';
  const token = params?.token || params?.cookie?.token || '0';
  const dataMap = {
    listid: params.listid,
    userid,
    type: Number(params.type || 0),
    page: Number(params.page || 1),
    pagesize: Number(params.pagesize || 300),
    area_code: 1,
    allplatform: 1,
    show_cover: 1,
    // 返回各音质的 relate_goods（含 OGG/320K 无损 hash），否则云歌单只有 128K
    show_relate_goods: 1,
    token,
  };

  return useAxios({
    url: '/v4/get_list_all_file_v3',
    method: 'post',
    encryptType: 'android',
    data: dataMap,
    cookie: params?.cookie || {},
    headers: { 'x-router': 'cloudlist.service.kugou.com' },
  });
};

