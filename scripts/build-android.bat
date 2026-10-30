@echo off
rem One-click Android build (portable toolchain D:\Android).
rem Usage: scripts\build-android.bat [apk^|aab^|split^|debug]
rem Default: apk. See README "Android Release" for details.

setlocal EnableExtensions

set "ROOT=%~dp0.."
set "JAVA_HOME=D:\Android\jdk-17.0.21.0.2+1"
set "ANDROID_HOME=D:\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "NDK_HOME=%ANDROID_HOME%\ndk\29.0.13846066"
set "GRADLE_USER_HOME=D:\Android\gradle-home"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [ERROR] JDK not found: %JAVA_HOME%
  exit /b 1
)
if not exist "%ANDROID_HOME%\platform-tools\adb.exe" (
  echo [ERROR] Android SDK not found: %ANDROID_HOME%
  exit /b 1
)
if not exist "%NDK_HOME%\ndk-build.cmd" (
  echo [ERROR] Android NDK not found: %NDK_HOME%
  exit /b 1
)

if not exist "%ROOT%\src-tauri\gen\android\keystore.properties" (
  echo [WARN] keystore.properties not found: release APK may be unsigned.
  echo        Configure signing first, see README section 2.
)

cd /d "%ROOT%"

set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=apk"

if /I "%TARGET%"=="apk" goto :build_apk
if /I "%TARGET%"=="aab" goto :build_aab
if /I "%TARGET%"=="split" goto :build_split
if /I "%TARGET%"=="debug" goto :build_debug

echo Usage: scripts\build-android.bat [apk^|aab^|split^|debug]
exit /b 1

:build_apk
call pnpm android:build:apk
goto :check

:build_aab
call pnpm android:build:aab
goto :check

:build_split
call pnpm tauri android build --apk --split-per-abi
goto :check

:build_debug
call pnpm tauri android build --debug --apk
goto :check

:check
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. See the log above.
  exit /b 1
)

echo.
echo [OK] Build finished.
echo      Output: src-tauri\gen\android\app\build\outputs
echo      Install example: "%ANDROID_HOME%\platform-tools\adb.exe" install -r src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk
endlocal
