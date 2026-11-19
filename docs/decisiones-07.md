# Decisiones de la etapa 8 — el inventario de RIWI pasa de 2 hojas a 15

Gana sobre `decisiones-06.md` y sobre todo lo anterior.

**La numeración empieza en D43**: `decisiones-06.md` cerró con D42 («sin empresa
no hay acta»). Comprobado antes de crear este fichero.

La etapa va en cinco tramos:

| Tramo | Contenido | Estado |
|---|---|---|
| **8a** | Esquema: `asignable`, `ubicacion_detalle`, transiciones, verificadores | **cerrado** |
| 8b | Licencias: tabla, cifrado, endpoints | pendiente |
| 8c | Importador con mapeo por hoja | pendiente |
| 8d | Reimportación real y limpieza de la bandeja | pendiente |
| 8e | Pantallas | pendiente |

El esquema va **antes** que el importador por lo de siempre: si los datos entran
antes de que la regla exista, la regla ya no se puede imponer sin limpiar a mano.

---

## Lo que la exploración corrigió antes de escribir nada

| El encargo decía | El archivo dice |
|---|---|
| `INVENTARIO_-_RIWI_MED_1.xlsx` | `INVENTARIO_RIWI_MED_1.xlsx`, sin el `_-_` |
| BBL tiene 4 hojas | Tiene 5: hay una `Calendario 2026` de mantenimiento |
| `CONTROL DE CALIDAD` es una columna de texto | Es una **fórmula** sin resultado guardado (D45) |
| `INV - BLACKBIRD` puede solaparse con el fichero de BBL | **Cero** de sus 16 seriales están allí (D46) |
| `INV - LIC WINDOWS` «puede que no sea inventario» | No lo es: cuatro de sus columnas están a 0/3 (D47) |

Los conteos de las quince hojas sí cuadraban los quince.

### Un descuido de la propia exploración

El primer script ocultaba las columnas de secretos **por nombre** —`CLAVE`,
`KEY`, `PASSWORD`— y `SERIAL WINDOWS` no cae en ninguno: volcó cuatro claves de
Windows al log, truncadas a 26 de sus 29 caracteres.

Ahora hay dos filtros y basta con que salte uno: el nombre, y la **forma** del
valor. El segundo es el que vale, porque no depende de acertar con el nombre.
Queda escrito aquí porque la regla 6 del proyecto es sobre los ficheros, y esto
enseña que el log también cuenta.

---

## D43. Vuelve el módulo de licencias

Se eliminó en la etapa 0 porque no existía. Ahora existe: 30 filas con su tipo,
descripción, key, equipo activado, estado, responsable y ubicación.

**No se resucita `LicensesMdmView`.** Aquello era un módulo SaaS con asientos y
renovaciones; esto es un inventario de licencias con su key y el equipo donde
está activada.

**Las keys son secretos bajo el §5**: AES-256-GCM con el mecanismo que ya existe
—no un segundo—, nunca en listados, nunca en exportaciones, nunca en logs, y
accesibles de una en una por rol admin con su fila en `auditoria`.

La licencia de Windows **por equipo** que ya es un campo de `equipos` no se toca
ni se fusiona con esto: son cosas distintas.

### A qué apuntan las 30 licencias, contado

```
  11   etiqueta de un equipo que SÍ está en los ficheros    → FK resuelta
  12   BAQ-00001 … BAQ-00024                                → Barranquilla
   4   «No»                                                 → no activada en ninguno
   2   EF1, EF2                                             → no se sabe qué son
   1   etiqueta que no resuelve                             → a la bandeja
```

**Doce de treinta apuntan a Barranquilla**, y son el 40 % del módulo. Con los
ficheros de Barranquilla resolverían solas; sin ellos se quedan marcadas y la
pantalla de licencias enseñará casi la mitad de sus filas sin equipo.

Es un argumento con número para pedir esos ficheros antes de lo previsto, pero
**no bloquea 8b**: la tabla se construye igual y las filas entran marcadas.

Los cuatro `No` no son un fallo: son licencias compradas y sin activar, y su
`EQUIPO ACTIVADO` va a NULL sin marca. `EF1` y `EF2` sí van a la bandeja, porque
no se sabe qué son.

