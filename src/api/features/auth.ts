/**
 * 登录相关功能。
 *
 * 参考库提供 5 种登录方式，这里统一包装成可直接被 UI 调用的函数：
 *   - 酷狗 App 扫码（`client.ts` 中的 createLoginQr / checkLoginQr）
 *   - 手机号 + 短信验证码
 *   - 用户名 + 密码（可能触发安全验证）
 *   - 微信扫码（微信 uuid / wx_code → 酷狗开放平台登录）
 *   - QQ 扫码（QQ 二维码 → openid / access_token → 酷狗开放平台登录）
 *
 * 另外提供 QQ 授权参数直登、刷新登录态、扫码授权其他设备。
 *
 * 安全约定：
 *   - 短信接口只会在用户主动点击“发送验证码”时调用，本模块不做任何自动发送；
 *   - 密码只在调用时进入加密请求，不写入 localStorage；
 *   - 登录成功后的 token 由 `core/jar` 按平台持久化，不会输出到日志。
 */

import qrcode from '../core/node/qrcode';
import { cookieToJson } from '../core/util';
import { getAuth, setCookieObject } from '../core/jar';
import { KuGouApiError, type KuGouResponse } from '../core/types';
import { callModule } from '../registry';
import { ensureDfid } from '../client';

/** 登录方式（与登录页的 Tab 一一对应） */
export type LoginMethod = 'qr' | 'phone' | 'password' | 'wechat' | 'qq';

/** 登录成功后的最小会话信息 */
export interface LoginSession {
  userid: string;
  token: string;
  nickname: string;
  vipType: number;
}

// ---------------------------------------------------------------------------
// 通用解析
// ---------------------------------------------------------------------------

/** 把接口返回的任意错误字段转成可读文本 */
function errorText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      errorText(record.errmsg) ||
      errorText(record.msg) ||
      errorText(record.message) ||
      errorText(record.error)
    );
  }
  return '';
}

/** 酷狗业务错误文案；没有文案时返回空字符串 */
function loginErrorMessage(body: any): string {
  return (
    errorText(body?.msg) ||
    errorText(body?.error) ||
    errorText(body?.error_msg) ||
    errorText(body?.errmsg) ||
    errorText(body?.message) ||
    errorText(body?.data?.msg) ||
    errorText(body?.data?.error) ||
    errorText(body?.data) ||
    ''
  );
}

/** 写入酷狗登录 Cookie，确保 hasLogin() 立即生效 */
function commitSession(data: any, session: LoginSession): void {
  const cookies: Record<string, string> = {
    token: session.token,
    userid: session.userid,
  };
  const t1 = errorText(data?.t1);
  if (t1) cookies.t1 = t1;
  if (data?.vip_type !== undefined && data?.vip_type !== null) {
    cookies.vip_type = String(data.vip_type);
  }
  const vipToken = errorText(data?.vip_token);
  if (vipToken) cookies.vip_token = vipToken;
  setCookieObject(cookies);
}

/**
 * 统一解析酷狗登录响应。
 *
 * 各登录模块都会把 token 放在 `body.data`（个别接口也会放在 body 顶层），
 * 状态码为 1 且 token/userid 都存在才算成功。
 */
function parseLoginResponse(response: KuGouResponse): LoginSession {
  const body = response?.body || {};
  const rawData = body?.data;
  const data = rawData && typeof rawData === 'object' && !Array.isArray(rawData) ? rawData : {};

  if (Number(body?.status) !== 1) {
    throw new Error(loginErrorMessage(body) || '登录失败，请检查账号信息后重试');
  }

  const token = errorText(data?.token) || errorText(body?.token);
  const userid = errorText(data?.userid) || errorText(body?.userid);
  if (!token || !userid || userid === '0') {
    throw new Error(loginErrorMessage(body) || '登录失败：接口未返回有效的登录凭证');
  }

  const session: LoginSession = {
    userid,
    token,
    nickname:
      errorText(data?.nickname) ||
      errorText(data?.username) ||
      errorText(data?.user_name) ||
      '酷狗用户',
    vipType: Number(data?.vip_type ?? data?.vipType ?? 0) || 0,
  };
  commitSession(data, session);
  return session;
}

/**
 * 刷新登录失败的响应 → 可操作的提示。
 *
 * 20017 表示 token 已过期，20018 表示 token 校验失败；两者都只能重新登录，
 * 继续显示“请求失败 (502)”会让用户不知道发生了什么。
 */
