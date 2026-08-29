param(
  [ValidateRange(1, 100)]
  [int]$Amount = 100
)

$ErrorActionPreference = "Stop"
$secretPath = Join-Path $env:LOCALAPPDATA "OutcomeGuard\secrets\worker-key.dpapi"
if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) { throw "Encrypted OutcomeGuard worker key was not found." }

$secureKey = ConvertTo-SecureString ([IO.File]::ReadAllText($secretPath))
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  $env:FAUCET_AMOUNT = $Amount.ToString()
  $env:RPC_URL = "https://api.infra.testnet.somnia.network"
  & npm exec -- tsx scripts/fund-test-collateral.ts
  if ($LASTEXITCODE -ne 0) { throw "Shannon tUSDC faucet helper exited with code $LASTEXITCODE." }
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  Remove-Item Env:PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:FAUCET_AMOUNT -ErrorAction SilentlyContinue
}
