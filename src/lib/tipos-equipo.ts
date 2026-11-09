import type { CategoriaEquipo } from '../types';

/**
 * Qué campos lleva cada tipo de equipo.
 *
 * Lo leen el alta (`NewDeviceModal`) y la edición (`EditarEquipo`): si una
 * distinción importa, sale de un solo sitio, no de dos listas que se separan.
 *
 * `etiqueta`, `serial`, empresa, sede, responsable, costo y notas van en todos
 * y no se repiten aquí. Un campo que un tipo no muestra no se borra: se queda
 * en la base como estuviera, y simplemente no se ofrece.
 */
export type Tipo = 'portatil' | 'mesa' | 'celular' | 'tablet' | 'periferico';

export type CampoTecnico =
  | 'nombre_equipo'
  | 'marca'
  | 'modelo'
  | 'serial_cargador'
  | 'imei'
  | 'procesador'
  | 'ram'
  | 'disco'
  | 'tamano_pantalla'
  | 'sistema_operativo'
  | 'licencia_tipo';

export const TIPOS: Record<
  Tipo,
  {
    nombre: string;
    /** `null` en periférico: la categoría la elige quien registra («¿Qué es?»). */
    categoria: CategoriaEquipo | null;
    campos: readonly CampoTecnico[];
  }
> = {
  portatil: {
    nombre: 'Portátil',
    categoria: 'Portátil',
    campos: [
      'nombre_equipo',
      'marca',
      'modelo',
      'serial_cargador',
      'procesador',
      'ram',
      'disco',
      'tamano_pantalla',
      'sistema_operativo',
      'licencia_tipo',
    ],
  },
  mesa: {
    nombre: 'Equipo de mesa',
    categoria: 'Desktop',
    campos: [
      'nombre_equipo',
      'marca',
      'modelo',
      'procesador',
      'ram',
      'disco',
      'sistema_operativo',
      'licencia_tipo',
    ],
  },
  celular: {
    nombre: 'Celular',
    categoria: 'Celular',
    // `disco` es el almacenamiento: la columna ya existe y dice lo mismo.
    campos: ['marca', 'modelo', 'imei', 'disco'],
  },
  tablet: {
    nombre: 'Tablet',
    categoria: 'Tablet',
    campos: ['marca', 'modelo', 'imei', 'disco'],
  },
  periferico: {
    nombre: 'Periférico',
    categoria: null,
    campos: ['marca', 'modelo'],
  },
};

/** A qué formulario va un equipo según su categoría. */
export function tipoDe(categoria: CategoriaEquipo): Tipo {
  switch (categoria) {
    case 'Portátil':
      return 'portatil';
    case 'Desktop':
      return 'mesa';
    case 'Celular':
      return 'celular';
    case 'Tablet':
      return 'tablet';
    default:
      return 'periferico';
  }
}

/** El nombre del campo `disco` cambia con el tipo: en un móvil es almacenamiento. */
export const etiquetaDisco = (t: Tipo) => (t === 'celular' || t === 'tablet' ? 'Almacenamiento' : 'Disco');
