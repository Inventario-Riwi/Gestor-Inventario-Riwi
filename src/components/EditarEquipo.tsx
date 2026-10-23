import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CambiosEquipo, EquipoConMotivos } from '../types';
import {
  CATEGORIAS_EQUIPO,
  CONDICIONES_EQUIPO,
  EMPRESAS,
  PROPIEDADES_EQUIPO,
  TIPOS_LICENCIA,
} from '../types';
import { api, ErrorApi } from '../lib/api';
import { etiquetaEmpresa } from '../lib/empresas';

/**
 * Editar los datos de un equipo desde su ficha.
 *
 * Lo que NO está, a propósito: estado, responsable y sede se mueven con una
 * operación (Asignar, Trasladar…), que es lo que deja el movimiento en el
 * historial (D19); la clave BIOS y la de licencia van cifradas y tienen su
 * acceso aparte (§5.2); las notas tienen su propio editor (`NotasEquipo`).
 *
 * Solo se manda lo que cambió: el servidor audita campo a campo, y mandar la
 * ficha entera registraría veinte columnas idénticas por tocar una.
 */

type Texto =
  | 'etiqueta'
  | 'nombre_equipo'
  | 'marca'
  | 'modelo'
  | 'serial'
  | 'serial_cargador'
  | 'sistema_operativo'
  | 'procesador'
  | 'ram'
  | 'disco'
  | 'tamano_pantalla'
  | 'costo';

type Datos = Record<Texto, string> & {
  categoria: EquipoConMotivos['categoria'];
  empresa: EquipoConMotivos['empresa'];
  propiedad: EquipoConMotivos['propiedad'];
  licencia_tipo: string;
  condicion: string;
};

const desde = (e: EquipoConMotivos): Datos => ({
  categoria: e.categoria,
  etiqueta: e.etiqueta ?? '',
  nombre_equipo: e.nombre_equipo ?? '',
  marca: e.marca ?? '',
  modelo: e.modelo ?? '',
  serial: e.serial ?? '',
  serial_cargador: e.serial_cargador ?? '',
  empresa: e.empresa,
  propiedad: e.propiedad,
  sistema_operativo: e.sistema_operativo ?? '',
  licencia_tipo: e.licencia_tipo ?? '',
  procesador: e.procesador ?? '',
  ram: e.ram ?? '',
  disco: e.disco ?? '',
  tamano_pantalla: e.tamano_pantalla ?? '',
  condicion: e.condicion ?? '',
  costo: e.costo ?? '',
});

