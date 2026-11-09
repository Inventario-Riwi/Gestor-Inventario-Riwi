/**
 * «Aquí no hay dato»: los textos que significan ausencia y no un valor.
 *
 * Un solo sitio para el importador, el servidor y los formularios. Antes vivía
 * solo en el importador, y la aplicación guardaba «N/A» como un serial más:
 * el segundo equipo con «N/A» chocaba contra el índice único del primero,
 * como si fueran el mismo aparato. «N/A» no es un serial: es que no hay.
 *
 * Sin dependencias a propósito: lo importa también el navegador.
 */

/**
 * Lo que el propio Excel considera «aquí no hay dato», sacado de la fórmula de
 * `CONTROL DE CALIDAD` (D45).
 *
 * `Es de Claro` y `Sin rotulo` no estaban en nuestra lista: los trajo el
 * fichero. Sustituyen a la lista que el importador tenía escrita a mano.
 */
export const MARCADORES_DEL_FICHERO = [
  'N/A',
  'No aplica',
  'No tiene',
  '-',
  'Es de Claro',
  'Sin rotulo',
  'No',
];

/** minúsculas, sin tildes, espacios colapsados. La llave de matching. */
export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * La lista completa: la del fichero y las que encontró la carga.
 *
 * `sin etiqueta` lo encontró la carga: `ETIQUETA TECLADO` lo trae en cinco
 * filas de `INV - CE`, y cinco teclados con la etiqueta «Sin etiqueta»
 * chocaron contra el UNIQUE. `sin serial` entró con la regla de que «N/A» se
 * puede repetir: es la misma ausencia dicha de otra forma.
 *
 * `disponible` NO está aquí: es un marcador solo en la columna de la persona, y
 * ahí se trata aparte — en la columna de estado es un valor legítimo.
 */
export const MARCADORES = new Set([
  ...MARCADORES_DEL_FICHERO.map((m) => norm(m)),
  'na',
  'n.a',
  'n.a.',
  'ninguno',
  'sin asignar',
  'sin etiqueta',
  'sin serial',
  '--',
  '.',
]);

export const esMarcador = (s: string) => MARCADORES.has(norm(s));

/** El texto, o `null` si está vacío o es un marcador de ausencia. */
export function sinMarcador(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  if (!t || esMarcador(t)) return null;
  return t;
}
