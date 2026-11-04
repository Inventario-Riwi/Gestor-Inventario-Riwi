import React, { useState } from 'react';
import { KeyRound, Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { api, ErrorApi } from '../lib/api';
import type { UsuarioSesion } from '../types';

/**
 * Cambio de contraseña obligatorio (0025).
 *
 * Aparece en lugar de la aplicación cuando la cuenta entró con una contraseña
 * temporal —la que eligió quien la creó—. El servidor tampoco deja hacer nada
 * más, así que esta pantalla no es el candado, es la forma de abrirlo.
 *
 * Pide la actual (la temporal) además de la nueva, y la nueva dos veces: sin
 * ver lo que se teclea, un error de dedo dejaría a la persona fuera.
 */
export const CambiarPassword: React.FC<{
  usuario: UsuarioSesion;
  onCambiada: (usuario: UsuarioSesion) => void;
  onSalir: () => void;
}> = ({ usuario, onCambiada, onSalir }) => {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problema =
    nueva.length > 0 && nueva.length < 12
      ? 'La nueva debe tener al menos 12 caracteres.'
      : repetida.length > 0 && repetida !== nueva
        ? 'Las dos contraseñas nuevas no coinciden.'
        : nueva.length > 0 && nueva === actual
          ? 'La nueva tiene que ser distinta de la temporal.'
          : null;
  const listo = actual.length > 0 && nueva.length >= 12 && nueva === repetida && !problema;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listo) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await api.cambiarPassword(actual, nueva);
      onCambiada(r.usuario);
    } catch (err) {
      if (err instanceof ErrorApi && err.estado === 429) {
        setError('Demasiados intentos. Esperar unos minutos antes de volver a probar.');
      } else {
        setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar la contraseña.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const campo = (
    id: string,
    etiqueta: string,
    valor: string,
    poner: (v: string) => void,
    autoComplete: string,
  ) => (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted mb-1">
        {etiqueta}
      </label>
      <input
        id={id}
        type="password"
        autoComplete={autoComplete}
        required
        value={valor}
        onChange={(e) => poner(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-surface text-ink focus:outline-none focus:border-brand"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-alt flex items-center justify-center p-4">
      <form
        onSubmit={enviar}
        className="bg-surface border border-line rounded-xl p-8 w-full max-w-sm space-y-5"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-brand" />
            Cambia tu contraseña
          </h1>
          <p className="text-sm text-ink-muted">
            Hola, {usuario.nombre}. Entraste con una contraseña temporal: antes de seguir, elige
            una propia que solo conozcas tú.
          </p>
        </div>

        <div className="space-y-3">
          {campo('actual', 'Contraseña temporal', actual, setActual, 'current-password')}
          {campo('nueva', 'Nueva contraseña (mínimo 12 caracteres)', nueva, setNueva, 'new-password')}
          {campo('repetida', 'Repite la nueva', repetida, setRepetida, 'new-password')}
        </div>

        {(problema || error) && (
          <p className="text-sm text-ink bg-danger/10 border border-danger/40 rounded-lg px-3 py-2 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            {error ?? problema}
          </p>
        )}

        <button
          type="submit"
          disabled={!listo || enviando}
          className="w-full px-4 py-2.5 bg-brand text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {enviando ? 'Guardando…' : 'Guardar y entrar'}
        </button>

        <button
          type="button"
          onClick={onSalir}
          className="w-full text-sm text-ink-muted hover:text-ink flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          Salir
        </button>
      </form>
    </div>
  );
};
