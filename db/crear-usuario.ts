/**
 * Crea o actualiza un usuario de la aplicación.
 * `npm run usuario -- <email> <nombre> <admin|tecnico>`
 *
 * Existe porque §2 dice «sin registro público; se siembran con un script», y
 * porque hay un problema de arranque: crear usuarios es una operación de admin,
 * y hasta que exista el primer admin no hay nadie que pueda hacerla. El único
 * usuario que siembra `npm run seed` es `sistema@bbl.local`, que no puede
 * iniciar sesión por diseño (D4).
 *
 * La contraseña se pide por stdin y no se pasa como argumento: los argumentos
 * quedan en el historial del shell y en la lista de procesos.
 *
 * Y en una terminal se pide SIN eco (asteriscos) y dos veces. Antes se veía
 * tal cual al escribirla, y la primera cuenta de producción acabó con su
 * contraseña en una captura de pantalla.
 */

import 'dotenv/config';
import { createInterface } from 'node:readline/promises';

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db, pool } from './cliente.js';
import { usuariosApp } from './esquema.js';

const COSTE = 12;

/**
 * Lee una línea sin mostrarla: cada carácter se pinta como «*». Ctrl+C cancela
 * y Retroceso borra. Solo en una terminal de verdad (`docker compose exec -it`,
 * una consola): si la entrada viene de una tubería no hay nada que ocultar, y
 * se lee tal cual.
 */
async function pedirOculta(pregunta: string): Promise<string> {
  const entrada = process.stdin;
  if (!entrada.isTTY) {
    const rl = createInterface({ input: entrada, terminal: false });
    process.stdout.write(pregunta);
    const linea = await rl[Symbol.asyncIterator]().next();
    rl.close();
    process.stdout.write('\n');
    return typeof linea.value === 'string' ? linea.value : '';
  }

  process.stdout.write(pregunta);
  entrada.setRawMode(true);
  entrada.setEncoding('utf8');
  entrada.resume();

  return new Promise((resolve, reject) => {
    let valor = '';
    const terminar = () => {
      entrada.removeListener('data', alTeclear);
      entrada.setRawMode(false);
      entrada.pause();
      process.stdout.write('\n');
    };
    function alTeclear(trozo: string) {
      for (const c of trozo) {
        if (c === '\r' || c === '\n') {
          terminar();
          resolve(valor);
          return;
        }
        if (c === '\u0003') {
          terminar();
          reject(new Error('Cancelado: no se creó ni cambió nada.'));
          return;
        }
        if (c === '\u007f' || c === '\b') {
          if (valor.length > 0) {
            valor = valor.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (c >= ' ') {
          valor += c;
          process.stdout.write('*');
        }
      }
    }
    entrada.on('data', alTeclear);
  });
}

async function main() {
  const [email, nombre, rol] = process.argv.slice(2);
  if (!email || !nombre || (rol !== 'admin' && rol !== 'tecnico')) {
    throw new Error('Uso: npm run usuario -- <email> "<nombre>" <admin|tecnico>');
  }

  const password = await pedirOculta(`Contraseña para ${email}: `);
  // Sin eco, un error de tecleo no se ve: en una terminal se pide dos veces.
  if (process.stdin.isTTY) {
    const repetida = await pedirOculta('Repítela: ');
    if (repetida !== password) {
      throw new Error('Las dos contraseñas no coinciden. No se creó ni cambió nada.');
    }
  }

  if (password.length < 12) {
    throw new Error('La contraseña debe tener al menos 12 caracteres.');
  }

  const password_hash = await bcrypt.hash(password, COSTE);

  const [fila] = await db
    .insert(usuariosApp)
    .values({ email, nombre, rol, activo: true, password_hash })
    .onConflictDoUpdate({
      target: usuariosApp.email,
      // Cambiar la contraseña aquí invalida las sesiones abiertas de esa
      // persona: el guardián compara una huella del hash en cada petición.
      set: { nombre, rol, activo: true, password_hash },
    })
    .returning({ id: usuariosApp.id, email: usuariosApp.email, rol: usuariosApp.rol });

  console.log(`Usuario listo: ${fila.email} (${fila.rol})`);

  const [sistema] = await db
    .select({ activo: usuariosApp.activo })
    .from(usuariosApp)
    .where(eq(usuariosApp.email, 'sistema@bbl.local'));
  if (sistema?.activo) {
    throw new Error('sistema@bbl.local ha quedado activo. Revisar: no debe poder iniciar sesión.');
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
