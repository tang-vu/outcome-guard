$ErrorActionPreference = "Stop"

$secretDirectory = Join-Path $env:LOCALAPPDATA "OutcomeGuard\secrets"
$secretPath = Join-Path $secretDirectory "mimo-token-plan-key.dpapi"
New-Item -ItemType Directory -Force -Path $secretDirectory | Out-Null

$secureKey = Read-Host "Paste the NEW rotated MiMo Token Plan API key (input is hidden)" -AsSecureString
if ($secureKey.Length -lt 20) { throw "The key is unexpectedly short." }
$secureKey | ConvertFrom-SecureString | Set-Content -LiteralPath $secretPath -Encoding utf8NoBOM

$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentIdentity, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $secretDirectory -AclObject $acl

Write-Host "Stored with Windows DPAPI outside the repository at $secretPath"
Write-Host "The plaintext key was not printed or written to the repository."
