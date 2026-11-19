import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  GraduationCap,
  Laptop,
  MapPin,
  Mouse,
  PackageCheck,
  Truck,
  UserCheck,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { EstadoEquipo, ResumenEquipos } from '../types';
import { api, ErrorApi } from '../lib/api';
import { etiquetaEmpresa } from '../lib/empresas';
import { useSondeo } from '../lib/sondeo';
import { Cargando, ErrorDeCarga } from './EstadoCarga';

interface DashboardViewProps {
  onOpenNewDeviceModal: () => void;
  onOpenOnboardingModal: () => void;
  setActiveTab: (tab: string) => void;
  /** D53. Lo disponible del staff, con solo sede y empresa para filtrar. */
  onAbrirDisponibles: () => void;
}

/**
 * Un color por estado, de `docs/paleta.md`. Están los seis del enum; uno nuevo
 * cae en el gris y se ve, en vez de desaparecer del gráfico.
 */
const COLOR_ESTADO: Record<string, string> = {
  Disponible: '#57C99B',
  Asignado: '#5B4FE0',
  'En mantenimiento': '#E5C84B',
  Reservado: '#DDA5F2',
  Prestado: '#7C71F0',
  'De baja': '#9B9AB0',
};
const GRIS = '#9B9AB0';

/**
 * Los colores de empresa son los de su marca (`index.css`): el mismo color en
 * los chips de la tabla y aquí. Validados como paleta (dataviz): las tres
 * marcas pasan; el gris de «Sin clasificar» es neutro a propósito y siempre
 * lleva su nombre al lado.
 */
const COLOR_EMPRESA: Record<string, string> = {
  RIWI: '#5B4FE0',
  'BBL Labs': '#157A4E',
  'Emerald Fire': '#0862C0',
  'Sin clasificar': GRIS,
};

/** Tres tramos para las barras apiladas: lo que más se pregunta y el resto. */
const TRAMOS = [
  { clave: 'asignados', nombre: 'Asignados', color: COLOR_ESTADO.Asignado },
  { clave: 'disponibles', nombre: 'Disponibles', color: COLOR_ESTADO.Disponible },
  { clave: 'otros', nombre: 'Otros estados', color: '#D9D8E6' },
] as const;

const tooltipEstilo = {
  contentStyle: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E3E2EE',
    borderRadius: 10,
    fontSize: 12,
    color: '#1D1C4A',
    boxShadow: '0 4px 16px rgba(29, 28, 74, 0.08)',
  },
  cursor: { fill: 'rgba(91, 79, 224, 0.06)' },
};