function refreshErrorFromBody(body: any): Error {
  const code = Number(body?.error_code ?? body?.errcode);
  if (code === 20017) return new Error('登录状态已过期，请重新登录');
  if (code === 20018) return new Error('登录状态校验未通过，请稍后重试或重新登录');
  if (code === 20028) return new Error('请求触发安全验证，请稍后再试');

  const message = loginErrorMessage(body);
  if (message) return new Error(message);
  return new Error('登录状态刷新失败，请稍后重试');
}

/** 把刷新过程中抛出的异常统一转成 UI 可展示的 Error */
function refreshLoginError(error: unknown): Error {
  if (error instanceof KuGouApiError) return refreshErrorFromBody(error.body);
  if (error instanceof Error && error.message) return error;
  return new Error('登录状态刷新失败，请稍后重试');
}

/** 去掉 +86 / 86 前缀并校验中国大陆手机号 */
export function normalizeMobile(input: string): string {
  let value = String(input || '').replace(/[\s-]/g, '');
  if (value.startsWith('+86')) value = value.slice(3);
  else if (value.startsWith('86') && value.length === 13) value = value.slice(2);
  return /^1[3-9]\d{9}$/.test(value) ? value : '';
}

// ---------------------------------------------------------------------------
// 手机号 + 短信验证码
// ---------------------------------------------------------------------------

/**
 * 发送短信验证码。
 *
 * 只应由用户点击“发送验证码”触发；调用前会严格校验手机号，
 * 避免把请求发到无效号码。
 */
export async function sendSmsCode(mobile: string): Promise<string> {
  const normalized = normalizeMobile(mobile);
  if (!normalized) throw new Error('请输入正确的 11 位手机号');

  const response = await callModule('/captcha/sent', { mobile: normalized });
  const body = response?.body || {};
  const ok =
    Number(body?.status) === 1 ||
    Number(body?.error_code) === 0 ||
    Number(body?.errcode) === 0;
  if (!ok) {
    throw new Error(loginErrorMessage(body) || '验证码发送失败，请稍后重试');
  }
  return loginErrorMessage(body) || '验证码已发送，请查收短信';
}

/** 手机号 + 验证码登录；多账号时传入 userid */
export async function loginBySms(mobile: string, code: string, userid?: string): Promise<LoginSession> {
  const normalized = normalizeMobile(mobile);
  if (!normalized) throw new Error('请输入正确的 11 位手机号');
  const smsCode = String(code || '').trim();
  if (!/^\d{4,6}$/.test(smsCode)) throw new Error('请输入短信验证码');

  const params: Record<string, string> = { mobile: normalized, code: smsCode };
  const uid = String(userid || '').trim();
  if (uid) params.userid = uid;

  const response = await callModule('/login/cellphone', params);
  return parseLoginResponse(response);
}

// ---------------------------------------------------------------------------
// 用户名 + 密码
// ---------------------------------------------------------------------------

/**
 * 用户名 / 密码登录。
 *
 * 参考库提示该方式可能触发安全验证，因此 `code` 作为可选验证码透传。
 * 密码不会写入本地存储。
 */
export async function loginByPassword(
  username: string,
  password: string,
  code?: string,
): Promise<LoginSession> {
  const account = String(username || '').trim();
  if (!account) throw new Error('请输入酷狗账号');
  if (!password) throw new Error('请输入密码');

  const params: Record<string, string> = { username: account, password };
  const verifyCode = String(code || '').trim();
  if (verifyCode) params.code = verifyCode;

  const response = await callModule('/login', params);
  return parseLoginResponse(response);
}

// ---------------------------------------------------------------------------
// 微信扫码
// ---------------------------------------------------------------------------

export interface WxQrSession {
  uuid: string;
  /** 微信确认页地址，也是二维码内容 */
  url: string;
  /** 本地渲染的二维码 data URL */
  image: string;
}

export interface WxQrStatus {
  /** 408 等待扫码 / 404 已扫码 / 403 拒绝 / 405 成功 / 402 过期 */
  status: number;
  message: string;
  /** 405 时返回，用于 /login/openplat */
  wxCode?: string;
}

