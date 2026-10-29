<script setup lang="ts">
/**
 * 接口中心。
 *
 * 协议层的 234 个路由都注册在 `registry.ts` 中；这个页面把目录里没有专属
 * 业务页面的接口也暴露出来：按分组浏览、搜索、填写参数并直接调用。
 *
 * 设计约束：
 * - 登录 / 短信 / 二维码等接口由登录页托管，不在调试页重复提供，避免误发短信；
 * - 会修改账号数据的接口需要二次确认；
 * - 响应中的 token / cookie / 密码等字段在前端脱敏后再展示；
 * - 不允许在“额外参数”里手动传 cookie / token，登录态由客户端自动注入。
 */

import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  AlertTriangle,
  Braces,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Copy,
  Loader2,
  LockKeyhole,
  Play,
  Search,
  ShieldAlert,
  X,
} from 'lucide-vue-next';
import DetailHeader from '@/components/DetailHeader.vue';
import { callModule, toErrorMessage } from '@/api';
import {
  ROUTE_CATALOG,
  ROUTE_GROUPS,
  type RouteGroupId,
  type RouteInfo,
} from '@/api/route-catalog';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';

defineOptions({ name: 'ApiCenterView' });

const router = useRouter();
const user = useUserStore();
const toast = useToastStore();

/** 这些接口有专门的登录流程 / 页面，避免在调试页误触发短信或写入登录态 */
const MANAGED_ROUTES = new Set([
  '/captcha/sent',
  '/login',
  '/login/cellphone',
  '/login/openplat',
  '/login/qq',
  '/login/qq/qr/check',
  '/login/qq/qr/create',
  '/login/qr/authorize',
  '/login/qr/check',
  '/login/qr/create',
  '/login/qr/key',
  '/login/token',
  '/login/wx/check',
  '/login/wx/create',
  '/register/dev',
]);

const routes = ROUTE_CATALOG.filter((route) => !MANAGED_ROUTES.has(route.route));
const managedCount = ROUTE_CATALOG.length - routes.length;

const groupOptions: { id: 'all' | RouteGroupId; label: string }[] = [
  { id: 'all', label: '全部' },
  ...ROUTE_GROUPS.filter((group) => routes.some((route) => route.group === group.id)).map(
    (group) => ({ id: group.id, label: group.label }),
  ),
];
const groupLabels = new Map(ROUTE_GROUPS.map((group) => [group.id, group.label]));

const keyword = ref('');
const group = ref<'all' | RouteGroupId>('all');
const visibleLimit = ref(60);

const filtered = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return routes.filter((route) => {
    if (group.value !== 'all' && route.group !== group.value) return false;
    if (!query) return true;
    return (
      route.route.toLowerCase().includes(query) ||
      route.label.toLowerCase().includes(query) ||
      route.summary.toLowerCase().includes(query)
    );
  });
});
const visible = computed(() => filtered.value.slice(0, visibleLimit.value));
const hasMore = computed(() => visible.value.length < filtered.value.length);

watch([keyword, group], () => {
  visibleLimit.value = 60;
});

// ---------------------------------------------------------------------------
// 调用弹层
// ---------------------------------------------------------------------------

interface ApiResult {
  success: boolean;
  status: number;
  elapsed: number;
  text: string;
  error: string;
}

const selected = ref<RouteInfo | null>(null);
const formValues = reactive<Record<string, string>>({});
const extraJson = ref('');
const paramsError = ref('');
const confirming = ref(false);
const running = ref(false);
const result = ref<ApiResult | null>(null);
const resultEl = ref<HTMLElement | null>(null);

let requestToken = 0;

// 修改参数后需要重新确认写入类接口，避免确认后悄悄换掉请求内容
watch([formValues, extraJson], () => {
  confirming.value = false;
}, { deep: true });

const isDeviceRoute = computed(
  () => selected.value?.route === '/login/device' || selected.value?.route === '/login/device/kick',
);

