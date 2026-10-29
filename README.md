# Muskugou

一个以酷狗音乐接口为数据源的移动端音乐播放器。前端使用 **Vue 3 + TypeScript + Vite**，壳层使用 **Tauri 2**，优先面向 **Android**，也可以在 Windows/macOS/Linux 桌面运行。

项目将参考库 [`src/KuGouMusicApi`](src/KuGouMusicApi) 的 **236 个接口模块全量移植为 TypeScript**，并在其之上实现了统一数据模型、播放器、歌词、歌单、搜索、排行榜、五种登录方式和本地收藏/历史。

客户端**只使用概念版（lite）接口**：`appid=3116`、`clientver=11440`。概念版对登录用户开放免费听，
播放地址优先走 `/song/url/auth/merge`，不可用时回退到标准 `/song/url` / `free_part` 试听。

> 本项目仅用于个人学习与技术研究。音乐版权归酷狗音乐及版权方所有，请勿用于商业用途。

---

## 功能

### 内容发现

- **首页**：推荐单曲、概念版免费听、精选歌单、排行榜、新歌速递、新碟上架，以及六个快捷入口
- **发现页**：每日推荐（含历史）、风格推荐、概念卡片、AI 推荐、主题歌单、场景音乐、IP 专区、电台、听书、MV、歌单广场
- **每日推荐**：按日期拉取当日推荐与历史记录，支持整队列播放/随机播放
- **主题 / 场景 / IP**：主题详情、场景标签切歌、IP 专区歌单
- **电台 FM**：分类电台、推荐电台、电台歌曲无限加载
- **听书**：每日/每周/VIP 书单、分类标签、排行榜、书籍详情与章节播放
- **歌单广场**：分类标签筛选、分页浏览公开歌单

### 搜索与详情

- **搜索**：单曲 / 歌单 / 专辑 / 歌手 / MV / 歌词六类并行搜索，联想词、热搜、搜索历史、分页
- **详情**：歌单（相似歌单推荐）、专辑、歌手（热门歌曲 + 专辑 + MV + 荣誉）、榜单（往期选择）、书籍、视频
- **歌曲信息**：相关版本（翻唱 / Live / 伴奏）、AI 推荐、全球上榜成绩
- **评论**：歌曲 / 歌单 / 专辑评论列表、楼层回复、发表评论、删除自己的评论、热词
- **MV**：搜索 MV、歌手 MV、歌曲关联 MV；多清晰度播放与备用 CDN 回退

### 播放与账号

- **播放**：全局播放队列、列表循环/单曲循环/随机播放、上一首/下一首、拖动进度、音质回退
- **VIP**：概念版每日自动领取 1 天 VIP；无完整播放权限时自动请求 `free_part` 试听片段
- **歌词**：KRC/LRC 解码、逐行高亮、自动滚动、翻译开关、点击歌词跳转
- **歌单管理**：收藏公开歌单、重命名/删除自己的歌单、添加/移除歌曲、排序（协议层）
- **账号**：酷狗扫码、手机验证码、用户名密码、微信扫码、QQ 扫码五种登录方式；同步账号歌单；账号页查看关注/粉丝/好友/访客/已购单曲/已购专辑，并可直接关注/取关
- **用户主页**：点击“我的”/账号/设置/登录页以及评论、关注、粉丝列表里的头像进入主页；自己的主页展示听歌等级、累计听歌时长、歌单与公开音乐，他人主页展示资料、关注状态与公开音乐
- **听歌等级**：读取 `/user/grade/info`，展示当前等级、积分进度、升级所需积分与累计听歌时长；等级由酷狗服务端计算，客户端不模拟上报
- **登录设备**：读取当前账号的登录设备，显示机型、版本、最近活跃与 IP，并可二次确认后踢下线
- **接口中心**：覆盖 219 个非托管协议路由的可视化入口，支持搜索、分组、参数表单、额外 JSON 参数与响应脱敏查看；其余 15 个登录/短信/二维码/设备注册接口由登录流程或客户端托管
- **云盘**：查看云盘歌曲、播放、删除
- **本地音乐库**：收藏、最近播放（最多 100 首）、搜索历史，全部保存在设备上
- **设置**：默认音质、歌词翻译、自动切歌、热搜开关、缓存清理（线路固定为概念版）
- **播放体验**：迷你播放器、全屏播放页、队列弹层、系统 Media Session 元数据
- **移动端适配**：Android 实体/手势返回键、刘海安全区、窄屏布局、http 媒体兼容

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| UI | Vue 3.5 `<script setup>`、vue-router 4、Pinia 3、lucide-vue-next |
| 构建 | Vite 8、TypeScript 6、vue-tsc |
| 壳层 | Tauri 2（Rust + reqwest 原生 HTTP） |
| 协议 | crypto-js、node-forge、pako、qrcode |
| 验证 | tsx（在 Node 中直接运行移植后的协议模块） |

