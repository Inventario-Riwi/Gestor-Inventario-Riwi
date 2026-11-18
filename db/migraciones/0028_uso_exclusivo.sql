-- Uso exclusivo: equipos que no se asignan a personas.
--
-- Pedido del usuario: «solo para que no asignen los equipos, sino que están en
-- un préstamo entre empresas o que es exclusivo para eventos». Son equipos del
-- pool, a nombre de nadie:
--
--   'Préstamo interno'  se reservan para prestarlos entre empresas: se pueden
--                       PRESTAR, no asignar ni reservar para una persona.
--   'Eventos'           para eventos: ni se asignan, ni se reservan, ni se
--                       prestan a otra empresa.
--
-- Qué operación bloquea cada uso lo decide `db/transiciones.ts`; aquí van las
-- CHECK que lo sostienen aunque alguien escriba en la base por otro camino.
-- `estado::text` y `uso_exclusivo::text` por costumbre (0026): no depender de
-- los literales del enum dentro de una CHECK.

CREATE TYPE "public"."uso_exclusivo" AS ENUM ('Préstamo interno', 'Eventos');--> statement-breakpoint

ALTER TABLE "equipos" ADD COLUMN "uso_exclusivo" "uso_exclusivo";--> statement-breakpoint

-- Del pool, no de una persona: con uso exclusivo no hay responsable, ni está
-- asignado o reservado.
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_uso_exclusivo_sin_persona"
  CHECK ("uso_exclusivo" IS NULL
         OR ("empleado_id" IS NULL AND "estado"::text NOT IN ('Asignado', 'Reservado')));--> statement-breakpoint

-- Los de eventos tampoco se prestan a otra empresa.
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_eventos_no_se_presta"
  CHECK ("uso_exclusivo" IS NULL OR "uso_exclusivo"::text <> 'Eventos'
         OR ("estado"::text <> 'Prestado' AND "prestado_a" IS NULL));
