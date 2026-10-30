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
- **完整歌单队列**：播放全部 / 随机播放 / 点击歌单内任意歌曲时，会先拉取整个歌单（最多 5000 首）作为队列，不再受首屏 50 首限制
- **搜索试听插入队列**：搜索结果和歌词搜索结果只把点中的歌曲插入当前歌曲之后并立即播放，不会替换正在听的歌单
- **音质与封面补齐**：云歌单自动通过 `/privilege/lite` 补齐 320K/无损/OGG hash，通过 `/album/detail` 补齐封面；切换音质会立即重新加载当前歌曲
- **歌曲信息展示**：相关版本、概念版免费听兼容 `base` / `audio_info` / `copyright.trans_param` 等嵌套结构，正确显示歌手、封面与多音质
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

### Android 调试

首次需要生成 Android 工程并打 manifest 补丁（允许 http 回退地址）：

```bash
# 确保 ANDROID_HOME / NDK_HOME 已配置
pnpm android:init

# 真机/模拟器调试
pnpm android:dev
```

`pnpm android:init` 实际执行：

1. `tauri android init` 生成 `src-tauri/gen/android`
2. `node scripts/patch-android.mjs` 给 `AndroidManifest.xml` 补 `INTERNET` 权限，
   把新版模板里的 `${usesCleartextTraffic}` 占位符改成 `true`（release 也允许 http 回退），
   并给 `app/build.gradle.kts` 补 release 签名配置

如果已经初始化过工程，只需重新打补丁：

```bash
pnpm android:patch
```

> 客户端会优先把酷狗图片/媒体地址升级为 `https`，但个别 CDN 可能只返回 `http`，
> 因此 Android 端保留明文流量开关作为兼容兜底。

### Android Release 打包

> 本机已经准备好一套便携工具链，`src-tauri/gen/android` 也已初始化并配置好签名。
> 直接看下面的「4. 构建 Release 包」即可；换电脑时再按完整步骤操作。

#### 0. 本机工具链（D:\Android）

| 项目 | 路径 |
| --- | --- |
| JDK 17 | `D:\Android\jdk-17.0.21.0.2+1` |
| Android SDK | `D:\Android\Sdk` |
| NDK | `D:\Android\Sdk\ndk\29.0.13846066` |
| Gradle 用户目录 | `D:\Android\gradle-home` |
| Gradle 发行包（已放入 wrapper 缓存） | `D:\Android\tools\gradle-9.6.1-bin.zip` |
| Release 密钥 | `D:\Android\keystores\kiru-release.jks`（alias `kiru`） |
| 密钥密码文件 | `D:\Android\keystores\kiru-release.password` |

> 这套工具链对应 Tauri 2.12 生成的 Android 工程：compileSdk/targetSdk 37、NDK 29、
> Gradle 9.6.1、JDK 17。`keystore.properties` 里的密码来自上面的密码文件；
> 该目录是明文保存，注意不要上传或分享，务必离线备份 `.jks` 和密码。
> 如果以后想给 Muskugou 单独一把钥匙，按「3. 生成签名密钥（可选）」重新生成，
> 并同步修改 `keystore.properties`。

#### 1. 设置环境变量（每开一个新终端都要做）

PowerShell（VSCode 默认终端）：

```powershell
$env:JAVA_HOME = 'D:\Android\jdk-17.0.21.0.2+1'
$env:ANDROID_HOME = 'D:\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NDK_HOME = 'D:\Android\Sdk\ndk\29.0.13846066'
$env:GRADLE_USER_HOME = 'D:\Android\gradle-home'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
```

Git Bash：

```bash
export JAVA_HOME="D:/Android/jdk-17.0.21.0.2+1"
export ANDROID_HOME="D:/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export NDK_HOME="$ANDROID_HOME/ndk/29.0.13846066"
export GRADLE_USER_HOME="D:/Android/gradle-home"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

检查：

```bash
java -version        # 必须是 17
adb version
pnpm -v
```

> **Windows 必看**：Tauri 构建 Android 时会把 Rust 产物软链接到
> `gen/android/app/src/main/jniLibs/<abi>/`。Windows 默认不允许普通进程创建软链接，
> 如果报 `Creation symbolic link is not allowed for this system`，请任选一种：
>
> 1. 开启 **开发者模式**：设置 → 系统 → 开发者选项 → 开发人员模式；
> 2. 用 **管理员身份** 打开终端再执行构建。
>
> 开启后重新打开终端，再次运行构建即可。已经编译过的 Rust 依赖会复用，第二次会快很多。

如果 `adb` 找不到，直接用绝对路径 `D:\Android\Sdk\platform-tools\adb.exe`。
Rust Android target 已经装好（aarch64/armv7/i686/x86_64），换电脑时才需要执行：

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

#### 2. Android 工程与签名配置

本机已经执行过：

```bash
pnpm android:init
pnpm android:patch
```

如果以后删除了 `src-tauri/gen/android` 并重新初始化，重新执行
`pnpm android:patch` 会自动补回 manifest 和 release 签名配置。

`src-tauri/gen/android/keystore.properties`（已被 `.gitignore` 忽略）内容示意：

```properties
password=<D:\Android\keystores\kiru-release.password 的内容>
keyAlias=kiru
storeFile=D:/Android/keystores/kiru-release.jks
```

`app/build.gradle.kts` 里的对应配置：

```kotlin
import java.io.FileInputStream
import java.util.Properties

