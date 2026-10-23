-- Las sedes pasan a ser cuatro: Medellín, Barranquilla, Cartagena y Remoto.
-- Quien no trabaja en una de las tres oficinas es Remoto, y de un remoto se
-- guarda DÓNDE está: país, departamento (o estado, en EE. UU.), ciudad o
-- municipio, y la dirección que ya existía.
--
-- ===========================================================================
-- UBICACIÓN DEL COLABORADOR REMOTO
-- ===========================================================================
--
-- `pais` es enum: hoy hay remotos en Colombia y en Estados Unidos, y un país
-- nuevo es una decisión, no un valor que se teclea. `departamento` y `ciudad`
-- son texto libre a propósito: los escribe quien da de alta a la persona, y una
-- lista cerrada de municipios convertiría cada pueblo que falte en un bloqueo.
--
-- No hay CHECK que los exija (D30): hay fichas sin dirección y una constraint
-- las dejaría sin poder editarse. Los exige la API al crear a un remoto o al
-- pasar a alguien a Remoto, y el resto lo avisa la interfaz.

CREATE TYPE "public"."pais" AS ENUM ('Colombia', 'Estados Unidos');--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN "pais" "pais";--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN "departamento" text;--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN "ciudad" text;--> statement-breakpoint

-- ===========================================================================
-- BOGOTÁ Y BOYACÁ SE RETIRAN COMO SEDE
-- ===========================================================================
--
-- No se borran: `sede_id` tiene FK RESTRICT desde equipos y empleados, y el
-- historial de traslados las nombra. Se desactivan, y dejan de ofrecerse.
--
-- Las PERSONAS que estaban en ellas pasan a Remoto con su ubicación ya puesta.
-- Boyacá es un departamento, no una ciudad: se guarda como tal y la ciudad
-- queda vacía, en vez de inventar un municipio que nadie dijo.
--
-- Los EQUIPOS no se mueven aquí. Cambiarles `sede_id` por SQL sería un
-- traslado sin movimiento: el historial diría que siguen donde estaban, y
-- `verificar-datos.sql` §F2 —la sede de un equipo es el destino de su último
-- traslado— lo vería como corrupción. Se mueven con un traslado de verdad.

UPDATE "empleados" e
   SET "sede_id" = r."id",
       "pais" = 'Colombia',
       "departamento" = CASE s."nombre" WHEN 'Bogotá' THEN 'Bogotá D.C.' ELSE 'Boyacá' END,
       "ciudad" = CASE s."nombre" WHEN 'Bogotá' THEN 'Bogotá' ELSE NULL END
  FROM "sedes" s, "sedes" r
 WHERE e."sede_id" = s."id"
   AND s."nombre" IN ('Bogotá', 'Boyacá')
   AND r."nombre" = 'Remoto';--> statement-breakpoint

UPDATE "sedes" SET "activa" = false WHERE "nombre" IN ('Bogotá', 'Boyacá');
