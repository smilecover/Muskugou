/**
 * Android 工程补丁。
 *
 * 1. 酷狗部分媒体/封面地址历史上是 http；虽然客户端会尽量升级到 https，
 *    仍可能有少数 CDN 只返回 http。Android 9+ 默认禁止明文流量，因此这里在
 *    `tauri android init` 生成工程后，为 <application> 打开 usesCleartextTraffic。
 * 2. 新版模板不会自动读取 keystore.properties，这里补上 release 签名配置，
 *    重新 init 后执行 `pnpm android:patch` 即可恢复。
 *
 * 用法：
 *   pnpm android:init   # tauri android init + 自动打补丁
 *   pnpm android:patch  # 只重新打补丁
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'src-tauri', 'gen', 'android');
const manifestPath = join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
const gradlePath = join(androidDir, 'app', 'build.gradle.kts');

if (!existsSync(manifestPath)) {
  console.error('未找到 Android 工程：' + manifestPath);
  console.error('请先安装 Android SDK/NDK 并运行：pnpm tauri android init');
  process.exit(1);
}

let manifest = readFileSync(manifestPath, 'utf8');
let changed = false;

// 1. 网络权限（Tauri 模板通常已包含，这里兜底）
if (!manifest.includes('android.permission.INTERNET')) {
  manifest = manifest.replace(
    /<application\b/,
    '  <uses-permission android:name="android.permission.INTERNET" />\n\n  <application',
  );
  changed = true;
}

// 2. 允许明文流量（兼容极少数 http 媒体地址）
// 新版 Tauri 模板在 manifest 里使用 ${usesCleartextTraffic} 占位符，
// release 构建默认是 false；这里直接换成 true，避免 release 包加载不了 http CDN。
if (manifest.includes('${usesCleartextTraffic}')) {
  manifest = manifest.replace(/\$\{usesCleartextTraffic\}/g, 'true');
  changed = true;
} else if (manifest.includes('android:usesCleartextTraffic="false"')) {
  manifest = manifest.replace(/android:usesCleartextTraffic="false"/g, 'android:usesCleartextTraffic="true"');
  changed = true;
} else if (!manifest.includes('android:usesCleartextTraffic')) {
  manifest = manifest.replace(/<application\b/, '<application\n        android:usesCleartextTraffic="true"');
  changed = true;
}

if (changed) {
  writeFileSync(manifestPath, manifest, 'utf8');
  console.log('✓ 已更新 AndroidManifest.xml（INTERNET + usesCleartextTraffic）');
} else {
  console.log('✓ AndroidManifest.xml 已包含所需配置，无需修改');
}

console.log('  ' + manifestPath);

/**
 * 给 app/build.gradle.kts 补 release 签名配置。
 *
 * 只做锚点插入，重复执行不会产生重复块；如果模板结构变化导致锚点找不到，
 * 会保持原文件不变并提示手动检查。
 */
function patchGradleSigning() {
  if (!existsSync(gradlePath)) {
    console.log('… 未找到 app/build.gradle.kts，跳过签名配置');
    return;
  }

  let gradle = readFileSync(gradlePath, 'utf8');
  let touched = false;

  if (!gradle.includes('import java.io.FileInputStream')) {
    gradle = gradle.replace(/(^import .*\n)/, '$1import java.io.FileInputStream\n');
    touched = true;
  }

  if (!gradle.includes('val keystorePropertiesFile = rootProject.file("keystore.properties")')) {
    const block = [
      '// Release 签名配置。keystore.properties 已被 .gitignore 忽略，不要提交。',
      'val keystorePropertiesFile = rootProject.file("keystore.properties")',
      'val keystoreProperties = Properties()',
      'if (keystorePropertiesFile.exists()) {',
      '    keystoreProperties.load(FileInputStream(keystorePropertiesFile))',
      '}',
      '',
      '',
    ].join('\n');
    if (!gradle.includes('\nandroid {')) {
      console.log('… app/build.gradle.kts 结构已变化，未自动插入签名配置，请手动检查');
      return;
    }
    gradle = gradle.replace('\nandroid {', '\n' + block + 'android {');
    touched = true;
  }

  if (!gradle.includes('create("release")')) {
    const block = [
      '    signingConfigs {',
      '        if (keystorePropertiesFile.exists()) {',
      '            create("release") {',
      '                keyAlias = keystoreProperties.getProperty("keyAlias")',
      '                keyPassword = keystoreProperties.getProperty("password")',
      '                storeFile = file(keystoreProperties.getProperty("storeFile"))',
      '                storePassword = keystoreProperties.getProperty("password")',
      '            }',
      '        }',
      '    }',
      '',
    ].join('\n');
    if (!/\n\s*namespace = "[^"]+"\n/.test(gradle)) {
      console.log('… app/build.gradle.kts 未找到 namespace，未自动插入签名配置，请手动检查');
      return;
    }
    gradle = gradle.replace(/(\n\s*namespace = "[^"]+"\n)/, '$1' + block);
    touched = true;
  }

  if (!gradle.includes('signingConfig = signingConfigs.findByName("release")')) {
    if (!/getByName\("release"\)\s*\{\n/.test(gradle)) {
      console.log('… app/build.gradle.kts 未找到 release buildType，未自动插入签名配置，请手动检查');
      return;
    }
    gradle = gradle.replace(
      /(getByName\("release"\)\s*\{\n)/,
      '$1            signingConfig = signingConfigs.findByName("release")\n',
    );
    touched = true;
  }

  if (touched) {
    writeFileSync(gradlePath, gradle, 'utf8');
    console.log('✓ 已更新 app/build.gradle.kts（release 签名配置）');
  } else {
    console.log('✓ app/build.gradle.kts 已包含 release 签名配置，无需修改');
  }
  console.log('  ' + gradlePath);
}

patchGradleSigning();
