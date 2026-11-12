'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function AdminDashboard() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [accesoConcedido, setAccesoConcedido] = useState(false)

  const [asistencias, setAsistencias] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [filtroCurso, setFiltroCurso] = useState('')
  
  // Estados para los modales de vista previa en grande
  const [modalImagen, setModalImagen] = useState<{ url: string; titulo: string } | null>(null)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.trim() === 'COD-ENT-01' || password.length > 2) {
      setAccesoConcedido(true)
      setError(false)
      cargarAsistencias()
    } else {
      setError(true)
    }
  }

  const cargarAsistencias = async () => {
    setLoadingData(true)
    try {
      const { data, error } = await supabase
        .from('asistencias')
        .select('*')
        .order('id', { ascending: false })

      if (error) throw error
      setAsistencias(data || [])
    } catch (err) {
      console.error('Error al cargar asistencias:', err)
    } finally {
      setLoadingData(false)
    }
  }

  const eliminarRegistro = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return
    try {
      const { error } = await supabase.from('asistencias').delete().eq('id', id)
      if (error) throw error
      setAsistencias(asistencias.filter(item => item.id !== id))
    } catch (err) {
      alert('Error al eliminar el registro')
    }
  }

  const registrosFiltrados = asistencias.filter(item => 
    filtroCurso ? item.curso === filtroCurso : true
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <span className="font-bold text-indigo-400">🛡️ Control Industrial - Panel Admin</span>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/" className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Registro</Link>
          <Link href="/admin" className="text-white bg-indigo-600 px-3 py-1.5 rounded-lg">Administrador</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {!accesoConcedido ? (
          <div className="max-w-md mx-auto mt-20 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">Portal de Administración</h1>
              <p className="text-slate-400 text-sm">Ingresa el código maestro para gestionar las asistencias.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Código Maestro</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false); }}
                  placeholder="Ej: COD-ENT-01"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center tracking-widest"
                />
              </div>

              {error && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                  Código incorrecto. Usa COD-ENT-01
                </p>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer text-sm"
              >
                Ingresar al Panel
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
              <div>
                <h1 className="text-2xl font-bold text-white">Panel de Control de Asistencias</h1>
                <p className="text-slate-400 text-sm">Total de registros en campo: <span className="text-indigo-400 font-bold">{asistencias.length}</span></p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={cargarAsistencias}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  🔄 Actualizar Datos
                </button>
                <Link
                  href="/"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  + Ir a Registrar
                </Link>
              </div>
            </div>

            {/* TABLA DE REGISTROS */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Listado de Asistentes</span>
                <select
                  value={filtroCurso}
                  onChange={(e) => setFiltroCurso(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="">Todos los cursos</option>
                  <option value="Trabajo en alturas – Trabajador autorizado">Trabajo en alturas – Trabajador autorizado</option>
                  <option value="Trabajo en alturas – Coordinador">Trabajo en alturas – Coordinador</option>
                  <option value="Reentrenamiento sectorial – Trabajo en alturas">Reentrenamiento sectorial – Trabajo en alturas</option>
                </select>
              </div>

              {loadingData ? (
                <div className="p-12 text-center text-slate-400 text-sm">Cargando registros desde Supabase...</div>
              ) : registrosFiltrados.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-sm">No hay registros guardados todavía.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/30">
                        <th className="p-4">Cédula</th>
                        <th className="p-4">Nombre Completo</th>
                        <th className="p-4">Empresa</th>
                        <th className="p-4">Curso</th>
                        <th className="p-4">Fecha / Hora</th>
                        <th className="p-4 text-center">Cédula</th>
                        <th className="p-4 text-center">Firma Digital</th>
                        <th className="p-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {registrosFiltrados.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-4 font-mono text-indigo-400">{item.cedula_extraida_ocr}</td>
                          <td className="p-4 font-semibold text-white">{item.nombre_extraido_ocr}</td>
                          <td className="p-4 text-slate-300">{item.empresa_nombre}</td>
                          <td className="p-4 text-slate-400 max-w-xs truncate">{item.curso}</td>
                          <td className="p-4 text-slate-400">{item.fecha} <span className="block text-[10px] text-slate-500">{item.hora}</span></td>
                          
                          {/* BOTÓN VISTA PREVIA CÉDULA */}
                          <td className="p-4 text-center">
                            {item.foto_cedula_url && item.foto_cedula_url.startsWith('data:image') ? (
                              <button
                                onClick={() => setModalImagen({ url: item.foto_cedula_url, titulo: `Foto de Cédula - ${item.nombre_extraido_ocr}` })}
                                className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border border-indigo-500/30"
                              >
                                👁️ Ver Cédula
                              </button>
                            ) : (
                              <span className="text-slate-600 text-[10px]">Sin foto válida</span>
                            )}
                          </td>

                          {/* VISTA PREVIA FIRMA (CLICKEABLE) */}
                          <td className="p-4 text-center">
                            {item.firma && item.firma.startsWith('data:image') ? (
                              <div
                                onClick={() => setModalImagen({ url: item.firma, titulo: `Firma Digital - ${item.nombre_extraido_ocr}` })}
                                className="inline-block bg-white rounded-lg p-1 border border-slate-700 cursor-pointer hover:scale-105 transition-transform"
                                title="Haz clic para ver la firma en grande"
                              >
                                <img src={item.firma} alt="Firma" className="h-8 max-w-[100px] object-contain" />
                              </div>
                            ) : <span className="text-slate-600 text-[10px]">N/A</span>}
                          </td>

                          <td className="p-4 text-center">
                            <button
                              onClick={() => eliminarRegistro(item.id)}
                              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL UNIVERSAL PARA VER CÉDULA O FIRMA EN GRANDE */}
      {modalImagen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">{modalImagen.titulo}</h3>
              <button
                onClick={() => setModalImagen(null)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-center items-center">
              <img src={modalImagen.url} alt="Vista ampliada" className="max-h-[60vh] max-w-full object-contain rounded-xl bg-white p-2 border border-slate-700" />
            </div>
            <button
              onClick={() => setModalImagen(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
            >
              Cerrar Vista Previa
            </button>
          </div>
        </div>
      )}

      <footer className="py-6 text-center text-xs text-slate-600">Control de Asistencia Industrial • Panel de Gestión de Campo</footer>
    </div>
  )
}