---

## 快速开始

### 环境要求

- Node.js ≥ 20，pnpm ≥ 10
- Rust stable（使用 `rustup` 安装）
- 桌面端：Tauri 2 系统依赖（Windows 需要 WebView2，通常已内置）
- Android：
  - JDK 17
  - Android Studio / Android SDK（API 34+）
  - Android NDK
  - 环境变量 `ANDROID_HOME`、`NDK_HOME`，并把 `platform-tools` 加入 `PATH`

Android 环境配置可参考 [Tauri 官方文档](https://tauri.app/start/prerequisites/#android)。

### 安装与运行

```bash
pnpm install

# 桌面端开发（窗口按手机比例 430×900 显示）
pnpm tauri dev

# 只启动前端（仅 UI 调试；浏览器直连酷狗接口会被 CORS 拦截）
pnpm dev

# 类型检查 / 生产构建
pnpm typecheck
pnpm build

# 协议层联调（不会触发短信接口）
pnpm api:check

# 修改接口模块后重新生成路由目录（接口中心使用）
pnpm api:catalog
```

### Android

首次需要生成 Android 工程并打 manifest 补丁（允许 http 回退地址）：

```bash
# 确保 ANDROID_HOME / NDK_HOME 已配置
pnpm android:init

# 真机/模拟器调试
pnpm android:dev

# 生成 APK / AAB
pnpm android:build
```

`pnpm android:init` 实际执行：

1. `tauri android init` 生成 `src-tauri/gen/android`
2. `node scripts/patch-android.mjs` 给 `AndroidManifest.xml` 增加
   `android:usesCleartextTraffic="true"` 与 `INTERNET` 权限

如果已经初始化过工程，只需重新打补丁：

```bash
pnpm android:patch
```

> 客户端会优先把酷狗图片/媒体地址升级为 `https`，但个别 CDN 可能只返回 `http`，
> 因此 Android 端保留明文流量开关作为兼容兜底。

---

## 项目结构

```
Muskugou/
├── src/
│   ├── api/
│   │   ├── core/                 # 协议核心（与原库 util 对齐）
│   │   │   ├── compat.ts         # 原库 util 的 ESM 兼容入口、live binding
│   │   │   ├── crypto.ts         # MD5/签名/AES/RSA
│   │   │   ├── device.ts         # GUID / MID / DEV / MAC / WEBGL
│   │   │   ├── jar.ts            # 双平台 Cookie / 登录态
│   │   │   ├── request.ts        # 签名、Cookie、请求头、错误处理
│   │   │   ├── config.ts         # 运行时设置 + 平台参数
│   │   │   ├── storage.ts        # localStorage / 内存回退
│   │   │   ├── node/             # Node 内置模块兼容层
│   │   │   └── ...
│   │   ├── modules/              # 236 个全量移植的接口模块（自动生成）
│   │   ├── features/             # 业务封装：认证/设备/发现/视频/听书/评论/歌单/用户/歌曲/搜索
│   │   ├── registry.ts           # 文件名 -> 路由，动态注册模块
│   │   ├── route-catalog.ts      # 234 个路由的静态目录（接口中心使用，自动生成）
│   │   ├── normalize.ts          # 统一 Song/Playlist/Album/Artist/Rank
│   │   ├── client.ts             # App 使用的类型化接口门面
│   │   └── index.ts              # API 统一出口
│   ├── components/               # 播放器、歌曲列表、卡片、等级卡、评论/添加歌单弹层、Toast
│   ├── views/                    # 首页/发现/搜索/排行/我的/详情/播放/视频/听书/云盘/接口中心/登录设备/用户主页等
│   ├── stores/                   # player / user / library / settings / membership / toast
│   ├── utils/                    # 格式化、KRC/LRC 歌词解析
│   ├── router/                   # hash 路由与 meta 约定
│   ├── styles/global.css         # 深色设计变量与公共样式
│   ├── App.vue                   # App 外壳（内容 + 迷你播放器 + TabBar）
│   ├── main.ts
│   └── KuGouMusicApi/            # 参考库原始实现（不参与打包）
├── scripts/
│   ├── port-modules.mjs          # CommonJS -> ESM/TS 全量移植脚本
│   ├── gen-route-catalog.mjs     # 从模块注释生成接口中心路由目录
│   ├── verify-api.ts             # 协议层 20 项联调
│   └── patch-android.mjs         # Android manifest 补丁
├── src-tauri/
│   ├── src/lib.rs                # `http_request` 原生 HTTP 命令
│   ├── tauri.conf.json
│   ├── app-icon.svg              # 图标源文件
│   └── icons/                    # 桌面/Android/iOS 图标
├── public/favicon.svg
├── index.html
└── README.md
```

---

## 架构说明

### 1. 全量移植层

原库是 CommonJS，模块以 `module.exports = (params, useAxios) => ...` 导出。`scripts/port-modules.mjs` 做了机械化转换：

- `require('../util')` → `../core/compat`
- `require('crypto' | 'zlib' | 'net' | 'fs')` → `../core/node/*` 兼容层
- `module.exports = ...` → `export default ...`
- 对象/属性导出 → 命名导出
- 自动补 `Buffer`、`process`、`UseAxios` 类型导入
- 保留原始注释与实现；在注释/字符串内不执行替换，避免误伤示例代码

模块文件统一带有 `// @ts-nocheck`，把“协议实现”和“严格类型”隔离开；App 层（`client.ts`、stores、views）保持完整 TypeScript 类型检查。

### 2. 路由注册表

`registry.ts` 使用 `import.meta.glob('./modules/*.ts', { eager: true })` 收集全部模块：

- 文件名 `_` 转路径 `/`：`user_detail.ts` → `/user/detail`
- 以 `_` 开头的文件是内部 helper，不注册为路由
- 调用时自动注入当前 Cookie，并把响应 Set-Cookie 写回
- 业务层通过 `callModule('/song/url', params)` 即可访问任意移植接口
- `route-catalog.ts` 由 `pnpm api:catalog` 从模块文件名与中文注释生成，记录路由、分组、摘要、
  已识别参数、是否需要登录/修改数据；`pnpm api:check` 会校验目录与模块文件是否同步

### 3. 接口中心与登录设备

协议层有 234 个路由，但并非每个都值得单独做一个业务页面。为了给全部路由提供入口：

- **接口中心**（`/api-center`）读取静态目录，支持关键词搜索、按业务分组筛选、参数表单与
  额外 JSON。修改类接口第一次点击只进入确认态；响应中的 token/cookie/密码等字段自动脱敏；
  `cookie`、`token`、`password` 等敏感参数禁止手动传入，登录态由客户端统一注入。
- **登录设备**（`/devices`）通过 `features/device.ts` 封装 `/login/device` 与
  `/login/device/kick`，设备行只保留展示与下线所需字段，目标设备的 `t/mid/appid/clientver`
  直接来自服务端列表，不经过用户手填；本机与参数不全的设备禁止下线。
- 登录、短信、二维码与设备注册相关的 15 个路由不会出现在接口中心，统一由登录流程或
  客户端自动管理，避免在调试页误发短信或破坏登录态。

### 4. 用户主页与听歌等级

- **入口**：`/user/:id` 为用户主页，`/user/me` 表示当前登录账号。头像点击统一走
  `LibraryView` → `AccountView` → `UserProfileView`；评论/关注/粉丝列表里的用户行也复用该页。
- **等级**：`features/user.ts` 的 `getUserGrade()` 读取 `/user/grade/info`，把
  `p_grade`、`p_current_point`、`p_grade_point`、`p_next_grade`、`p_next_grade_point`、
  `d_sec`、`duration` 归一化为等级、进度、升级所需积分和累计听歌时长。
  该接口只对当前登录账号可靠，因此等级卡只在“自己的主页”和账号页展示。
- **他人资料兜底**：酷狗没有公开的按 userid 查资料接口，`/user/detail` 也可能返回当前账号。
  从列表进入他人主页时，`rememberUser()` 会把列表里的昵称/头像缓存在内存中；同时
  `/youth/user/song` 即使没有公开歌曲也会返回 `nick_name` / `user_pic`，主页优先用它补齐
  昵称和头像，详情接口不可用或返回的 userid 不匹配时也不会显示成空白资料。
- **不会伪造等级**：客户端只查询和展示服务端数据，不自动调用等级上报或听歌时长上报参数。

### 5. 统一数据模型

不同接口的歌曲结构差异很大（搜索是扁平字段，歌单带 `singerinfo`，排行/专辑是嵌套 `audio_info`）。`normalize.ts` 把它们统一成：

```ts
interface Song {
  id: string;
  hash: string;
  name: string;
  artist: string;
  artistIds: string[];
  albumId: string;
  albumName: string;
  albumAudioId: string;
  cover: string;
  duration: number;      // 毫秒
  qualities: SongQuality[];
  payType: number;
  privilege: number;
}
```

同时提取多音质 hash（`FileHash`/`HQFileHash`/`SQFileHash`/`ResFileHash`/`SuperFileHash`），供播放器按设置选择并向下回退。

### 6. 传输层

- Tauri 环境：通过 `invoke('http_request')` 调用 Rust `reqwest`，绕开 WebView CORS，并拿到被隐藏的 `Set-Cookie`
- 非 Tauri 环境（`pnpm dev` 浏览器 / Node 验证）：回退到 `fetch`
  - 浏览器直连酷狗接口会被 CORS 拦截，因此浏览器模式只适合调试 UI
  - Node 验证脚本不受 CORS 限制，可完整跑通协议
- 二进制响应统一 base64，Cookie 由协议层自行管理

### 7. 播放器

`stores/player.ts` 是唯一持有 `HTMLAudioElement` 的地方：

- 队列与播放模式持久化到 `localStorage`
- 获取地址失败时调用 `free_part: true` 获取 60 秒试听
- VIP/付费歌曲无地址时给出明确错误
- 歌曲结束按模式循环/随机/停止
- 自动记录最近播放（去重、置顶、最多 100 首）
- 加载 KRC 歌词并解析、缓存最近 30 首
- 更新 Media Session 元数据（锁屏/系统媒体面板支持因平台而异）

---

## 协议要点

- **设备注册**：首次启动调用 `/register/dev` 获取 `dfid`，否则 `/song/url` 可能返回“本次请求需要验证”（errcode 20028）
- **签名**：参数按 key 排序拼接 + 平台盐值做 MD5；设备注册、signKey、Web 接口使用不同盐值
- **平台**：固定概念版 `appid=3116 / clientver=11440`；`config.ts` 在读写设置时强制 `platform='lite'`，不受旧配置影响
- **登录**：登录页提供五种方式，登录成功后统一刷新 auth、资料与歌单
  - 酷狗扫码：`/login/qr/key` → `/login/qr/create`（本地生成二维码）→ 轮询 `/login/qr/check`，状态 `0 过期 / 1 等待 / 2 已扫码 / 4 成功`
  - 手机验证码：用户点击发送后调用 `/captcha/sent`（60 秒倒计时），再调用 `/login/cellphone`；多账号时透传 `userid`
  - 用户名密码：`/login`，密码只进入本次加密请求、不写入本地存储，可能触发安全验证
  - 微信扫码：`/login/wx/create` → 轮询 `/login/wx/check`（`408/404/403/405/402`）→ 用 `wx_code` 调用 `/login/openplat`
  - QQ 扫码：`/login/qq/qr/create` → 轮询 `/login/qq/qr/check` → 模块内部用 `openid/access_token` 换取酷狗登录态；也支持 `/login/qq` 参数直登
  - 其它：登录后的账号卡片可调用 `/login/token` 刷新登录态；`/login/qr/authorize`（授权其它设备）已在 `features/auth.ts` 封装，可按需调用
- **歌词**：`/search/lyric` 找候选 → `/lyric?fmt=krc&decode=true` → 解析 KRC 逐字标签并合并翻译行
- **概念版免费听**：登录后优先调用 `/song/url/auth/merge`；`/privilege/lite` 返回的 `free_listen` 用于识别免费歌曲
- **试听兜底**：`/song/url` 无完整地址时追加 `free_part: true`，返回片段 URL；客户端标记 `preview` 并缓存 5 分钟
- **自动领 VIP**：`src/api/vip.ts` 每天调用概念版会员领取接口一次，结果由 `stores/membership.ts` 持久化并展示
- **明文兼容**：媒体/图片 URL 优先升级 https；Android manifest 额外允许明文流量兜底

### 登录与凭据

- 短信验证码**只会在用户主动点击“发送验证码”后发送**到其填写的手机号，客户端不会自动或批量调用 `/captcha/sent`。
- 手机号会在发送前按大陆 11 位规则校验；验证码按钮带 60 秒倒计时，避免重复发送。
- 密码只在登录请求中参与加密，**不会写入 localStorage 或 Cookie**；登录成功后仅持久化酷狗返回的登录 Cookie。
- 微信 / QQ 授权由官方开放平台完成，客户端不接触第三方密码。
- 登录态保存在 WebView `localStorage`，没有系统钥匙串加密；请勿在共享设备上登录重要账号。

### 明确不支持

- **图片/文件上传**：`playlist/pic/upload` 等模块需要二进制 `data`；App 中未提供文件选择 UI，
  仍可在接口中心的“额外参数”里手动传入 base64。
- **一起听 / 歌单编辑弹层**：协议模块已移植；UI 暂未开放多人房间与封面编辑，
  可在接口中心或通过 `callModule` 调用对应路由。
- **部分概念版接口**：`/ip/zone/home`、`/search/complex`、`/search/mixed`、`/song/auth`、`/youth/channel/all`
  在实测中返回业务错误，页面已做降级处理（隐藏区块或提示稍后重试），不影响主要功能。

---

## 已知限制

1. **Android 后台播放**：当前使用 WebView 内的 `HTMLAudioElement`，不是原生 ExoPlayer/前台服务。锁屏或系统回收 WebView 时，播放可能暂停；通知栏控制不保证出现。若需要稳定的后台播放，需要接入 Android MediaSessionService + ExoPlayer（或类似方案）。
2. **版权与会员限制**：搜索/歌单中的歌曲能否完整播放取决于版权与账号权益。登录后可免费听概念版曲库；
   超出范围或无版权时自动降级为 60 秒试听。
3. **音质**：高音质/无损需要账号权益；请求不可用时按 `super → high → flac → 320 → 128` 向下回退。
4. **概念版专属内容**：每日推荐、主题、场景、IP 专区、听书等依赖概念版接口；接口调整或地区限制时，页面会显示空状态而不会崩溃。
5. **接口稳定性**：酷狗接口可能随时调整参数或签名规则，接口失败时需要根据抓包更新 `src/api/core`。
6. **桌面端体验**：窗口按手机比例设计；桌面系统媒体键未额外适配。

---

## 验证

```bash
pnpm typecheck   # vue-tsc，App 层严格类型检查
pnpm build       # 生产构建
pnpm api:check   # 20 项协议联调（模块与路由目录同步/设备注册/搜索/播放/歌词/歌单/排行/登录二维码）
```

`pnpm api:check` 的预期输出结尾：

```
通过 20 项，失败 0 项
```

> 酷狗会对短时间内的设备注册做临时限流（`/register/dev` 返回空数据），
> 此时播放地址会报 `20028 本次请求需要验证`。等待几分钟后重试即可，
> 不需要修改代码。

> 登录联调说明：`api:check` 只验证酷狗扫码 key/二维码/轮询；微信与 QQ 的二维码生成、QQ 轮询已在开发时单独验证。
> 短信发送和真实账号登录必须由用户本人操作（短信会真实发送到手机），因此不纳入自动联调，也绝不能用随机号码测试。

---

## 声明

- 本项目与酷狗音乐官方无关。
- 所有音乐、封面、歌词版权归酷狗音乐及对应版权方所有。
- 接口实现来自公开参考库，仅供学习研究；请遵守目标网站服务条款与当地法律。
- 禁止将本项目用于商业用途、批量抓取或绕过付费/会员机制。
