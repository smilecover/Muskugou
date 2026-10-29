// @ts-nocheck
/**
 * 自动移植自 src/KuGouMusicApi/module/user_follow_message.js
 * 接口路由：/user/follow/message
 *
 * 本文件由 scripts/port-modules.mjs 从原库机械转换，保留原有实现与注释。
 * 模块层关闭 TypeScript 检查；类型与业务封装维护在 src/api/core 与 App 层。
 */
import type { UseAxios } from '../core/types';

/**
 * 获取私信会话历史
 *
 * 参数：
 *   tag      会话标识，直接指定。官方系统会话（如账号安全小助手）为 mchat:官方uid，
 *            普通会话为 chat:对方uid_自己uid（传 tag 时忽略 id）
 *   id       对方 uid，不传 tag 时按普通会话构造 chat:id_自己
 *   pagesize 每页条数，默认 30
 *   maxid    翻页游标，默认 0（从最新开始）
 */
export default (params: any, useAxios: UseAxios): Promise<any> => {
  const userid = params?.userid || params?.cookie?.userid || '0';
  const tag = params?.tag || `chat:${params.id}_${userid}`;
  if (tag === 'chat:undefined_0') {
    return Promise.reject({ status: 502, body: { status: 0, errcode: -1, error: '需要提供 tag（如 mchat:1270119904）或对方 id' } });
  }

  return useAxios({
    url: '/msg.mobile/v3/msgtag/history',
    encryptType: 'android',
    method: 'GET',
    params: { filter: 1, maxid: params.maxid ?? 0, pagesize: params.pagesize ?? 30, tag },
    cookie: params?.cookie || {},
  });
};

