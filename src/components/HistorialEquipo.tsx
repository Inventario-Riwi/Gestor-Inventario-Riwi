import React, { useEffect, useState } from 'react';
import { ArrowRight, History, Loader2 } from 'lucide-react';
import type { EquipoConMotivos, MovimientoConNombres } from '../types';
import { api, ErrorApi } from '../lib/api';

/**
 * Lo que le ha pasado a un equipo, lo más reciente arriba.
 *
 * El servidor ya devolvía esto con nombres (`GET /api/equipos/:id/historial`);
 * faltaba enseñarlo. Es la pregunta que justifica el proyecto: «¿quién tenía
 * este portátil en marzo?».
 *
 * Se vuelve a pedir cuando el equipo cambia (`updated_at`): una operación
 * hecha desde la misma ficha escribe un movimiento, y la lista tiene que
 * enseñarlo sin cerrar y reabrir.
 */

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/** «Juan → María», «Medellín → Remoto», o lo que haya de los dos extremos. */
const tramo = (desde: string | null, hacia: string | null) => {
  if (!desde && !hacia) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {desde ?? '—'}
      <ArrowRight className="w-3 h-3 text-ink-faint" />
      {hacia ?? '—'}
    </span>
  );
};

export const HistorialEquipo: React.FC<{ equipo: EquipoConMotivos }> = ({ equipo }) => {
  const [movimientos, setMovimientos] = useState<MovimientoConNombres[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setError(null);
    api.historial(equipo.id).then(
      (r) => vigente && setMovimientos(r.movimientos),
      (e) =>
        vigente &&
        setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el historial.'),
    );
    return () => {
      vigente = false;
    };
  }, [equipo.id, equipo.updated_at]);

  return (
    <section className="space-y-2 border-t border-line pt-3">
      <h3 className="text-xs font-semibold text-ink-muted uppercase flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" />
        Historial
      </h3>

      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : movimientos === null ? (
        <p className="text-xs text-ink-muted flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Cargando…
        </p>
      ) : movimientos.length === 0 ? (
        <p className="text-sm text-ink-faint">Todavía no tiene movimientos.</p>
      ) : (
        <ol className="space-y-2">
          {movimientos.map((m) => {
            const personas = tramo(m.empleado_origen, m.empleado_destino);
            const sedes = tramo(m.sede_origen, m.sede_destino);
            const enCamino = m.tipo === 'Traslado' && m.fecha_confirmacion === null;
            return (
              <li key={m.id} className="text-xs border border-line rounded-lg px-3 py-2 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {m.tipo}
                    {enCamino && (
                      <span className="ml-1.5 font-normal text-[10px] px-1.5 py-0.5 rounded bg-warn/20 text-ink">
                        en camino
                      </span>
                    )}
                  </span>
                  <span className="text-ink-muted tabular-nums">{fecha(m.fecha)}</span>
                </div>
                {personas && <div className="text-ink">{personas}</div>}
                {sedes && <div className="text-ink-muted">{sedes}</div>}
                {m.observaciones && (
                  <div className="text-ink-muted italic break-words">{m.observaciones}</div>
                )}
                <div className="text-[11px] text-ink-faint">Registró: {m.usuario ?? '—'}</div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
