param(
  [Parameter(Mandatory = $true)]
  [string]$Bundle,
  [ValidatePattern("^(0|[1-9]\d*)(\.\d+)?$")]
  [string]$InitialTotalPremiumAtRisk = "0"
)

$ErrorActionPreference = "Stop"
$secretPath = Join-Path $env:LOCALAPPDATA "OutcomeGuard\secrets\worker-key.dpapi"
$statePath = Join-Path $env:LOCALAPPDATA "OutcomeGuard\execution-state"

if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) {
  throw "Encrypted OutcomeGuard worker key was not found."
}
if (-not (Test-Path -LiteralPath $Bundle -PathType Leaf)) {
  throw "Signed execution bundle was not found: $Bundle"
}

$resolvedBundle = (Resolve-Path -LiteralPath $Bundle).Path
$secureKey = ConvertTo-SecureString ([IO.File]::ReadAllText($secretPath))
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
  $env:PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  $env:NETWORK = "testnet"
  $env:CHAIN_ID = "50312"
  $env:DRY_RUN = "false"
  $env:FIXTURE_MODE = "false"
  $env:RPC_URL = "https://api.infra.testnet.somnia.network"
  $env:WS_RPC_URL = "wss://api.infra.testnet.somnia.network/ws"
  $env:INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql"
  $env:VENUE_ID = "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c"
  $env:EXECUTION_STATE_DIR = $statePath
  $env:INITIAL_TOTAL_PREMIUM_AT_RISK = $InitialTotalPremiumAtRisk
  New-Item -ItemType Directory -Force -Path $statePath | Out-Null

  & npm run execute-once -w '@outcome-guard/agent' -- --bundle $resolvedBundle
  if ($LASTEXITCODE -ne 0) { throw "OutcomeGuard one-shot worker exited with code $LASTEXITCODE." }
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  Remove-Item Env:PRIVATE_KEY -ErrorAction SilentlyContinue
}
