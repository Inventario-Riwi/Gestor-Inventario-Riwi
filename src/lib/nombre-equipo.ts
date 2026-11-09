import type { CategoriaEquipo } from '../types';
import { tipoDe } from './tipos-equipo';

/**
 * Cómo se llama un equipo en pantalla. Una sola regla para todas las vistas.
 *
 * Un periférico casi nunca tiene nombre ni etiqueta, y las listas acababan
 * enseñando su número de serie, que no le dice nada a nadie. Para ellos el
 * nombre es **qué es + marca + modelo** («Mouse Logitech M170»); el serial
 * queda como dato secundario (`identificador`).
 *
 * Los demás siguen como antes: su nombre, si no su etiqueta, si no marca y
 * modelo.
 */
export interface Nombrable {
  categoria: CategoriaEquipo;
  nombre_equipo?: string | null;
  etiqueta?: string | null;
  marca?: string | null;
  modelo?: string | null;
}

export const esPeriferico = (c: CategoriaEquipo) => tipoDe(c) === 'periferico';

export function nombreVisible(e: Nombrable): string {
  const marcaModelo = [e.marca, e.modelo].filter(Boolean).join(' ');
  if (esPeriferico(e.categoria)) {
    // «Otro» no dice qué es: ahí manda el nombre si alguien lo escribió.
    if (e.categoria === 'Otro') return e.nombre_equipo ?? (marcaModelo || 'Otro');
    return [e.categoria, marcaModelo].filter(Boolean).join(' ');
  }
  return e.nombre_equipo ?? e.etiqueta ?? (marcaModelo || e.categoria);
}

/** Lo que lo identifica físicamente: la etiqueta, si no el serial. */
export const identificador = (e: { etiqueta?: string | null; serial?: string | null }) =>
  e.etiqueta ?? e.serial ?? null;
