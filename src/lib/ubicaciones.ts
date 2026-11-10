import type { Empresa, Sede } from '../types';
import { norm } from '../../db/marcadores';

/**
 * Las tarjetas de «Ubicaciones» en Inventario. Un solo sitio: añadir una
 * tarjeta es añadir una línea aquí.
 *
 * Dos clases de tarjeta, y cuentan distinto a propósito:
 *
 * - **Con empresa** (RIWI · Medellín, Blackbird Labs…): la regla del filtro por
 *   empresa (D31), un equipo prestado cuenta en su dueña y en quien lo tiene.
 *   Si llevan sede, solo la de esa sede.
 * - **Solo sede** (Armenia, San Andrés…): todo lo que está físicamente allí, de
 *   la empresa que sea.
 *
 * Por eso un equipo de Blackbird en Armenia sale en las dos tarjetas: está en
 * las dos cosas a la vez.
 *
 * La sede se busca por NOMBRE, sin tildes ni mayúsculas, no por id: Armenia y
 * San Andrés se crean a mano en cada base y su id cambia de una a otra. Si una
 * sede todavía no existe, su tarjeta lo dice en vez de desaparecer.
 */
export interface Tarjeta {
  clave: string;
  titulo: string;
  empresa?: Empresa;
  sede?: string;
  /** Enseñar cuántos hay en cada sede (las de empresa sin sede fija). */
  porSede?: boolean;
}

export const TARJETAS: Tarjeta[] = [
  { clave: 'riwi-med', titulo: 'RIWI · Medellín', empresa: 'RIWI', sede: 'Medellín' },
  { clave: 'riwi-baq', titulo: 'RIWI · Barranquilla', empresa: 'RIWI', sede: 'Barranquilla' },
  { clave: 'bbl', titulo: 'Blackbird Labs', empresa: 'BBL Labs', porSede: true },
  { clave: 'ef', titulo: 'Emerald Fire', empresa: 'Emerald Fire', porSede: true },
  { clave: 'armenia', titulo: 'Armenia', sede: 'Armenia' },
  { clave: 'san-andres', titulo: 'San Andrés', sede: 'San Andrés' },
  { clave: 'cartagena', titulo: 'Cartagena', sede: 'Cartagena' },
  { clave: 'remoto', titulo: 'Remoto', sede: 'Remoto' },
];

export interface ConteosUbicacion {
  por_empresa: { empresa: string; sede_id: string | null; estado: string; n: number }[];
  por_sede: { sede_id: string | null; estado: string; n: number }[];
}

export interface Resumen {
  /** `undefined`: la tarjeta pide una sede que esta base no tiene. */
  sede_id?: string | null;
  sinSede: boolean;
  total: number;
  asignados: number;
  disponibles: number;
  mantenimiento: number;
  /** Solo en las de `porSede`: nombre de la sede → equipos. */
  reparto?: [string, number][];
}

export const sedeDeTarjeta = (t: Tarjeta, sedes: Sede[]) =>
  t.sede ? sedes.find((s) => norm(s.nombre) === norm(t.sede!)) : undefined;

export function resumir(t: Tarjeta, c: ConteosUbicacion, sedes: Sede[]): Resumen {
  const sede = sedeDeTarjeta(t, sedes);
  if (t.sede && !sede) {
    return { sinSede: true, total: 0, asignados: 0, disponibles: 0, mantenimiento: 0 };
  }
  const filas = t.empresa
    ? c.por_empresa.filter((f) => f.empresa === t.empresa && (!sede || f.sede_id === sede.id))
    : c.por_sede.filter((f) => f.sede_id === sede!.id);
  const suma = (estado?: string) =>
    filas.filter((f) => !estado || f.estado === estado).reduce((a, f) => a + f.n, 0);

  let reparto: [string, number][] | undefined;
  if (t.porSede) {
    const mapa = new Map<string, number>();
    for (const f of filas) {
      const nombre = sedes.find((s) => s.id === f.sede_id)?.nombre ?? 'Sin sede';
      mapa.set(nombre, (mapa.get(nombre) ?? 0) + f.n);
    }
    reparto = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }

  return {
    sede_id: sede?.id ?? null,
    sinSede: false,
    total: suma(),
    asignados: suma('Asignado'),
    disponibles: suma('Disponible'),
    mantenimiento: suma('En mantenimiento'),
    reparto,
  };
}