### Y una cosa que cambia la forma del módulo

```
29 de 30   Local · Windows 11 Pro
 1 de 30   Cuenta · Suite Adobe
```

Casi todo el módulo son licencias de Windows, que es exactamente lo que el campo
`licencia_tipo` / `licencia_serial_cifrado` de `equipos` ya guarda. **Aun así no
se fusionan**, y el motivo es que responden preguntas distintas:

- El campo por equipo responde «¿este portátil tiene licencia, y de qué tipo?».
  Es un atributo de la máquina y muere con ella.
- La tabla responde «¿dónde está activada esta key que compramos?». Es un activo
  con vida propia: se desactiva de un equipo y se activa en otro.

Fusionarlos perdería la segunda, que es la que justifica el módulo.

Se implementa en **8b**.

---

## D44. Equipos que nunca se asignan

Migración `0016`. Columna `asignable boolean NOT NULL DEFAULT true`.

Switches, access points, el rack, las impresoras, los equipos fijos de las salas.
Se inventarían y se mantienen; no se asignan, ni se reservan, ni se prestan, ni
salen en un acta.

### Lo impone la base, no la interfaz

```sql
CHECK (
  asignable
  OR (empleado_id IS NULL AND prestado_a IS NULL
      AND estado::text NOT IN ('Asignado', 'Reservado', 'Prestado'))
)
```

Excluirlos del selector deja la puerta abierta: el día que alguien llame al
endpoint a mano, asigna un switch a una persona y nada lo para.

`De baja` y `En mantenimiento` quedan **fuera** de la prohibición, y eso es la
mitad que importa: un switch se avería y se da de baja igual que un portátil. Lo
que no se hace es entregárselo a alguien.

### La regla es un campo, no un `if`

`Transicion` gana `requiere_asignable`, y de ahí salen las tres cosas a la vez:

1. `mutar` lanza `EquipoNoAsignable` → 409.
2. El catálogo publica `por_estado_no_asignable`, calculado en el servidor.
3. `AccionesEquipo` elige qué lista mirar según la bandera del equipo.

Escrito como un `if` en el repositorio, la tabla diría una cosa y el endpoint
haría otra — que es exactamente lo que dejó un botón dando 404 en la 5d.

La llevan **cuatro** operaciones: `asignar`, `reservar`, `prestar` y `reasignar`.
`devolver`, `liberar` y `recuperar_prestamo` no, aunque parezca simétrico: sacan
de un estado al que un no asignable no debería haber llegado, así que marcarlas
prohibiría lo imposible **e impediría corregir una fila mal importada** sin tocar
la base a mano.

### El 409 no ofrece alternativas

A diferencia de `TransicionIlegal`, que dice qué se puede hacer en su lugar. Aquí
no hay ninguna operación que sirva mientras el equipo siga marcado, y una lista
de opciones que también fallan manda a quien la recibe a probar una por una.

### Cómo se comprobó

Seis casos en `verificar-esquema.sql` —tres negativos, tres positivos— y cuatro
invariantes en `verificar-datos.sql`, incluido uno que la CHECK no alcanza:
**infraestructura dentro de un acta**, porque el acta es otra tabla.

En la batería, las tres operaciones se prueban por separado y no una de muestra:
la regla vive en un campo, y un campo mal puesto en una sola dejaría esa abierta
sin que las otras lo delataran. Falsificado retirando el campo de `asignar`:
caen el caso de la operación y el del catálogo.

Y un caso comprueba que **la CHECK es la que sostiene la regla**: marcar como
infraestructura un equipo que ya está asignado no pasa por `mutar`, así que si la
base no lo parara, la regla se saltaría con un `UPDATE`.

---

## D45. `CONTROL DE CALIDAD` no se importa, pero su fórmula es la especificación

El encargo la daba por «columna de texto, se guarda tal cual». **No se puede**:
es una fórmula de Excel y su resultado no está en el fichero (`result = null` en
las tres hojas que se abrieron). Guardarla «tal cual» guardaría la fórmula o una
cadena vacía.

