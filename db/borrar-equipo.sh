#!/usr/bin/env bash
#
# Borra UN equipo registrado por error.
#
#   ./db/borrar-equipo.sh "BAQ-00769"                              # ensayo: solo enseña
#   CONFIRMAR=BORRAR ./db/borrar-equipo.sh "BAQ-00769" --en-serio  # borra de verdad
#
# Se corre EN LA MÁQUINA del compose de producción, desde la carpeta del
# proyecto. Qué borra y cuándo se niega, en `db/borrar-equipo.sql`.
#
# ANTES: ./db/respaldar.sh. Y si el equipo existió y salió del inventario, no
# es esto: es «Dar de baja» en su ficha, que conserva el historial.

set -euo pipefail

COMPOSE="${COMPOSE:-docker compose -f docker-compose.produccion.yml}"
ETIQUETA=""
EN_SERIO=0

for arg in "$@"; do
  case "$arg" in
    --en-serio) EN_SERIO=1 ;;
    *) ETIQUETA="$arg" ;;
  esac
done

if [ -z "$ETIQUETA" ]; then
  echo "Falta la etiqueta: ./db/borrar-equipo.sh \"BAQ-00000\"" >&2
  exit 1
fi

if [ "$EN_SERIO" = "1" ] && [ "${CONFIRMAR:-}" != "BORRAR" ]; then
  echo "Esto BORRA de producción el equipo «${ETIQUETA}» y todo su historial." >&2
  echo "Si de verdad es lo que quieres:" >&2
  echo "  CONFIRMAR=BORRAR ./db/borrar-equipo.sh \"${ETIQUETA}\" --en-serio" >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "── Borrar el equipo «${ETIQUETA}» ($([ "$EN_SERIO" = "1" ] && echo 'EN SERIO' || echo 'ensayo')) ──"
$COMPOSE exec -T postgres psql -q -v ON_ERROR_STOP=1 \
  -v etiqueta="$ETIQUETA" -v en_serio="$EN_SERIO" < "$DIR/borrar-equipo.sql"