const PARAM_LABELS: Record<string, string> = {
  keywords: '关键词',
  keyword: '关键词',
  page: '页码',
  pagesize: '每页数量',
  id: 'ID',
  hash: '文件 Hash',
  album_id: '专辑 ID',
  album_audio_id: '歌曲 ID',
  rankid: '榜单 ID',
  userid: '用户 ID',
  type: '类型',
  label: '标签',
  source: '来源',
  quality: '音质',
  free_part: '试听片段',
  mixsongid: '歌曲 ID',
  fileid: '文件 ID',
  kv_id: '文件 KV ID',
  mid: '设备 MID',
  uuid: '设备 UUID',
  mobile: '手机号',
  code: '验证码',
  username: '用户名',
  password: '密码',
  position: '位置',
  tid: '标签 ID',
  tagid: '标签 ID',
  sort: '排序',
  word: '搜索词',
  query: '搜索词',
  duration: '时长',
  singerid: '歌手 ID',
  author_id: '作者 ID',
  album_audio_ids: '歌曲 ID 列表',
  mixsongids: '歌曲 ID 列表',
  data: '数据',
  items: '条目 JSON',
  file: '文件',
  filename: '文件名',
  img: '图片数据',
  imgFile: '图片文件',
};

const PLACEHOLDERS: Record<string, string> = {
  page: '1',
  pagesize: '20',
  quality: '128',
  label: 'song / singer',
  free_part: 'true / false',
  keywords: '周杰伦',
  keyword: '关键词',
  id: '数字 ID',
  hash: '文件 Hash',
  album_id: '专辑 ID',
  album_audio_id: '歌曲 ID',
  rankid: '榜单 ID',
  userid: '用户 ID',
  type: '数字或字符串',
  source: '3 / 4',
  data: 'JSON 或原始字符串',
  items: '[{"k":"...","v":"..."}]',
  mobile: '11 位手机号',
};

const MULTILINE_FIELDS = new Set([
  'items',
  'data',
  'params',
  'extra',
  'body',
  'labels',
  'tracks',
  'songs',
  'devices',
  'list',
  'file',
  'filename',
  'img',
  'imgFile',
]);

const JSON_FIELDS = new Set(['items', 'params', 'extra', 'body', 'labels', 'tracks', 'songs', 'devices', 'list']);
const NUMERIC_FIELDS = new Set(['page', 'pagesize']);
const BLOCKED_KEYS = new Set([
  'cookie',
  'token',
  'authorization',
  'password',
  'passwd',
  'access_token',
  'refresh_token',
]);

function paramLabel(name: string): string {
  return PARAM_LABELS[name] || name;
}

function inputType(name: string): string {
  return NUMERIC_FIELDS.has(name) ? 'number' : 'text';
}

function defaultParam(name: string): string {
  if (name === 'page') return '1';
  if (name === 'pagesize') return '20';
  if (name === 'quality') return '128';
  if (name === 'label') return 'song';
  return '';
}

function openRoute(route: RouteInfo): void {
  requestToken += 1;
  for (const key of Object.keys(formValues)) delete formValues[key];
  for (const param of route.params) formValues[param] = defaultParam(param);
  extraJson.value = '';
  paramsError.value = '';
  confirming.value = false;
  running.value = false;
  result.value = null;
  selected.value = route;
}

function closeSheet(): void {
  requestToken += 1;
  selected.value = null;
  running.value = false;
  confirming.value = false;
  result.value = null;
  paramsError.value = '';
}