Lo que contiene, en cambio, vale más que la columna:

```
"Serial duplicado" | "Etiqueta duplicada" | "Nombre duplicado" | "Estado vacío"
| "Sin responsable" | "Estado/usuario inconsistente" | "Sin ubicación"
```

**Es la bandeja de revisión, escrita en Excel.** Y trae además la lista de lo que
el propio fichero considera que no es un valor:

```
N/A · No aplica · No tiene · - · Es de Claro · Sin rotulo · No
```

Eso no lo estábamos adivinando bien: `Es de Claro` y `Sin rotulo` no estaban en
nuestra lista de marcadores.

**Decisión:** la columna no se importa; sus reglas se traducen a motivos de
revisión en 8c, y la lista de marcadores sustituye a la nuestra. Cada motivo que
salga de aquí cita esta decisión, para que se sepa que viene del fichero y no de
una suposición.

### Las siete reglas, transcritas

Alguien redactó una especificación dentro de una fórmula. Se pierde con el
fichero, así que queda aquí.

| # | Regla | Sobre qué columna | Hojas | ¿La tenemos? |
|---|---|---|---|---|
| 1 | **Serial duplicado** | `SERIAL EQUIPO` / `SERIAL / MAC` / `KEY / SERIAL LICENCIA` | 14 | Sí — `SERIAL_DUPLICADO` |
| 2 | **Etiqueta duplicada** | `ETIQUETA` | 12 | Sí — `ETIQUETA_DUPLICADA` |
| 3 | **Estado vacío** | `ESTADO DEL EQUIPO` / `ESTADO` | 12 | No, y **no hace falta**: `estado` es NOT NULL |
| 4 | **Nombre duplicado** | `NOMBRE EQUIPO` | 1 (`STAFF`) | **No. Ver abajo** |
| 5 | **Sin responsable** | `USUARIO RESPONSABLE` | 2 | Sí — `ASIGNADO_SIN_RESPONSABLE` |
| 6 | **Estado/usuario inconsistente** | `USUARIO RESPONSABLE` | 2 | Sí, por CHECK: `equipos_asignado_implica_empleado` |
| 7 | **Sin ubicación** | `UBICACIÓN` | 2 | Sí — `SIN_UBICACION` |

Las reglas 5 y 6 son dos caras de lo mismo y el fichero lo escribe explícito:

- **Sin responsable**: el estado es `Asignado`, `Préstamo`, `Préstamo BBL` o
  `ISF` y la columna de responsable está vacía.
- **Estado/usuario inconsistente**: el estado es `Stock` o `Disponible` **y sin
  embargo hay un responsable escrito**.

La segunda es la que nosotros imponemos con una CHECK desde la etapa 1, y en la
misma dirección. Coincidir en esto sin habernos puesto de acuerdo es la mejor
señal de que la regla es correcta.

### La regla 4 debería ser un invariante nuestro y no lo es

`NOMBRE EQUIPO` es el nombre de red de la máquina —`RIWI-1705`, `BBL-0049`—, y
**dos máquinas con el mismo nombre de red es un problema real**: colisionan en el
dominio, en las licencias y en cualquier inventario que las mire por nombre.

Hoy no lo comprobamos. Los datos dicen que hace falta:

```
INV RIWI STAFF   75 nombres, 73 distintos   →  2 repetidos
INV - CE        177 nombres, 172 distintos  →  5 repetidos
```

Entra en 8c como motivo nuevo `NOMBRE_EQUIPO_DUPLICADO`, y **el fichero es quien
lo pidió**. Es el único caso de los siete en el que el Excel es más estricto que
la base.

### La lista de marcadores, que también estaba ahí

```
N/A · No aplica · No tiene · - · Es de Claro · Sin rotulo · No
```

`Es de Claro` y `Sin rotulo` no estaban en nuestra lista. Sustituyen a la
nuestra en 8c.

---

## D46. `INV - BLACKBIRD` es un préstamo, pero no solapa con BBL

D-bb acertaba en el modelo y erraba en la hipótesis del cruce:

