#!/usr/bin/env bash
#
# Pone en la VM la última versión de RiwiStock. Un solo comando, desde la
# carpeta del proyecto en la VM:
#
#   bash desplegar.sh
#
# Sirve igual para la primera instalación y para cada actualización. El orden
# importa y no se salta:
#
#   1. Respaldo de la base, ANTES de tocar nada. Si algo sale mal, de aquí se
#      vuelve (db/restaurar.sh).
#   2. Código nuevo (git pull, solo si avanza en línea recta: un pull que
#      necesite mezclar es que alguien tocó el código en la VM, y eso se mira
#      a mano, no se resuelve solo).
#   3. Imagen nueva de la aplicación.
#   4. Migraciones, con la imagen NUEVA y antes de arrancarla: la aplicación
#      nueva puede necesitar columnas que solo crea la migración nueva.
#   5. Arranque, y comprobación de que responde.
#
# Si un paso falla, el script se detiene ahí (set -e): lo que estaba corriendo
# sigue corriendo, porque la aplicación vieja no se para hasta el paso 5.

set -euo pipefail
cd "$(dirname "$0")"

# Docker con `sudo` solo si hace falta. En la VM el usuario NO está en el grupo
# `docker` a propósito (ese grupo equivale a root sin contraseña), así que hay
# que pedirlo. Y solo para Docker: correr el script entero con sudo haría el
# `git pull` como root, que no tiene la llave de GitHub del usuario.
SUDO=""
if [ "$(id -u)" -ne 0 ] && ! docker info >/dev/null 2>&1; then
  SUDO="sudo"
  sudo -v   # pide la contraseña ahora, no a mitad del despliegue
fi
COMPOSE="$SUDO docker compose -f docker-compose.produccion.yml"
export COMPOSE   # db/respaldar.sh lo lee del entorno

paso() { printf '\n== %s\n' "$1"; }

paso "1/5 Respaldo de la base"
if $COMPOSE ps --status running --services 2>/dev/null | grep -qx postgres; then
  bash db/respaldar.sh
else
  echo "La base todavía no está corriendo (primera instalación): no hay nada que respaldar."
fi

paso "2/5 Código nuevo"
git pull --ff-only

paso "3/5 Construir la aplicación"
$COMPOSE build app

paso "4/5 Migraciones"
$COMPOSE up -d postgres
# `run` espera a que la base esté sana (depends_on) y usa la imagen recién
# construida. El contenedor de la migración se borra al terminar.
$COMPOSE run --rm app node dist/herramientas/migrar.cjs

paso "5/5 Arrancar"
$COMPOSE up -d

for _ in $(seq 1 30); do
  if $COMPOSE exec -T app node -e \
    "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))" \
    2>/dev/null; then
    printf '\nListo: RiwiStock responde.\n'
    exit 0
  fi
  sleep 2
done

printf '\nLa aplicación no respondió en 60 segundos. Para ver por qué:\n'
echo "  $COMPOSE logs app --tail 50"
exit 1
