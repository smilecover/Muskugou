/**
 * 登录设备管理。
 *
 * 酷狗网页版通过 `/login/device` 返回当前账号的登录设备，通过
 * `/login/device/kick` 把指定设备踢下线。设备列表在不同版本中字段名不完全一致，
 * 这里做宽松解析，只保留展示与下线所需的字段；下线令牌 `t` 仅保存在内存中，
 * 由设备页直接传给下线接口，不展示、不写入本地存储。
 *
 * 下线接口要求目标设备的 t / mid / appid / clientver；任何一项缺失都拒绝调用，
 * 避免拼出无效请求。
 */

import { getCookieJar, hasLogin } from '../core/jar';
import { callModuleBody } from '../registry';

export interface LoginDevice {
  /** 列表 key：优先使用 mid */
  key: string;
  name: string;
  model: string;
  mid: string;
  appid: string;
  clientver: string;
  /**
   * 目标设备的下线令牌。
   * 只在内存中保存，不写入 localStorage，也不会在页面上展示。
   */
  t: string;
  ip: string;
  /** 已格式化的最近活跃时间；接口没有返回时为空 */
  lastActive: string;
  current: boolean;
  /** 是否具备完整下线参数 */
  canKick: boolean;
}

function pick(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

/** 兼容字符串错误、嵌套错误对象 */
function errorText(value: unknown, depth = 0): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object' || depth >= 3) return '';
  const record = value as Record<string, any>;
  return (
    errorText(record.msg, depth + 1) ||
    errorText(record.errmsg, depth + 1) ||
    errorText(record.message, depth + 1) ||
    errorText(record.error_msg, depth + 1) ||
    errorText(record.error, depth + 1)
  );
}

function bodyMessage(body: any): string {
  return (
    errorText(body?.msg) ||
    errorText(body?.errmsg) ||
    errorText(body?.message) ||
    errorText(body?.error) ||
    errorText(body?.data?.msg) ||
    errorText(body?.data?.message) ||
    errorText(body?.data?.error) ||
    ''
  );
}

/** 业务失败时抛错；没有 status/error_code 的接口按成功处理 */
function ensureSuccess(body: any, action: string): void {
  if (!body || typeof body !== 'object') throw new Error(`${action}返回为空`);
  const rawCode = body?.error_code ?? body?.errcode;
  const code =
    rawCode === undefined || rawCode === null || rawCode === '' ? null : Number(rawCode);
  if (
    body?.status === 0 ||
    body?.status === '0' ||
    body?.success === false ||
    (code !== null && Number.isFinite(code) && code !== 0 && code !== 200)
  ) {
    throw new Error(bodyMessage(body) || `${action}失败`);
  }
}

/** 把 10/13 位时间戳或常见日期字符串格式化为可读时间 */
function timeText(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  let numeric: number | null = null;
  if (typeof value === 'number') numeric = value;
  else if (typeof value === 'string' && /^\d+$/.test(value.trim())) numeric = Number(value.trim());
  else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
    return value.trim().slice(0, 16).replace('T', ' ');
  }

  if (numeric === null || !Number.isFinite(numeric)) return '';
  const milliseconds = numeric < 1e12 ? numeric * 1000 : numeric;
  // 过滤明显的令牌/异常值：不在 2001 年之后或超过一年后的数字不当作时间
  if (milliseconds < 1e12 || milliseconds > Date.now() + 366 * 86_400_000) return '';
  const date = new Date(milliseconds);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function isDeviceLike(record: Record<string, any>): boolean {
  return ['mid', 't_mid', 'dev', 'device_name', 'device_model', 'device_id', 'mid_str'].some(
    (key) => key in record,
  );
}

/** 在未知嵌套层级里寻找“看起来像设备”的对象数组 */
function findDeviceArray(value: unknown, depth = 0): Record<string, any>[] | null {
  if (!value || typeof value !== 'object' || depth > 4) return null;

  if (Array.isArray(value)) {
    const records = value.filter((item): item is Record<string, any> => Boolean(asRecord(item)));
    return records.length && records.every(isDeviceLike) ? records : null;
  }

  const record = value as Record<string, any>;
  for (const key of ['dev_list', 'device_list', 'device', 'devices', 'dev', 'list', 'info', 'data', 'result']) {
    const found = findDeviceArray(record[key], depth + 1);
    if (found) return found;
  }

  // 少数接口返回 { "0": {...}, "1": {...} } 形式
  const values = Object.values(record).filter((item): item is Record<string, any> =>
    Boolean(asRecord(item)),
  );
  return values.length && values.every(isDeviceLike) ? values : null;
}

