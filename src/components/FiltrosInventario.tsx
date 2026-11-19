import React from 'react';
import { AlertTriangle, Laptop, Layers, Mouse, Search, X } from 'lucide-react';

import type { CategoriaEquipo, EstadoEquipo, Sede } from '../types';
import { CATEGORIAS_EQUIPO, ESTADOS_EQUIPO, USOS_EXCLUSIVOS } from '../types';
import { CLASES, claseDe, ETIQUETA_CLASE, type Clase } from '../../db/clases-equipo';
import { etiquetaEmpresa } from '../lib/empresas';

/**
 * La barra de filtros de Inventario (D55), en un solo bloque.
 *
 * Antes eran cinco capas sueltas: el selector de clase, una fila de chips de
 * empresa con su nota, las pestañas, seis controles en línea y un botón
 * «Centros de entrenamiento» que repetía la pestaña de salas. Ahora:
 *
 * 1. **Qué busco**: equipos / periféricos / todo, y el buscador a todo lo ancho.
 * 2. **Afinar**: cinco desplegables del mismo tamaño, con la empresa con su
 *    número (lo que daban los chips, D28) y el ámbito staff / salas (D53).
 * 3. **Lo que está puesto**: cada filtro activo como una pastilla que se quita
 *    sola, y «Limpiar todo». Se ve qué filtra la tabla sin leer los cinco.
 */
export interface Filtros {
  clase: Clase | '';
  q: string;
  estado: EstadoEquipo | '';
  categoria: CategoriaEquipo | '';
  empresa: string;
  sede: string;
  uso: string;
  /** D53: false = staff, true = salas de entrenamiento. */
  salas: boolean;
}