/** 把 “{} / [] / true / false / 数字” 转成合理类型 */
function parseField(name: string, raw: string): unknown {
  const value = raw.trim();
  if (!value) return undefined;
  if (JSON_FIELDS.has(name) || value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch {
      if (JSON_FIELDS.has(name)) throw new Error(`参数“${paramLabel(name)}”不是合法 JSON`);
      return value;
    }
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (NUMERIC_FIELDS.has(name) && /^-?\d+$/.test(value)) return Number(value);
  return value;
}

function buildParams(): Record<string, any> {
  const params: Record<string, any> = {};
  for (const name of selected.value?.params || []) {
    const value = parseField(name, formValues[name] || '');
    if (value !== undefined) params[name] = value;
  }

  if (extraJson.value.trim()) {
    let extra: unknown;
    try {
      extra = JSON.parse(extraJson.value);
    } catch {
      throw new Error('额外参数不是合法 JSON');
    }
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
      throw new Error('额外参数必须是 JSON 对象');
    }
    for (const [key, value] of Object.entries(extra)) {
      if (BLOCKED_KEYS.has(key.toLowerCase())) {
        throw new Error(`参数 ${key} 由客户端自动管理，不能手动传入`);
      }
      params[key] = value;
    }
  }

  return params;
}

function isBusinessError(body: any): boolean {
  if (!body || typeof body !== 'object') return false;
  if (body.status === 0 || body.status === '0' || body.success === false) return true;
  const rawCode = body.error_code ?? body.errcode;
  if (rawCode === undefined || rawCode === null || rawCode === '') return false;
  const code = Number(rawCode);
  return Number.isFinite(code) && code !== 0 && code !== 200;
}

function businessErrorText(body: any): string {
  const message = toErrorMessage({ body });
  if (message !== '网络请求失败，请检查网络后重试') return message;
  const code = body?.error_code ?? body?.errcode;
  return code !== undefined ? `接口返回业务错误（${code}）` : '接口返回业务错误';
}

const SENSITIVE_KEY = /(token|secret|password|passwd|authorization|cookie|dfid|signature|access_token|refresh_token)/i;

/** 设备列表里的 `t` 是下线令牌，单独按精确键名脱敏 */
function isSensitiveKey(key: string): boolean {
  return key.toLowerCase() === 't' || SENSITIVE_KEY.test(key);
}

/** 响应展示前的脱敏与截断 */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return '…';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = isSensitiveKey(key) ? '***' : redact(child, depth + 1);
    }
    return output;
  }
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) return `[图片数据 ${value.length} 字符]`;
    if (value.length > 1500) return `${value.slice(0, 1500)}…（共 ${value.length} 字符）`;
    return value;
  }
  return value;
}

function formatBody(body: unknown): string {
  if (body === undefined || body === null) return '（空响应）';
  try {
    const text = typeof body === 'string' ? body : JSON.stringify(redact(body), null, 2) ?? String(body);
    if (text.length > 20_000) return `${text.slice(0, 20_000)}\n…（已截断）`;
    return text;
  } catch {
    return String(body);
  }
}

