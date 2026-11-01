'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [curso, setCurso] = useState('Trabajo en alturas – Trabajador autorizado')
  
  // Estados para cámara / foto cédula
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  
  // Estado de bloqueo de 1 solo registro por dispositivo
  const [yaRegistrado, setYaRegistrado] = useState(false)
  
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const sigCanvas = useRef<SignatureCanvas>(null)

  // Verificar si este dispositivo ya registró asistencia previamente
  useEffect(() => {
    const registroPrevio = localStorage.getItem('asistencia_registrada_industrial')
    if (registroPrevio === 'true') {
      setYaRegistrado(true)
    }
  }, [])

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      setImagePreview(evt.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const limpiarFirma = () => {
    sigCanvas.current?.clear()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensaje(null)

    if (yaRegistrado) {
      setMensaje('⚠️ Ya registraste tu asistencia. Solo se permite 1 registro por dispositivo/sesión.')
      return
    }

    if (!imagePreview) {
      setMensaje('Por favor toma o carga la foto de tu cédula.')
      return
    }

    if (!cedula.trim() || !nombre.trim()) {
      setMensaje('Por favor completa tu número de cédula y nombre completo.')
      return
    }

    if (sigCanvas.current?.isEmpty()) {
      setMensaje('Por favor realiza tu firma digital antes de guardar.')
      return
    }

    setLoading(true)

    try {
      const firmaUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png')
      const fechaHoy = new Date().toISOString().split('T')[0]
      const horaActual = new Date().toLocaleTimeString()

      // Insertar asistencia en Supabase con los nuevos campos de campo
      const { error } = await supabase.from('asistencias').insert([
        {
          cedula_extraida_ocr: cedula.trim(),
          nombre_extraido_ocr: nombre.trim(),
          empresa_nombre: empresa.trim() || 'N/A',
          curso: curso,
          foto_cedula_url: imagePreview, // Guardamos la imagen de la cédula
          firma: firmaUrl,
          fecha: fechaHoy,
          hora: horaActual,
          metodo: 'auto_qr',
          entrenador_codigo: 'CAMPO-DIRECTO'
        },
      ])

      if (error) throw error

      // Bloquear este dispositivo para que no haga más registros
      localStorage.setItem('asistencia_registrada_industrial', 'true')
      setYaRegistrado(true)
      setMensaje('¡Asistencia registrada con éxito! Muchas gracias.')
    } catch (err) {
      setMensaje('Error al registrar la asistencia. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <span className="font-bold text-indigo-400 text-lg">🛡️ Control Industrial - Campo</span>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/" className="text-white bg-indigo-600 px-3 py-1.5 rounded-lg">Registro</Link>
          <Link href="/admin" className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Administrador</Link>
        </div>
      </nav>

      <div className="flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Registro Digital en Campo
            </h1>
            <p className="text-slate-400 text-sm">Toma foto de tu cédula y firma tu asistencia</p>
          </div>

          {mensaje && (
            <div className={`p-4 rounded-xl text-sm font-medium text-center ${mensaje.includes('éxito') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
              {mensaje}
            </div>
          )}

          {yaRegistrado ? (
            <div className="p-6 bg-slate-950 border border-amber-500/30 rounded-2xl text-center space-y-3">
              <div className="text-3xl">🔒</div>
              <h3 className="font-bold text-amber-400">Dispositivo ya registrado</h3>
              <p className="text-xs text-slate-400">
                Ya se registró una asistencia desde este celular o navegador. Por seguridad, solo se permite 1 registro por dispositivo.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Captura de Foto Cédula */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  1. Foto de la Cédula (Frontal) *
                </label>
                <div className="border-2 border-dashed border-slate-700 bg-slate-950 rounded-2xl p-4 text-center">
                  {imagePreview ? (
                    <div className="space-y-3">
                      <img src={imagePreview} alt="Cédula" className="h-36 mx-auto rounded-xl object-cover border border-slate-700" />
                      <label htmlFor="foto-cedula" className="inline-block bg-slate-800 hover:bg-slate-700 text-xs px-4 py-2 rounded-xl cursor-pointer font-medium transition-all">
                        Cambiar Foto
                      </label>
                    </div>
                  ) : (
                    <label htmlFor="foto-cedula" className="cursor-pointer space-y-2 block py-4">
                      <div className="text-3xl">📸</div>
                      <div className="text-sm font-semibold text-white">Tomar Foto con la Cámara</div>
                      <div className="text-xs text-slate-500">Haz clic para abrir la cámara del celular</div>
                    </label>
                  )}
                  <input
                    id="foto-cedula"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageCapture}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Número de Cédula *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 1012345678"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Tus nombres y apellidos"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Empresa (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Constructora ABC"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Seleccionar Curso *</label>
                <select
                  value={curso}
                  onChange={(e) => setCurso(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-400">2. Firma Digital *</label>
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
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Guardando Asistencia...' : 'Firmar y Registrar Asistencia'}
              </button>
            </form>
          )}
        </div>
      </div>
      <div />
    </div>
  )
}