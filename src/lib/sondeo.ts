/**
 * Refresco periódico de una pantalla: cada pocos segundos vuelve a pedir sus
 * datos, para que lo que hace otra persona se vea sin recargar.
 *
 * Se eligió preguntar en vez de que el servidor avise: es más simple y no
 * añade nada al servidor. El precio es un retraso de hasta un intervalo.
 *
 * Tres cosas que no hace, a propósito:
 *
 * - **No pregunta con la pestaña oculta.** Diez pestañas olvidadas no deben
 *   costar diez consultas cada diez segundos. Al volver, refresca enseguida.
 * - **No encadena peticiones.** Si una tarda más que el intervalo, el tic
 *   siguiente se salta en vez de apilar otra encima.
 * - **No reinicia el temporizador** cuando cambia la función: la guarda en un
 *   ref, así que un filtro nuevo no deja la pantalla diez segundos sin tic.
 */

import { useEffect, useRef } from 'react';

export const INTERVALO_SONDEO_MS = 10_000;

export function useSondeo(
  refrescar: () => Promise<unknown> | void,
  intervaloMs: number = INTERVALO_SONDEO_MS,
): void {
  const actual = useRef(refrescar);
  actual.current = refrescar;

  useEffect(() => {
    let enCurso = false;

    const tic = async () => {
      if (document.visibilityState !== 'visible' || enCurso) return;
      enCurso = true;
      try {
        await actual.current();
      } catch {
        // Un tic fallido no es un error que enseñar: el siguiente lo reintenta.
      } finally {
        enCurso = false;
      }
    };

    const id = setInterval(() => void tic(), intervaloMs);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void tic();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [intervaloMs]);
}
