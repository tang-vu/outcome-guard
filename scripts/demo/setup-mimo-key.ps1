$ErrorActionPreference = "Stop"

$secretDirectory = Join-Path $env:LOCALAPPDATA "OutcomeGuard\secrets"
$secretPath = Join-Path $secretDirectory "mimo-token-plan-key.dpapi"
New-Item -ItemType Directory -Force -Path $secretDirectory | Out-Null

$secureKey = Read-Host "Paste the NEW rotated MiMo Token Plan API key (input is hidden)" -AsSecureString
if ($secureKey.Length -lt 20) { throw "The key is unexpectedly short." }
$encryptedKey = $secureKey | ConvertFrom-SecureString
# Windows PowerShell 5.1 lacks `utf8NoBOM`; WriteAllText also avoids the
# trailing newline that ConvertTo-SecureString would otherwise reject.
[System.IO.File]::WriteAllText($secretPath, $encryptedKey, (New-Object System.Text.UTF8Encoding($false)))

$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentIdentity, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $secretDirectory -AclObject $acl

$fileAcl = New-Object System.Security.AccessControl.FileSecurity
$fileAcl.SetAccessRuleProtection($true, $false)
$fileRule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentIdentity, "FullControl", "Allow")
$fileAcl.AddAccessRule($fileRule)
Set-Acl -LiteralPath $secretPath -AclObject $fileAcl

Write-Host "Stored with Windows DPAPI outside the repository at $secretPath"
Write-Host "The plaintext key was not printed or written to the repository."
