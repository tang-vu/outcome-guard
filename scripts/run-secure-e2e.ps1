param(
  [ValidateRange(1, 60)]
  [int]$Attempts = 1,
  [ValidateRange(5, 60)]
  [int]$DelaySeconds = 30
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
}