/** 生成微信扫码登录二维码 */
export async function createWxLoginQr(): Promise<WxQrSession> {
  const response = await callModule('/login/wx/create');
  const data = response?.body || {};
  const uuid = errorText(data?.uuid);
  const url = errorText(data?.qrcode?.qrcodeurl) || errorText(data?.qrcodeurl);

  if (!uuid || !url) {
    throw new Error(loginErrorMessage(data) || '微信登录二维码生成失败');
  }

  const image = await qrcode.toDataURL(url, {
    margin: 1,
    width: 360,
    color: { dark: '#000000', light: '#ffffff' },
  });
  return { uuid, url, image };
}

/** 轮询微信扫码状态（微信长轮询接口） */
export async function checkWxLoginQr(uuid: string): Promise<WxQrStatus> {
  if (!uuid) throw new Error('微信登录会话已失效，请刷新二维码');
  const response = await callModule('/login/wx/check', { uuid, timestamp: Date.now() });
  const data = response?.body || {};
  const status = Number(data?.wx_errcode ?? data?.errcode ?? -1);
  const messages: Record<number, string> = {
    408: '请使用微信扫码',
    404: '已扫码，请在微信中确认登录',
    403: '已拒绝登录',
    405: '微信授权成功，正在登录…',
    402: '二维码已过期，请刷新',
  };
  return {
    status,
    message: errorText(data?.wx_errmsg) || errorText(data?.errmsg) || messages[status] || '等待微信扫码',
    wxCode: errorText(data?.wx_code) || undefined,
  };
}

/** 微信扫码确认后，用 wx_code 换取酷狗登录态 */
export async function loginByWxCode(code: string): Promise<LoginSession> {
  const wxCode = String(code || '').trim();
  if (!wxCode) throw new Error('微信授权码为空，请刷新二维码重试');
  const response = await callModule('/login/openplat', { code: wxCode });
  return parseLoginResponse(response);
}

// ---------------------------------------------------------------------------
// QQ 扫码 / QQ 授权参数
// ---------------------------------------------------------------------------

export interface QqQrSession {
  /** data:image/png;base64,... */
  image: string;
  qrsig: string;
  ptqrtoken: string;
  ptLoginSig: string;
  ptOpenloginData: string;
  xloginUrl: string;
  /** QQ 会话 Cookie 字符串，轮询时必须原样带回 */
  cookie: string;
}

export type QqQrState = 'wait' | 'scanned' | 'expired' | 'success';

export interface QqQrStatus {
  status: QqQrState;
  message: string;
  session?: LoginSession;
}

/** 生成 QQ 扫码登录二维码 */
export async function createQqLoginQr(): Promise<QqQrSession> {
  const response = await callModule('/login/qq/qr/create');
  const data = response?.body || {};
  const rawImage = errorText(data?.qrcode);
  if (!rawImage) {
    throw new Error(loginErrorMessage(data) || 'QQ 登录二维码生成失败');
  }

  return {
    image: rawImage.startsWith('data:image/') ? rawImage : `data:image/png;base64,${rawImage}`,
    qrsig: errorText(data?.qrsig),
    ptqrtoken: errorText(data?.ptqrtoken),
    ptLoginSig: errorText(data?.pt_login_sig),
    ptOpenloginData: errorText(data?.pt_openlogin_data),
    xloginUrl: errorText(data?.xlogin_url),
    cookie: errorText(data?.cookie),
  };
}

/**
 * 轮询 QQ 扫码状态。
 *
 * 扫码成功后模块内部会用 openid / access_token 完成酷狗登录，
 * Cookie 也由注册表自动持久化，因此这里只负责返回状态。
 */