const hace = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  if (s < 60) return 'ahora';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 30) return rtf.format(-Math.round(s / 86400), 'day');
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenOnboardingModal,
  setActiveTab,
  onAbrirDisponibles,
}) => {
  const [resumen, setResumen] = useState<ResumenEquipos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ErrorApi | null>(null);

  /** `silencioso`: la recarga del sondeo; si falla, deja lo que había. */
  const cargar = useCallback(async ({ silencioso = false }: { silencioso?: boolean } = {}) => {
    if (!silencioso) {
      setCargando(true);
      setError(null);
    }
    try {
      setResumen(await api.resumenEquipos());
      setError(null);
    } catch (e) {
      if (silencioso) return;
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, String(e)));
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useSondeo(() => cargar({ silencioso: true }));
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const datos = useMemo(() => {
    if (!resumen) return null;
    // Un estado sin filas no viene (GROUP BY): se lee como cero, no undefined.
    const de = (estado: EstadoEquipo) =>
      resumen.por_estado.find((e) => e.estado === estado)?.equipos ?? 0;
    const sala = (estado: EstadoEquipo) =>
      resumen.salas.por_estado.find((e) => e.estado === estado)?.equipos ?? 0;

    const estados = resumen.por_estado
      .map((e) => ({ name: e.estado, value: e.equipos, color: COLOR_ESTADO[e.estado] ?? GRIS }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);

    // Por empresa: asignados, disponibles y el resto, de cada una.
    const empresas = new Map<string, { asignados: number; disponibles: number; otros: number }>();
    for (const f of resumen.por_empresa) {
      const fila = empresas.get(f.empresa) ?? { asignados: 0, disponibles: 0, otros: 0 };
      if (f.estado === 'Asignado') fila.asignados += f.n;
      else if (f.estado === 'Disponible') fila.disponibles += f.n;
      else fila.otros += f.n;
      empresas.set(f.empresa, fila);
    }
    const porEmpresa = [...empresas.entries()]
      .map(([empresa, v]) => ({ nombre: etiquetaEmpresa(empresa), empresa, ...v, total: v.asignados + v.disponibles + v.otros }))
      .sort((a, b) => b.total - a.total);

    const porSede = resumen.por_sede.map((s) => ({
      nombre: s.sede ?? 'Sin sede',
      asignados: s.asignados,
      disponibles: s.disponibles,
      otros: s.total - s.asignados - s.disponibles,
      total: s.total,
    }));

    return {
      total: resumen.total,
      asignados: de('Asignado'),
      disponibles: de('Disponible'),
      mantenimiento: de('En mantenimiento'),
      prestados: de('Prestado'),
      reservados: de('Reservado'),
      deBaja: de('De baja'),
      estados,
      porEmpresa,
      porSede,
      disponiblesTipo: resumen.disponibles_por_categoria,
      sala: {
        total: resumen.salas.total,
        disponibles: sala('Disponible'),
        mantenimiento: sala('En mantenimiento'),
        deBaja: sala('De baja'),
        categorias: [...resumen.salas.por_categoria].sort((a, b) => b.equipos - a.equipos),
      },
    };
  }, [resumen]);

  if (cargando) return <Cargando que="el resumen del inventario" />;
  if (error) {
    return <ErrorDeCarga error={error} que="el resumen del inventario" onReintentar={() => void cargar()} />;
  }
  if (!resumen || !datos) return null;

  const pct = (n: number) => (datos.total ? Math.round((n / datos.total) * 100) : 0);
  const atencion = datos.mantenimiento + resumen.por_revisar + resumen.traslados_abiertos;

  return (
    <div className="space-y-5 pb-8">
      {/* Cabecera: qué es y las dos acciones que más se usan. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Panel de inventario</h1>
          <p className="text-sm text-ink-muted mt-1">
            Equipos del staff de RIWI, Blackbird Labs y Emerald Fire. Las salas de entrenamiento van
            aparte, abajo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onAbrirDisponibles}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#146B3A] hover:bg-[#0F5A30] active:scale-[0.97] transition-[background-color,transform] duration-150 flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            Ver disponibles
            <span className="bg-white/20 rounded px-1.5 tabular-nums">{datos.disponibles}</span>
          </button>
          <button
            onClick={onOpenOnboardingModal}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand hover:bg-brand-hover active:scale-[0.97] transition-[background-color,transform] duration-150 flex items-center gap-2 shadow-sm"
          >
            <PackageCheck className="w-4 h-4" />
            Entregar equipos
          </button>
        </div>
      </header>

      {/* Cuatro cifras que contestan lo primero: cuánto hay, cuánto está en
          uso, cuánto se puede entregar y cuánto pide atención. */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi
          titulo="Staff en inventario"
          valor={datos.total}
          icono={Laptop}
          detalle={
            <span className="flex flex-wrap gap-x-3">
              <span className="flex items-center gap-1">
                <Laptop className="w-3.5 h-3.5" /> {resumen.clases.equipo} equipos
              </span>
              <span className="flex items-center gap-1">
                <Mouse className="w-3.5 h-3.5" /> {resumen.clases.periferico} periféricos
              </span>
            </span>
          }
          onClick={() => setActiveTab('inventory')}
        />
        <Kpi
          titulo="Asignados"
          valor={datos.asignados}
          icono={UserCheck}
          detalle={`${pct(datos.asignados)} % del staff está en manos de alguien`}
          barra={{ pct: pct(datos.asignados), color: COLOR_ESTADO.Asignado }}
          onClick={() => setActiveTab('inventory')}
        />
        <Kpi
          titulo="Disponibles"
          valor={datos.disponibles}
          icono={CheckCircle2}
          detalle="Listos para entregar · ver lista"
          barra={{ pct: pct(datos.disponibles), color: COLOR_ESTADO.Disponible }}
          onClick={onAbrirDisponibles}
          destacado
        />
        <Kpi
          titulo="Piden atención"
          valor={atencion}
          icono={AlertTriangle}
          detalle={
            <span className="flex flex-wrap gap-x-3">
              <span className="flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5" /> {datos.mantenimiento} en taller
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {resumen.por_revisar} por revisar
              </span>
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" /> {resumen.traslados_abiertos} en tránsito
              </span>
            </span>
          }
          onClick={() => setActiveTab('inventory')}
        />
      </section>

      {/* Estado y empresa: el reparto del staff de un vistazo. */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <Tarjeta titulo="Estado del staff" subtitulo={`${datos.total} equipos y periféricos`} className="lg:col-span-2">
          {datos.estados.length === 0 ? (
            <SinDatos />
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datos.estados}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={2}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {datos.estados.map((e) => (
                        <Cell key={e.name} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipEstilo} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-ink tabular-nums">{datos.total}</span>
                  <span className="text-[11px] text-ink-muted">total</span>
                </div>
              </div>
              <ul className="flex-1 space-y-2 min-w-0">
                {datos.estados.map((e) => (
                  <li key={e.name} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-ink truncate">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                        {e.name}
                      </span>
                      <span className="tabular-nums text-ink font-semibold">
                        {e.value}
                        <span className="text-ink-muted font-normal text-xs ml-1">{pct(e.value)} %</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Por empresa" subtitulo="Asignados, disponibles y el resto de cada una" className="lg:col-span-3" icono={Building2}>
          {datos.porEmpresa.length === 0 ? (
            <SinDatos />
          ) : (
            <>
              <Leyenda />
              <div style={{ height: Math.max(140, datos.porEmpresa.length * 46) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datos.porEmpresa} layout="vertical" margin={{ left: 8, right: 40 }} barCategoryGap={10}>
                    <CartesianGrid horizontal={false} stroke="#EEEDF5" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6E8B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      width={110}
                      tick={{ fontSize: 12, fill: '#1D1C4A' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip {...tooltipEstilo} />
                    {TRAMOS.map((t, i) => (
                      <Bar
                        key={t.clave}
                        dataKey={t.clave}
                        name={t.nombre}
                        stackId="e"
                        fill={t.color}
                        stroke="#FFFFFF"
                        strokeWidth={1}
                        radius={i === TRAMOS.length - 1 ? [0, 4, 4, 0] : 0}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {datos.porEmpresa.map((e) => (
                  <li
                    key={e.empresa}
                    className="text-xs px-2 py-1 rounded-md bg-surface-alt text-ink-muted flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_EMPRESA[e.empresa] ?? GRIS }} />
                    {e.nombre} <strong className="text-ink tabular-nums">{e.total}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Tarjeta>
      </section>

      {/* Dónde está y qué se puede entregar. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Tarjeta titulo="Por sede" subtitulo="Cuántos hay en cada sede y cuántos están libres" icono={MapPin}>
          {datos.porSede.length === 0 ? (
            <SinDatos />
          ) : (
            <>
              <Leyenda />
              <div style={{ height: Math.max(160, datos.porSede.length * 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datos.porSede} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={8}>
                    <CartesianGrid horizontal={false} stroke="#EEEDF5" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#6E6E8B' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 12, fill: '#1D1C4A' }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipEstilo} />
                    {TRAMOS.map((t, i) => (
                      <Bar
                        key={t.clave}
                        dataKey={t.clave}
                        name={t.nombre}
                        stackId="s"
                        fill={t.color}
                        stroke="#FFFFFF"
                        strokeWidth={1}
                        radius={i === TRAMOS.length - 1 ? [0, 4, 4, 0] : 0}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Disponible para entregar"
          subtitulo="Por tipo, del staff"
          icono={PackageCheck}
          accion={{ texto: 'Ver la lista', onClick: onAbrirDisponibles }}
        >
          {datos.disponiblesTipo.length === 0 ? (
            <SinDatos texto="No hay nada disponible ahora mismo." />
          ) : (
            <div style={{ height: Math.max(160, datos.disponiblesTipo.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datos.disponiblesTipo} layout="vertical" margin={{ left: 8, right: 36 }} barCategoryGap={8}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="categoria" width={90} tick={{ fontSize: 12, fill: '#1D1C4A' }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipEstilo} />
                  <Bar
                    dataKey="n"
                    name="Disponibles"
                    fill={COLOR_ESTADO.Disponible}
                    radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fontSize: 12, fill: '#1D1C4A', fontWeight: 600 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Tarjeta>
      </section>

      {/* Salas de entrenamiento, aparte (D53), y lo último que pasó. */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <Tarjeta
          titulo="Salas de entrenamiento"
          subtitulo="Aparte del staff: no se suman a nada de arriba"
          icono={GraduationCap}
          className="lg:col-span-2"
          accion={{ texto: 'Ir a salas', onClick: () => setActiveTab('inventory') }}
        >
          <div className="flex items-end gap-6">
            <div>
              <p className="text-3xl font-bold text-ink tabular-nums">{datos.sala.total}</p>
              <p className="text-xs text-ink-muted">equipos en salas</p>
            </div>
            <dl className="grid grid-cols-3 gap-4 text-sm flex-1">
              <Mini etiqueta="Disponibles" valor={datos.sala.disponibles} color={COLOR_ESTADO.Disponible} />
              <Mini etiqueta="En taller" valor={datos.sala.mantenimiento} color={COLOR_ESTADO['En mantenimiento']} />
              <Mini etiqueta="De baja" valor={datos.sala.deBaja} color={GRIS} />
            </dl>
          </div>
          {datos.sala.categorias.length > 0 && (
            <div className="mt-4 pt-3 border-t border-line flex flex-wrap gap-1.5">
              {datos.sala.categorias.map((c) => (
                <span key={c.categoria} className="text-[11px] px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">
                  {c.categoria} <strong className="text-ink tabular-nums">{c.equipos}</strong>
                </span>
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta
          titulo="Actividad reciente"
          subtitulo="Los últimos movimientos del staff"
          icono={Clock}
          className="lg:col-span-3"
          accion={{ texto: 'Ver inventario', onClick: () => setActiveTab('inventory') }}
        >
          {resumen.recientes.length === 0 ? (
            <SinDatos texto="Todavía no hay movimientos." />
          ) : (
            <ul className="divide-y divide-line -my-1">
              {resumen.recientes.map((m) => (
                <li key={m.id} className="py-2 flex items-start gap-3">
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorMovimiento(m.tipo) }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">
                      <span className="font-semibold">{m.tipo}</span>
                      {' · '}
                      <span className="font-mono text-xs text-brand">{m.etiqueta ?? '—'}</span>{' '}
                      <span className="text-ink-muted">
                        {[m.categoria, m.marca, m.modelo].filter(Boolean).join(' ')}
                      </span>
                    </p>
                    <p className="text-xs text-ink-muted truncate">
                      {m.para ? `Para ${m.para} · ` : ''}
                      {m.quien ? `Registró ${m.quien}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-ink-muted whitespace-nowrap tabular-nums">{hace(m.fecha)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </section>

      {/* Una lectura en frase de lo que no tiene gráfico propio. */}
      {(datos.prestados > 0 || datos.reservados > 0 || datos.deBaja > 0) && (
        <p className="text-xs text-ink-muted">
          Además:{' '}
          {[
            datos.prestados > 0 && `${datos.prestados} prestados a otra empresa`,
            datos.reservados > 0 && `${datos.reservados} reservados`,
            datos.deBaja > 0 && `${datos.deBaja} dados de baja (se recuperan desde su ficha)`,
          ]
            .filter(Boolean)
            .join(' · ')}
          .
        </p>
      )}
    </div>
  );
};

const colorMovimiento = (tipo: string) =>
  tipo === 'Asignación'
    ? COLOR_ESTADO.Asignado
    : tipo === 'Devolución' || tipo === 'Reversión de baja' || tipo === 'Retorno de mantenimiento'
      ? COLOR_ESTADO.Disponible
      : tipo === 'Baja'
        ? '#F4593F'
        : tipo.startsWith('Envío')
          ? COLOR_ESTADO['En mantenimiento']
          : GRIS;

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

const Kpi: React.FC<{
  titulo: string;
  valor: number;
  icono: React.ComponentType<{ className?: string }>;
  detalle: React.ReactNode;
  barra?: { pct: number; color: string };
  onClick?: () => void;
  destacado?: boolean;
}> = ({ titulo, valor, icono: Icono, detalle, barra, onClick, destacado }) => (
  <button
    onClick={onClick}
    className={`text-left bg-surface border rounded-xl p-4 shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${
      destacado ? 'border-[#146B3A]/40' : 'border-line hover:border-brand/40'
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{titulo}</span>
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          destacado ? 'bg-[#146B3A]/10 text-[#146B3A]' : 'bg-brand-subtle text-brand'
        }`}
      >
        <Icono className="w-4 h-4" />
      </span>
    </div>
    <p className="mt-2 text-3xl font-bold text-ink tabular-nums">{valor}</p>
    {barra && (
      <div className="mt-2 h-1.5 rounded-full bg-surface-alt overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${barra.pct}%`, backgroundColor: barra.color }} />
      </div>
    )}
    <div className="mt-2 text-xs text-ink-muted">{detalle}</div>
  </button>
);

const Tarjeta: React.FC<{
  titulo: string;
  subtitulo?: string;
  icono?: React.ComponentType<{ className?: string }>;
  className?: string;
  accion?: { texto: string; onClick: () => void };
  children: React.ReactNode;
}> = ({ titulo, subtitulo, icono: Icono, className = '', accion, children }) => (
  <div className={`bg-surface border border-line rounded-xl p-5 shadow-sm ${className}`}>
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="text-sm font-bold text-ink flex items-center gap-2">
          {Icono && <Icono className="w-4 h-4 text-brand" />}
          {titulo}
        </h2>
        {subtitulo && <p className="text-xs text-ink-muted mt-0.5">{subtitulo}</p>}
      </div>
      {accion && (
        <button
          onClick={accion.onClick}
          className="text-xs font-semibold text-brand hover:text-brand-hover flex items-center gap-1 whitespace-nowrap"
        >
          {accion.texto}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
    {children}
  </div>
);

const Leyenda: React.FC = () => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs text-ink-muted">
    {TRAMOS.map((t) => (
      <li key={t.clave} className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
        {t.nombre}
      </li>
    ))}
  </ul>
);

const Mini: React.FC<{ etiqueta: string; valor: number; color: string }> = ({ etiqueta, valor, color }) => (
  <div>
    <dt className="text-xs text-ink-muted flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {etiqueta}
    </dt>
    <dd className="text-lg font-semibold text-ink tabular-nums">{valor}</dd>
  </div>
);

const SinDatos: React.FC<{ texto?: string }> = ({ texto = 'Sin datos todavía.' }) => (
  <p className="text-sm text-ink-muted py-8 text-center">{texto}</p>
);
