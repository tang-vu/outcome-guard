param(
  [Parameter(Mandatory = $true)]
  [string]$SettlementReceipt,
  [Parameter(Mandatory = $true)]
  [string]$OutputReceipt
)

$ErrorActionPreference = "Stop"
$secretPath = Join-Path $env:LOCALAPPDATA "OutcomeGuard\secrets\worker-key.dpapi"
if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) { throw "Encrypted OutcomeGuard worker key was not found." }
$settlementAbsolute = [IO.Path]::GetFullPath($SettlementReceipt)
$outputAbsolute = [IO.Path]::GetFullPath($OutputReceipt)
if (-not (Test-Path -LiteralPath $settlementAbsolute -PathType Leaf)) { throw "Settlement receipt does not exist." }

$secureKey = ConvertTo-SecureString ([IO.File]::ReadAllText($secretPath))
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
  $env:PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
  & npm exec -- tsx scripts/redeem-settled-position.ts $settlementAbsolute $outputAbsolute
  if ($LASTEXITCODE -ne 0) { throw "Secure redemption exited with code $LASTEXITCODE." }
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
  Remove-Item Env:PRIVATE_KEY -ErrorAction SilentlyContinue
}
