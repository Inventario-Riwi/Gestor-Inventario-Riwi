import React, { useEffect, useState } from 'react';
import type {
  AccesorioNuevo,
  CategoriaEquipo,
  EmpleadoConConteo,
  Empresa,
  NuevoEquipo,
  Sede,
} from '../types';
import { TIPOS_LICENCIA } from '../types';
import {
  Headphones,
  Laptop,
  Loader2,
  Monitor,
  Plus,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

import { api, ErrorApi } from '../lib/api';
import { etiquetaEmpresa } from '../lib/empresas';
import { etiquetaDisco, TIPOS, type Tipo } from '../lib/tipos-equipo';
import { SIN_GUARDAR, useConfirmacion } from './Confirmacion';
import { sinMarcador } from '../../db/marcadores';

interface NewDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Para que quien esté mirando un listado vea aparecer lo que acaba de crear. */
  onCreado: () => void;
}

/** El tope que acepta la API. Ver `porPagina` en `server/rutas/equipos.ts`. */
const TOPE = 200;

const ICONO: Record<Tipo, React.ElementType> = {
  portatil: Laptop,
  mesa: Monitor,
  celular: Smartphone,
  tablet: Tablet,
  periferico: Headphones,
};

/** Lo que se puede elegir en «¿Qué es?» de un periférico. */
const PERIFERICOS: CategoriaEquipo[] = ['Monitor', 'Teclado', 'Mouse', 'Diadema', 'Otro'];

/** Las empresas que pueden ser dueñas. «Sin clasificar» no se elige al dar de alta. */
const DUENAS: Empresa[] = ['RIWI', 'BBL Labs', 'Emerald Fire'];

type Texto =
  | 'etiqueta'
  | 'nombre_equipo'
  | 'marca'
  | 'modelo'
  | 'serial'
  | 'serial_cargador'
  | 'imei'
  | 'procesador'
  | 'ram'
  | 'disco'
  | 'tamano_pantalla'
  | 'sistema_operativo'
  | 'licencia_tipo'
  | 'costo'
  | 'notas';

const VACIO: Record<Texto, string> = {
  etiqueta: '',
  nombre_equipo: '',
  marca: '',
  modelo: '',
  serial: '',
  serial_cargador: '',
  imei: '',
  procesador: '',
  ram: '',
  disco: '',
  tamano_pantalla: '',
  sistema_operativo: '',
  licencia_tipo: '',
  costo: '',
  notas: '',
};

type Accesorio = Required<{ [K in keyof Omit<AccesorioNuevo, 'categoria'>]: string }> & {
  categoria: AccesorioNuevo['categoria'];
};
const ACCESORIOS_VACIOS = (): Accesorio[] =>
  (['Monitor', 'Teclado', 'Mouse'] as const).map((categoria) => ({
    categoria,
    etiqueta: '',
    marca: '',
    modelo: '',
    serial: '',
  }));

const algo = (a: Accesorio) => !!(a.etiqueta.trim() || a.marca.trim() || a.modelo.trim() || a.serial.trim());
const nulo = (v: string) => (v.trim() === '' ? null : v.trim());

/**
 * Alta de un equipo, con un formulario por tipo.
 *
 * Un celular no tiene procesador ni licencia de Windows, y un mouse no tiene
 * nada técnico que contar: pedirle a todo los mismos dieciséis campos hacía
 * que nadie supiera cuáles importaban. Primero se elige qué es, y aparecen
 * solo sus campos. Qué campos lleva cada tipo está en `lib/tipos-equipo.ts`,
 * que es también lo que usa la edición: los dos formularios no pueden
 * separarse.
 *
 * Lo que es común a todos —etiqueta, empresa, sede, responsable, costo y
 * notas— va siempre.
 */