```
filas en BLACKBIRD:                                  16
cuyo serial aparece también en el fichero de BBL:     0
seriales distintos dentro de BLACKBIRD:              12
```

No es el caso de los seis solapados de la 5e: no hay nada que cruzar. Son
monitores y teclados Compumax de RIWI, prestados físicamente, con estado
`Préstamo` y ubicación `Blackbird -P5 Review`.

Entran como `empresa = 'RIWI'`, `prestado_a = 'BBL Labs'`, `estado = 'Prestado'`.

**Los 4 seriales repetidos dentro de la propia hoja** van a la bandeja, no se
deduplican: 16 etiquetas distintas y 12 seriales significa que alguien copió un
serial, y cuál está mal no lo sabemos.

---

## D47. Lo que no se importa

**`INV - LIC WINDOWS`** no es inventario:

```
NO. LICENCIA 0/3   VERSIÓN 0/3   SERIAL 0/3   ASIGNADO 0/3
```

Es una plantilla del proveedor sin rellenar. No se importa, y queda anotado por
si algún día llega con datos.

**`REVISIÓN - RESUMEN`, `Dashboard`, `Inicio`, `TABLA`, `Catálogos`, `Hoja3`**
son hojas de trabajo.

**`REVISIÓN - DETALLE` no se importa pero se lee**, y resultó ser lo más útil del
fichero: ver D49.

---

## D48. `ubicacion_detalle`

Migración `0016`. Columna de texto libre.

Los ficheros traen «P3 OCCI», «P4 OCCI Review», «Pecera», «Reuniones P4»,
«P3 Rack», «BeLAB» en **273 de sus 654 filas**. El modelo solo tiene `sede_id`,
que para todas ellas es Medellín: sin esta columna la sala se pierde, y con ella
la única forma de encontrar físicamente un equipo que no es de nadie.

Texto libre y no una tabla de ubicaciones: no hay catálogo de salas, los nombres
los escribe quien inventaría, y una FK contra algo que nadie mantiene convierte
cada sala nueva en un error de importación. Si algún día hay catálogo, esta
columna dice qué habría que meter en él.

---

## D49. `REVISIÓN - DETALLE` es la bitácora de una consolidación anterior

189 filas con `HOJA ORIGEN`, `FILA ORIGEN`, `HOJA DESTINO`, `CAMPO`,
`VALOR EN DESTINO (CONSERVADO)`, `VALOR EN ORIGEN` y `ACCIÓN / RESULTADO`.

**Alguien ya resolvió estos conflictos a mano y anotó qué decidió.** Lo que dice:

| Acción | Filas |
|---|---|
| Completado desde origen | 97 |
| Conflicto: se conservó el valor del destino (más reciente) | 19 |
| No aplicado: marcador interno del origen, no es una persona | 16 |
| No aplicado: en destino «Stock» y en origen otra cosa | 13 |
| Completado con Inv_Renting (mismo serial) | 12 |
| Informativo: el mismo serial en varias hojas del origen | 6 |
| No aplicado: valor en columna equivocada (posible desplazamiento) | 5 |
| **Excluido por política de seguridad: no se almacenan contraseñas** | 1 |

Tres cosas que esto cambia:

1. **Las colisiones que encontramos ya estaban vistas.** Los 6 seriales
   compartidos entre `INV - BELAB` e `INV - SEDE` están marcados como
   «informativo», y los 2 de `INV - RENTING` × `INV RIWI STAFF` como
   «inconsistencia dentro del archivo origen». Son **la misma máquina en dos
   hojas**, no dos equipos: entran como una fila.