async function invoke(): Promise<void> {
  if (!selected.value || running.value) return;

  // 先校验参数；修改类接口校验通过后第一次点击只进入确认态
  let params: Record<string, any>;
  try {
    params = buildParams();
  } catch (error) {
    paramsError.value = toErrorMessage(error);
    confirming.value = false;
    return;
  }

  if (selected.value.write && !confirming.value) {
    confirming.value = true;
    paramsError.value = '';
    return;
  }

  confirming.value = false;
  paramsError.value = '';
  running.value = true;
  result.value = null;
  const token = requestToken;
  const started = performance.now();

  try {
    const response = await callModule(selected.value.route, params);
    if (token !== requestToken) return;
    const businessError = isBusinessError(response.body);
    result.value = {
      success: !businessError,
      status: response.status,
      elapsed: Math.round(performance.now() - started),
      text: formatBody(response.body),
      error: businessError ? businessErrorText(response.body) : '',
    };
  } catch (error) {
    if (token !== requestToken) return;
    const anyError = error as any;
    result.value = {
      success: false,
      status: Number(anyError?.status) || 0,
      elapsed: Math.round(performance.now() - started),
      text: formatBody(anyError?.body),
      error: toErrorMessage(error),
    };
  } finally {
    if (token === requestToken) running.value = false;
  }

  await nextTick();
  resultEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function copyResult(): Promise<void> {
  if (!result.value) return;
  const text = result.value.error
    ? `${result.value.error}\n\n${result.value.text}`
    : result.value.text;
  try {
    await navigator.clipboard.writeText(text);
    toast.success('响应已复制');
  } catch {
    // WebView 没有剪贴板权限时回退到临时 textarea
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    toast.success('响应已复制');
  }
}
</script>

<template>
  <div class="page api-page">
    <DetailHeader title="接口中心" />

    <div class="api-body">
      <!-- 说明与登录状态 -->
      <section class="api-intro">
        <span class="api-intro__icon"><Braces :size="20" /></span>
        <div class="api-intro__text">
          <p>协议接口实验室</p>
          <span>
            {{ routes.length }} 个可调用路由 · 登录 / 短信等 {{ managedCount }} 个接口由登录流程或客户端托管
          </span>
        </div>
        <button
          v-if="!user.loggedIn"
          class="api-intro__action"
          @click="router.push('/login')"
        >
          去登录
        </button>
      </section>

      <div class="api-tip">
        <ShieldAlert :size="14" />
        <p>
          这里直接调用酷狗协议层。会修改账号数据的接口需要二次确认；
          响应中的 token、cookie、密码等字段会自动隐藏。
        </p>
      </div>

      <!-- 搜索 -->
      <div class="api-search">
        <Search :size="16" />
        <input
          v-model="keyword"
          type="search"
          placeholder="搜索接口名称或路由，如 song/url"
          autocomplete="off"
          spellcheck="false"
        />
        <button v-if="keyword" class="api-search__clear" aria-label="清空" @click="keyword = ''">
          <X :size="15" />
        </button>
      </div>

      <!-- 分组 -->
      <div class="chip-row api-groups">
        <button
          v-for="option in groupOptions"
          :key="option.id"
          class="chip"
          :class="{ 'chip--active': group === option.id }"
          @click="group = option.id"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="api-stats">
        <span>{{ filtered.length }} 个接口</span>
        <span v-if="!user.loggedIn" class="api-stats__warn">
          <LockKeyhole :size="11" />
          未登录时账号接口会失败
        </span>
      </div>

      <!-- 接口列表 -->
      <div class="api-list">
        <button
          v-for="route in visible"
          :key="route.route"
          class="api-row"
          @click="openRoute(route)"
        >
          <span class="api-row__icon"><Braces :size="15" /></span>
          <span class="api-row__main">
            <span class="api-row__title">
              <span class="ellipsis">{{ route.label }}</span>
              <span v-if="group === 'all'" class="api-row__group">
                {{ groupLabels.get(route.group) }}
              </span>
            </span>
            <code class="api-row__route ellipsis">{{ route.route }}</code>
            <span v-if="route.summary" class="api-row__desc ellipsis">{{ route.summary }}</span>
          </span>
          <span class="api-row__badges">
            <span v-if="route.write" class="api-badge api-badge--write">修改</span>
            <span v-else-if="route.auth" class="api-badge">需登录</span>
          </span>
          <ChevronRight :size="16" class="muted" />
        </button>

        <div v-if="!filtered.length" class="empty-state api-empty">
          <span class="empty-state__icon"><CircleAlert :size="22" /></span>
          <p class="empty-state__title">没有匹配的接口</p>
          <p class="empty-state__desc">换个关键词或分组试试</p>
        </div>

        <button v-if="hasMore" class="api-more" @click="visibleLimit += 60">
          加载更多（剩余 {{ filtered.length - visible.length }} 个）
        </button>
      </div>
    </div>

    <!-- 调用弹层 -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="selected" class="api-sheet-root">
          <div class="sheet-mask" @click="closeSheet" />

          <section class="sheet api-sheet">
            <div class="sheet__handle" />

            <header class="api-sheet__head">
              <div class="api-sheet__heading">
                <h2 class="sheet__title">{{ selected.label }}</h2>
                <code class="api-sheet__route">{{ selected.route }}</code>
              </div>
              <button class="icon-btn icon-btn--ghost" aria-label="关闭" @click="closeSheet">
                <X :size="20" />
              </button>
            </header>

            <div class="api-sheet__scroll">
              <p v-if="selected.summary" class="api-sheet__summary">{{ selected.summary }}</p>

              <div class="api-sheet__badges">
                <span v-if="selected.write" class="api-badge api-badge--write">
                  <AlertTriangle :size="10" />
                  修改账号数据
                </span>
                <span v-else-if="selected.auth" class="api-badge">
                  <LockKeyhole :size="10" />
                  通常需要登录
                </span>
                <span class="api-badge api-badge--plain">{{ selected.params.length }} 个已知参数</span>
              </div>

              <div v-if="selected.write" class="api-warning">
                <AlertTriangle :size="15" />
                <p>
                  该接口可能修改账号数据。第一次点击“调用接口”只会进入确认状态，
                  再次点击“确认调用”才会真正发送请求。
                </p>
              </div>

              <div v-if="isDeviceRoute" class="api-device-link">
                <p>设备列表与下线有专门的可视化页面，参数会自动从服务端读取。</p>
                <button class="text-btn" @click="router.push('/devices')">前往登录设备管理</button>
              </div>

              <!-- 参数表单 -->
              <div class="api-form">
                <label v-for="param in selected.params" :key="param" class="api-field">
                  <span class="api-field__label">
                    {{ paramLabel(param) }}
                    <code>{{ param }}</code>
                  </span>
                  <textarea
                    v-if="MULTILINE_FIELDS.has(param)"
                    v-model="formValues[param]"
                    rows="3"
                    :placeholder="PLACEHOLDERS[param] || '可选'"
                    spellcheck="false"
                  />
                  <input
                    v-else
                    v-model="formValues[param]"
                    :type="inputType(param)"
                    :placeholder="PLACEHOLDERS[param] || '可选'"
                    autocomplete="off"
                    spellcheck="false"
                  />
                </label>

                <p v-if="!selected.params.length" class="api-hint">
                  该接口没有可自动识别的参数，可在下方“额外参数”中填写 JSON。
                </p>
              </div>

              <details class="api-extra" :open="!selected.params.length">
                <summary>额外参数（JSON）</summary>
                <textarea
                  v-model="extraJson"
                  rows="4"
                  placeholder='{"foo":"bar"}'
                  spellcheck="false"
                />
                <p class="api-hint">
                  登录 Cookie 由客户端自动注入；cookie / token / password 不允许手动传入。
                </p>
              </details>

              <p v-if="paramsError" class="api-error">
                <CircleAlert :size="14" />
                {{ paramsError }}
              </p>

              <p v-if="confirming" class="api-confirm">
                再次点击下方按钮确认调用，或
                <button class="text-btn text-btn--muted" @click="confirming = false">取消</button>
              </p>

              <div class="api-actions">
                <button
                  class="btn btn--primary btn--block"
                  :disabled="running"
                  @click="invoke"
                >
                  <Loader2 v-if="running" :size="16" class="spin-icon" />
                  <Play v-else :size="15" />
                  {{ running ? '调用中…' : confirming ? '确认调用' : '调用接口' }}
                </button>
              </div>

              <!-- 响应 -->
              <div
                v-if="result"
                ref="resultEl"
                class="api-result"
                :class="{ 'api-result--error': !result.success }"
              >
                <div class="api-result__head">
                  <span class="api-result__status">
                    <CircleCheck v-if="result.success" :size="14" />
                    <CircleAlert v-else :size="14" />
                    {{ result.status ? `HTTP ${result.status}` : '请求失败' }}
                    · {{ result.elapsed }}ms
                  </span>
                  <button class="api-result__copy" @click="copyResult">
                    <Copy :size="13" />
                    复制
                  </button>
                </div>
                <p v-if="result.error" class="api-result__error">{{ result.error }}</p>
                <pre class="api-result__body">{{ result.text }}</pre>
              </div>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.api-page {
  padding-bottom: calc(30px + var(--safe-bottom));
}

.api-body {
  padding: 4px 16px 0;
}

.api-intro {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 14px;
  border: 1px solid rgba(56, 225, 198, 0.18);
  border-radius: 18px;
  background:
    radial-gradient(130% 180% at 100% 0%, rgba(56, 225, 198, 0.12), transparent 58%),
    rgba(255, 255, 255, 0.025);
}

.api-intro__icon {
  display: grid;
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 13px;
  color: var(--accent);
  background: var(--accent-soft);
}

.api-intro__text {
  flex: 1;
  min-width: 0;
}

.api-intro__text p {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
}

.api-intro__text span {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.45;
}

.api-intro__action {
  flex: 0 0 auto;
  padding: 5px 10px;
  border-radius: 999px;
  color: var(--accent);
  font-size: 10.5px;
  font-weight: 650;
  background: var(--accent-soft);
}

.api-tip {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 10px;
  padding: 0 4px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.55;
}

.api-tip svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--warning);
}

