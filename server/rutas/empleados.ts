/**
 * `/api/empleados`.
 *
 * Aquí vive la decisión de modelo de la etapa: **no se puede desactivar a un
 * empleado que tenga equipos a su nombre.** Ver `PATCH /:id`.
 */

import type { Express } from 'express';
import { z } from 'zod';

import * as repoEmpleados from '../../db/repositorios/empleados.js';
import * as repoSedes from '../../db/repositorios/sedes.js';
import { empresaEmpleado, estadoEmpleado, pais } from '../../db/esquema.js';
import { guardian } from '../autenticar.js';
import { asincrono, ErrorHttp, noEncontrado } from '../errores.js';
import { ruta } from '../permisos.js';

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
  message: 'identificador inválido',
});

const campos = z.object({
  nombre: z.string().trim().min(1).max(200),
  cedula: z.string().trim().max(40).nullable().optional(),
  email_corporativo: z.string().trim().max(320).nullable().optional(),
  cargo: z.string().trim().max(160).nullable().optional(),
  area: z.string().trim().max(160).nullable().optional(),
  sede_id: uuid.nullable().optional(),
  estado: z.enum(estadoEmpleado.enumValues).optional(),
  telefono: z.string().trim().max(60).nullable().optional(),
  direccion: z.string().trim().max(300).nullable().optional(),
  pais: z.enum(pais.enumValues).nullable().optional(),
  departamento: z.string().trim().max(120).nullable().optional(),
  ciudad: z.string().trim().max(120).nullable().optional(),
  empresa: z.enum(empresaEmpleado.enumValues).optional(),
  activo: z.boolean().optional(),
});

type DatosEmpleado = z.infer<typeof campos>;

const vacio = (v: string | null | undefined) => !v || v.trim() === '';

/**
 * Las reglas de sede del 0022, para un alta o un cambio.
 *
 * - **No se entra a una sede inactiva.** Bogotá y Boyacá siguen existiendo por
 *   el historial, pero ya no se ofrecen; quien llegue por otro camino, 409.
 * - **Al entrar a Remoto hacen falta país, ciudad y dirección.** Solo al
 *   ENTRAR —un alta, o un cambio de sede—, no en cada edición: una ficha vieja
 *   sin dirección tiene que poder corregirse en otra cosa (D30).
 * - **Fuera de Remoto, la ubicación remota se limpia.** La ciudad de una
 *   oficina es la de la oficina; dejar «Bogotá» en alguien de Medellín sería
 *   un dato que contradice a otro.
 *
 * `actual` es la ficha antes del cambio, o null en un alta. Devuelve los datos
 * que hay que guardar.
 */
async function aplicarReglasDeSede<T extends Partial<DatosEmpleado>>(
  datos: T,
  actual: { sede_id: string | null } & Pick<DatosEmpleado, 'pais' | 'ciudad' | 'direccion'> | null,
): Promise<T> {
  const cambiaSede = datos.sede_id !== undefined && datos.sede_id !== (actual?.sede_id ?? null);
  const sedeFinal = datos.sede_id !== undefined ? datos.sede_id : (actual?.sede_id ?? null);
  if (!sedeFinal) return datos;

  const sede = await repoSedes.porId(sedeFinal);
  if (!sede) throw new ErrorHttp(400, 'La sede no existe.');
  if (cambiaSede && !sede.activa) {
    throw new ErrorHttp(409, `La sede ${sede.nombre} ya no está activa. Elige otra.`);
  }

  const esRemota = sede.ciudad === null;
  if (!esRemota) {
    // Solo si algo de esto venía puesto o la persona cambia de sede: un PATCH
    // de otra cosa no tiene por qué escribir tres columnas.
    if (cambiaSede || datos.pais !== undefined || datos.ciudad !== undefined || datos.departamento !== undefined) {
      return { ...datos, pais: null, departamento: null, ciudad: null };
    }
    return datos;
  }

  if (actual === null || cambiaSede) {
    const final = {
      pais: datos.pais !== undefined ? datos.pais : actual?.pais,
      ciudad: datos.ciudad !== undefined ? datos.ciudad : actual?.ciudad,
      direccion: datos.direccion !== undefined ? datos.direccion : actual?.direccion,
    };
    const faltan = [
      !final.pais && 'país',
      vacio(final.ciudad) && 'ciudad o municipio',
      vacio(final.direccion) && 'dirección',
    ].filter(Boolean);
    if (faltan.length > 0) {
      throw new ErrorHttp(400, `Para la sede ${sede.nombre} falta: ${faltan.join(', ')}.`, {
        faltan,
      });
    }
  }
  return datos;
}

