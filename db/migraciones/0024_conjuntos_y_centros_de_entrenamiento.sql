-- Centros de entrenamiento (CE) y el vínculo entre un computador y sus partes.
--
-- D50 dejó la pantalla y el teclado de cada puesto de `INV - CE` como equipos
-- propios (tienen etiqueta y son activos), con el vínculo escrito en `notas` a
-- falta de una columna. Esta es esa columna.
--
-- `equipo_principal_id`: a qué equipo pertenece esta parte. Solo INFORMATIVO
-- por ahora, decidido así: trasladar o dar de baja el computador NO mueve sus
-- partes. Automatizarlo exige decidir qué pasa con cada operación (¿se da de
-- baja la pantalla con la torre?), y eso es otro cambio. RESTRICT al borrar:
-- un equipo con partes colgando no desaparece sin que alguien lo decida.
--
-- `centro_entrenamiento`: el equipo es de una sala de entrenamiento. La sala
-- concreta («P3 OCCI», «P4 ORI»…) va en `ubicacion_detalle`, como en D48.

ALTER TABLE "equipos" ADD COLUMN "equipo_principal_id" uuid
  REFERENCES "equipos"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "equipos" ADD COLUMN "centro_entrenamiento" boolean NOT NULL DEFAULT false;--> statement-breakpoint

-- Nadie es parte de sí mismo. Un ciclo más largo (A→B→A) no lo frena esta
-- CHECK; lo vigila verificar-datos.sql, y hoy solo lo escribe el importador.
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_principal_no_es_si_mismo"
  CHECK ("equipo_principal_id" IS NULL OR "equipo_principal_id" <> "id");--> statement-breakpoint

CREATE INDEX "idx_equipos_principal" ON "equipos" ("equipo_principal_id")
  WHERE "equipo_principal_id" IS NOT NULL;