.api-tip p {
  margin: 0;
}

.api-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.035);
}

.api-search:focus-within {
  border-color: rgba(56, 225, 198, 0.34);
  background: rgba(56, 225, 198, 0.035);
}

.api-search > svg {
  flex: 0 0 auto;
  color: var(--muted);
}

.api-search input {
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0;
  border: 0;
  outline: none;
  color: var(--text);
  font-size: 12.5px;
  background: transparent;
}

.api-search input::placeholder {
  color: rgba(255, 255, 255, 0.28);
}

.api-search__clear {
  display: grid;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.06);
}

.api-groups {
  flex-wrap: nowrap;
  gap: 7px;
  margin-top: 12px;
  padding: 0 0 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.api-groups::-webkit-scrollbar {
  display: none;
}

.api-groups .chip {
  flex: 0 0 auto;
  padding: 5px 10px;
  font-size: 10.5px;
}

.api-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 3px 7px;
  color: var(--muted);
  font-size: 10px;
}

.api-stats__warn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--warning);
}

.api-list {
  padding-bottom: 10px;
}

.api-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 10px 8px;
  border-radius: 13px;
  text-align: left;
}

.api-row:active {
  background: rgba(255, 255, 255, 0.045);
}

.api-row__icon {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  color: var(--accent);
  background: rgba(56, 225, 198, 0.075);
}

