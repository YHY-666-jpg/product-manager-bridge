@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if exist "%~dp0..\.tools\node\node.exe" (
  set "PATH=%~dp0..\.tools\node;%PATH%"
)

if not exist package.json (
  echo ERROR: package.json not found.
  pause
  exit /b 1
)

where node >nul 2>nul || (echo ERROR: node is not available.& pause& exit /b 1)
where npm >nul 2>nul || (echo ERROR: npm is not available.& pause& exit /b 1)

echo Installing dependencies...
call npm install || (echo ERROR: npm install failed.& pause& exit /b 1)

echo Compiling...
call npm run compile || (echo ERROR: compile failed.& pause& exit /b 1)

echo Running tests...
call npm run test --if-present || (echo ERROR: tests failed.& pause& exit /b 1)

echo Packaging VSIX...
call npx --yes @vscode/vsce package || (echo ERROR: VSIX package failed.& pause& exit /b 1)

set "latest="
for /f "delims=" %%F in ('dir /b /o-d *.vsix 2^>nul') do (
  set "latest=%%F"
  goto :found
)
:found
if "%latest%"=="" (
  echo ERROR: No VSIX file was generated.
  pause
  exit /b 1
)

echo Generated VSIX: %latest%
set /p installNow=Install this VSIX into local VS Code now? [y/N] 
if /i "%installNow%"=="y" (
  set "CODE_CLI="
  where code >nul 2>nul && set "CODE_CLI=code"
  if "!CODE_CLI!"=="" if exist "%LocalAppData%\Programs\Microsoft VS Code\bin\code.cmd" set "CODE_CLI=%LocalAppData%\Programs\Microsoft VS Code\bin\code.cmd"
  if "!CODE_CLI!"=="" if exist "%ProgramFiles%\Microsoft VS Code\bin\code.cmd" set "CODE_CLI=%ProgramFiles%\Microsoft VS Code\bin\code.cmd"
  if "!CODE_CLI!"=="" (
    echo code command not found. Install manually from Extensions ... Install from VSIX...
  ) else (
    call "!CODE_CLI!" --install-extension "%latest%" --force || (echo ERROR: install failed.& pause& exit /b 1)
  )
)

echo Done.
pause
