'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// Inicializa Supabase con tus variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function AdminPage() {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)

  // 1. Cargar registros ordenados (los más recientes primero)
  const fetchRegistros = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('asistencias') // Cambia 'asistencias' si tu tabla se llama diferente (ej: 'estudiantes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRegistros(data || [])
    } catch (err) {
      console.error('Error al cargar datos:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRegistros()

    // Suscripción en tiempo real
    const channel = supabase
      .channel('realtime-registros')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'asistencias' },
        () => { fetchRegistros() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // 2. FUNCIÓN PARA ELIMINAR DE VERDAD EN SUPABASE
  const handleEliminar = async (idRegistro) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return

    try {
      const { error } = await supabase
        .from('asistencias') // Asegúrate de que coincida con el nombre de tu tabla
        .delete()
        .eq('id', idRegistro) // Borra por el ID único del registro

      if (error) throw error

      // Actualiza la pantalla de inmediato quitando el elemento borrado
      setRegistros(prev => prev.filter(item => item.id !== idRegistro))
    } catch (err) {
      alert('Error al eliminar en Supabase: ' + err.message)
    }
  }

  // 3. Formato de hora colombiana
  const formatearHoraColombia = (fechaIso) => {
    if (!fechaIso) return 'Reciente'
    const fecha = new Date(fechaIso)
    return fecha.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-2">Panel de Control de Asistencias</h1>
        <p className="text-slate-400 mb-8">Total de registros en campo: {registros.length}</p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4">Listado de Asistentes</h2>

          {loading ? (
            <p className="text-slate-500 py-6 text-center">Cargando registros...</p>
          ) : registros.length === 0 ? (
            <p className="text-slate-500 py-6 text-center">No hay registros guardados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-sm">
                    <th className="py-3 px-4">Cédula</th>
                    <th className="py-3 px-4">Nombre Completo</th>
                    <th className="py-3 px-4">Fecha / Hora (Col)</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {registros.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 text-blue-400 font-medium">{reg.cedula || reg.documento}</td>
                      <td className="py-3 px-4 font-semibold">{reg.nombre_completo || reg.nombre}</td>
                      <td className="py-3 px-4 text-slate-300">
                        {reg.created_at ? `${reg.created_at.split('T')[0]} - ${formatearHoraColombia(reg.created_at)}` : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {/* Botón de eliminar conectado a Supabase */}
                        <button
                          onClick={() => handleEliminar(reg.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition"
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
    </main>
  )
}