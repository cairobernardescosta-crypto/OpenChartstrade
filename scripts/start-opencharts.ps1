param(
  [string]$ChromeProfile = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$url = "http://127.0.0.1:5173"
$stateDir = Join-Path $env:LOCALAPPDATA "OpenCharts"
$stdoutLog = Join-Path $stateDir "dev.log"
$stderrLog = Join-Path $stateDir "dev-error.log"

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null

function Test-OpenChartsReady {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

if (-not (Test-OpenChartsReady)) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules"))) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      "As dependências do OpenCharts não estão instaladas. Execute npm.cmd ci em $projectRoot.",
      "OpenCharts",
      "OK",
      "Error"
    ) | Out-Null
    exit 1
  }

  Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "5173") `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -WindowStyle Hidden | Out-Null

  $ready = $false
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-OpenChartsReady) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      "O servidor do OpenCharts não iniciou. Consulte $stderrLog.",
      "OpenCharts",
      "OK",
      "Error"
    ) | Out-Null
    exit 1
  }
}

$chromeCandidates = @(
  (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chrome = $chromeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if ($chrome) {
  $chromeArguments = @()
  if ($ChromeProfile) {
    $chromeArguments += "--profile-directory=`"$ChromeProfile`""
  }
  $chromeArguments += "--app=$url"
  Start-Process -FilePath $chrome -ArgumentList $chromeArguments
} else {
  Start-Process $url
}