val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("password")
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("password")
            }
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.findByName("release")
            // ... 其它配置 ...
        }
    }
}
```

#### 3. 生成签名密钥（可选，仅在没有密钥时）

如果 `kiru-release.jks` 已经用于另一个已发布的应用，建议不要复用（两个应用会共享签名身份），
而是为 Muskugou 新建一把钥匙：

```bash
mkdir -p D:/Android/keystores

"$JAVA_HOME/bin/keytool" -genkeypair -v \
  -storetype PKCS12 \
  -keystore D:/Android/keystores/muskugou-release.jks \
  -alias muskugou \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

按提示设置密码和证书信息（姓名/组织可随意填写）。然后把 `keystore.properties` 改成：

```properties
password=你设置的密码
keyAlias=muskugou
storeFile=D:/Android/keystores/muskugou-release.jks
```

> 密钥库密码和 key 密码请使用同一个值，Gradle 配置只读取一个 `password` 字段。
> 密钥和密码丢失后无法覆盖安装或更新已发布的应用，务必离线备份。

#### 4. 构建 Release 包

确保当前终端已经按第 1 节设置好环境变量，并且位于项目根目录
`E:\code\Tauriprogect\Muskugou`：

```bash
# 通用 APK（所有 ABI 打在一起，首次发布最省事）
pnpm android:build:apk

# Google Play 使用的 AAB
pnpm android:build:aab

# 按 ABI 拆分，单个包更小（真机一般只需要 arm64）
pnpm tauri android build --apk --split-per-abi
```

构建会自动执行 `beforeBuildCommand`（即 `pnpm build`），然后编译 Rust 和 Android 工程。
首次构建需要下载 Gradle 依赖并编译各 ABI，通常 10–30 分钟；之后增量构建会快很多。

只想快速验证 UI 时可以打 debug 包（使用调试签名，不能上架）：

```bash
pnpm tauri android build --debug --apk
```

也可以直接用本机的一键脚本（会自动设置上面的环境变量）：

```bat
scripts\build-android.bat apk
scripts\build-android.bat aab
scripts\build-android.bat split
scripts\build-android.bat debug
```

#### 5. 产物位置与安装

默认产物：

```text
src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab
```

按 ABI 拆分时在 `outputs/apk/<abi>/release/` 下，例如
`app-arm64-release.apk`。找不到时可以直接搜索：

```bash
find src-tauri/gen/android/app/build/outputs -name "*.apk" -o -name "*.aab"
```

安装到已连接的手机：

