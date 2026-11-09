-- Salas de entrenamiento: el mouse que viene con el puesto pero no tiene serial.
--
-- En las salas cada computador trae pantalla, teclado y mouse. La pantalla y
-- el teclado son equipos propios con etiqueta (D50, 0024); el mouse casi nunca
-- tiene serial ni etiqueta, y un equipo sin ninguno de los dos no se puede
-- señalar en una estantería (`verificar-datos.sql` §B). Registrarlo como
-- equipo propio obligaría a marcarlo para revisión para siempre.
--
-- Así que es un dato DEL COMPUTADOR: «este puesto trae mouse, sin serial». Un
-- mouse con serial sigue entrando como equipo propio ligado al computador; los
-- dos caminos cuentan igual para decir que el puesto está completo.
--
-- Solo un equipo de mesa (Desktop) lo lleva: un portátil trae su touchpad, y
-- un periférico no trae periféricos. El cast a texto es por la misma razón que
-- en la 0026: no depender del literal del enum dentro de la CHECK.

ALTER TABLE "equipos" ADD COLUMN "mouse_sin_serial" boolean NOT NULL DEFAULT false;--> statement-breakpoint

ALTER TABLE "equipos" ADD CONSTRAINT "equipos_mouse_sin_serial_solo_desktop"
  CHECK (NOT "mouse_sin_serial" OR "categoria"::text = 'Desktop');
