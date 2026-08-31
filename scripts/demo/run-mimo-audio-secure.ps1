$ErrorActionPreference = "Stop"

$secretPath = Join-Path $env:LOCALAPPDATA "OutcomeGuard\secrets\mimo-token-plan-key.dpapi"
if (-not (Test-Path -LiteralPath $secretPath)) {
  throw "MiMo key is not configured. First run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/demo/setup-mimo-key.ps1"
}

$secureKey = Get-Content -Raw -LiteralPath $secretPath | ConvertTo-SecureString
$credential = New-Object System.Management.Automation.PSCredential("mimo", $secureKey)
$env:MIMO_API_KEY = $credential.GetNetworkCredential().Password
try {
  node scripts/demo/generate-mimo-audio.mjs
} finally {
  Remove-Item Env:MIMO_API_KEY -ErrorAction SilentlyContinue
  $credential = $null
  $secureKey = $null
}
