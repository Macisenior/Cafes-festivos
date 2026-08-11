$ErrorActionPreference = 'Stop'
function Convert-SecureStringToPlainText([Security.SecureString]$value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}
$operationalSecure = Read-Host 'PIN Operativa (oculto)' -AsSecureString
$administrationSecure = Read-Host 'PIN Administración (oculto)' -AsSecureString
$env:V4_PRODUCTION_OPERATIONAL_PIN_TEST = Convert-SecureStringToPlainText $operationalSecure
$env:V4_PRODUCTION_ADMINISTRATION_PIN_TEST = Convert-SecureStringToPlainText $administrationSecure
$env:V4_RUN_APPROVED_PRODUCTION_SMOKE = 'true'
try { npx tsx scripts/production-contribution-smoke.ts }
finally {
  Remove-Item Env:V4_PRODUCTION_OPERATIONAL_PIN_TEST,Env:V4_PRODUCTION_ADMINISTRATION_PIN_TEST,Env:V4_RUN_APPROVED_PRODUCTION_SMOKE -ErrorAction SilentlyContinue
}
Read-Host 'Prueba finalizada. Pulsa Enter para cerrar'