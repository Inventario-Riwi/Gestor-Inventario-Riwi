-- Borra UN equipo registrado por error, con todo su rastro.
--
-- No se corre a mano: lo llama `db/borrar-equipo.sh`, que pasa:
--
--   :etiqueta  la etiqueta exacta del equipo (sin distinguir mayúsculas)
--   :en_serio  1 para borrar; 0 (por defecto) solo enseña y deshace
--
-- Es para equipos que NO debieron existir: un duplicado, una prueba, un alta
-- mal digitada. Un equipo que existió y salió del inventario se da de BAJA
-- desde su ficha, que conserva el historial. Por eso este script no tiene
-- botón en la aplicación.
--
-- Se borra: el equipo, sus movimientos, sus partes de mantenimiento, las
-- actas que lo incluyen SOLO a él, y sus motivos de revisión.
--
-- Se NIEGA, sin borrar nada, si:
--   - la etiqueta no corresponde a exactamente un equipo;
--   - aparece en un acta junto con otros equipos (borrar una línea de un acta
--     firmada cambiaría lo que el documento dice);
--   - tiene partes ligadas (pantalla, teclado…) o licencias ligadas: eso es
--     una decisión aparte, no un efecto secundario.
--
-- Todo en UNA transacción.

\set ON_ERROR_STOP on
\if :{?en_serio}
\else
  \set en_serio 0
\endif

BEGIN;

SELECT set_config('borrar.etiqueta', :'etiqueta', true) AS _e \gset

CREATE TEMP TABLE va ON COMMIT DROP AS
SELECT e.id, e.etiqueta, e.serial, e.categoria, e.marca, e.modelo, e.estado
  FROM equipos e
 WHERE lower(btrim(e.etiqueta)) = lower(btrim(current_setting('borrar.etiqueta')));

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM va;
  IF n = 0 THEN
    RAISE EXCEPTION 'No hay ningún equipo con la etiqueta «%». No se borró nada.',
      current_setting('borrar.etiqueta');
  ELSIF n > 1 THEN
    RAISE EXCEPTION 'Hay % equipos con la etiqueta «%». No se borró nada.',
      n, current_setting('borrar.etiqueta');
  END IF;
END $$;

-- Las actas que lo incluyen, y cuántos equipos tiene cada una.
CREATE TEMP TABLE sus_actas ON COMMIT DROP AS
SELECT ae.acta_id,
       (SELECT count(*) FROM actas_equipos o WHERE o.acta_id = ae.acta_id) AS equipos_en_acta
  FROM actas_equipos ae
 WHERE ae.equipo_id IN (SELECT va.id FROM va);

\echo
\echo '── El equipo ────────────────────────────────────────────────'
SELECT va.etiqueta, va.serial, va.categoria, va.marca, va.modelo, va.estado FROM va;

\echo '── Se borra con él ──────────────────────────────────────────'
SELECT (SELECT count(*) FROM movimientos m WHERE m.equipo_id IN (SELECT va.id FROM va)) AS movimientos,
       (SELECT count(*) FROM sus_actas) AS actas,
       (SELECT count(*) FROM mantenimientos mt WHERE mt.equipo_id IN (SELECT va.id FROM va)) AS mantenimientos;

\echo '── Lo que lo impediría (todo tiene que ser 0) ───────────────'
CREATE TEMP TABLE conflicto ON COMMIT DROP AS
SELECT 'acta que incluye también otros equipos' AS que,
       (SELECT count(*) FROM sus_actas s WHERE s.equipos_en_acta > 1) AS n
UNION ALL
SELECT 'partes ligadas a este equipo (pantalla, teclado…)',
       (SELECT count(*) FROM equipos p WHERE p.equipo_principal_id IN (SELECT va.id FROM va))
UNION ALL
SELECT 'licencias ligadas a este equipo',
       (SELECT count(*) FROM licencias l WHERE l.equipo_id IN (SELECT va.id FROM va));
SELECT c.que, c.n FROM conflicto c;

DO $$
DECLARE n bigint;
BEGIN
  SELECT sum(c.n) INTO n FROM conflicto c;
  IF n > 0 THEN
    RAISE EXCEPTION 'Hay % dependencia(s) que impiden borrarlo (tabla de arriba). No se borró nada.', n;
  END IF;
END $$;

\if :en_serio
\else
  \echo
  \echo 'ENSAYO: no se borró nada. Para hacerlo de verdad:'
  \echo '  CONFIRMAR=BORRAR ./db/borrar-equipo.sh "<etiqueta>" --en-serio'
  ROLLBACK;
  \quit
\endif

-- `movimientos` es append-only (0001): el trigger se apaga solo dentro de esta
-- transacción y se vuelve a encender antes del COMMIT.
ALTER TABLE movimientos DISABLE TRIGGER trg_movimientos_append_only;

DELETE FROM actas_equipos ae WHERE ae.acta_id IN (SELECT s.acta_id FROM sus_actas s);
DELETE FROM movimientos m WHERE m.equipo_id IN (SELECT va.id FROM va);
DELETE FROM actas a WHERE a.id IN (SELECT s.acta_id FROM sus_actas s);
DELETE FROM mantenimientos mt WHERE mt.equipo_id IN (SELECT va.id FROM va);
-- `equipos_motivos_revision` se va sola: ON DELETE CASCADE.
DELETE FROM equipos e WHERE e.id IN (SELECT va.id FROM va);

ALTER TABLE movimientos ENABLE TRIGGER trg_movimientos_append_only;

-- Que conste, con lo que era: el registro de quién tocó la base sobrevive al
-- equipo. Con el usuario de sistema, si existe (ver dejar-solo-a.sql).
INSERT INTO auditoria (tabla, registro_id, accion, usuario_app_id, antes, despues)
SELECT 'equipos', va.id, 'borrado_por_error_de_registro', u.id,
       jsonb_build_object('etiqueta', va.etiqueta, 'serial', va.serial,
                          'categoria', va.categoria, 'marca', va.marca, 'modelo', va.modelo),
       NULL
  FROM va
  JOIN usuarios_app u ON u.email = 'sistema@bbl.local';

\echo
\echo '── Hecho: el equipo ya no está ──────────────────────────────'
SELECT count(*) AS quedan_con_esa_etiqueta FROM equipos e
 WHERE lower(btrim(e.etiqueta)) = lower(btrim(current_setting('borrar.etiqueta')));

COMMIT;
