import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

/**
 * La ventana de «¿estás seguro?» de toda la aplicación.
 *
 * Una sola, para que pedir confirmación se vea y se comporte igual en todas
 * partes: título, qué va a pasar, y los botones. En rojo cuando lo que se
 * confirma no se deshace.
 *
 * Se usa con `useConfirmacion()`, que devuelve la ventana para pintarla y una
 * función que la abre y espera la respuesta:
 *
 * ```tsx
 * const [ventana, preguntar] = useConfirmacion();
 * if ((await preguntar({ titulo, mensaje, confirmar: 'Desactivar' })) !== 'confirmar') return;
 * ```
 *
 * Tres respuestas y no dos porque «cambios sin guardar» las necesita:
 * Guardar (`confirmar`), Descartar (`alterno`) y Seguir editando (`cancelar`).
 *
 * **Clic fuera no cierra.** Así se cerraba sola la ficha del equipo: el clic
 * que devolvía el foco a la ventana caía en el fondo. Aquí solo responden los
 * botones y Esc, que equivale a cancelar.
 */

export interface PedidoConfirmacion {
  titulo: string;
  mensaje: React.ReactNode;
  /** Texto del botón principal. */
  confirmar: string;
  /** Rojo y con aviso: lo que se confirma no se deshace o pierde algo. */
  peligro?: boolean;
  /** Un tercer botón, entre cancelar y confirmar (p. ej. «Descartar»). */
  alterno?: string;
  /** Texto del botón de no hacer nada. «Cancelar» si no se dice. */
  cancelar?: string;
}

export type RespuestaConfirmacion = 'confirmar' | 'alterno' | 'cancelar';

export function useConfirmacion(): [
  React.ReactNode,
  (pedido: PedidoConfirmacion) => Promise<RespuestaConfirmacion>,
] {
  const [pedido, setPedido] = useState<PedidoConfirmacion | null>(null);
  const resolver = useRef<((r: RespuestaConfirmacion) => void) | null>(null);

  const preguntar = useCallback((p: PedidoConfirmacion) => {
    // Si había una abierta, se da por cancelada: nadie se queda esperando.
    resolver.current?.('cancelar');
    setPedido(p);
    return new Promise<RespuestaConfirmacion>((res) => {
      resolver.current = res;
    });
  }, []);

  const responder = useCallback((r: RespuestaConfirmacion) => {
    resolver.current?.(r);
    resolver.current = null;
    setPedido(null);
  }, []);

  const ventana = pedido ? <VentanaConfirmacion pedido={pedido} onResponder={responder} /> : null;
  return [ventana, preguntar];
}

/**
 * Lo que un formulario metido dentro de otra ventana le deja ver a quien la
 * cierra: si tiene algo escrito, y cómo guardarlo. `guardar` devuelve si
 * guardó: con un error en pantalla, la ventana no se cierra.
 */
export interface ControlSinGuardar {
  sucio: () => boolean;
  guardar: () => Promise<boolean>;
}

/** El pedido de siempre para cerrar algo con cambios escritos. */
export const SIN_GUARDAR: PedidoConfirmacion = {
  titulo: 'Tienes cambios sin guardar',
  mensaje: 'Si sales ahora, lo que escribiste se pierde.',
  confirmar: 'Guardar',
  alterno: 'Descartar',
  cancelar: 'Seguir editando',
};

const VentanaConfirmacion: React.FC<{
  pedido: PedidoConfirmacion;
  onResponder: (r: RespuestaConfirmacion) => void;
}> = ({ pedido, onResponder }) => {
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Con peligro, el foco va a Cancelar: un Enter distraído no debe confirmar
    // algo que no se deshace.
    (pedido.peligro ? cancelarRef : confirmarRef).current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onResponder('cancelar');
      }
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [pedido, onResponder]);

  const Icono = pedido.peligro ? AlertTriangle : HelpCircle;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmacion-titulo"
        aria-describedby="confirmacion-mensaje"
        className="bg-surface border border-line rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl animate-aparecer"
      >
        <div className="flex items-start gap-3">
          <span
            className={`shrink-0 rounded-full p-2 ${
              pedido.peligro ? 'bg-danger/10 text-danger' : 'bg-brand/10 text-brand'
            }`}
          >
            <Icono className="w-5 h-5" />
          </span>
          <div className="space-y-1.5">
            <h2 id="confirmacion-titulo" className="text-base font-semibold text-ink">
              {pedido.titulo}
            </h2>
            <div id="confirmacion-mensaje" className="text-sm text-ink-muted">
              {pedido.mensaje}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            ref={cancelarRef}
            type="button"
            onClick={() => onResponder('cancelar')}
            className="px-3 py-1.5 text-sm border border-line rounded-lg text-ink-muted hover:bg-surface-alt"
          >
            {pedido.cancelar ?? 'Cancelar'}
          </button>
          {pedido.alterno && (
            <button
              type="button"
              onClick={() => onResponder('alterno')}
              className="px-3 py-1.5 text-sm border border-danger/50 rounded-lg text-danger hover:bg-danger/10"
            >
              {pedido.alterno}
            </button>
          )}
          <button
            ref={confirmarRef}
            type="button"
            onClick={() => onResponder('confirmar')}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium text-white ${
              pedido.peligro ? 'bg-danger hover:opacity-90' : 'bg-brand hover:bg-brand-hover'
            }`}
          >
            {pedido.confirmar}
          </button>
        </div>
      </div>
    </div>
  );
};