```bash
adb install -r src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

如果提示 `INSTALL_FAILED_UPDATE_INCOMPATIBLE`，说明设备上已有不同签名的版本：
先 `adb uninstall com.smilecover.muskugou`，再安装（会清除应用本地数据）。

#### 6. 版本号与升级

上架或覆盖安装新版本前，必须同时更新版本号：

1. 修改 `src-tauri/tauri.conf.json` 的 `version`；
2. 修改 `package.json` 的 `version`（保持一致）；
3. Android 的 `versionCode` 必须大于上次发布的值。默认由 semver 推导：
   `versionCode = major * 1000000 + minor * 1000 + patch`（`0.1.0` → `1000`）。
   也可以在 `tauri.conf.json` 中显式指定：

```json
{
  "bundle": {
    "android": {
      "versionCode": 1000,
      "minSdkVersion": 24
    }
  }
}
```

> 如果开启 `bundle.android.autoIncrementVersionCode`，Tauri 会读取并递增
> `src-tauri/gen/android/app/tauri.properties`；此时需要把该文件从
> `app/.gitignore` 中移除并纳入版本管理，避免每次构建都从同一个值开始。

> `identifier`（当前为 `com.smilecover.muskugou`）一旦上架就不要再改，
> 否则会被应用商店视为另一个应用。

#### 7. 发布前检查清单

- [ ] Release APK 能安装、能登录、能播放（不要只测 debug 包）
- [ ] `version` / `versionCode` 已递增
- [ ] `keystore.properties` 和 `.jks` 没有被 `git add`
- [ ] 分享/备份项目时没有带上 `src-tauri/gen/android/keystore.properties`
- [ ] 密钥库与密码已离线备份
- [ ] 上架 Google Play 时上传 AAB，并启用 Play App Signing
- [ ] 重新初始化过 Android 工程后执行过 `pnpm android:patch`

#### 常见问题

| 现象 | 处理 |
| --- | --- |
| `ANDROID_HOME is not set` | 按第 1 节设置环境变量后重开终端；本机 SDK 在 `D:\Android\Sdk` |
| `SDK location not found` | 本机已写入 `src-tauri/gen/android/local.properties` 的 `sdk.dir=D:/Android/Sdk`；换电脑时改成自己的路径 |
| `Could not read script 'tauri.settings.gradle'` | 不要直接运行 `gradlew`；用 `pnpm android:build:apk`，Tauri 会先生成该文件 |
| `Keystore file ... not set` | `keystore.properties` 的 `storeFile` 路径不对；本机应为 `D:/Android/keystores/kiru-release.jks` |
| `Unsupported class file major version` | Gradle 用错 JDK；把 `JAVA_HOME` 指向 `D:\Android\jdk-17.0.21.0.2+1` |
| 首次构建卡在下载 | 本机 Gradle 发行包已放进 `D:\Android\gradle-home`；Maven 依赖仍可能联网，可配置代理或 `D:\Android\gradle-home\init.d\gradle-mirrors.gradle` 镜像 |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 设备上已有不同签名的包：`adb uninstall com.smilecover.muskugou` 后再装（会清除本地数据） |
| 播放/图片在真机加载失败 | 确认执行过 `pnpm android:patch`，`AndroidManifest.xml` 的 `usesCleartextTraffic` 为 `true` |

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
│   │   ├── features/             # 业务封装：认证/设备/发现/视频/听书/评论/歌单/用户/歌曲/搜索/音质封面
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
│   ├── patch-android.mjs         # Android manifest 补丁
│   └── build-android.bat         # 本机一键打包（设置 D:\Android 环境变量）
├── src-tauri/
│   ├── src/lib.rs                # `http_request` 原生 HTTP 命令
│   ├── tauri.conf.json
│   ├── gen/android/              # `pnpm android:init` 生成的 Android 工程（已配置 release 签名）
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

归一化层还兼容不同接口的嵌套结构：`song_info`、`audio_info`、`base`、`album_info`，以及
`copyright.trans_param`（相关版本接口把 OGG/封面放在这里）。歌名与歌手会从
`base.songname`、`base.author_name` 等外层字段补齐；文件名会去掉 `.mp3` 等扩展名和与歌手
重复的“歌手 - ”前缀，避免出现“未知歌手”“未知歌曲”或 `xxx.mp3`。

### 8. 音质补齐与完整播放队列

- `features/quality.ts`：批量调用 `/privilege/lite` 补齐每首歌的 128/320/FLAC/Hi-Res hash
  （概念版 128/320 优先使用 OGG 资源），并用 `/album/detail` 补封面。权益结果与专辑封面都有
  TTL/容量上限缓存，避免翻页和重复进入时发请求。
- `client.ts` 的 `getPlaylistAllSongs()`：按 300 首/页循环拉取整个歌单，自动处理服务端
  截断页大小、重复歌曲与总数缺失，最多 5000 首。详情页首屏仍只加载 50 首用于展示，
  播放时再用完整列表建队列。
- `stores/player.ts` 的 `playInserted()`：搜索试听不替换队列，而是插到当前歌曲之后播放；
  若歌曲已在队列中则直接跳转。

### 6. 传输层

- Tauri 环境：通过 `invoke('http_request')` 调用 Rust `reqwest`，绕开 WebView CORS，并拿到被隐藏的 `Set-Cookie`
- 非 Tauri 环境（`pnpm dev` 浏览器 / Node 验证）：回退到 `fetch`
  - 浏览器直连酷狗接口会被 CORS 拦截，因此浏览器模式只适合调试 UI
  - Node 验证脚本不受 CORS 限制，可完整跑通协议
- 二进制响应统一 base64，Cookie 由协议层自行管理

### 7. 播放器

`stores/player.ts` 是唯一持有 `HTMLAudioElement` 的地方：

- 队列与播放模式持久化到 `localStorage`
- `playSongs()` 替换队列；`playInserted()` 保留队列并插入单曲（搜索试听）
- 歌单播放前由 `getPlaylistAllSongs()` 拉取完整歌曲列表，避免队列只有首屏 50 首
- 音质切换会清空地址缓存并立即重新请求当前歌曲，失败时按音质等级向下回退
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
