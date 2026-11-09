import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleAlert, MonitorSmartphone, Wrench } from 'lucide-react';

import type { EquipoDePuesto, PuestoSala, ResumenSala } from '../types';
import { api, ErrorApi } from '../lib/api';
import { useSondeo } from '../lib/sondeo';
import { Cargando, ErrorDeCarga, Vacio } from './EstadoCarga';

/**
 * Las salas de entrenamiento de Medellín y Barranquilla.
 *
 * La tabla de Inventario lista equipos sueltos; aquí la unidad es el **puesto**:
 * el computador con su pantalla, su teclado y su mouse. Una sala es una lista
 * de puestos, y lo que importa de un vistazo es cuántos están completos.
 *
 * Qué es «completo» lo decide el servidor (`PUESTO_COMPLETO` y
 * `puestosDeSala`), no esta pantalla: la tarjeta y la lista cuentan lo mismo
 * porque salen de la misma regla.
 */

const clave = (s: { sede_id: string | null; sala: string | null }) => `${s.sede_id}|${s.sala}`;

export const SalasEntrenamiento: React.FC<{
  /** Abrir la ficha de un equipo (el computador o una de sus partes). */
  onAbrir: (id: string) => void;
}> = ({ onAbrir }) => {
  const [salas, setSalas] = useState<ResumenSala[] | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [sede, setSede] = useState<string>('');
  const [abierta, setAbierta] = useState<ResumenSala | null>(null);

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    try {
      const r = await api.salas();
      setSalas(r.salas);
      setError(null);
    } catch (e) {
      if (!silencioso) setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'Error desconocido'));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useSondeo(() => cargar({ silencioso: true }));

  const sedes = useMemo(
    () => [...new Set((salas ?? []).map((s) => s.sede ?? 'Sin sede'))],
    [salas],
  );
  const visibles = (salas ?? []).filter((s) => !sede || (s.sede ?? 'Sin sede') === sede);

  if (abierta) {
    // La tarjeta puede haber cambiado con el sondeo: se busca por clave.
    const actual = salas?.find((s) => clave(s) === clave(abierta)) ?? abierta;
    return <Sala sala={actual} onVolver={() => setAbierta(null)} onAbrir={onAbrir} />;
  }

  if (error) return <ErrorDeCarga error={error} que="las salas" onReintentar={() => void cargar()} />;
  if (!salas) return <Cargando que="las salas" />;
  if (salas.length === 0)
    return (
      <Vacio
        titulo="Todavía no hay salas"
        detalle="Un equipo de mesa registrado con «Va en una sala de entrenamiento» aparece aquí, en su sala."
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sede">
        {['', ...sedes].map((s) => (
          <button
            key={s || 'todas'}
            role="radio"
            aria-checked={sede === s}
            onClick={() => setSede(s)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              sede === s
                ? 'border-brand bg-brand/10 text-brand font-medium'
                : 'border-line text-ink-muted hover:bg-surface-alt'
            }`}
          >
            {s || 'Todas las sedes'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibles.map((s) => {
          const pct = s.puestos ? Math.round((s.completos / s.puestos) * 100) : 0;
          const faltan = s.puestos - s.completos;
          return (
            <button
              key={clave(s)}
              onClick={() => setAbierta(s)}
              className="text-left bg-surface border border-line rounded-xl p-4 space-y-3 hover:border-brand/60 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{s.sala ?? 'Sin sala escrita'}</p>
                  <p className="text-xs text-ink-muted">{s.sede ?? 'Sin sede'}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full border border-line text-ink-muted tabular-nums">
                  {s.puestos} puesto{s.puestos === 1 ? '' : 's'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
                <div
                  className={`h-full ${faltan === 0 ? 'bg-ok' : 'bg-warn'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <span className="text-ink flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-ok" />
                  {s.completos} completo{s.completos === 1 ? '' : 's'}
                </span>
                {faltan > 0 && (
                  <span className="text-ink flex items-center gap-1">
                    <CircleAlert className="w-3.5 h-3.5 text-warn" />
                    {faltan} incompleto{faltan === 1 ? '' : 's'}
                  </span>
                )}
                {s.en_mantenimiento > 0 && (
                  <span className="text-ink flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5 text-ink-muted" />
                    {s.en_mantenimiento} en mantenimiento
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const Sala: React.FC<{
  sala: ResumenSala;
  onVolver: () => void;
  onAbrir: (id: string) => void;
}> = ({ sala, onVolver, onAbrir }) => {
  const [puestos, setPuestos] = useState<PuestoSala[] | null>(null);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [soloIncompletos, setSoloIncompletos] = useState(false);

  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      try {
        const r = await api.puestosDeSala(sala.sede_id, sala.sala);
        setPuestos(r.puestos);
        setError(null);
      } catch (e) {
        if (!silencioso) setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'Error desconocido'));
      }
    },
    [sala.sede_id, sala.sala],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useSondeo(() => cargar({ silencioso: true }));

  const filas = (puestos ?? []).filter((p) => !soloIncompletos || !p.completo);

  /** Una celda de parte: su etiqueta o serial, o que falta. */
  const parte = (p: PuestoSala, categoria: 'Monitor' | 'Teclado' | 'Mouse') => {
    if (p.categoria !== 'Desktop') return <span className="text-ink-faint">—</span>;
    const x = p.partes.filter((e) => e.categoria === categoria);
    if (x.length === 0) {
      if (categoria === 'Mouse' && p.mouse_sin_serial)
        return <span className="text-ink-muted">Sí, sin serial</span>;
      return <span className="text-warn font-medium">Falta</span>;
    }
    return (
      <span className="flex flex-col gap-0.5">
        {x.map((e) => (
          <EnlaceEquipo key={e.id} equipo={e} onAbrir={onAbrir} />
        ))}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onVolver}
            className="p-2 border border-line rounded-lg text-ink-muted hover:text-ink hover:bg-surface-alt"
            aria-label="Volver a las salas"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-semibold text-ink">{sala.sala ?? 'Sin sala escrita'}</h2>
            <p className="text-xs text-ink-muted">
              {sala.sede ?? 'Sin sede'} · {sala.puestos} puestos · {sala.completos} completos
            </p>
          </div>
        </div>
        <label className="text-xs text-ink-muted flex items-center gap-2">
          <input
            type="checkbox"
            checked={soloIncompletos}
            onChange={(e) => setSoloIncompletos(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-line"
          />
          Solo los incompletos
        </label>
      </div>

      {error ? (
        <ErrorDeCarga error={error} que="las salas" onReintentar={() => void cargar()} />
      ) : !puestos ? (
        <Cargando que="los puestos" />
      ) : filas.length === 0 ? (
        <Vacio titulo="Nada que mostrar" detalle="Todos los puestos de esta sala están completos." />
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-muted border-b border-line">
              <tr>
                <th className="text-left font-medium px-3 py-2">Computador</th>
                <th className="text-left font-medium px-3 py-2">Pantalla</th>
                <th className="text-left font-medium px-3 py-2">Teclado</th>
                <th className="text-left font-medium px-3 py-2">Mouse</th>
                <th className="text-left font-medium px-3 py-2">Estado</th>
                <th className="text-left font-medium px-3 py-2">Puesto</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-3 py-2">
                    <EnlaceEquipo equipo={p} onAbrir={onAbrir} conModelo />
                  </td>
                  <td className="px-3 py-2">{parte(p, 'Monitor')}</td>
                  <td className="px-3 py-2">{parte(p, 'Teclado')}</td>
                  <td className="px-3 py-2">{parte(p, 'Mouse')}</td>
                  <td className="px-3 py-2 text-ink-muted">{p.estado}</td>
                  <td className="px-3 py-2">
                    {p.completo ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-ok/10 text-ok border border-ok/30">
                        Completo
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-warn/10 text-warn border border-warn/40">
                        Incompleto
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const EnlaceEquipo: React.FC<{
  equipo: EquipoDePuesto;
  onAbrir: (id: string) => void;
  conModelo?: boolean;
}> = ({ equipo, onAbrir, conModelo }) => (
  <button
    onClick={() => onAbrir(equipo.id)}
    className="text-left hover:underline"
    title="Abrir la ficha"
  >
    <span className="font-mono text-brand text-xs flex items-center gap-1">
      {conModelo && <MonitorSmartphone className="w-3.5 h-3.5" />}
      {equipo.etiqueta ?? equipo.serial ?? 'sin etiqueta'}
    </span>
    {conModelo && (
      <span className="block text-xs text-ink-muted">
        {[equipo.marca, equipo.modelo].filter(Boolean).join(' ') || equipo.categoria}
      </span>
    )}
    {equipo.estado !== 'Disponible' && equipo.estado !== 'Asignado' && !conModelo && (
      <span className="block text-[10px] text-ink-muted">{equipo.estado}</span>
    )}
  </button>
);