2. **Hay una segunda regla de precedencia, y no contradice a la nuestra: tiene
   otro alcance.** Conviene dejarlo escrito así, porque dentro de seis meses
   parecerán incompatibles.

   | Regla | Alcance | Qué gana |
   |---|---|---|
   | **D31** (5e) | **Entre ficheros**: RIWI contra BBL | El fichero del **dueño** manda en propiedad, specs y etiqueta; el del **prestatario**, en quién lo tiene hoy |
   | **D49** (esta) | **Dentro del mismo libro**: hoja contra hoja | Gana el **destino**, por ser la hoja más reciente |

   No compiten porque no se aplican a lo mismo. Un serial que aparece en
   `INV - BELAB` y en `INV - SEDE` es un conflicto interno del libro de RIWI y lo
   resuelve D49; un serial que aparece en el libro de RIWI y en el de BBL es un
   equipo compartido entre dos empresas y lo resuelve D31.

   El orden de aplicación importa y es este: **primero D49 dentro de cada libro**
   —que deja un libro sin duplicados internos—, **después D31 entre los dos**.
   Al revés habría que decidir con qué versión de la fila de RIWI se compara la
   de BBL, que es justo la pregunta que D49 responde.

3. **La última línea aplica nuestra propia regla 4 antes que nosotros.** Johan ya
   excluyó una contraseña «por política de seguridad».

---

## D50. `INV - CE`: infraestructura, y sus pantallas y teclados son activos

Las dos preguntas que quedaban abiertas, decididas con los datos delante.

### Las 177 filas entran como infraestructura

Sus 177 filas dicen `Asignado` y **ninguna tiene responsable**: la columna no
existe en esa hoja. «Asignado» ahí significa «en uso en la sala P3 OCCI», no «a
una persona». Importarlas como `Asignado` chocaría contra
`equipos_asignado_implica_empleado`, que existe desde la etapa 1.

Entran como `asignable = false`, `estado = 'Disponible'`, y la sala en
`ubicacion_detalle`. `Disponible` no es una afirmación sobre su uso: con
`asignable = false` no se puede entregar, así que es simplemente el estado
operativo de un equipo que funciona.

**No se inventa un estado nuevo.** Añadir «En sala» al enum obligaría a decidir
sus transiciones, sus operaciones y su sitio en cinco pantallas, y el hecho que
representa ya lo cuenta la bandera.

### Pantalla y teclado son filas propias; el ratón no

| | Etiquetas | Distintas | Seriales |
|---|---|---|---|
| Pantalla | 168 | **168** | 42 |
| Teclado | 168 | 164 | 0 |
| Ratón | **0** | 0 | 0 |

Las pantallas tienen etiqueta propia y **todas únicas**, y ninguna choca con una
etiqueta de equipo: son activos numerados aparte, y tratarlos como campos
perdería 168 activos del inventario. Los teclados igual, con 4 etiquetas
repetidas que van a la bandeja.

El ratón solo tiene marca. No es un activo: es una nota, y va a `notas`.

**Sin relación padre-hijo.** El vínculo con su equipo se guarda en `notas` por
ahora. Crear `equipo_padre_id` es un concepto nuevo que toca listados, filtros,
actas y bajas —¿se da de baja la pantalla cuando se da de baja el equipo?— y no
cabe en esta etapa. Queda anotado en `pendientes.md`: esta decisión es la que lo
justificará cuando toque.

---

## D51. `CORREO DE RECUPERACIÓN` se guarda cifrado

Seis celulares, y la exploración encontró lo que el encargo sospechaba:

```
NÚMERO                  6 valores, 5 distintos    (un número repetido)
CORREO / WHATSAPP       6 valores, 6 distintos
CORREO DE RECUPERACIÓN  6 valores, 3 distintos  ← la misma en tres equipos
```

Una cuenta de recuperación **compartida entre tres celulares** no es un dato de
contacto: es la llave para reponer el acceso a esos tres. Se guarda, por decisión
de Johan, y se guarda **bajo el §5**: cifrada con el mecanismo que ya existe,
fuera de listados y exportaciones, y accesible de una en una con su fila de
auditoría, igual que `bios_password`.

`NÚMERO` y `CORREO / WHATSAPP` son datos de contacto normales y van en claro.

## D52. Una baja se puede revertir

Hasta aquí «De baja» era terminal: ninguna operación salía de él. El RIWI-1730
(un MacBook Air) quedó dado de baja y sigue en uso; hay que devolverlo a
circulación y asignárselo a una persona. Sin una operación, la única salida era
un UPDATE a mano, que deja el estado sin movimiento que lo explique (D19,
`verificar-datos.sql` §F2).

