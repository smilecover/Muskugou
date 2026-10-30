import { getCookieJar, setCookieStrings } from '../src/api/core/jar';
import { createRequest } from '../src/api/core/request';
import type { KuGouResponse, UseAxios } from '../src/api/core/types';
import login from '../src/api/modules/login';
import getVerifyInfo from '../src/api/modules/get_verify_info';

async function call(handler: any, params: Record<string, any> = {}): Promise<KuGouResponse> {
  const response = await handler(
    { ...params, cookie: { ...getCookieJar(), ...(params.cookie || {}) } },
    createRequest as UseAxios
  );
  if (Array.isArray(response?.cookie) && response.cookie.length) setCookieStrings(response.cookie);
  return response;
}

async function main() {
  let ssaCode = '';
  try {
    await call(login, { username: 'not-a-real-user-xyz', password: 'not-a-real-password' });
  } catch (e: any) {
    ssaCode = e?.body?.ssaCode || '';
    console.log('SSA', ssaCode);
  }
  for (const eventid of [ssaCode, ssaCode.replace(/^gz_tx_event_/, '')]) {
    try {
      const r = await call(getVerifyInfo, { eventid, userid: getCookieJar().userid, platid: 2 });
      console.log('VERIFY INFO', eventid.slice(0, 20), JSON.stringify(r.body).slice(0, 1500));
    } catch (e: any) {
      console.log('VERIFY INFO FAIL', eventid.slice(0, 20), JSON.stringify(e?.body ?? e?.message ?? String(e)).slice(0, 1000));
    }
  }
}

main();
