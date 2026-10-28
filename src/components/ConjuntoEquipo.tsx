import React, { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import type { EquipoConMotivos } from '../types';
import { api, type EquipoEnConjunto } from '../lib/api';

/**
 * El conjunto de un equipo (0024): si es una parte, a qué computador
 * pertenece; si es un computador, qué partes tiene. Cada una es un enlace que
 * abre su propia ficha.
 *
 * Informativo: el texto lo dice, porque trasladar o dar de baja el computador
 * no mueve sus partes, y quien lo lea podría suponer que sí.
 *
 * No pinta nada si el equipo no pertenece a nada ni tiene partes: la inmensa
 * mayoría de los portátiles de staff.
 */

const nombre = (e: EquipoEnConjunto) =>
  [e.categoria, e.etiqueta ?? e.nombre_equipo ?? 'sin etiqueta'].join(' ');

const Enlace: React.FC<{ equipo: EquipoEnConjunto; onAbrir: (id: string) => void }> = ({
  equipo,
  onAbrir,
}) => (
  <button
    type="button"
    onClick={() => onAbrir(equipo.id)}
    className="text-brand hover:underline"
    title={[equipo.marca, equipo.modelo].filter(Boolean).join(' ') || undefined}
  >
    {nombre(equipo)}
  </button>
);

export const ConjuntoEquipo: React.FC<{
  equipo: EquipoConMotivos;
  onAbrir: (id: string) => void;
}> = ({ equipo, onAbrir }) => {
  const [datos, setDatos] = useState<{
    principal: EquipoEnConjunto | null;
    partes: EquipoEnConjunto[];
  } | null>(null);

  useEffect(() => {
    let vigente = true;
    api.conjunto(equipo.id).then(
      (r) => vigente && setDatos(r),
      () => vigente && setDatos(null),
    );
    return () => {
      vigente = false;
    };
  }, [equipo.id, equipo.updated_at]);

  if (!datos || (!datos.principal && datos.partes.length === 0)) return null;

  return (
    <section className="text-sm bg-surface-alt border border-line rounded-lg px-3 py-2 space-y-1">
      <p className="text-xs font-semibold text-ink-muted uppercase flex items-center gap-1.5">
        <Link2 className="w-3.5 h-3.5" />
        Conjunto
      </p>
      {datos.principal && (
        <p className="text-ink">
          Pertenece a: <Enlace equipo={datos.principal} onAbrir={onAbrir} />
        </p>
      )}
      {datos.partes.length > 0 && (
        <p className="text-ink">
          Partes:{' '}
          {datos.partes.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && ' · '}
              <Enlace equipo={p} onAbrir={onAbrir} />
            </React.Fragment>
          ))}
        </p>
      )}
      <p className="text-[11px] text-ink-muted">
        Solo informativo: trasladar o dar de baja uno no mueve a los otros.
      </p>
    </section>
  );
};
