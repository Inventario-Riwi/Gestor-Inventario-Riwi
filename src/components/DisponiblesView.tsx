import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Laptop, Mouse, PackageCheck } from 'lucide-react';

import { EMPRESAS, type EquipoConMotivos, type Sede } from '../types';
import { api, ErrorApi } from '../lib/api';
import { estiloEmpresa, etiquetaEmpresa } from '../lib/empresas';
import { esPeriferico, identificador, nombreVisible } from '../lib/nombre-equipo';
import { useSondeo } from '../lib/sondeo';
import { Cargando, ErrorDeCarga, Vacio } from './EstadoCarga';

/**
 * «Disponibles» (D53): lo que se puede entregar ya, de primera mano.
 *
 * Para quien necesita saber qué hay sin aprender la tabla de inventario: solo
 * equipos del **staff** en estado Disponible —nunca los de salas de
 * entrenamiento, que van aparte— y solo dos filtros, sede y empresa. Equipos y
 * periféricos en dos bloques, porque se buscan distinto: un portátil por su
 * modelo, un mouse por cuántos quedan.
 *
 * Trae todas las páginas y no la primera: con 200 por página, enseñar solo la
 * primera diría «hay 200» cuando hay 543, y el número es justo lo que se mira.
 */
export const DisponiblesView: React.FC<{ onVolver: () => void }> = ({ onVolver }) => {
  const [sede, setSede] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [filas, setFilas] = useState<EquipoConMotivos[] | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);

  useEffect(() => {
    api.sedes().then(
      (r) => setSedes(r.sedes),
      () => setSedes([]),
    );
  }, []);

  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!silencioso) setError(null);
      try {
        const todas: EquipoConMotivos[] = [];
        for (let pagina = 1; ; pagina++) {
          const r = await api.equipos({
            estado: 'Disponible',
            sede: sede || undefined,
            empresa: empresa || undefined,
            pagina,
            porPagina: 200,
          });
          todas.push(...r.filas);
          if (todas.length >= r.total || r.filas.length === 0) break;
        }
        setFilas(todas);
      } catch (e) {
        if (!silencioso) setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'Error desconocido'));
      }
    },
    [sede, empresa],
  );

  useEffect(() => {
    setFilas(null);
    void cargar();
  }, [cargar]);
  useSondeo(() => cargar({ silencioso: true }));

  const { equipos, perifericos } = useMemo(() => {
    const lista = filas ?? [];
    return {
      equipos: lista.filter((e) => !esPeriferico(e.categoria)),
      perifericos: lista.filter((e) => esPeriferico(e.categoria)),
    };
  }, [filas]);

  const nombreSede = (id: string | null) => (id ? (sedes.find((s) => s.id === id)?.nombre ?? '—') : '—');

  const select =
    'px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/40';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onVolver}
            className="p-2 border border-line rounded-lg text-ink-muted hover:text-ink hover:bg-surface-alt"
            aria-label="Volver al dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-ink flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-brand" />
              Disponibles
            </h1>
            <p className="text-xs text-ink-muted">
              Equipos y periféricos del staff listos para entregar. Sin salas de entrenamiento.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <select aria-label="Sede" value={sede} onChange={(e) => setSede(e.target.value)} className={select}>
            <option value="">Todas las sedes</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          <select
            aria-label="Empresa"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className={select}
          >
            <option value="">Todas las empresas</option>
            {EMPRESAS.map((emp) => (
              <option key={emp} value={emp}>
                {etiquetaEmpresa(emp)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <ErrorDeCarga error={error} que="los equipos disponibles" onReintentar={() => void cargar()} />
      ) : filas === null ? (
        <Cargando que="los equipos disponibles" />
      ) : filas.length === 0 ? (
        <Vacio titulo="No hay nada disponible" detalle="Prueba con otra sede o empresa." />
      ) : (
        <>
          <Bloque titulo="Equipos" icono={Laptop} filas={equipos} nombreSede={nombreSede} />
          <Bloque titulo="Periféricos" icono={Mouse} filas={perifericos} nombreSede={nombreSede} />
        </>
      )}
    </div>
  );
};

const Bloque: React.FC<{
  titulo: string;
  icono: React.ComponentType<{ className?: string }>;
  filas: EquipoConMotivos[];
  nombreSede: (id: string | null) => string;
}> = ({ titulo, icono: Icono, filas, nombreSede }) => {
  // Cuántos de cada categoría, de mayor a menor: es lo primero que se pregunta
  // («¿quedan monitores?») y la tabla sola obliga a contar a ojo.
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filas) m.set(e.categoria, (m.get(e.categoria) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filas]);

  return (
    <section className="bg-surface border border-line rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink flex items-center gap-2">
          <Icono className="w-4 h-4 text-brand" />
          {titulo}
          <span className="text-sm font-normal text-ink-muted tabular-nums">{filas.length}</span>
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {porCategoria.map(([cat, n]) => (
            <span key={cat} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">
              {cat} <strong className="text-ink tabular-nums">{n}</strong>
            </span>
          ))}
        </div>
      </div>
      {filas.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted">Ninguno con estos filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt text-xs text-ink-muted uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Etiqueta</th>
                <th className="text-left px-4 py-2 font-medium">Equipo</th>
                <th className="text-left px-4 py-2 font-medium">Serial</th>
                <th className="text-left px-4 py-2 font-medium">Sede</th>
                <th className="text-left px-4 py-2 font-medium">Empresa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filas.map((e) => (
                <tr key={e.id} className="hover:bg-surface-alt/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-brand">{e.etiqueta ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{nombreVisible(e)}</div>
                    <div className="text-xs text-ink-muted">
                      {esPeriferico(e.categoria)
                        ? (identificador(e) ?? 'sin etiqueta ni serial')
                        : [e.marca, e.modelo].filter(Boolean).join(' ') || e.categoria}
                      {e.uso_exclusivo ? ` · ${e.uso_exclusivo.toLowerCase()}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{e.serial ?? '—'}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{nombreSede(e.sede_id)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md border ${
                        estiloEmpresa(e.empresa)?.chip ?? 'border-line text-ink-muted'
                      }`}
                    >
                      {etiquetaEmpresa(e.empresa)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
