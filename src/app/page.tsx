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
  const [buscando, setBuscando] = useState(false)
  const [cedulaRegistrada, setCedulaRegistrada] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const sigCanvas = useRef<SignatureCanvas>(null)

  const buscarCedula = async () => {
    if (!cedula.trim()) return
    setBuscando(true)
    setMensaje(null)

    try {
      const { data, error } = await supabase
        .from('asistentes_permitidos')
        .select('*')
        .eq('cedula', cedula.trim())
        .single()

      if (data) {
        setNombre(data.nombre_completo || '')
        setEmpresa(data.empresa || '')
        setCedulaRegistrada(true)
      } else {
        setNombre('')
        setEmpresa('')
        setCedulaRegistrada(false)
        setMensaje('La cédula ingresada no se encuentra en el listado oficial autorizados.')
      }
    } catch (err) {
      setCedulaRegistrada(false)
      setMensaje('Cédula no encontrada en la lista autorizada.')
    } finally {
      setBuscando(false)
    }
  }

  const limpiarFirma = () => {
    sigCanvas.current?.clear()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje(null)

    if (!cedulaRegistrada) {
      setMensaje('Por favor ingresa una cédula válida y registrada.')
      return
    }

    if (sigCanvas.current?.isEmpty()) {
      setMensaje('Por favor realiza tu firma digital antes de guardar.')
      return
    }

    setLoading(true)

    try {
      const firmaUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png')

      const { error } = await supabase.from('asistencias').insert([
        {
          cedula: cedula.trim(),
          nombre_completo: nombre,
          empresa: empresa,
          curso: curso,
          firma: firmaUrl,
        },
      ])

      if (error) throw error

      setMensaje('¡Asistencia registrada con éxito! Muchas gracias.')
      setCedula('')
      setNombre('')
      setEmpresa('')
      setCedulaRegistrada(false)
      sigCanvas.current?.clear()
    } catch (err) {
      setMensaje('Error al registrar la asistencia. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      <head>
        <title>Control de Asistencia Industrial | SG-SST</title>
      </head>

      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <span className="font-bold text-indigo-400 text-lg">🛡️ Control Industrial</span>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/" className="text-white bg-indigo-600 px-3 py-1.5 rounded-lg">Registro</Link>
          <Link href="/admin" className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Administrador</Link>
        </div>
      </nav>

      <div className="flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Registro Digital de Asistencia
            </h1>
            <p className="text-slate-400 text-sm">Digita tu cédula para registrar tu asistencia</p>
          </div>

          {mensaje && (
            <div className={`p-4 rounded-xl text-sm font-medium text-center ${mensaje.includes('éxito') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
              {mensaje}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Número de Cédula *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ej: 1012345678"
                  value={cedula}
                  onChange={(e) => {
                    setCedula(e.target.value)
                    setCedulaRegistrada(false)
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={buscarCedula}
                  disabled={buscando}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 rounded-xl transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  {buscando ? 'Buscando...' : 'Verificar'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Nombre Completo</label>
              <input
                type="text"
                readOnly
                placeholder="Se completará al verificar cédula"
                value={nombre}
                className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl px-4 py-3 text-slate-300 focus:outline-none cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Empresa</label>
              <input
                type="text"
                readOnly
                placeholder="Empresa"
                value={empresa}
                className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl px-4 py-3 text-slate-300 focus:outline-none cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Seleccionar Curso *</label>
              <select
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Trabajo en alturas – Trabajador autorizado">Trabajo en alturas – Trabajador autorizado</option>
                <option value="Trabajo en alturas – Coordinador">Trabajo en alturas – Coordinador</option>
                <option value="Reentrenamiento sectorial – Trabajo en alturas">Reentrenamiento sectorial – Trabajo en alturas</option>
                <option value="Tareas de alto riesgo y trabajo en caliente">Tareas de alto riesgo y trabajo en caliente</option>
                <option value="Armado de andamios para trabajo en alturas">Armado de andamios para trabajo en alturas</option>
                <option value="Rescate en alturas">Rescate en alturas</option>
                <option value="Brigadas de emergencia – Primeros auxilios">Brigadas de emergencia – Primeros auxilios</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Firma Digital *</label>
                <button type="button" onClick={limpiarFirma} className="text-xs text-rose-400 hover:text-rose-300">
                  Limpiar
                </button>
              </div>
              <div className="border border-slate-800 rounded-2xl bg-white overflow-hidden touch-none">
                <SignatureCanvas
                  ref={sigCanvas}
                  penColor="black"
                  canvasProps={{ className: 'w-full h-36 cursor-crosshair' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !cedulaRegistrada}
              className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Guardando Asistencia...' : 'Firmar y Registrar Asistencia'}
            </button>
          </form>
        </div>
      </div>
      <div />
    </div>
  )
}