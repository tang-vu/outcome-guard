param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^0x[0-9a-fA-F]{40}$")]
  [string]$Pool,
  [ValidateRange(0.001, 100)]
  [decimal]$Amount = 15
)

$ErrorActionPreference = "Stop"
$secretPath = Join-Path $env:LOCALAPPDATA "OutcomeGuard\secrets\worker-key.dpapi"
if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) { throw "Encrypted OutcomeGuard worker key was not found." }

$secureKey = ConvertTo-SecureString ([IO.File]::ReadAllText($secretPath))
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  $env:APPROVAL_POOL = $Pool
  $env:APPROVAL_AMOUNT = $Amount.ToString([Globalization.CultureInfo]::InvariantCulture)
  $env:RPC_URL = "https://api.infra.testnet.somnia.network"
  & npm exec -- tsx scripts/approve-test-collateral.ts
  if ($LASTEXITCODE -ne 0) { throw "Shannon exact-allowance helper exited with code $LASTEXITCODE." }
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  Remove-Item Env:PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:APPROVAL_POOL -ErrorAction SilentlyContinue
  Remove-Item Env:APPROVAL_AMOUNT -ErrorAction SilentlyContinue
}
