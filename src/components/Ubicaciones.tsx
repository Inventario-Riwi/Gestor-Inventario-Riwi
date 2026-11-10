import React, { useCallback, useEffect, useState } from 'react';
import { Building2, CircleDashed, MapPin } from 'lucide-react';

import type { Sede } from '../types';
import { api, ErrorApi } from '../lib/api';
import { estiloEmpresa } from '../lib/empresas';
import { useSondeo } from '../lib/sondeo';
import { resumir, TARJETAS, type ConteosUbicacion, type Tarjeta } from '../lib/ubicaciones';
import { Cargando, ErrorDeCarga } from './EstadoCarga';

/**
 * Inventario por empresa y sede, en tarjetas. Las tarjetas y qué cuenta cada
 * una están en `lib/ubicaciones.ts`; aquí solo se pintan.
 *
 * Abrir una tarjeta no abre otra pantalla: lleva a la tabla de siempre con la
 * empresa y la sede ya puestas, para que buscar, filtrar y abrir la ficha
 * funcionen igual que en «Todos».
 */
export const Ubicaciones: React.FC<{
  sedes: Sede[];
  onAbrir: (t: Tarjeta, sedeId: string | null) => void;
}> = ({ sedes, onAbrir }) => {
  const [conteos, setConteos] = useState<ConteosUbicacion | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      setConteos(await api.ubicaciones());
      setError(null);
    } catch (e) {
      if (!silencioso) setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'Error desconocido'));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useSondeo(() => cargar({ silencioso: true }));

  if (error) return <ErrorDeCarga error={error} que="las ubicaciones" onReintentar={() => void cargar()} />;
  if (!conteos) return <Cargando que="las ubicaciones" />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {TARJETAS.map((t) => {
        const r = resumir(t, conteos, sedes);
        const estilo = t.empresa ? estiloEmpresa(t.empresa) : null;
        const Icono = t.empresa ? Building2 : MapPin;

        if (r.sinSede) {
          return (
            <div
              key={t.clave}
              className="border border-dashed border-line rounded-xl p-4 space-y-1 text-ink-muted"
            >
              <p className="font-semibold text-ink flex items-center gap-1.5">
                <CircleDashed className="w-4 h-4" />
                {t.titulo}
              </p>
              <p className="text-xs">
                La sede «{t.sede}» todavía no existe. Créala en Sedes → Nueva sede.
              </p>
            </div>
          );
        }

        return (
          <button
            key={t.clave}
            onClick={() => onAbrir(t, r.sede_id ?? null)}
            className="text-left bg-surface border border-line rounded-xl p-4 space-y-3 hover:border-brand/60 hover:shadow-sm transition"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-ink flex items-center gap-1.5">
                <Icono className="w-4 h-4 text-brand" />
                {t.titulo}
              </p>
              {estilo && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${estilo.chip}`}>
                  {t.sede ? 'Empresa · sede' : 'Empresa'}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-ink tabular-nums">
              {r.total}
              <span className="text-sm font-normal text-ink-muted"> equipo{r.total === 1 ? '' : 's'}</span>
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span>
                <strong className="text-ink tabular-nums">{r.asignados}</strong> asignados
              </span>
              <span>
                <strong className="text-ink tabular-nums">{r.disponibles}</strong> disponibles
              </span>
              {r.mantenimiento > 0 && (
                <span>
                  <strong className="text-ink tabular-nums">{r.mantenimiento}</strong> en mantenimiento
                </span>
              )}
            </div>
            {r.reparto && r.reparto.length > 0 && (
              <div className="border-t border-line pt-2 flex flex-wrap gap-1.5">
                {r.reparto.map(([nombre, n]) => (
                  <span
                    key={nombre}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted"
                  >
                    {nombre} <strong className="text-ink tabular-nums">{n}</strong>
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