export const FiltrosInventario: React.FC<{
  f: Filtros;
  cambiar: (parche: Partial<Filtros>) => void;
  limpiar: () => void;
  sedes: Sede[];
  conteosClase: Record<Clase, number> | null;
  conteosEmpresa: Record<string, number> | null;
  /** Dentro de una tarjeta de «Empresas y sedes»: empresa, sede y ámbito los fija ella. */
  fijados?: { empresa?: boolean; sede?: boolean; ambito?: boolean };
}> = ({ f, cambiar, limpiar, sedes, conteosClase, conteosEmpresa, fijados = {} }) => {
  const nombreSede = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? 'Sede';

  // Las pastillas de lo que está puesto. La clase y la búsqueda no van: la
  // clase ya se ve en el selector y la búsqueda en su caja.
  const activos: { clave: string; texto: string; quitar: () => void }[] = [];
  if (f.estado) activos.push({ clave: 'estado', texto: f.estado, quitar: () => cambiar({ estado: '' }) });
  if (f.categoria) activos.push({ clave: 'categoria', texto: f.categoria, quitar: () => cambiar({ categoria: '' }) });
  if (f.empresa && !fijados.empresa)
    activos.push({ clave: 'empresa', texto: etiquetaEmpresa(f.empresa), quitar: () => cambiar({ empresa: '' }) });
  if (f.sede && !fijados.sede)
    activos.push({ clave: 'sede', texto: nombreSede(f.sede), quitar: () => cambiar({ sede: '' }) });
  if (f.uso) activos.push({ clave: 'uso', texto: `Solo ${f.uso.toLowerCase()}`, quitar: () => cambiar({ uso: '' }) });
  if (f.salas) activos.push({ clave: 'salas', texto: 'Salas de entrenamiento', quitar: () => cambiar({ salas: false }) });

  const sinClasificar = conteosEmpresa?.['Sin clasificar'] ?? 0;

  const select =
    'w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:bg-surface-alt disabled:text-ink-muted';

  return (
    <section className="bg-surface border border-line rounded-xl p-3 space-y-3 shadow-sm">
      {/* 1. Qué busco */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div
          role="tablist"
          aria-label="Clase de objeto"
          className="inline-flex p-1 rounded-lg bg-surface-alt border border-line shrink-0 self-start"
        >
          {([...CLASES, ''] as const).map((c) => {
            const activa = f.clase === c;
            const n = c
              ? conteosClase?.[c]
              : conteosClase
                ? conteosClase.equipo + conteosClase.periferico
                : undefined;
            const Icono = c === 'equipo' ? Laptop : c === 'periferico' ? Mouse : Layers;
            return (
              <button
                key={c || 'todo'}
                role="tab"
                aria-selected={activa}
                onClick={() =>
                  cambiar({
                    clase: c,
                    // Una categoría de la otra clase dejaría la tabla vacía sin
                    // explicación: se suelta.
                    ...(c && f.categoria && claseDe(f.categoria) !== c ? { categoria: '' } : {}),
                  })
                }
                className={`px-3 py-1.5 text-sm rounded-md font-medium flex items-center gap-1.5 transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${
                  activa ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Icono className="w-4 h-4" />
                {c ? ETIQUETA_CLASE[c] : 'Todo'}
                {n !== undefined && (
                  <span className={`text-xs tabular-nums ${activa ? 'text-brand' : 'text-ink-faint'}`}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            value={f.q}
            onChange={(e) => cambiar({ q: e.target.value })}
            placeholder="Buscar por etiqueta, serial, nombre, marca, modelo, sala o persona…"
            aria-label="Buscar en el inventario"
            className="w-full pl-9 pr-9 py-2 text-sm border border-line rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          {f.q && (
            <button
              onClick={() => cambiar({ q: '' })}
              aria-label="Borrar la búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-ink-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Afinar: cinco del mismo tamaño, en rejilla. */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <select aria-label="Estado" value={f.estado} onChange={(e) => cambiar({ estado: e.target.value as EstadoEquipo | '' })} className={select}>
          <option value="">Estado: todos</option>
          {ESTADOS_EQUIPO.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          aria-label="Categoría"
          value={f.categoria}
          onChange={(e) => cambiar({ categoria: e.target.value as CategoriaEquipo | '' })}
          className={select}
        >
          <option value="">Tipo: todos</option>
          {CATEGORIAS_EQUIPO.filter((c) => !f.clase || claseDe(c) === f.clase).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* La empresa con su número, que es lo que daban los chips (D28). Lo
            prestado cuenta en su dueña y en quien lo tiene (D31). */}
        <select
          aria-label="Empresa"
          title="Un equipo prestado cuenta en su dueña y en quien lo tiene."
          value={f.empresa}
          onChange={(e) => cambiar({ empresa: e.target.value })}
          disabled={fijados.empresa}
          className={select}
        >
          <option value="">Empresa: todas</option>
          {Object.entries(conteosEmpresa ?? {}).map(([nombre, n]) => (
            <option key={nombre} value={nombre}>
              {etiquetaEmpresa(nombre)} ({n}){nombre === 'Sin clasificar' && n > 0 ? ' ⚠' : ''}
            </option>
          ))}
        </select>

        <select
          aria-label="Sede"
          value={f.sede}
          onChange={(e) => cambiar({ sede: e.target.value })}
          disabled={fijados.sede}
          className={select}
        >
          <option value="">Sede: todas</option>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>

        <select aria-label="Uso" value={f.uso} onChange={(e) => cambiar({ uso: e.target.value })} className={select}>
          <option value="">Uso: cualquiera</option>
          {USOS_EXCLUSIVOS.map((u) => (
            <option key={u} value={u}>
              Solo {u.toLowerCase()}
            </option>
          ))}
        </select>

        {/* D53: el staff y las salas no se mezclan. Aquí se elige cuál ver
            como tabla; la pestaña «Salas» los enseña por puesto. */}
        <select
          aria-label="Ámbito"
          value={f.salas ? 'salas' : 'staff'}
          onChange={(e) => cambiar({ salas: e.target.value === 'salas' })}
          disabled={fijados.ambito}
          className={select}
        >
          <option value="staff">Equipos del staff</option>
          <option value="salas">Salas de entrenamiento</option>
        </select>
      </div>

      {/* 3. Lo que está puesto */}
      {(activos.length > 0 || sinClasificar > 0) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {activos.map((a) => (
            <button
              key={a.clave}
              onClick={a.quitar}
              className="group text-xs pl-2.5 pr-1.5 py-1 rounded-full bg-brand-subtle text-brand font-medium flex items-center gap-1 hover:bg-brand/15 transition-colors"
              aria-label={`Quitar filtro ${a.texto}`}
            >
              {a.texto}
              <X className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
          {activos.length > 0 && (
            <button onClick={limpiar} className="text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline">
              Limpiar todo
            </button>
          )}
          {/* «Sin clasificar» se ve sin ir a buscarlo (D28): era la razón de los chips. */}
          {sinClasificar > 0 && f.empresa !== 'Sin clasificar' && !fijados.empresa && (
            <button
              onClick={() => cambiar({ empresa: 'Sin clasificar' })}
              className="ml-auto text-xs px-2.5 py-1 rounded-full border border-warn/50 bg-warn/10 text-ink flex items-center gap-1.5 hover:bg-warn/20"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-warn" />
              {sinClasificar} sin empresa asignada
            </button>
          )}
        </div>
      )}
    </section>
  );
};