.api-row__main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.api-row__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
}

.api-row__title .ellipsis {
  flex: 0 1 auto;
}

.api-row__group {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 4px;
  color: var(--muted);
  font-size: 8px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.055);
}

.api-row__route {
  color: rgba(255, 255, 255, 0.36);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9.5px;
}

.api-row__desc {
  color: var(--muted);
  font-size: 9.5px;
}

.api-row__badges {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 3px;
  align-items: flex-end;
}

.api-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  border-radius: 4px;
  color: var(--accent);
  font-size: 8px;
  font-weight: 600;
  white-space: nowrap;
  background: var(--accent-soft);
}

.api-badge--write {
  color: var(--warning);
  background: rgba(255, 195, 92, 0.1);
}

.api-badge--plain {
  color: var(--muted);
  background: rgba(255, 255, 255, 0.055);
}

.api-empty {
  padding: 44px 18px;
}

.api-more {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 11px;
  border: 1px dashed var(--line);
  border-radius: 12px;
  color: var(--muted);
  font-size: 11px;
}

/* -------------------------------------------------------------------------
 * 弹层
 * ----------------------------------------------------------------------- */

.api-sheet {
  display: flex;
  height: min(88vh, 760px);
  max-height: 88vh;
  flex-direction: column;
  padding-bottom: calc(10px + var(--safe-bottom));
}

