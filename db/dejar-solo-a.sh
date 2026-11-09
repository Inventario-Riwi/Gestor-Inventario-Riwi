#!/usr/bin/env bash
#
# Deja en la base UN colaborador y sus equipos asignados; borra el resto.
#
#   ./db/dejar-solo-a.sh "Sebastian Espitia"                              # ensayo: solo cuenta
#   CONFIRMAR=BORRAR ./db/dejar-solo-a.sh "Sebastian Espitia" --en-serio  # borra de verdad
#
# Se corre EN LA MÁQUINA del compose de producción, desde la carpeta del
# proyecto. Lo que hace y lo que no, en `db/dejar-solo-a.sql`.
#
# ============================================================================
# ANTES: ./db/respaldar.sh. Esto no se deshace de otra forma.
# ============================================================================
#
# Sin `--en-serio` no borra nada: cuenta qué se quedaría y qué se iría, y
# deshace. Con `--en-serio` hay que escribir además CONFIRMAR=BORRAR, igual que
# `restaurar.sh` pide RESTAURAR: borrar producción no pasa por un argumento
# puesto de más.

set -euo pipefail

COMPOSE="${COMPOSE:-docker compose -f docker-compose.produccion.yml}"
NOMBRE=""
EN_SERIO=0

for arg in "$@"; do
  case "$arg" in
    --en-serio) EN_SERIO=1 ;;
    *) NOMBRE="$arg" ;;
  esac
done

if [ -z "$NOMBRE" ]; then
  echo "Falta el nombre: ./db/dejar-solo-a.sh \"Nombre Apellido\"" >&2
  exit 1
fi

if [ "$EN_SERIO" = "1" ] && [ "${CONFIRMAR:-}" != "BORRAR" ]; then
  echo "Esto BORRA de la base de producción todo lo que no sea de «${NOMBRE}»." >&2
  echo "Si de verdad es lo que quieres:" >&2
  echo "  CONFIRMAR=BORRAR ./db/dejar-solo-a.sh \"${NOMBRE}\" --en-serio" >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "── Dejar solo a «${NOMBRE}» ($([ "$EN_SERIO" = "1" ] && echo 'EN SERIO' || echo 'ensayo')) ──"
$COMPOSE exec -T postgres psql -q -v ON_ERROR_STOP=1 \
  -v nombre="$NOMBRE" -v en_serio="$EN_SERIO" < "$DIR/dejar-solo-a.sql"
