const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { execFileSync } = require('node:child_process');

// OneDrive can mark generated directories read-only, blocking Nest's cleanup.
const output = resolve(__dirname, '../dist');
if (process.platform === 'win32' && existsSync(output)) {
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
    $ErrorActionPreference = 'Stop'
    $target = Get-Item -LiteralPath $env:RRHH_BUILD_DIR
    $items = @($target) + @(Get-ChildItem -LiteralPath $target.FullName -Recurse -Force)
    foreach ($item in $items) {
      if ($item.Attributes -band [System.IO.FileAttributes]::ReadOnly) {
        $item.Attributes = $item.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
      }
    }
  `], { stdio: 'inherit', env: { ...process.env, RRHH_BUILD_DIR: output } });
}
