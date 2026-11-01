'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [curso, setCurso] = useState('Trabajo en alturas – Trabajador autorizado')
  const [previewFoto, setPreviewFoto] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [autorizado, setAutorizado] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  const sigCanvas = useRef<SignatureCanvas | null>(null)

  const verificarCedula = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const cedulaInput = e.target.value
    setCedula(cedulaInput)

    if (cedulaInput.length < 5) {
      setAutorizado(false)
      setNombre('')
      setEmpresa('')
      return
    }

    setVerificando(true)
    try {
      const { data, error } = await supabase
        .from('asistentes_permitidos')
        .select('*')
        .eq('cedula', cedulaInput.trim())
        .single()

      if (error || !data) {
        setAutorizado(false)
        setNombre('')
        setEmpresa('')
        setMensaje({ tipo: 'error', texto: 'Cédula no encontrada en el listado oficial.' })
      } else {
        setAutorizado(true)
        setNombre(data.nombre_completo)
        setEmpresa(data.empresa || '')
        setMensaje({ tipo: 'exito', texto: `¡Bienvenido/a, ${data.nombre_completo}!` })
      }
    } catch (err) {
      setAutorizado(false)
    } finally {
      setVerificando(false)
    }
  }

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPreviewFoto(URL.createObjectURL(e.target.files[0]))
    }
  }

  const limpiarFirma = () => {
    sigCanvas.current?.clear()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!autorizado) {
      setMensaje({ tipo: 'error', texto: 'Debes ingresar una cédula autorizada.' })
      return
    }

    if (sigCanvas.current?.isEmpty()) {
      setMensaje({ tipo: 'error', texto: 'Por favor ingresa tu firma digital.' })
      return
    }

    setLoading(true)
    setMensaje(null)

    try {
      const { data: existente } = await supabase
        .from('asistencias')
        .select('*')
        .eq('cedula', cedula.trim())
        .eq('curso', curso)
        .maybeSingle()

      if (existente) {
        setMensaje({ tipo: 'error', texto: '⚠️ Esta cédula ya registró su asistencia para este curso.' })
        setLoading(false)
        return
      }

      const firmaUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png')

      const { error } = await supabase.from('asistencias').insert([
        {
          nombre_completo: nombre,
          cedula: cedula,
          curso: curso,
          empresa: empresa || 'N/A',
          firma: firmaUrl
        }
      ])

      if (error) throw error

      setMensaje({ tipo: 'exito', texto: '¡Asistencia guardada con éxito!' })
      setCedula('')
      setNombre('')
      setEmpresa('')
      setPreviewFoto(null)
      setAutorizado(false)
      limpiarFirma()

    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'Ocurrió un error al guardar.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <span className="font-bold text-indigo-400">🛡️ Control Industrial</span>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/" className="text-white bg-indigo-600 px-3 py-1.5 rounded-lg">Registro</Link>
          <Link href="/admin" className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Administrador</Link>
        </div>
      </nav>

      <div className="p-4 sm:p-6 flex items-center justify-center">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Registro Digital de Asistencia
            </h1>
            <p className="text-slate-400 text-sm">Digita tu cédula para registrar tu asistencia</p>
          </div>

          {mensaje && (
            <div className={`p-4 rounded-xl text-sm font-medium ${mensaje.tipo === 'exito' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              {mensaje.texto}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Número de Cédula *</label>
              <input
                type="text"
                required
                placeholder="Ej: 1012345678"
                value={cedula}
                onChange={verificarCedula}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
              />
              {verificando && <p className="text-xs text-indigo-400 mt-1 animate-pulse">Verificando...</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Nombre Completo</label>
              <input type="text" disabled value={nombre} placeholder="Se autocompleta con la cédula" className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Empresa</label>
              <input type="text" disabled value={empresa} placeholder="Empresa" className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Seleccionar Curso *</label>
              <select value={curso} onChange={(e) => setCurso(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="Trabajo en alturas – Trabajador autorizado">Trabajo en alturas – Trabajador autorizado (32h)</option>
                <option value="Trabajo en alturas – Coordinador">Trabajo en alturas – Coordinador (80h)</option>
                <option value="Reentrenamiento sectorial – Trabajo en alturas">Reentrenamiento sectorial – Trabajo en alturas (8h)</option>
                <option value="Tareas de alto riesgo y trabajo en caliente">Tareas de alto riesgo y trabajo en caliente (10h)</option>
                <option value="Armado de andamios para trabajo en alturas">Armado de andamios para trabajo en alturas (10h)</option>
                <option value="Rescate en alturas">Rescate en alturas (16h)</option>
                <option value="Brigadas de emergencia – Primeros auxilios">Brigadas de emergencia – Primeros auxilios (8h)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Foto de Cédula</label>
              <input type="file" accept="image/*" capture="environment" onChange={handleFotoChange} className="hidden" id="foto-input" />
              <label htmlFor="foto-input" className="flex items-center justify-center gap-2 w-full bg-slate-950 border border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-4 cursor-pointer text-slate-400 hover:text-white transition-all text-sm">
                📷 {previewFoto ? 'Documento cargado' : 'Tomar foto o subir archivo'}
              </label>
              {previewFoto && (
                <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-800 max-h-40">
                  <img src={previewFoto} alt="Cédula" className="w-full object-cover" />
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Firma Digital *</label>
                <button type="button" onClick={limpiarFirma} className="text-xs text-rose-400 hover:text-rose-300">Limpiar</button>
              </div>
              <div className="bg-white rounded-xl overflow-hidden border-2 border-slate-700">
                <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{ className: 'w-full h-36 cursor-crosshair' }} />
              </div>
            </div>

            <button type="submit" disabled={loading || !autorizado} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer">
              {loading ? 'Guardando...' : 'Confirmar y Guardar Asistencia'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}