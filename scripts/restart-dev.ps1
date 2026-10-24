param([int]$Port = 3000)

$ErrorActionPreference = "SilentlyContinue"
$proj = Split-Path -Parent $PSScriptRoot
$log = Join-Path $env:TEMP "opencode\devlog.txt"

$nodeProcs = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq "node.exe" -and $_.CommandLine -and $_.CommandLine.Contains($proj)
}
$portPids = Get-NetTCPConnection -LocalPort $Port -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique
$kill = @()
$kill += $nodeProcs | ForEach-Object { $_.ProcessId }
$kill += $portPids
foreach ($p in ($kill | Select-Object -Unique)) {
  Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
}

$waited = 0
while ($waited -lt 10 -and (Get-NetTCPConnection -LocalPort $Port -State Listen)) {
  Start-Sleep -Milliseconds 500
  $waited += 0.5
}
Start-Sleep -Milliseconds 800
Remove-Item $log -Force -ErrorAction SilentlyContinue

Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c", "npm.cmd run dev > `"$log`" 2>&1" `
  -WorkingDirectory $proj -WindowStyle Hidden

for ($i = 1; $i -le 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$Port/login" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) {
      Write-Output "DEV-OK ($i detik)"
      exit 0
    }
  } catch {}
  Start-Sleep -Seconds 1
}
Write-Output "DEV-TIMEOUT setelah 30 detik - cek $log"
exit 1
