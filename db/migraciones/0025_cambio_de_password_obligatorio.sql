-- Cambio de contraseña obligatorio en el primer ingreso.
--
-- Quien crea una cuenta para otra persona elige una contraseña temporal, y esa
-- contraseña la conocen dos. Con la marca puesta, la persona no puede usar la
-- aplicación hasta poner una suya: el servidor responde 403 a todo salvo a
-- cambiarla, consultar quién es y salir.
--
-- La pone `crear-usuario --temporal`; la quita el propio cambio. Las cuentas
-- que ya existen quedan sin marca (DEFAULT false): sus contraseñas ya las
-- eligieron sus dueños.

ALTER TABLE "usuarios_app" ADD COLUMN "debe_cambiar_password" boolean NOT NULL DEFAULT false;
