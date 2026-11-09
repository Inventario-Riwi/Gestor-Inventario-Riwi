-- Formulario por tipo de equipo: entra la Tablet y el IMEI.
--
-- `Tablet` es una categoría más del enum. Como en la 0021, `ADD VALUE` no se
-- deshace con un `DROP VALUE`, y dentro de la transacción el valor nuevo no se
-- puede USAR hasta el COMMIT: por eso las CHECK de abajo comparan
-- `categoria::text` y no el literal del enum.
--
-- `imei`: el identificador del módem de un celular o una tablet con datos.
-- Solo esas dos categorías lo llevan, y son exactamente 15 dígitos: el
-- formulario quita espacios y guiones antes de mandarlo. Una tablet solo wifi
-- no tiene IMEI, así que el campo es opcional.
--
-- Único como el serial (0001): entre las filas limpias. Dos teléfonos con el
-- mismo IMEI son un error de digitación, no dos teléfonos.

ALTER TYPE "public"."categoria_equipo" ADD VALUE IF NOT EXISTS 'Tablet';--> statement-breakpoint

ALTER TABLE "equipos" ADD COLUMN "imei" text;--> statement-breakpoint

ALTER TABLE "equipos" ADD CONSTRAINT "equipos_imei_formato"
  CHECK ("imei" IS NULL OR "imei" ~ '^[0-9]{15}$');--> statement-breakpoint

ALTER TABLE "equipos" ADD CONSTRAINT "equipos_imei_solo_moviles"
  CHECK ("imei" IS NULL OR "categoria"::text IN ('Celular', 'Tablet'));--> statement-breakpoint

CREATE UNIQUE INDEX "equipos_imei_uk" ON "equipos" ("imei")
  WHERE "imei" IS NOT NULL AND "requiere_revision" = false;
