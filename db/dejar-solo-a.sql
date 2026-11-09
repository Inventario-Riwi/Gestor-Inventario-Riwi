-- Deja en la base UN colaborador y sus equipos asignados; borra el resto.
--
-- No se corre a mano: lo llama `db/dejar-solo-a.sh`, que pasa dos variables
-- de psql:
--
--   :nombre    las palabras del nombre, en orden («Sebastian Espitia»)
--   :en_serio  1 para borrar; 0 (por defecto) solo cuenta y deshace
--
-- Lo que se QUEDA: esa persona, los equipos a su nombre (y sus partes), su
-- historial y sus actas. Las cuentas de la aplicación, las sedes, el catálogo
-- de motivos y la auditoría no se tocan. La auditoría
-- recibe una fila que dice que esto pasó.
--
-- Lo que se BORRA: los demás colaboradores y los demás equipos, con sus
-- movimientos, actas, partes de mantenimiento y licencias ligadas, y las
-- corridas de importación que se quedan sin nada.
--
-- Se NIEGA, sin borrar nada, si lo que se queda depende de lo que se va: un
-- movimiento de uno de sus equipos que nombra a otra persona, un acta que
-- mezcla equipos que se quedan con equipos que se van, o un equipo suyo que
-- menciona a otro colaborador. Borrar a esa persona rompería el historial que
-- se quiere conservar, y decidir qué hacer con eso no le toca a un script.
--
-- Todo en UNA transacción: o pasa entero o no pasa nada.

\set ON_ERROR_STOP on
\if :{?en_serio}
\else
  \set en_serio 0
\endif

BEGIN;

-- `\gset` y no un SELECT suelto: guarda sin imprimir nada.
SELECT set_config('dejar.nombre', :'nombre', true) AS _n \gset

-- ---------------------------------------------------------------------------
-- 1. Quién se queda: exactamente una persona
-- ---------------------------------------------------------------------------
--
-- Por palabras y sin tildes ni mayúsculas: «Sebastian Espitia» encuentra a
-- «Sebastián Espitia Rojas». Si encuentra cero o más de una, se detiene y las
-- enseña: elegir entre dos personas no lo hace un script.
CREATE TEMP TABLE queda_persona ON COMMIT DROP AS
SELECT p.id, p.nombre
  FROM empleados p
 WHERE translate(lower(p.nombre), 'áéíóúüñ', 'aeiouun')
       LIKE '%' || replace(translate(lower(btrim(current_setting('dejar.nombre'))), 'áéíóúüñ', 'aeiouun'), ' ', '%') || '%';

DO $$
DECLARE n int; lista text;
BEGIN
  SELECT count(*), string_agg(q.nombre, ' | ') INTO n, lista FROM queda_persona q;
  IF n = 0 THEN
    RAISE EXCEPTION 'No hay ningún colaborador cuyo nombre contenga «%». No se borró nada.',
      current_setting('dejar.nombre');
  ELSIF n > 1 THEN
    RAISE EXCEPTION 'Hay % colaboradores que coinciden con «%»: %. Escribir el nombre más completo. No se borró nada.',
      n, current_setting('dejar.nombre'), lista;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Qué equipos se quedan: los suyos asignados y las partes de esos
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE queda_equipo ON COMMIT DROP AS
SELECT e.id FROM equipos e JOIN queda_persona q ON q.id = e.empleado_id
UNION
SELECT parte.id
  FROM equipos parte
  JOIN equipos torre ON torre.id = parte.equipo_principal_id
  JOIN queda_persona q ON q.id = torre.empleado_id;

CREATE TEMP TABLE va_equipo ON COMMIT DROP AS
SELECT e.id FROM equipos e WHERE e.id NOT IN (SELECT qe.id FROM queda_equipo qe);

CREATE TEMP TABLE va_persona ON COMMIT DROP AS
SELECT p.id FROM empleados p WHERE p.id NOT IN (SELECT q.id FROM queda_persona q);

-- Un acta se va si incluye algún equipo que se va, o si es de otra persona.
CREATE TEMP TABLE va_acta ON COMMIT DROP AS
SELECT a.id FROM actas a
 WHERE a.empleado_id IN (SELECT vp.id FROM va_persona vp)
    OR EXISTS (SELECT 1 FROM actas_equipos ae
                WHERE ae.acta_id = a.id AND ae.equipo_id IN (SELECT ve.id FROM va_equipo ve));

-- ---------------------------------------------------------------------------
-- 3. Lo que impediría hacerlo sin romper lo que se queda
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE conflicto ON COMMIT DROP AS
SELECT 'movimiento de un equipo que se queda que nombra a otra persona' AS que, count(*) AS n
  FROM movimientos m
 WHERE m.equipo_id IN (SELECT qe.id FROM queda_equipo qe)
   AND (m.empleado_origen_id IN (SELECT vp.id FROM va_persona vp)
        OR m.empleado_destino_id IN (SELECT vp.id FROM va_persona vp))
UNION ALL
SELECT 'acta que se va con un equipo que se queda', count(*)
  FROM actas_equipos ae
 WHERE ae.acta_id IN (SELECT va.id FROM va_acta va)
   AND ae.equipo_id IN (SELECT qe.id FROM queda_equipo qe)
UNION ALL
SELECT 'equipo que se queda que menciona a otro colaborador', count(*)
  FROM equipos e
 WHERE e.id IN (SELECT qe.id FROM queda_equipo qe)
   AND e.empleado_mencionado_id IN (SELECT vp.id FROM va_persona vp);

