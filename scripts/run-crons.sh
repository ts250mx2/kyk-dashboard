#!/usr/bin/env bash
# Cron de KYK Dashboard: evalúa alertas y manda reportes programados por WhatsApp.
#
# Pega cada 5 minutos a los dos endpoints cron-callables de la app:
#   POST /api/agent/alerts/evaluate   (alertas: si se disparan y tienen teléfono, mandan WhatsApp)
#   POST /api/agent/schedules/run     (reportes programados: digest + link por WhatsApp)
#
# Cada endpoint decide internamente qué toca en esta pasada (5min/hourly/daily/weekly),
# así que es seguro llamarlo cada 5 minutos; no manda duplicados.
#
# Instalación (en el servidor):
#   chmod +x /ruta/al/proyecto/scripts/run-crons.sh
#   crontab -e   y agregar:
#     */5 * * * * /ruta/al/proyecto/scripts/run-crons.sh >> /var/log/kyk-crons.log 2>&1
#
# Config: BASE_URL y CRON_SECRET se pueden sobreescribir por variables de entorno.

set -u

BASE_URL="${BASE_URL:-http://localhost:3002}"
CRON_SECRET="${CRON_SECRET:-9lx58iocayrjnsu3hmgtdbzwq7k4f2vp1e06}"

call_endpoint() {
    local name="$1" path="$2"
    local response http_code body
    response=$(curl -sS -m 300 -w '\n%{http_code}' -X POST "$BASE_URL$path" \
        -H "X-Cron-Secret: $CRON_SECRET" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    if [ "$http_code" = "200" ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S')  $name OK $body"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S')  $name ERROR ($http_code) $body"
    fi
}

call_endpoint "alertas"   "/api/agent/alerts/evaluate"
call_endpoint "schedules" "/api/agent/schedules/run"
