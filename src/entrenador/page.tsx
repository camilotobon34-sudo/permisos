'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function EntrenadorLogin() {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Código maestro de ejemplo
    if (codigo.trim() === 'COD-ENT-01' || codigo.length > 3) {
      // Si el código es correcto, lo manda de regreso al registro pero habilitado
      localStorage.removeItem('dispositivo_registrado');
      window.location.href = '/';
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#10172a] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        
        <div className="text-center">
          <span className="bg-indigo-600/20 text-indigo-400 text-xs px-3 py-1 rounded-full font-medium">MODO SUPERVISOR</span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-3 mb-1">Acceso Entrenador</h1>
          <p className="text-xs text-slate-400">Ingresa el código maestro para desbloquear o reiniciar el dispositivo.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
              Código Maestro
            </label>
            <input
              type="password"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                setError(false);
              }}
              placeholder="••••••••"
              className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm text-center tracking-widest"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-lg text-center">
              Código incorrecto. Inténtalo de nuevo.
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/30 text-sm"
          >
            Desbloquear Dispositivo ➔
          </button>
        </form>

        <div className="text-center border-t border-slate-800 pt-4">
          <Link href="/" className="text-xs text-slate-400 hover:text-white underline">
            ← Volver al formulario de registro
          </Link>
        </div>

      </div>
    </div>
  );
}