export const NewDeviceModal: React.FC<NewDeviceModalProps> = ({ isOpen, onClose, onCreado }) => {
  const [tipo, setTipo] = useState<Tipo>('portatil');
  const [periferico, setPeriferico] = useState<CategoriaEquipo>('Monitor');
  const [datos, setDatos] = useState<Record<Texto, string>>(VACIO);
  const [empresa, setEmpresa] = useState<Empresa | ''>('');
  const [sedeId, setSedeId] = useState('');
  const [empleadoId, setEmpleadoId] = useState('');
  const [accesorios, setAccesorios] = useState<Accesorio[]>(ACCESORIOS_VACIOS);
  /** Sala de entrenamiento: solo para un equipo de mesa. */
  const [enSala, setEnSala] = useState(false);
  const [sala, setSala] = useState('');
  /** 0027. El mouse viene, pero sin serial: no es un equipo propio. */
  const [mouseSinSerial, setMouseSinSerial] = useState(false);
  /** Las salas que ya existen, para sugerirlas y no escribir «P3 OCCI» de dos formas. */
  const [salasConocidas, setSalasConocidas] = useState<string[]>([]);

  const [sedes, setSedes] = useState<Sede[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoConConteo[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ventana, preguntar] = useConfirmacion();

  // Los desplegables se piden al abrir, no al montar: el modal vive montado
  // todo el rato y pedirlos al arrancar sería una consulta que casi nadie usa.
  useEffect(() => {
    if (!isOpen) return;
    let vigente = true;
    Promise.all([api.sedes(), api.empleados({ porPagina: TOPE, activo: true })]).then(
      ([s, e]) => {
        if (!vigente) return;
        setSedes(s.sedes);
        setEmpleados(e.filas);
      },
      () => {
        // Si fallan, los desplegables quedan vacíos y el alta sigue siendo
        // posible sin sede ni responsable: los dos campos son opcionales.
        if (vigente) setError('No se pudieron cargar sedes y colaboradores.');
      },
    );
    // Las sugerencias de sala no bloquean nada: si fallan, se escribe a mano.
    api.salas().then(
      (r) =>
        vigente &&
        setSalasConocidas([...new Set(r.salas.map((x) => x.sala).filter((x): x is string => !!x))]),
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const def = TIPOS[tipo];
  const categoria: CategoriaEquipo = def.categoria ?? periferico;
  const lleva = (campo: Texto) => def.campos.includes(campo as never);

  const poner = (campo: Texto, valor: string) => setDatos((d) => ({ ...d, [campo]: valor }));
  const ponerAccesorio = (i: number, campo: keyof Accesorio, valor: string) =>
    setAccesorios((xs) => xs.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));

  const limpiar = () => {
    setDatos(VACIO);
    setEmpresa('');
    setSedeId('');
    setEmpleadoId('');
    setAccesorios(ACCESORIOS_VACIOS());
    setEnSala(false);
    setSala('');
    setMouseSinSerial(false);
    setError(null);
  };

  /** Algo escrito o elegido que se perdería al cerrar. El tipo no cuenta. */
  const sucio =
    Object.values(datos).some((v) => v.trim() !== '') ||
    !!empresa ||
    !!sedeId ||
    !!empleadoId ||
    (tipo === 'mesa' && (accesorios.some(algo) || enSala || mouseSinSerial));

  /** La X y Cancelar: con algo escrito, pregunta antes de perderlo. */
  const cerrar = async () => {
    if (guardando) return;
    if (sucio) {
      const r = await preguntar(SIN_GUARDAR);
      if (r === 'cancelar') return;
      if (r === 'confirmar') return void guardar();
    }
    limpiar();
    onClose();
  };

  /** Lo que impide guardar, dicho antes de mandar nada. `null` si está listo. */
  const problema = (): string | null => {
    if (!empresa) return 'Elige de qué empresa es.';
    // verificar-datos.sql §B: todo activo se tiene que poder señalar.
    // «N/A» no identifica nada: cuenta como sin serial (marcadores.ts).
    if (!sinMarcador(datos.serial) && !datos.etiqueta.trim())
      return 'Hace falta el serial o la etiqueta: sin ninguno de los dos no hay forma de encontrarlo.';
    if (lleva('imei') && datos.imei.trim() && !/^\d{15}$/.test(datos.imei.replace(/[\s-]/g, '')))
      return 'El IMEI son 15 dígitos.';
    if (tipo === 'mesa') {
      if (enSala && !sala.trim()) return 'Escribe el nombre de la sala de entrenamiento.';
      const sinId = accesorios.find(
        (a) => algo(a) && !sinMarcador(a.serial) && !a.etiqueta.trim() && !(a.categoria === 'Mouse' && mouseSinSerial),
      );
      if (sinId) return `${sinId.categoria}: hace falta su serial o su etiqueta.`;
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void guardar();
  };

  const guardar = async () => {
    if (guardando) return;
    const p = problema();
    if (p) return setError(p);
    setGuardando(true);
    setError(null);

    // Solo los campos del tipo elegido. Si alguien escribió un procesador y
    // luego cambió a celular, ese procesador no viaja: no se ve, no se manda.
    const campos: Partial<NuevoEquipo> = {};
    for (const c of def.campos) (campos as Record<string, unknown>)[c] = nulo(datos[c]);
    if (campos.imei) campos.imei = campos.imei.replace(/[\s-]/g, '');

    try {
      await api.crearEquipo({
        ...campos,
        categoria,
        etiqueta: nulo(datos.etiqueta),
        serial: nulo(datos.serial),
        empresa: empresa as Empresa,
        // El invariante del §2, y un CHECK en la BD:
        // 'Asignado' si y solo si hay responsable.
        estado: empleadoId ? 'Asignado' : 'Disponible',
        sede_id: sedeId || null,
        empleado_id: empleadoId || null,
        costo: nulo(datos.costo),
        notas: nulo(datos.notas),
        ...(tipo === 'mesa'
          ? {
              mouse_sin_serial: mouseSinSerial,
              ...(enSala ? { centro_entrenamiento: true, ubicacion_detalle: sala.trim() } : {}),
            }
          : {}),
        accesorios:
          tipo === 'mesa'
            ? accesorios
                .filter((a) => algo(a) && !(a.categoria === 'Mouse' && mouseSinSerial))
                .map((a) => ({
                categoria: a.categoria,
                etiqueta: nulo(a.etiqueta),
                marca: nulo(a.marca),
                modelo: nulo(a.modelo),
                serial: nulo(a.serial),
              }))
            : undefined,
      });

      // Lo que NO se manda, y por qué: la condición (§D la prohíbe en equipos
      // de cómputo y el alta no la pregunta) y la fecha de compra (hoy es
      // cuando se registra, no cuando se compró; inventarla es la regla 3).

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      limpiar();
      onCreado();
      onClose();
    } catch (err) {
      // Los choques de serial, etiqueta e IMEI llegan ya en español desde
      // `server/errores-postgres.ts`. Se muestran tal cual.
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el equipo.');
    } finally {
      setGuardando(false);
    }
  };

  const claseCampo =
    'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-600';

  const texto = (campo: Texto, etiqueta: string, opciones: { ayuda?: string; mono?: boolean } = {}) => (
    <div>
      <label htmlFor={`alta-${campo}`} className="block text-slate-700 font-semibold mb-1">
        {etiqueta}
      </label>
      <input
        id={`alta-${campo}`}
        type="text"
        value={datos[campo]}
        onChange={(e) => poner(campo, e.target.value)}
        placeholder={opciones.ayuda}
        className={`${claseCampo} ${opciones.mono ? 'font-mono' : ''}`}
      />
    </div>
  );

  /** Los campos técnicos del tipo, en el orden en que se declaran. */
  const ETIQUETAS: Partial<Record<Texto, [string, { ayuda?: string; mono?: boolean }?]>> = {
    nombre_equipo: ['Nombre del equipo'],
    marca: ['Marca'],
    modelo: ['Modelo'],
    imei: ['IMEI', { ayuda: '15 dígitos', mono: true }],
    procesador: ['Procesador'],
    ram: ['RAM', { ayuda: 'p. ej. 16 GB' }],
    disco: [etiquetaDisco(tipo), { ayuda: 'p. ej. 512 GB' }],
    tamano_pantalla: ['Pantalla', { ayuda: 'p. ej. 14"' }],
    sistema_operativo: ['Sistema operativo'],
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      {ventana}
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-xl relative animate-aparecer text-slate-900">
        <button
          onClick={() => void cerrar()}
          aria-label="Cerrar"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-xl border border-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Registrar nuevo equipo
          </h2>
          <p className="text-xs text-slate-500">Elige qué es: el formulario muestra solo lo que le corresponde.</p>
        </div>

        <div role="radiogroup" aria-label="Tipo de equipo" className="grid grid-cols-5 gap-2">
          {(Object.keys(TIPOS) as Tipo[]).map((t) => {
            const Icono = ICONO[t];
            const activo = t === tipo;
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => {
                  setTipo(t);
                  setError(null);
                }}
                className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors ${
                  activo
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icono className="w-5 h-5" />
                {TIPOS[t].nombre}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Identidad: lo que permite encontrarlo. */}
          <div className="grid grid-cols-3 gap-3">
            {tipo === 'periferico' && (
              <div>
                <label htmlFor="alta-que-es" className="block text-slate-700 font-semibold mb-1">
                  ¿Qué es?
                </label>
                <select
                  id="alta-que-es"
                  value={periferico}
                  onChange={(e) => setPeriferico(e.target.value as CategoriaEquipo)}
                  className={claseCampo}
                >
                  {PERIFERICOS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {texto('etiqueta', 'Etiqueta', { mono: true })}
            {texto('serial', 'Serial', { mono: true })}
          </div>

          {/* Lo propio del tipo. */}
          <div className="grid grid-cols-3 gap-3">
            {def.campos
              .filter((c) => c !== 'licencia_tipo' && ETIQUETAS[c as Texto])
              .map((c) => {
                const [et, op] = ETIQUETAS[c as Texto]!;
                return <React.Fragment key={c}>{texto(c as Texto, et, op)}</React.Fragment>;
              })}
            {lleva('licencia_tipo') && (
              <div>
                <label htmlFor="alta-licencia" className="block text-slate-700 font-semibold mb-1">
                  Licencia
                </label>
                <select
                  id="alta-licencia"
                  value={datos.licencia_tipo}
                  onChange={(e) => poner('licencia_tipo', e.target.value)}
                  className={claseCampo}
                >
                  <option value="">—</option>
                  {TIPOS_LICENCIA.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {tipo === 'mesa' && (
            <fieldset className="border border-slate-200 rounded-lg p-3 space-y-2">
              <legend className="px-1 text-slate-700 font-semibold">Viene con</legend>
              <p className="text-[11px] text-slate-500">
                Cada uno queda como equipo propio, ligado a este equipo de mesa y con su mismo
                responsable y sede. Deja vacío lo que no tenga.
              </p>
              {accesorios.map((a, i) => {
                const sinSerial = a.categoria === 'Mouse' && mouseSinSerial;
                return (
                  <div key={a.categoria} className="space-y-1">
                    <div className="grid grid-cols-[5rem_1fr_1fr_1fr_1fr] gap-2 items-center">
                      <span className="font-semibold text-slate-700">{a.categoria}</span>
                      {(['etiqueta', 'serial', 'marca', 'modelo'] as const).map((c) => (
                        <input
                          key={c}
                          aria-label={`${a.categoria}: ${c}`}
                          value={sinSerial ? '' : a[c]}
                          disabled={sinSerial}
                          onChange={(e) => ponerAccesorio(i, c, e.target.value)}
                          placeholder={sinSerial ? '—' : c[0].toUpperCase() + c.slice(1)}
                          className={`${claseCampo} disabled:bg-slate-50 ${c === 'etiqueta' || c === 'serial' ? 'font-mono' : ''}`}
                        />
                      ))}
                    </div>
                    {a.categoria === 'Mouse' && (
                      <label className="flex items-center gap-2 pl-[5.5rem] text-slate-600">
                        <input
                          type="checkbox"
                          checked={mouseSinSerial}
                          onChange={(e) => setMouseSinSerial(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-300"
                        />
                        Lo trae, pero sin serial
                      </label>
                    )}
                  </div>
                );
              })}
            </fieldset>
          )}

          {tipo === 'mesa' && (
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 text-slate-700 font-semibold">
                <input
                  type="checkbox"
                  checked={enSala}
                  onChange={(e) => setEnSala(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300"
                />
                Va en una sala de entrenamiento
              </label>
              {enSala && (
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div>
                    <label htmlFor="alta-sala" className="block text-slate-700 font-semibold mb-1">
                      Sala *
                    </label>
                    <input
                      id="alta-sala"
                      list="alta-salas-conocidas"
                      value={sala}
                      onChange={(e) => setSala(e.target.value)}
                      placeholder="p. ej. P3 OCCI"
                      className={claseCampo}
                    />
                    <datalist id="alta-salas-conocidas">
                      {salasConocidas.map((x) => (
                        <option key={x} value={x} />
                      ))}
                    </datalist>
                  </div>
                  <p className="col-span-2 text-[11px] text-slate-500">
                    El computador y lo que viene con él quedan en esa sala. La sede se elige abajo.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Común a todos: de quién es, dónde está y con quién. */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200">
            <div>
              <label htmlFor="alta-empresa" className="block text-slate-700 font-semibold mb-1">
                Empresa *
              </label>
              <select
                id="alta-empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value as Empresa)}
                className={claseCampo}
              >
                <option value="">Elige…</option>
                {DUENAS.map((em) => (
                  <option key={em} value={em}>
                    {etiquetaEmpresa(em)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="alta-sede" className="block text-slate-700 font-semibold mb-1">
                Sede
              </label>
              <select
                id="alta-sede"
                value={sedeId}
                onChange={(e) => setSedeId(e.target.value)}
                className={claseCampo}
              >
                <option value="">Sin sede</option>
                {/* 0022: un equipo nuevo no entra a una sede retirada. */}
                {sedes
                  .filter((s) => s.activa)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="alta-responsable" className="block text-slate-700 font-semibold mb-1">
                Asignar a (opcional)
              </label>
              <select
                id="alta-responsable"
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                className={claseCampo}
              >
                <option value="">Sin asignar</option>
                {empleados.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.nombre}
                    {em.cargo ? ` (${em.cargo})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {texto('costo', 'Costo (COP)', { ayuda: 'p. ej. 3500000' })}
            <div className="col-span-2">
              <label htmlFor="alta-notas" className="block text-slate-700 font-semibold mb-1">
                Notas
              </label>
              <textarea
                id="alta-notas"
                value={datos.notas}
                onChange={(e) => poner('notas', e.target.value)}
                rows={1}
                maxLength={2000}
                placeholder="Lo que haga falta recordar de este equipo"
                className={claseCampo}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-ink bg-danger/15 border border-danger rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => void cerrar()}
              disabled={guardando}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{guardando ? 'Guardando…' : `Guardar ${TIPOS[tipo].nombre.toLowerCase()}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

