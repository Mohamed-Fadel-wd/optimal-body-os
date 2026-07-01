$ErrorActionPreference = "Stop"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  $nodePath = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
} else {
  $nodePath = $node.Source
}

$securePassword = Read-Host "Choose the Optimal Body OS login password" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $passwordHash = & $nodePath "$PSScriptRoot\hash-password.js" $plainPassword
  $jwtSecret = & $nodePath --input-type=module -e "import crypto from 'node:crypto'; console.log(crypto.randomBytes(48).toString('base64url'))"

  $envPath = Join-Path $PSScriptRoot "..\.env"
  $updated = Get-Content $envPath | ForEach-Object {
    if ($_.StartsWith("APP_PASSWORD_HASH=")) {
      "APP_PASSWORD_HASH=$passwordHash"
    } elseif ($_.StartsWith("JWT_SECRET=")) {
      "JWT_SECRET=$jwtSecret"
    } else {
      $_
    }
  }
  Set-Content -Path $envPath -Value $updated -Encoding utf8
  Write-Host ""
  Write-Host "Authentication configured. You can close this window." -ForegroundColor Green
} finally {
  if ($plainPassword) { $plainPassword = $null }
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}

Read-Host "Press Enter to close"
