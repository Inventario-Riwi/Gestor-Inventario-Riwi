/**
 * Equipos y periféricos (D54): las dos clases de objeto del inventario.
 *
 * Pedido del usuario: «que los equipos no se concentren en un solo nombre,
 * sino equipos como portátiles y desktop, y periféricos como un nombre aparte».
 *
 * **Un solo sitio.** Lo leen el filtro del listado (servidor), el selector de
 * Inventario y `esPeriferico` (cliente). Dos listas del mismo hecho serían la
 * copia que se separa en silencio (CLAUDE.md): una categoría nueva caería en
 * una clase en la pantalla y en otra en el filtro.
 *
 * Lo que no es equipo principal es periférico, también `Otro`: así una
 * categoría nueva del enum cae en algún lado y no desaparece de los dos.
 */
import type { categoriaEquipo } from './esquema.js';

type Categoria = (typeof categoriaEquipo.enumValues)[number];

export const CLASES = ['equipo', 'periferico'] as const;
export type Clase = (typeof CLASES)[number];

/** Los objetos principales: lo que se le entrega a una persona para trabajar. */
export const CATEGORIAS_PRINCIPALES: readonly Categoria[] = ['Portátil', 'Desktop', 'Celular', 'Tablet'];

export const claseDe = (c: Categoria): Clase =>
  CATEGORIAS_PRINCIPALES.includes(c) ? 'equipo' : 'periferico';

export const ETIQUETA_CLASE: Record<Clase, string> = {
  equipo: 'Equipos',
  periferico: 'Periféricos',
};