.api-sheet__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-bottom: 8px;
}

.api-sheet__heading {
  flex: 1;
  min-width: 0;
}

.api-sheet .sheet__title {
  margin: 0;
  font-size: 17px;
}

.api-sheet__route {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-sheet__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 1px 8px;
  overscroll-behavior: contain;
}

.api-sheet__summary {
  margin: 0 0 9px;
  color: var(--text-2);
  font-size: 11px;
  line-height: 1.55;
}

.api-sheet__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.api-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 11px;
  border: 1px solid rgba(255, 195, 92, 0.2);
  border-radius: 11px;
  color: rgba(255, 222, 164, 0.88);
  font-size: 10px;
  line-height: 1.55;
  background: rgba(255, 195, 92, 0.06);
}

.api-warning svg {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--warning);
}

.api-warning p {
  margin: 0;
}

.api-device-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  padding: 9px 11px;
  border: 1px solid rgba(56, 225, 198, 0.18);
  border-radius: 11px;
  background: var(--accent-soft);
}

.api-device-link p {
  margin: 0;
  color: var(--text-2);
  font-size: 10px;
  line-height: 1.45;
}

.api-form {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.api-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.api-field__label {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 550;
}

.api-field__label code {
  color: rgba(255, 255, 255, 0.3);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 400;
}

.api-field input,
.api-field textarea,
.api-extra textarea {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  outline: none;
  color: var(--text);
  font-size: 12px;
  line-height: 1.5;
  background: rgba(4, 9, 16, 0.55);
  user-select: text;
  resize: vertical;
}

.api-field input:focus,
.api-field textarea:focus,
.api-extra textarea:focus {
  border-color: rgba(56, 225, 198, 0.4);
  background: rgba(56, 225, 198, 0.035);
}

.api-field input::placeholder,
.api-field textarea::placeholder,
.api-extra textarea::placeholder {
  color: rgba(255, 255, 255, 0.24);
}

.api-field textarea,
.api-extra textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
}

.api-hint {
  margin: 0;
  color: var(--muted);
  font-size: 9.5px;
  line-height: 1.5;
}

.api-extra {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.api-extra summary {
  margin-bottom: 8px;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.api-extra textarea {
  margin-bottom: 6px;
}

.api-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 10px 0 0;
  color: var(--danger);
  font-size: 10.5px;
  line-height: 1.5;
}

.api-error svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.api-confirm {
  margin: 12px 0 0;
  color: var(--warning);
  font-size: 10.5px;
  line-height: 1.5;
}

.api-confirm .text-btn {
  padding: 0;
  font-size: 10.5px;
}

.api-actions {
  margin-top: 14px;
}

.api-result {
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid rgba(56, 225, 198, 0.18);
  border-radius: 12px;
  background: rgba(56, 225, 198, 0.03);
}

.api-result--error {
  border-color: rgba(255, 99, 119, 0.22);
  background: rgba(255, 99, 119, 0.035);
}

.api-result__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 11px;
  border-bottom: 1px solid var(--line);
}

.api-result__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
}

.api-result--error .api-result__status {
  color: var(--danger);
}

.api-result__copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  border-radius: 999px;
  color: var(--muted);
  font-size: 9.5px;
  background: rgba(255, 255, 255, 0.055);
}

.api-result__error {
  margin: 0;
  padding: 8px 11px 0;
  color: var(--danger);
  font-size: 10.5px;
  line-height: 1.5;
}

.api-result__body {
  max-height: 300px;
  margin: 0;
  padding: 10px 11px;
  overflow: auto;
  color: var(--text-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

.spin-icon {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