export async function checkQqLoginQr(session: QqQrSession): Promise<QqQrStatus> {
  const response = await callModule('/login/qq/qr/check', {
    timestamp: Date.now(),
    qrsig: session.qrsig,
    ptqrtoken: session.ptqrtoken,
    pt_login_sig: session.ptLoginSig,
    pt_openlogin_data: session.ptOpenloginData,
    xlogin_url: session.xloginUrl,
    // 注册表会与酷狗 Cookie 合并；QQ 会话字段以对象形式传入
    cookie: cookieToJson(session.cookie),
  });
  const body = response?.body || {};
  const rawStatus = body?.status;

  // 扫码中 / 已扫码 / 已过期由模块直接返回字符串状态
  if (typeof rawStatus === 'string') {
    if (rawStatus === 'wait' || rawStatus === '66') {
      return { status: 'wait', message: errorText(body?.msg) || '请使用手机 QQ 扫码' };
    }
    if (rawStatus === 'expired' || rawStatus === '65') {
      return { status: 'expired', message: errorText(body?.msg) || '二维码已失效，请刷新' };
    }
    if (rawStatus === '67') {
      return { status: 'scanned', message: errorText(body?.msg) || '已扫码，请在手机 QQ 中确认' };
    }
    // 其它 QQ 状态码（取消、风控等）：停止轮询，由用户刷新二维码
    return { status: 'expired', message: errorText(body?.msg) || `QQ 扫码状态异常（${rawStatus}），请刷新` };
  }

  // 数值状态来自扫码成功后的酷狗登录响应；失败时 parseLoginResponse 会抛错
  return {
    status: 'success',
    message: '登录成功',
    session: parseLoginResponse(response),
  };
}

/** QQ 开放平台参数直接登录（已有 openid / access_token 时使用） */
export async function loginByQq(openid: string, accessToken: string): Promise<LoginSession> {
  const id = String(openid || '').trim();
  const token = String(accessToken || '').trim();
  if (!id || !token) throw new Error('请输入 QQ 的 openid 和 access_token');
  const response = await callModule('/login/qq', { openid: id, access_token: token });
  return parseLoginResponse(response);
}

// ---------------------------------------------------------------------------
// 其它登录相关接口
// ---------------------------------------------------------------------------

/**
 * 刷新登录态（延长 token 有效期）。
 *
 * 与普通登录不同，刷新成功时服务端可能：
 *   1. 在 `secu_params` 中返回新的 token；
 *   2. 只续期而不改变 token，响应体里没有 token/userid。
 * 因此不能复用登录页的严格解析（它要求响应体必须带凭证）。
 * 只要服务端确认成功且本地原本已登录，就沿用当前登录态。
 */
export async function refreshLogin(): Promise<LoginSession> {
  const before = getAuth();
  if (!before.token || !before.userid || before.userid === '0') {
    throw new Error('当前未登录或登录凭证已失效，请重新登录');
  }

  // 刷新接口会用 dfid + 设备标识校验登录态；dfid 缺失时先静默补注册
  await ensureDfid().catch(() => null);

  let response: KuGouResponse;
  try {
    response = await callModule('/login/token', {
      token: before.token,
      userid: before.userid,
    });
  } catch (error) {
    throw refreshLoginError(error);
  }

  const body = response?.body || {};
  const rawData = body?.data;
  const data = rawData && typeof rawData === 'object' && !Array.isArray(rawData) ? rawData : {};

  if (Number(body?.status) !== 1) {
    throw refreshErrorFromBody(body);
  }

  // 响应没有新凭证时沿用当前值：刷新主要是延长有效期，token 通常不变。
  // 取调用后的最新 Cookie，兼容服务端只用 Set-Cookie 返回新 token 的情况。
  const latest = getAuth();
  const token = errorText(data?.token) || errorText(body?.token) || latest.token || before.token;
  const userid = errorText(data?.userid) || errorText(body?.userid) || latest.userid || before.userid;
  if (!token || token === '0' || !userid || userid === '0') {
    throw new Error('登录状态刷新失败：接口未返回有效凭证，请重新登录');
  }

  const session: LoginSession = {
    userid,
    token,
    nickname:
      errorText(data?.nickname) ||
      errorText(data?.username) ||
      errorText(data?.user_name) ||
      '酷狗用户',
    vipType: Number(data?.vip_type ?? data?.vipType ?? 0) || 0,
  };
  commitSession(data, session);
  return session;
}

/** 使用当前账号授权另一台设备的二维码登录 */
export async function authorizeQrLogin(qrcodeKey: string): Promise<{ authorized: boolean; userid: string }> {
  const key = String(qrcodeKey || '').trim();
  if (!/^[\w-]+$/.test(key)) throw new Error('二维码 key 格式不正确');

  const response = await callModule('/login/qr/authorize', { qrcode: key });
  const data = response?.body?.data || {};
  if (!data?.authorized) {
    throw new Error(loginErrorMessage(response?.body) || '授权失败，请确认二维码仍然有效');
  }
  return { authorized: true, userid: errorText(data?.userid) };
}