/** 在常见响应层级中寻找设备数组 */
function deviceList(body: any): Record<string, any>[] {
  const data = body?.data ?? body;
  const candidates = [
    data?.dev_list,
    data?.device_list,
    data?.device,
    data?.list,
    data?.devices,
    data?.info,
    body?.dev_list,
    body?.device_list,
    body?.device,
    body?.list,
    body?.devices,
    Array.isArray(data) ? data : null,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, any> => Boolean(asRecord(item)));
    }
  }

  const nested = findDeviceArray(data);
  if (nested) return nested;

  const single = asRecord(data);
  if (single && ('mid' in single || 'dev' in single || 'device_name' in single)) {
    return [single];
  }

  // 少数接口返回 { "0": {...}, "1": {...} } 形式
  if (single) {
    const values = Object.values(single).filter((item): item is Record<string, any> =>
      Boolean(asRecord(item)),
    );
    if (
      values.length &&
      values.every(
        (item) =>
          'mid' in item ||
          't_mid' in item ||
          'dev' in item ||
          'device_name' in item ||
          'device_model' in item,
      )
    ) {
      return values;
    }
  }

  return [];
}

function normalizeDevice(
  raw: Record<string, any>,
  index: number,
  currentMid: string,
): LoginDevice {
  const mid = text(pick(raw.mid, raw.t_mid, raw.device_mid, raw.device_id, raw.mid_str));
  const appid = text(pick(raw.appid, raw.t_appid, raw.app_id));
  const clientver = text(pick(raw.clientver, raw.t_clientver, raw.client_ver));
  const token = text(pick(raw.t, raw.target_token, raw.device_token));
  const model = text(pick(raw.device_model, raw.model, raw.dev, raw.device_name));
  const name =
    text(pick(raw.dev, raw.device_name, raw.device_model, raw.model, raw.name, raw.nickname)) ||
    `设备 ${index + 1}`;
  const ip = text(pick(raw.ip, raw.last_ip, raw.login_ip, raw.local_ip));
  const lastActive = timeText(
    pick(raw.last_login_time, raw.last_active_time, raw.last_active, raw.logintime, raw.login_time),
  );
  const current =
    raw.is_current === true ||
    raw.is_current === 1 ||
    raw.is_current === '1' ||
    raw.current === true ||
    raw.current === 1 ||
    raw.current === '1' ||
    Boolean(currentMid && mid === currentMid);

  return {
    key: mid || `device-${index}`,
    name,
    model,
    mid,
    appid,
    clientver,
    t: token,
    ip,
    lastActive,
    current,
    canKick: !current && Boolean(token && mid && appid && clientver),
  };
}

/** 当前账号的登录设备列表 */
export async function getLoginDevices(): Promise<LoginDevice[]> {
  if (!hasLogin()) throw new Error('请先登录后再查看登录设备');
  const body = await callModuleBody('/login/device');
  ensureSuccess(body, '获取登录设备');
  const currentMid = text(getCookieJar().KUGOU_API_MID);
  return deviceList(body).map((raw, index) => normalizeDevice(raw, index, currentMid));
}

/**
 * 将指定设备踢下线。
 *
 * 只接受从 `getLoginDevices()` 返回的对象，确保参数来自服务端而不是用户手填。
 * 调用前 UI 必须二次确认。
 */
export async function kickLoginDevice(device: LoginDevice): Promise<string> {
  if (!hasLogin()) throw new Error('登录状态已失效，请重新登录');
  if (!device.t || !device.mid || !device.appid || !device.clientver) {
    throw new Error('该设备缺少下线所需参数，请刷新设备列表后重试');
  }

  const body = await callModuleBody('/login/device/kick', {
    t: device.t,
    t_mid: device.mid,
    t_appid: device.appid,
    t_clientver: device.clientver,
  });
  ensureSuccess(body, '设备下线');
  return (
    text(pick(body?.data?.msg, body?.data?.message, body?.msg, body?.message)) ||
    '已发送下线请求'
  );
}