-- ---------------------------------------------------------------------------
-- 4. El resumen: qué se queda y qué se va
-- ---------------------------------------------------------------------------
\echo
\echo '── Se queda ─────────────────────────────────────────────────'
SELECT q.nombre AS colaborador,
       (SELECT count(*) FROM queda_equipo) AS equipos,
       (SELECT count(*) FROM actas a WHERE a.empleado_id = q.id
          AND a.id NOT IN (SELECT va.id FROM va_acta va)) AS actas
  FROM queda_persona q;

\echo '── Se borra ─────────────────────────────────────────────────'
SELECT (SELECT count(*) FROM va_persona) AS colaboradores,
       (SELECT count(*) FROM va_equipo) AS equipos,
       (SELECT count(*) FROM movimientos m WHERE m.equipo_id IN (SELECT ve.id FROM va_equipo ve)) AS movimientos,
       (SELECT count(*) FROM va_acta) AS actas,
       (SELECT count(*) FROM mantenimientos mt WHERE mt.equipo_id IN (SELECT ve.id FROM va_equipo ve)) AS mantenimientos,
       (SELECT count(*) FROM licencias l WHERE l.equipo_id IN (SELECT ve.id FROM va_equipo ve)) AS licencias;

\echo '── Lo que lo impediría (todo tiene que ser 0) ───────────────'
SELECT c.que, c.n FROM conflicto c;

DO $$
DECLARE n bigint;
BEGIN
  SELECT sum(c.n) INTO n FROM conflicto c;
  IF n > 0 THEN
    RAISE EXCEPTION 'Hay % dependencia(s) de lo que se queda hacia lo que se va (tabla de arriba). No se borró nada.', n;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Ensayo: aquí se para si no es en serio
-- ---------------------------------------------------------------------------
\if :en_serio
\else
  \echo
  \echo 'ENSAYO: no se borró nada. Para hacerlo de verdad:'
  \echo '  CONFIRMAR=BORRAR ./db/dejar-solo-a.sh "<nombre>" --en-serio'
  ROLLBACK;
  \quit
\endif

-- ---------------------------------------------------------------------------
-- 6. El borrado, de las hojas a la raíz
-- ---------------------------------------------------------------------------
--
-- `movimientos` es append-only por un trigger (0001). Se apaga SOLO dentro de
-- esta transacción: el DDL es transaccional, así que si algo falla el ROLLBACK
-- lo vuelve a encender, y si todo pasa se enciende a mano antes del COMMIT.
ALTER TABLE movimientos DISABLE TRIGGER trg_movimientos_append_only;

DELETE FROM actas_equipos ae WHERE ae.acta_id IN (SELECT va.id FROM va_acta va);
DELETE FROM movimientos m WHERE m.equipo_id IN (SELECT ve.id FROM va_equipo ve);
DELETE FROM actas a WHERE a.id IN (SELECT va.id FROM va_acta va);
DELETE FROM mantenimientos mt WHERE mt.equipo_id IN (SELECT ve.id FROM va_equipo ve);
DELETE FROM licencias l WHERE l.equipo_id IN (SELECT ve.id FROM va_equipo ve);

-- Partes y computadores: se sueltan antes de borrar, para que el orden dentro
-- del DELETE no importe (la FK es RESTRICT).
UPDATE equipos e SET equipo_principal_id = NULL
 WHERE e.equipo_principal_id IN (SELECT ve.id FROM va_equipo ve);
-- `equipos_motivos_revision` se va sola: es ON DELETE CASCADE.
DELETE FROM equipos e WHERE e.id IN (SELECT ve.id FROM va_equipo ve);

DELETE FROM empleados p WHERE p.id IN (SELECT vp.id FROM va_persona vp);

-- Las corridas de importación que se quedaron sin ningún equipo ni licencia.
-- Si se quedaran, `verificar-datos.sql` §G diría que sus filas insertadas no
-- cuadran con la base, y tendría razón: describen equipos que ya no existen.
DELETE FROM importaciones i
 WHERE NOT EXISTS (SELECT 1 FROM equipos e WHERE e.importacion_id = i.id)
   AND NOT EXISTS (SELECT 1 FROM licencias l WHERE l.importacion_id = i.id);

ALTER TABLE movimientos ENABLE TRIGGER trg_movimientos_append_only;

-- Que conste. Con el usuario de sistema: el script no sabe quién lo corrió,
-- y escribir un nombre adivinado en la auditoría sería inventarlo. Si esa
-- cuenta no existe en esta base, no se escribe la fila —la columna de autor es
-- obligatoria— y se dice abajo, en vez de abortar un borrado ya comprobado.
INSERT INTO auditoria (tabla, registro_id, accion, usuario_app_id, antes, despues)
SELECT 'empleados', q.id, 'depuracion_dejar_solo_a', u.id, NULL,
       jsonb_build_object('se_queda', q.nombre,
                          'equipos_que_quedan', (SELECT count(*) FROM queda_equipo))
  FROM queda_persona q
  JOIN usuarios_app u ON u.email = 'sistema@bbl.local';
SELECT CASE WHEN EXISTS (SELECT 1 FROM usuarios_app u WHERE u.email = 'sistema@bbl.local')
            THEN 'Auditoría: registrado.'
            ELSE 'Auditoría: no hay usuario de sistema en esta base; no se registró.' END AS auditoria;

\echo
\echo '── Hecho ────────────────────────────────────────────────────'
SELECT (SELECT count(*) FROM empleados) AS colaboradores,
       (SELECT count(*) FROM equipos) AS equipos,
       (SELECT count(*) FROM movimientos) AS movimientos,
       (SELECT count(*) FROM actas) AS actas;

COMMIT;
