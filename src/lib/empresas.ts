/**
 * Cómo se ve cada empresa en pantalla: el nombre que se muestra y su color.
 *
 * El valor guardado en la base no cambia: `BBL Labs` sigue siendo la clave del
 * enum, de las actas y del importador. Aquí solo se decide la etiqueta, así
 * que renombrar en pantalla no toca ningún documento emitido.
 *
 * Las clases van escritas enteras porque Tailwind solo genera las que lee
 * literalmente en el código: un `bg-${color}` armado al vuelo no pintaría.
 */

interface EstiloEmpresa {
  etiqueta: string;
  /** Chip sin seleccionar: fondo suave y texto del color. */
  chip: string;
  /** Chip seleccionado como filtro: fondo del color y texto blanco. */
  activo: string;
}

const ESTILOS: Record<string, EstiloEmpresa> = {
  RIWI: {
    etiqueta: 'RIWI',
    chip: 'border-riwi/40 bg-riwi-subtle text-riwi hover:border-riwi',
    activo: 'bg-riwi text-white border-riwi',
  },
  'BBL Labs': {
    etiqueta: 'Blackbird Labs',
    chip: 'border-blackbird/40 bg-blackbird-subtle text-blackbird hover:border-blackbird',
    activo: 'bg-blackbird text-white border-blackbird',
  },
  'Emerald Fire': {
    etiqueta: 'Emerald Fire',
    chip: 'border-emerald-fire/40 bg-emerald-fire-subtle text-emerald-fire hover:border-emerald-fire',
    activo: 'bg-emerald-fire text-white border-emerald-fire',
  },
};

export function estiloEmpresa(nombre: string): EstiloEmpresa | null {
  return ESTILOS[nombre] ?? null;
}

export function etiquetaEmpresa(nombre: string): string {
  return ESTILOS[nombre]?.etiqueta ?? nombre;
}
