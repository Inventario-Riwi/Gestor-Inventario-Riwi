-- `empleados.activo` y `empleados.estado = 'Inactivo'` dicen lo mismo, y no
-- lo decía nadie: desactivar a alguien solo tocaba `activo`, y la tarjeta
-- enseñaba a la vez «Activo» y «Inactivo: no aparece en asignaciones nuevas».
--
-- Manda `activo`. Es el que la API protege —no se desactiva a quien tiene
-- equipos a su nombre— y el que decide si alguien recibe asignaciones. El
-- importador nunca escribió `estado`, así que todo lo cargado está en el
-- `Activo` por defecto y `activo` es lo único que alguien decidió.
--
-- 1. Alinear lo que hay.

UPDATE "empleados" SET "estado" = 'Inactivo'
 WHERE NOT "activo" AND "estado" <> 'Inactivo';--> statement-breakpoint

UPDATE "empleados" SET "estado" = 'Activo'
 WHERE "activo" AND "estado" = 'Inactivo';--> statement-breakpoint

-- 2. Y que no vuelva a separarse. Igualdad de dos booleanos que nunca son
--    NULL (las dos columnas son NOT NULL), así que la CHECK siempre da true o
--    false y no puede pasar por defecto.

ALTER TABLE "empleados" ADD CONSTRAINT "empleados_activo_es_estado"
  CHECK ("activo" = ("estado" <> 'Inactivo'));
