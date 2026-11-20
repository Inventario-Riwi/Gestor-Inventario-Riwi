# Traspaso: dónde quedó RiwiStock y cómo seguir

Para retomar el trabajo en otra máquina o en otra sesión sin depender de la
memoria de nadie. Escrito el 20 de noviembre de 2026.

Las fuentes de verdad siguen siendo las de `CLAUDE.md` (plan, `decisiones-0x.md`,
`esquema.md`, `despliegue.md`). Este documento no las repite: dice **en qué
estado está todo** y **qué falta**.

---

## 1. Estado en una línea

En producción y en uso. La aplicación corre en la VM interna de Medellín (ver
`despliegue.md` § «Red interna»), RIWI y Blackbird Labs están cargados, y falta
migrar **Emerald Fire** (prevista para esta semana).

| Qué | Dónde está |
|---|---|
| Código | GitHub `Inventario-Riwi/Gestor-Inventario-Riwi`, rama **`mejoras-y-despliegue-interno`** (todavía no fusionada a `master`) |
| Producción | VM de Proxmox en Medellín, carpeta `~/riwistock`, desplegada desde esa misma rama |
| Migraciones | Hasta **0029** (`0029_reversion_de_baja.sql`) |
| Tests | `npm test`: 261+ en verde al cierre (el número crece con cada cambio) |
| Manual para el equipo de TI | `docs/manual/generar-manual.cjs` (ver § 6) |

---

## 2. Arrancar en otra máquina

Lo general está en `despliegue.md` § «Puesta en marcha». Lo que **no** viaja con
el repositorio y hay que traer aparte, por canal seguro:

| Qué | Por qué no está en Git | De dónde sale |
|---|---|---|
| `.env` | Credenciales locales | Copiar `.env.example` y rellenar. Generar contraseñas nuevas |
| `ENCRYPTION_KEY` de **producción** | Descifra BIOS y licencias | Gestor de contraseñas corporativo (custodia: analista y líder de TI). Ver `despliegue.md` § «Custodia» |
| `data/origen/` (los Excel) | Contienen contraseñas en claro (regla 6 de `CLAUDE.md`) | Copia controlada, nunca por correo ni chat |

### Particularidades de Windows (la máquina donde se construyó)

- `npm.cmd` en vez de `npm` desde PowerShell: la política de ejecución bloquea
  `npm.ps1`.
- La base local escucha en el **5433**, no en el 5432 (`despliegue.md`).
- Docker Desktop tiene que estar **abierto**; si no, todo falla con
  `ECONNREFUSED` o «Error interno».
- `PORT` del servidor: por defecto 3000. Si otra aplicación lo ocupa, arrancar
  con `PORT=3100`. Producción ya pasa `PORT=3000`.
- No hay Python ni poppler: los PDF se generan con `pdfkit`, que ya está en las
  dependencias.

---

## 3. Producción: lo que hay y cómo se opera

Los comandos van **uno por uno** por SSH a la VM, desde `~/riwistock`.

| Tarea | Comando |
|---|---|
| Actualizar | `git pull` y luego `bash desplegar.sh` (respalda, migra, levanta y comprueba) |
| Respaldo manual | `sudo bash db/respaldar.sh` (el automático corre a las 3:15 a. m., guarda 14) |
| Crear una cuenta | `sudo docker compose -f docker-compose.produccion.yml exec -it app node dist/herramientas/crear-usuario.cjs <correo> "<Nombre>" <admin\|tecnico> --temporal` |
| Borrar un equipo registrado por error | `sudo bash db/borrar-equipo.sh "<ETIQUETA>"` (ensayo) y luego `sudo CONFIRMAR=BORRAR bash db/borrar-equipo.sh "<ETIQUETA>" --en-serio` |
| Dejar un solo colaborador y sus equipos | `sudo bash db/dejar-solo-a.sh "<Nombre>"` (ensayo) y luego con `CONFIRMAR=BORRAR ... --en-serio` |

Reglas de operación que se han mantenido todo el proyecto:

- **Respaldo antes de cualquier borrado**, y siempre el ensayo primero.
- Las contraseñas temporales se generan en el **gestor de contraseñas** y se
  comparten por él. Nunca en un chat, un correo o una captura.
- Un equipo que existió y salió del inventario **se da de baja**, no se borra.
  Borrar es solo para registros que no debieron existir.

---

## 4. Lo que se construyó en esta tanda (de la 0021 a la 0029)

Por orden, con su commit o decisión para ir al detalle:

| Tema | Dónde mirar |
|---|---|
| Emerald Fire como tercera empresa, colores por empresa | 0021 |
| Sedes: Medellín, Barranquilla, Cartagena, Remoto; residencia de remotos | 0022, `rutas/empleados.ts` |
| Conjuntos (computador + partes) y centros de entrenamiento | 0024 |
| Cambio de contraseña obligatorio en el primer ingreso | 0025 |
| Formulario de alta por tipo; Tablet e IMEI | 0026, `src/lib/tipos-equipo.ts` |
| Salas de entrenamiento: puestos completos, mouse sin serial | 0027, `SalasEntrenamiento.tsx` |
| Uso exclusivo: Préstamo interno y Eventos (no se asignan) | 0028, `PERMITIDAS_CON_USO` en `db/transiciones.ts` |
| Recuperar de baja | 0029 |
| Ventana de confirmación única y aviso de cambios sin guardar | `src/components/Confirmacion.tsx` |
| Reactivar ficha de colaborador | `EmployeesView.tsx` |
| Remotos: el equipo asignado queda en su residencia y la sigue | `mutar` en `db/repositorios/movimientos.ts` |
| «N/A» en serial o etiqueta = sin dato, repetible | `db/marcadores.ts` (compartido con el importador) |
| Nombre legible de periféricos | `src/lib/nombre-equipo.ts` |
| Empresas y sedes en tarjetas; botón Nueva sede (admin, con ciudad) | `src/lib/ubicaciones.ts` |
| Listas de colaboradores y de entregables sin el tope de 200 | `GET /api/empleados/activos`, `GET /api/equipos/entregables` |
| Equipos y periféricos como clases; filtros en un bloque; dashboard | D54, D55 en `decisiones-07.md` |

---

## 5. Pendientes

### Datos y producción

- [ ] **Migrar Emerald Fire** (esta semana). Ajustar su catálogo en
      `db/hojas.ts` como se hizo con RIWI y BBL, probar con
      `node --import tsx db/importar.ts "<hoja|empresa>"` contra una base
      aparte, y cargar en producción con respaldo previo.
- [ ] **Mouse de las salas de entrenamiento**: el Excel no dice si cada puesto
      trae mouse. Si todos lo traen sin serial, el importador puede marcar
      `mouse_sin_serial`; si no, se marca a mano en la ficha. No se supone
      (regla 3).
- [ ] **VLAN 40**: confirmar que está en la regla de la FortiGate **y** en
      `REDES_PERMITIDAS` del `.env` de la VM.
- [ ] **Armenia y San Andrés**: crearlas en producción con Sedes → Nueva sede,
      si no se ha hecho.
- [ ] **Cuentas** que falten del equipo de TI, todas con `--temporal`.

### Infraestructura

- [ ] Instalar el certificado interno (CA de Caddy) en los equipos que entran,
      para que el navegador no muestre la advertencia.
- [ ] Pedir a quien administra el Proxmox copias de la VM y un disco de
      40–50 GB.
- [ ] Fusionar la rama a `master` y pasar la VM a desplegar desde `master`.

### Código

- [ ] Un `PATCH /api/equipos/:id` sin ningún campo válido responde 500 («No
      values to set») en vez de un 400 claro. Existe desde antes; lo enseña un
      test de campos cifrados.
- [ ] Lo abierto en `docs/pendientes.md` sigue vigente.

### Limpieza de la máquina de desarrollo

- [ ] Bases de prueba locales: `inventario_demo`, `inventario_carga`,
      `inventario_carga_2`, `inventario_carga_3`.
- [ ] En la base de desarrollo: la cuenta `capturas@riwistock.test`, la ficha
      ficticia «Persona de Prueba» y las sedes Armenia y San Andrés creadas para
      probar.

---

## 6. El manual para el equipo de TI

El PDF lleva la dirección real del servidor, así que **no se sube**: se genera.

```bash
RIWISTOCK_URL="https://<ip-de-la-vm>" node docs/manual/generar-manual.cjs
```

Sale como `RiwiStock-Manual.pdf` en la raíz del proyecto. Para que Git no lo
recoja, añadirlo a `.git/info/exclude` en cada máquina (en la original ya está).
Si cambia una pantalla o un procedimiento, se edita el texto del generador y se
vuelve a generar.

---

## 7. Cómo se ha trabajado con el usuario

Para quien retome, sea persona o asistente:

- **Una mejora a la vez.** Antes de tocar código se explica en pocas líneas qué
  se va a hacer y se espera la aprobación.
- **Sin saturar**: respuestas cortas, en español, y los comandos para la VM uno
  por uno, porque se pegan a mano en la consola SSH.
- **Capturas** de lo hecho antes de pedir el commit.
- Los cambios se prueban en la aplicación local y con `npm test`; las
  operaciones de borrado, primero sobre una copia desechable de la base.
- Nada de contraseñas, claves ni la `ENCRYPTION_KEY` en el chat ni en el
  repositorio.
