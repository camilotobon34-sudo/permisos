'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [curso, setCurso] = useState('')
  const [cursoOtro, setCursoOtro] = useState('')
  const [metodo, setMetodo] = useState('clave')
  const [claveUsada, setClaveUsada] = useState('')
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cursosDisponibles = [
    'Trabajo Seguro en Alturas',
    'Primeros Auxilios',
    'Seguridad y Salud en el Trabajo (SST)',
    'Manejo de Emergencias',
    'Otro'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMensaje('')

    const cursoFinal = curso === 'Otro' ? cursoOtro : curso

    if (!cursoFinal) {
      setMensaje('⚠️ Por favor seleccione o especifique el curso marcando con una X.')
      setLoading(false)
      return
    }

    try {
      // 1. Buscar o crear el alumno en Supabase
      let alumnoId = null
      const { data: alumnoExistente } = await supabase
        .from('alumnos')
        .select('id')
        .eq('cedula', cedula)
        .single()

      if (alumnoExistente) {
        alumnoId = alumnoExistente.id
      } else {
        const { data: nuevoAlumno, error: errorAlumno } = await supabase
          .from('alumnos')
          .insert([{ nombre, cedula }])
          .select()
          .single()

        if (errorAlumno) throw errorAlumno
        alumnoId = nuevoAlumno.id
      }

      // 2. Insertar asistencia real en Supabase
      const { error: errorAsistencia } = await supabase
        .from('asistencias')
        .insert([
          {
            alumno_id: alumnoId,
            metodo: metodo,
            clave_usada: claveUsada || '0000',
            curso: cursoFinal,
            fecha: new Date().toISOString().split('T')[0],
            hora: new Date().toLocaleTimeString('es-CO', { hour12: false })
          }
        ])

      if (errorAsistencia) throw errorAsistencia

      setMensaje('✅ ¡Asistencia registrada exitosamente en la base de datos!')
      setNombre('')
      setCedula('')
      setCurso('')
      setCursoOtro('')
      setClaveUsada('')
    } catch (err: any) {
      console.error(err)
      setMensaje('❌ Error al guardar: ' + (err.message || 'Intente de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 py-10 px-4 flex flex-col items-center justify-center font-sans text-slate-100">
      <div className="max-w-xl w-full bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 p-8">
        
        <div className="text-center mb-8 border-b border-slate-700 pb-6">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Registro de Asistencia Digital
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Plataforma de Capacitaciones — Viviana Mambuscay
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Nombre Completo *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Juan Pérez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Número de Cédula *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: 1012345678"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Seleccione el Curso a Realizar (Marque con X) *
            </label>
            <div className="space-y-3 bg-slate-900/50 border border-slate-700/80 rounded-2xl p-4">
              {cursosDisponibles.map((item) => {
                const isSelected = curso === item
                return (
                  <div
                    key={item}
                    onClick={() => setCurso(item)}
                    className={`flex items-center gap-4 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-600/20 text-blue-300 font-semibold shadow-md'
                        : 'border-slate-800 bg-slate-800/80 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center font-black text-base ${
                        isSelected
                          ? 'border-blue-400 bg-blue-600 text-white'
                          : 'border-slate-600 bg-slate-900 text-transparent'
                      }`}
                    >
                      X
                    </div>
                    <span className="text-sm">{item}</span>
                  </div>
                )
              })}
            </div>

            {curso === 'Otro' && (
              <input
                type="text"
                required
                placeholder="Escriba el nombre del curso..."
                value={cursoOtro}
                onChange={(e) => setCursoOtro(e.target.value)}
                className="w-full mt-3 px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Clave Temporal del Evento (4 dígitos)
            </label>
            <input
              type="text"
              maxLength={4}
              placeholder="Ej: 1234"
              value={claveUsada}
              onChange={(e) => setClaveUsada(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-lg font-bold"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg transition-all disabled:opacity-50 text-base"
          >
            {loading ? 'Guardando en Supabase...' : 'Registrar Asistencia'}
          </button>
        </form>

        {mensaje && (
          <div
            className={`mt-6 p-4 rounded-2xl text-center text-sm font-medium border ${
              mensaje.startsWith('✅')
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {mensaje}
          </div>
        )}

      </div>
    </main>
  )
}