export const EditarEquipo: React.FC<{
  equipo: EquipoConMotivos;
  onCancelar: () => void;
  onGuardado: (equipo: EquipoConMotivos) => void;
}> = ({ equipo, onCancelar, onGuardado }) => {
  const [datos, setDatos] = useState<Datos>(() => desde(equipo));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poner = <K extends keyof Datos>(campo: K, valor: Datos[K]) =>
    setDatos((d) => ({ ...d, [campo]: valor }));

  /**
   * Un portátil o un desktop no lleva condición: la hoja de origen no la
   * tiene para ellos y `verificar-datos.sql` §D cuenta como error cualquiera
   * que aparezca. Por eso el campo no se ofrece, y si alguien cambia la
   * categoría a una de esas, la condición que hubiera se vacía.
   */
  const esComputo = datos.categoria === 'Portátil' || datos.categoria === 'Desktop';

  /** Solo lo que cambió, con las cadenas vacías como NULL. */
  const cambios = (): CambiosEquipo => {
    const antes = desde(equipo);
    const final: Datos = esComputo ? { ...datos, condicion: '' } : datos;
    const salida: Record<string, unknown> = {};
    for (const clave of Object.keys(final) as (keyof Datos)[]) {
      const ahora = typeof final[clave] === 'string' ? (final[clave] as string).trim() : final[clave];
      const previo = typeof antes[clave] === 'string' ? (antes[clave] as string).trim() : antes[clave];
      if (ahora !== previo) salida[clave] = ahora === '' ? null : ahora;
    }
    return salida as CambiosEquipo;
  };

  const pendientes = cambios();
  const hayCambios = Object.keys(pendientes).length > 0;
  const sinEtiqueta = datos.etiqueta.trim() === '' && equipo.etiqueta !== null;

  const guardar = async () => {
    if (!hayCambios) return onCancelar();
    setGuardando(true);
    setError(null);
    try {
      const r = await api.actualizarEquipo(equipo.id, pendientes);
      onGuardado({ ...equipo, ...r.equipo });
    } catch (e) {
      // El 409 de serial o etiqueta repetidos llega tal cual: es un dato real
      // que hay que resolver, no un fallo de la pantalla.
      setError(e instanceof ErrorApi ? e.message : 'No se pudieron guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  };

  const clase =
    'w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-brand';

  const texto = (etiqueta: string, campo: Texto, ayuda?: string) => (
    <label className="text-xs text-ink-muted space-y-1">
      <span>{etiqueta}</span>
      <input
        value={datos[campo]}
        onChange={(e) => poner(campo, e.target.value)}
        placeholder={ayuda}
        className={clase}
      />
    </label>
  );

  const lista = <K extends 'categoria' | 'empresa' | 'propiedad' | 'licencia_tipo' | 'condicion'>(
    etiqueta: string,
    campo: K,
    opciones: readonly string[],
    conVacio = false,
  ) => (
    <label className="text-xs text-ink-muted space-y-1">
      <span>{etiqueta}</span>
      <select
        value={datos[campo]}
        onChange={(e) => poner(campo, e.target.value as Datos[K])}
        className={clase}
      >
        {conVacio && <option value="">—</option>}
        {opciones.map((o) => (
          <option key={o} value={o}>
            {campo === 'empresa' ? etiquetaEmpresa(o) : o}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {lista('Categoría', 'categoria', CATEGORIAS_EQUIPO)}
        {texto('Etiqueta', 'etiqueta')}
        {texto('Nombre del equipo', 'nombre_equipo')}
        {texto('Serial', 'serial')}
        {texto('Marca', 'marca')}
        {texto('Modelo', 'modelo')}
        {texto('Serial del cargador', 'serial_cargador')}
        {lista('Empresa', 'empresa', EMPRESAS)}
        {lista('Propiedad', 'propiedad', PROPIEDADES_EQUIPO)}
        {texto('Sistema operativo', 'sistema_operativo')}
        {lista('Licencia', 'licencia_tipo', TIPOS_LICENCIA, true)}
        {texto('Procesador', 'procesador')}
        {texto('RAM', 'ram', 'p. ej. 16 GB')}
        {texto('Disco', 'disco', 'p. ej. 512 GB')}
        {texto('Pantalla', 'tamano_pantalla', 'p. ej. 14"')}
        {!esComputo && lista('Condición', 'condicion', CONDICIONES_EQUIPO, true)}
        {texto('Costo (COP)', 'costo', 'p. ej. 3500000')}
      </div>

      <p className="text-[11px] text-ink-muted">
        Estado, responsable y sede no se editan aquí: se cambian con las operaciones de abajo,
        para que quede constancia en el historial.
      </p>

      {sinEtiqueta && (
        <p className="text-xs text-ink bg-warn/10 border border-warn/40 rounded-lg px-3 py-2">
          Vas a quitarle la etiqueta. Si es para corregirla, escribe la nueva en su lugar.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancelar}
          disabled={guardando}
          className="px-3 py-1.5 text-sm border border-line rounded-lg text-ink-muted hover:bg-surface-alt disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={() => void guardar()}
          disabled={guardando || !hayCambios}
          className="px-3 py-1.5 text-sm bg-brand text-white rounded-lg font-medium hover:bg-brand-hover disabled:opacity-50 flex items-center gap-1.5"
        >
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
          Guardar cambios
        </button>
      </div>
    </div>
  );
};
