'use client';

import { useState } from 'react';

export default function Home() {
  const [cedula, setCedula] = useState('');
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [curso, setCurso] = useState('Trabajo en alturas - Trabajador autorizado');
  const [fotoCargada, setFotoCargada] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFotoCargada(true);
      setCedula('4036943054');
      setNombre('Camilo Tobón');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedula || !nombre) {
      setMensaje('Por favor completa los campos obligatorios.');
      return;
    }

    setCargando(true);
    setMensaje('');

    try {
      setTimeout(() => {
        setMensaje('¡Registro guardado con éxito en el sistema!');
        setCargando(false);
      }, 1000);
    } catch (error) {
      setMensaje('Error al guardar el registro.');
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center p-4 md:p-8">
      <div className="max-w-xl w-full bg-[#10172a] border border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
            Registro Digital en Campo
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            Sube la foto de tu cédula e ingresa tus datos para validar el registro
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold tracking-wider text-slate-300 uppercase mb-3">
              1. FOTO DE LA CÉDULA (FRONTAL) *
            </label>
            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center bg-[#0b101f] transition relative cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFotoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              {!fotoCargada ? (
                <div className="space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    📷
                  </div>
                  <p className="text-xs text-slate-300 font-medium">Haz clic aquí o arrastra la foto de tu cédula</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mx-auto w-20 h-28 bg-slate-800 rounded-lg overflow-hidden border border-slate-600 flex items-center justify-center">
                    <span className="text-xs text-slate-400">Cédula OK</span>
                  </div>
                  <p className="text-xs text-emerald-400 font-medium">✓ Foto de cédula cargada correctamente</p>
                  <span className="text-xs text-indigo-400 underline cursor-pointer">Cambiar Foto</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-300 uppercase mb-2">
                NÚMERO DE CÉDULA *
              </label>
              <input
                type="text"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="Ej. 4036943054"
                className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-300 uppercase mb-2">
                NOMBRE COMPLETO *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Camilo Tobón"
                className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-300 uppercase mb-2">
                EMPRESA / CONTRATISTA
              </label>
              <input
                type="text"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Ej. Industrial S.A.S."
                className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-300 uppercase mb-2">
                CURSO *
              </label>
              <select
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 text-sm"
              >
                <option value="Trabajo en alturas - Trabajador autorizado">Trabajo en alturas - Trabajador autorizado</option>
                <option value="Coordinador de alturas">Coordinador de alturas</option>
                <option value="Reentrenamiento alturas">Reentrenamiento alturas</option>
              </select>
            </div>
          </div>

          {mensaje && (
            <p className="text-xs text-center text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 p-3 rounded-lg">
              {mensaje}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3.5 rounded-xl transition duration-200 shadow-lg shadow-indigo-600/30 disabled:opacity-50 text-sm"
          >
            {cargando ? 'Guardando registro...' : 'Completar Registro'}
          </button>
        </form>

      </div>
    </div>
  );
}