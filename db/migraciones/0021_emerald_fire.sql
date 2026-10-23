-- Emerald Fire entra como tercera empresa.
--
-- Va en los dos enums porque cumple los dos papeles que ya cumplen RIWI y
-- BBL Labs: puede ser DUEÑA de equipos y de colaboradores (`empresa`), y las
-- empresas se prestan equipos entre sí, así que también puede RECIBIR un
-- préstamo (`prestatario`).
--
-- Lo que NO cambia: Emerald Fire no emite actas. No hay formato aprobado ni
-- logo para ella, y `puedeEmitir` lo decide por `PREFIJO_CONSECUTIVO`, que no
-- la incluye. Un colaborador suyo queda en la misma situación que uno
-- `Sin clasificar`: la API responde 409 antes de numerar nada.
--
-- `ADD VALUE` no se puede deshacer con un `DROP VALUE`: Postgres no lo tiene.
-- Retirarla exigiría recrear el tipo, que es una migración nueva y a la vista.
-- Dentro de una transacción el valor nuevo no se puede USAR hasta el COMMIT;
-- esta migración solo lo añade, así que no le afecta.

ALTER TYPE "public"."empresa" ADD VALUE IF NOT EXISTS 'Emerald Fire';--> statement-breakpoint
ALTER TYPE "public"."prestatario" ADD VALUE IF NOT EXISTS 'Emerald Fire';
