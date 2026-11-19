-- Revertir una baja (D52).
--
-- Pedido del usuario: el RIWI-1730 (un MacBook Air) quedó «De baja» y sigue en
-- uso: hay que volverlo a circulación y asignárselo a una persona. Hasta ahora
-- «De baja» no tenía salida, y la única forma de corregirlo era un UPDATE a
-- mano, que deja el estado sin movimiento que lo explique (D19).
--
-- La operación vive en `db/transiciones.ts` (`revertir_baja`: De baja →
-- Disponible). Aquí solo el tipo de movimiento que escribe: sin él, el
-- historial no podría contar que el equipo volvió.

ALTER TYPE "public"."tipo_movimiento"
  ADD VALUE IF NOT EXISTS 'Reversión de baja';