const esquemaCrear = campos;
const esquemaActualizar = campos.partial();

const esquemaFiltros = z.object({
  q: z.string().trim().max(120).optional(),
  sede: uuid.optional(),
  empresa: z.enum(empresaEmpleado.enumValues).optional(),
  activo: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  pagina: z.coerce.number().int().min(1).optional(),
  porPagina: z.coerce.number().int().min(1).max(200).optional(),
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

export function registrarRutasEmpleados(app: Express): void {
  ruta(
    app,
    'get',
    '/api/empleados',
    'autenticado',
    guardian,
    asincrono(async (req, res) => {
      const f = validar(esquemaFiltros, req.query);
      // El conteo por empresa viaja con el listado, igual que los conteos por
      // motivo de la bandeja: es lo que hace que las «Sin clasificar» se vean
      // sin tener que ir a buscarlas (D28).
      const [pagina, conteos] = await Promise.all([
        repoEmpleados.listar(f),
        repoEmpleados.conteoPorEmpresa(),
      ]);
      res.json({ ...pagina, conteos_empresa: conteos });
    }),
  );

  ruta(
    app,
    'get',
    '/api/empleados/:id',
    'autenticado',
    guardian,
    asincrono(async (req, res) => {
      const empleado = await repoEmpleados.porId(validar(uuid, req.params.id));
      if (!empleado) throw noEncontrado('Empleado');
      res.json({ empleado });
    }),
  );

  ruta(
    app,
    'get',
    '/api/empleados/:id/equipos',
    'autenticado',
    guardian,
    asincrono(async (req, res) => {
      const id = validar(uuid, req.params.id);
      const empleado = await repoEmpleados.porId(id);
      if (!empleado) throw noEncontrado('Empleado');
      res.json({ equipos: await repoEmpleados.equiposDe(id) });
    }),
  );

  ruta(
    app,
    'post',
    '/api/empleados',
    'autenticado',
    guardian,
    asincrono(async (req, res) => {
      const datos = await aplicarReglasDeSede(validar(esquemaCrear, req.body), null);
      res.status(201).json({ empleado: await repoEmpleados.crear(datos) });
    }),
  );

  ruta(
    app,
    'patch',
    '/api/empleados/:id',
    'autenticado',
    guardian,
    asincrono(async (req, res) => {
      const id = validar(uuid, req.params.id);
      const datos = validar(esquemaActualizar, req.body);

      const empleado = await repoEmpleados.porId(id);
      if (!empleado) throw noEncontrado('Empleado');

      /**
       * Desactivar a alguien con equipos a su nombre se bloquea, y la respuesta
       * dice cuáles.
       *
       * Un empleado inactivo con un portátil asignado es un equipo perdido con
       * pasos extra: no sale en los listados de gente activa, así que nadie
       * vuelve a mirarlo, y el equipo sigue figurando entregado a quien ya no
       * está. Obligar a devolver primero es el orden real de un offboarding.
       *
       * Se comprueba solo al pasar de activo a inactivo: un PATCH que no toque
       * `activo`, o que reactive, no tiene por qué exigir nada.
       */
      if (datos.activo === false && empleado.activo) {
        const asignados = await repoEmpleados.equiposDe(id);
        if (asignados.length > 0) {
          throw new ErrorHttp(
            409,
            'No se puede desactivar a un empleado con equipos a su nombre. Devolverlos primero.',
            { equipos: asignados },
          );
        }
      }

      const actualizado = await repoEmpleados.actualizar(
        id,
        await aplicarReglasDeSede(datos, empleado),
      );
      if (!actualizado) throw noEncontrado('Empleado');
      res.json({ empleado: actualizado });
    }),
  );
}