- `revertir_baja` en `db/transiciones.ts` (botón «Recuperar de baja»): de `De baja` a `Disponible`, con el
  movimiento nuevo `Reversión de baja` (migración 0029).
- Vuelve a **Disponible**, no a Asignado: «la baja fue un error» y «se le
  entrega a alguien» son dos hechos, y el historial los cuenta como dos, igual
  que `reasignar`. Después se asigna con la operación de siempre.
- Mismo permiso que dar de baja: quien puede una puede la otra, y las dos quedan
  en el historial con su autor.
- §F2 trata `Reversión de baja` como un movimiento que deja el equipo
  `Disponible`.

## D53. Las salas de entrenamiento van aparte en todo el inventario

Pedido del usuario: «los equipos de salas de entrenamiento deben ir aparte de
los equipos de RIWI staff, no se deben mezclar en ninguna zona del inventario,
hasta en el dashboard». Las salas ya tenían su pestaña, pero el resto los sumaba
con el staff.

- **Listado** (`GET /api/equipos` y la bandeja): sin `ce`, solo staff. `ce=true`,
  solo salas (el botón «Centros de entrenamiento»); `ce=todos`, los dos, solo
  para vincular licencias, que se ponen a cualquier equipo. Los chips de empresa
  cuentan lo mismo que la lista.
- **Dashboard** (`GET /api/equipos/resumen`): `total`, `por_estado` y
  `por_categoria` son del staff; las salas en `salas`, con su tarjeta propia.
  Staff + salas = la tabla entera (test contra SQL). El badge de mantenimiento
  del menú suma los dos, porque la vista de Mantenimiento tiene los partes de
  los dos.
- **Empresas y sedes** y **Sedes**: conteos solo del staff; cada sede enseña sus
  equipos de sala en una línea aparte.
- **Disponibles**: botón del dashboard que lleva a lo Disponible del staff, en
  dos bloques (equipos y periféricos), con solo dos filtros: sede y empresa.

## D54. Equipos y periféricos, dos nombres aparte

Pedido del usuario: «que los equipos no se concentren en un solo nombre, sino
equipos como portátiles y desktop, y periféricos como un nombre aparte».

- **Equipos**: Portátil, Desktop, Celular y Tablet, los objetos principales.
  **Periféricos**: todo lo demás (Monitor, Teclado, Mouse, Diadema, Otro), y
  también cualquier categoría nueva, para que no desaparezca de los dos lados.
- La lista vive en `db/clases-equipo.ts`, una sola vez: la leen el filtro
  `clase` de `GET /api/equipos`, el selector de Inventario y `esPeriferico`.
- Inventario abre en **Equipos**, con «Periféricos» y «Todo» a un clic y su
  número al lado (`conteos_clase`, con la misma regla de salas que la lista,
  D53). El desplegable de categoría solo ofrece las de la clase elegida.

## D55. Filtros en un solo bloque y un dashboard que se lee de un vistazo

Pedido del usuario: filtros «full, no redundantes, una experiencia amena e
intuitiva», y un dashboard con más gráficas y datos para leer el inventario
desde la primera página.

- **Filtros** (`FiltrosInventario.tsx`): eran cinco capas sueltas (clase, chips
  de empresa con nota, pestañas, seis controles y un botón de salas que repetía
  la pestaña). Ahora: las pestañas arriba; debajo un solo bloque con *qué busco*
  (equipos / periféricos / todo y el buscador), *afinar* (estado, tipo, empresa
  con su número, sede, uso y ámbito staff/salas, del mismo tamaño) y *lo que
  está puesto* como pastillas que se quitan solas. «Sin clasificar» sigue
  visible sin ir a buscarlo (D28), como aviso que filtra con un clic.
- **Dashboard**: cuatro cifras (staff, asignados, disponibles, piden atención),
  estado del staff, por empresa, por sede, disponible para entregar por tipo,
  las salas aparte (D53) y la actividad reciente. Todo del staff; el resumen
  (`GET /api/equipos/resumen`) trae los desgloses nuevos y un test comprueba
  que cada uno reparte el mismo total.
