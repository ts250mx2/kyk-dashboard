# Cron de KYK Dashboard: evalúa alertas y manda reportes programados por WhatsApp.
#
# Pega cada 5 minutos a los dos endpoints cron-callables de la app:
#   POST /api/agent/alerts/evaluate   (alertas: si se disparan y tienen teléfono, mandan WhatsApp)
#   POST /api/agent/schedules/run     (reportes programados: digest + link por WhatsApp)
#
# Cada endpoint decide internamente qué toca en esta pasada (5min/hourly/daily/weekly),
# así que es seguro llamarlo cada 5 minutos; no manda duplicados.
#
# Registro en Task Scheduler (correr UNA vez en PowerShell como admin, en el servidor):
#   schtasks /Create /TN "KYK\AlertasWhatsApp" /SC MINUTE /MO 5 `
#     /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\ruta\al\proyecto\scripts\run-crons.ps1" `
#     /RU SYSTEM /RL LIMITED /F
#
# Logs: scripts\cron-log.txt (se trunca solo, conserva las últimas ~500 líneas).

param(
    # URL base de la app. En el servidor, donde corre `next start -p 3002`, usa localhost.
    [string]$BaseUrl = 'http://localhost:3002',
    # Debe coincidir con CRON_SECRET del .env de la app.
    [string]$CronSecret = '9lx58iocayrjnsu3hmgtdbzwq7k4f2vp1e06'
)

$ErrorActionPreference = 'Continue'
$logFile = Join-Path $PSScriptRoot 'cron-log.txt'

function Write-Log([string]$msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Add-Content -Path $logFile -Value $line -Encoding utf8
}

function Invoke-CronEndpoint([string]$name, [string]$path) {
    try {
        $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" `
            -Headers @{ 'X-Cron-Secret' = $CronSecret } -TimeoutSec 300
        $summary = $resp.summary | ConvertTo-Json -Compress -Depth 5
        Write-Log "$name OK $summary"
    } catch {
        Write-Log "$name ERROR $($_.Exception.Message)"
    }
}

Invoke-CronEndpoint 'alertas'   '/api/agent/alerts/evaluate'
Invoke-CronEndpoint 'schedules' '/api/agent/schedules/run'

# Truncar log: conserva las últimas 500 líneas para que no crezca sin límite.
if (Test-Path $logFile) {
    $lines = Get-Content $logFile
    if ($lines.Count -gt 500) {
        $lines | Select-Object -Last 500 | Set-Content $logFile -Encoding utf8
    }
}
