#!/usr/bin/env bash
#
# Programa el respaldo diario de RiwiStock en la VM. Se corre una vez:
#
#   bash programar-respaldo.sh
#
# Deja tres cosas:
#
#   1. /etc/cron.d/riwistock-respaldo: `db/respaldar.sh` todos los días a las
#      03:15, como root (Docker lo necesita y root no pide contraseña a las
#      tres de la mañana). Antes de las 04:00, que es cuando se le pide a
#      Proxmox que copie la VM entera: así esa copia ya lleva el respaldo del día.
#   2. /etc/logrotate.d/riwistock-respaldo: el registro no crece para siempre
#      en un disco de 23 GB.
#   3. Un respaldo AHORA, para ver que funciona antes de confiar en el de
#      esta noche. Un respaldo programado que nadie vio correr no es un respaldo.
#
# Se puede volver a correr: reescribe los dos ficheros, no los duplica.
#
#   bash programar-respaldo.sh --simular   # enseña lo que escribiría, sin tocar nada

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRO=/var/log/riwistock-respaldo.log

CRON="# RiwiStock: respaldo diario verificado (ver ${DIR}/programar-respaldo.sh)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 3 * * * root cd ${DIR} && bash db/respaldar.sh >> ${REGISTRO} 2>&1
"

LOGROTATE="${REGISTRO} {
	weekly
	rotate 8
	compress
	missingok
	notifempty
}
"

if [ "${1:-}" = "--simular" ]; then
  echo "== /etc/cron.d/riwistock-respaldo"; printf '%s' "$CRON"
  echo "== /etc/logrotate.d/riwistock-respaldo"; printf '%s' "$LOGROTATE"
  echo "== y después: un respaldo ahora mismo con db/respaldar.sh"
  exit 0
fi

[ -f "${DIR}/.env" ] || { echo "No hay .env en ${DIR}: primero bash preparar-env.sh y bash desplegar.sh"; exit 1; }

echo "Programando el respaldo diario (pide tu contraseña para sudo)…"
printf '%s' "$CRON" | sudo tee /etc/cron.d/riwistock-respaldo > /dev/null
sudo chmod 644 /etc/cron.d/riwistock-respaldo
printf '%s' "$LOGROTATE" | sudo tee /etc/logrotate.d/riwistock-respaldo > /dev/null
sudo chmod 644 /etc/logrotate.d/riwistock-respaldo

echo
echo "Haciendo un respaldo ahora, para comprobar que funciona…"
if sudo bash -c "cd '${DIR}' && bash db/respaldar.sh" 2>&1 | sudo tee -a "${REGISTRO}"; then
  echo
  echo "Listo: respaldo diario a las 03:15, y el de ahora salió bien."
  echo "Para ver los que hay:  sudo docker compose -f docker-compose.produccion.yml exec postgres ls -lh /respaldos"
else
  echo
  echo "El respaldo de prueba FALLÓ. La tarea quedó programada, pero arréglalo antes de confiar en ella."
  echo "El detalle está en ${REGISTRO}"
  exit 1
fi
