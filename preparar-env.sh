#!/usr/bin/env bash
#
# Prepara el `.env` de producción en la VM. Se corre UNA vez, antes del primer
# `bash desplegar.sh`:
#
#   bash preparar-env.sh
#
# Genera aquí mismo los tres secretos —contraseña de Postgres, secreto de
# sesión y llave de cifrado— para que no viajen por ningún chat, correo ni
# portapapeles, y pregunta lo que solo sabe quien instala: la IP de la VM y las
# redes que pueden entrar.
#
# La llave de cifrado se muestra UNA vez al final, para copiarla al gestor de
# contraseñas de la empresa. Es la misma que tendrá que ir en el `.env` del
# portátil antes de importar los Excel reales (ver .env.produccion.example).
#
# Si `.env` ya existe, no hace nada: pisar una llave de cifrado en uso deja los
# datos cifrados ilegibles para siempre.

set -euo pipefail
cd "$(dirname "$0")"

if [ -e .env ]; then
  echo "Ya existe un .env aquí. No lo toco: reemplazarlo cambiaría la llave de cifrado."
  echo "Si de verdad hay que empezar de cero, renómbralo primero (y guarda su llave)."
  exit 1
fi

command -v openssl >/dev/null || { echo "Falta openssl: sudo apt install -y openssl"; exit 1; }

# Pone el valor en la línea `CLAVE=""` de la plantilla. Los secretos son hex o
# base64 (pueden traer «/» y «+»), así que el separador de sed es «|», que no
# aparece ni en ellos ni en lo que se valida abajo.
poner() {
  local clave="$1" valor="$2"
  grep -q "^${clave}=\"\"$" .env || { echo "La plantilla no tiene ${clave}=\"\""; exit 1; }
  sed -i "s|^${clave}=\"\"$|${clave}=\"${valor}\"|" .env
}

# Lo que se teclea no puede romper el fichero: nada de comillas, «|» ni «\».
limpio() { [[ "$1" != *[\"\|\\]* ]]; }

preguntar() {
  local texto="$1" patron="$2" respuesta
  while true; do
    read -rp "$texto" respuesta
    respuesta="$(echo "$respuesta" | xargs)"   # sin espacios de sobra
    if limpio "$respuesta" && [[ "$respuesta" =~ $patron ]]; then
      echo "$respuesta"
      return
    fi
    echo "  No parece válido, inténtalo otra vez." >&2
  done
}

IP='([0-9]{1,3}\.){3}[0-9]{1,3}'
CIDR="${IP}(/[0-9]{1,2})?"

echo "Preparando el .env de RiwiStock."
echo

sitio="$(preguntar "IP de esta VM (p. ej. 10.0.10.5): " "^${IP}$")"
redes="$(preguntar "Rangos IP que pueden entrar, en números y separados por un espacio: primero la VLAN de usuarios de Medellín, luego la de Barranquilla (p. ej. 10.0.12.0/24 10.20.0.0/24): " "^${CIDR}( ${CIDR})*$")"
razon="$(preguntar "Razón social para las actas (Enter para dejarla vacía): " "^.*$")"
nit="$(preguntar "NIT para las actas (Enter para dejarlo vacío): " "^[0-9.\-]*$")"

cp .env.produccion.example .env
chmod 600 .env   # solo el dueño lo lee: tiene los tres secretos

poner POSTGRES_PASSWORD "$(openssl rand -hex 24)"
poner SESSION_SECRET "$(openssl rand -hex 32)"
poner ENCRYPTION_KEY "$(openssl rand -base64 32)"
poner SITIO "$sitio"
poner REDES_PERMITIDAS "$redes"
poner ORGANIZACION_RAZON_SOCIAL "$razon"
poner ORGANIZACION_NIT "$nit"

echo
echo "Listo: .env creado (solo lo puede leer tu usuario)."
echo
echo "================================================================"
echo " LLAVE DE CIFRADO: cópiala AHORA al gestor de contraseñas."
echo " Sin ella, las claves BIOS y de licencias son irrecuperables."
echo " No la pegues en chats, correos ni documentos."
echo "================================================================"
sed -n 's/^ENCRYPTION_KEY="\(.*\)"$/\1/p' .env
echo "================================================================"
echo
echo "Cuando la hayas guardado, escribe: clear   (la borra de la pantalla)"
