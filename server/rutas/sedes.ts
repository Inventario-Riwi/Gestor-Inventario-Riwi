/** `/api/sedes`. */

import type { Express } from 'express';
import { z } from 'zod';

import * as repoSedes from '../../db/repositorios/sedes.js';
import { guardian } from '../autenticar.js';
import { asincrono, ErrorHttp, noEncontrado } from '../errores.js';
import { ruta } from '../permisos.js';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
  message: 'identificador inválido',
});

const campos = z.object({
  nombre: z.string().trim().min(1).max(120),
  ciudad: z.string().trim().max(120).nullable().optional(),
  direccion: z.string().trim().max(300).nullable().optional(),
  responsable: z.string().trim().max(200).nullable().optional(),
  contacto_email: z.string().trim().max(320).nullable().optional(),
  contacto_telefono: z.string().trim().max(60).nullable().optional(),
  activa: z.boolean().optional(),
});

function validar<T>(esquema: z.ZodType<T>, entrada: unknown): T {
  const r = esquema.safeParse(entrada);
  if (!r.success) {
    throw new ErrorHttp(400, 'Entrada inválida', {
      campos: r.error.issues.map((i) => ({ campo: i.path.join('.'), problema: i.message })),
    });
  }
  return r.data;
}

export function registrarRutasSedes(app: Express): void {
  ruta(
    app,
    'get',
    '/api/sedes',
    'autenticado',
    guardian,
    asincrono(async (req, res) => {
      // `?conteos=1` añade el reparto de equipos por sede. Va como opción y no
      // siempre porque los desplegables de otras vistas solo quieren la lista,
      // y son seis subconsultas por fila.
      if (req.query.conteos === '1') {
        const [sedes, sinSede] = await Promise.all([
          repoSedes.listarConConteos(),
          repoSedes.equiposSinSede(),
        ]);
        res.json({ sedes, equipos_sin_sede: sinSede });
        return;
      }
      res.json({ sedes: await repoSedes.listar() });
    }),
  );

  ruta(
    app,
    'get',
    '/api/sedes/:id',
    'autenticado',
    guardian,
    asincrono(async (req, res) => {
      const sede = await repoSedes.porId(validar(uuid, req.params.id));
      if (!sede) throw noEncontrado('Sede');
      res.json({ sede });
    }),
  );

  /**
   * Crear una sede: solo admin, y **con ciudad**.
   *
   * La ciudad no es opcional aquí aunque la columna la admita vacía: una sede
   * sin ciudad es como la app reconoce a «Remoto» (la semilla, la ficha del
   * colaborador y `sedeRemota()` lo hacen así). Una «Armenia» sin ciudad se
   * volvería un segundo Remoto, y los equipos de quien viva allí irían a parar
   * a cualquiera de los dos.
   */
  ruta(
    app,
    'post',
    '/api/sedes',
    'admin',
    guardian,
    asincrono(async (req, res) => {
      const datos = validar(
        campos.extend({ ciudad: z.string().trim().min(1, { message: 'la ciudad es obligatoria' }).max(120) }),
        req.body,
      );
      res.status(201).json({ sede: await repoSedes.crear(datos) });
    }),
  );

  ruta(
    app,
    'patch',
    '/api/sedes/:id',
    'autenticado',
    guardian,
    asincrono(async (req, res) => {
      const id = validar(uuid, req.params.id);
      const sede = await repoSedes.actualizar(id, validar(campos.partial(), req.body));
      if (!sede) throw noEncontrado('Sede');
      res.json({ sede });
    }),
  );
}
