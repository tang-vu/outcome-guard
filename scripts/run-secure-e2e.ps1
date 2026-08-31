param(
  [ValidateRange(1, 60)]
  [int]$Attempts = 1,
  [ValidateRange(5, 60)]
  [int]$DelaySeconds = 30,
  [ValidateRange(0.1, 15)]
  [decimal]$MaximumPremium = 15,
  [ValidateSet(15, 60)]
  [int]$HorizonMinutes = 15,
  [ValidateSet("BTC", "ETH", "ANY")]
  [string]$Asset = "ANY"
)

$ErrorActionPreference = "Stop"
$secretPath = Join-Path $env:LOCALAPPDATA "OutcomeGuard\secrets\worker-key.dpapi"
if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) { throw "Encrypted OutcomeGuard worker key was not found." }

$secureKey = ConvertTo-SecureString ([IO.File]::ReadAllText($secretPath))
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  $env:AGENT_SIGNER_ADDRESS = "0x1A3b41966bd8fFf0637685D5398762778FdeFfc2"
  $env:EXECUTION_INBOX_DIR = Join-Path $env:LOCALAPPDATA "OutcomeGuard\execution-inbox"
  $env:EXECUTION_STATUS_DIR = Join-Path $env:LOCALAPPDATA "OutcomeGuard\execution-status"
  $env:OUTCOMEGUARD_URL = "https://outcomeguard.tangvu.dev"
  $env:E2E_MAX_PREMIUM = $MaximumPremium.ToString([Globalization.CultureInfo]::InvariantCulture)
  $env:E2E_HORIZON_MINUTES = $HorizonMinutes.ToString([Globalization.CultureInfo]::InvariantCulture)
  if ($Asset -ne "ANY") { $env:E2E_ASSET = $Asset }
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    Write-Output ("Dedicated Shannon E2E attempt {0}/{1}" -f $attempt, $Attempts)
    & npm exec -- tsx scripts/run-dedicated-test-e2e.ts
    if ($LASTEXITCODE -eq 0) { break }
    if ($attempt -eq $Attempts) { throw "Dedicated Shannon E2E exhausted $Attempts attempts." }
    Start-Sleep -Seconds $DelaySeconds
  }
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  Remove-Item Env:PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:E2E_MAX_PREMIUM -ErrorAction SilentlyContinue
  Remove-Item Env:E2E_HORIZON_MINUTES -ErrorAction SilentlyContinue
  Remove-Item Env:E2E_ASSET -ErrorAction SilentlyContinue
}
