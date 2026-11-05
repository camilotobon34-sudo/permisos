'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import SignatureCanvas from 'react-signature-canvas'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export default function Home() {
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [curso, setCurso] = useState('Trabajo en alturas – Trabajador autorizado')
  const [empresa, setEmpresa] = useState('')
  const [fotoCedula, setFotoCedula] = useState<string | null>(null)
  const [firmaData, setFirmaData] = useState<string | null>(null)
  
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [processingOcr, setProcessingOcr] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [showEntrenadorModal, setShowEntrenadorModal] = useState(false)
  const [codigoEntrenador, setCodigoEntrenador] = useState('')
  const [errorEntrenador, setErrorEntrenador] = useState('')

  const sigCanvasRef = useRef<SignatureCanvas | null>(null)

  useEffect(() => {
    const registrado = localStorage.getItem('asistencia_registrada_industrial')
    if (registrado) {
      setAlreadyRegistered(true)
    }
  }, [])

  const handleFotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64Image = reader.result as string
      setFotoCedula(base64Image)
      
      setProcessingOcr(true)
      try {
        const response = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apikey: 'K88888888888957',
            base64Image: base64Image,
            language: 'spa',
            isOverlayRequired: false,
            scale: true,
            OCREngine: '2'
          })
        })

        const result = await response.json()
        console.log('Respuesta OCR:', result)
        
        if (result && result.ParsedResults && result.ParsedResults[0]) {
          const texto = result.ParsedResults[0].ParsedText || ''
          console.log('Texto obtenido:', texto)

          const lineas = texto.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0)

          // 1. Extracción directa del número de documento
          const lineaCedula = lineas.find((l: string) => /\d{1,3}[.,]?\d{3}[.,]?\d{3}/.test(l))
          if (lineaCedula) {
            setCedula(lineaCedula.replace(/\D/g, ''))
          } else {
            const matchSimple = texto.match(/\b\d{7,10}\b/)
            if (matchSimple) setCedula(matchSimple[0])
          }

          // 2. Filtrar estrictamente títulos para que NUNCA aparezca "Identificación Personal" u otros
          const palabrasProhibidas = [
            'REPÚBLICA', 'REPUBLICA', 'COLOMBIA', 'IDENTIFICACION', 'PERSONAL', 
            'TARJETA', 'IDENTIDAD', 'NÚMERO', 'NUMERO', 'APELLIDOS', 'NOMBRES', 'FIRMA'
          ]

          const lineasLimpias = lineas.filter((l: string) => {
            const upper = l.toUpperCase()
            const tieneProhibida = palabrasProhibidas.some(p => upper.includes(p))
            const tieneNumeros = /\d/.test(l)
            return !tieneProhibida && !tieneNumeros && l.length > 3
          })

          console.log('Líneas limpias finales:', lineasLimpias)

          if (lineasLimpias.length >= 2) {
            // Une los apellidos y nombres limpios de la tarjeta
            setNombre(`${lineasLimpias[0]} ${lineasLimpias[1]}`)
          } else if (lineasLimpias.length === 1) {
            setNombre(lineasLimpias[0])
          }
        }
      } catch (err) {
        console.error('Error en OCR:', err)
      } finally {
        setProcessingOcr(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const limpiarFirma = () => {
    sigCanvasRef.current?.clear()
    setFirmaData(null)
  }

  const guardarFirma = () => {
    if (sigCanvasRef.current?.isEmpty()) {
      alert('Por favor realiza tu firma antes de continuar.')
      return
    }
    const signatureURL = sigCanvasRef.current?.getTrimmedCanvas().toDataURL('image/png')
    setFirmaData(signatureURL || null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!fotoCedula) {
      setErrorMsg('Debes tomar o subir la foto de la cédula.')
      return
    }

    if (!firmaData) {
      setErrorMsg('Debes guardar tu firma digital.')
      return
    }

    setLoading(true)

    try {
      const fechaHoy = new Date().toISOString().split('T')[0]
      const horaActual = new Date().toLocaleTimeString()

      let coordenadas = 'N/A'
      if (navigator.geolocation) {
        try {
          const position: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }))
          coordenadas = `${position.coords.latitude}, ${position.coords.longitude}`
        } catch (geoErr) {
          console.log('GPS no disponible')
        }
      }

      const { error } = await supabase.from('asistencias').insert([
        {
          cedula_extraida_ocr: cedula.trim(),
          nombre_extraido_ocr: nombre.trim(),
          empresa_nombre: empresa.trim() || 'N/A',
          curso: curso,
          foto_cedula_url: fotoCedula,
          firma: firmaData,
          fecha: fechaHoy,
          hora: horaActual,
          gps: coordenadas,
          metodo: 'web_campo'
        }
      ])

      if (error) throw error

      localStorage.setItem('asistencia_registrada_industrial', 'true')
      setSuccess(true)
      setAlreadyRegistered(true)
    } catch (err: any) {
      setErrorMsg('Error al registrar la asistencia. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const desbloquearConEntrenador = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorEntrenador('')

    const codigo = codigoEntrenador.trim()
    if (codigo === 'ENT-NEIVA-01') {
      permitirDesbloqueo()
      return
    }

    const { data } = await supabase
      .from('entrenadores')
      .select('*')
      .eq('codigo', codigo)
      .maybeSingle()

    if (data) {
      permitirDesbloqueo()
    } else {
      setErrorEntrenador('Código de entrenador incorrecto.')
    }
  }

  const permitirDesbloqueo = () => {
    localStorage.removeItem('asistencia_registrada_industrial')
    setAlreadyRegistered(false)
    setSuccess(false)
    setShowEntrenadorModal(false)
    setCodigoEntrenador('')
    setCedula('')
    setNombre('')
    setEmpresa('')
    setFotoCedula(null)
    setFirmaData(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <span className="font-bold text-indigo-400">🛡️ Control Industrial - Campo</span>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/" className="text-white bg-indigo-600 px-3 py-1.5 rounded-lg">Registro</Link>
          <Link href="/admin" className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Administrador</Link>
        </div>
      </nav>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Registro Digital en Campo
            </h1>
            <p className="text-slate-400 text-sm">Toma foto de tu cédula, verifica tus datos y firma</p>
          </div>

          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-center font-medium">
              ¡Asistencia registrada con éxito! Muchas gracias.
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-center text-sm">
              {errorMsg}
            </div>
          )}

          {alreadyRegistered ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto text-2xl border border-amber-500/20">
                🔒
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-amber-400">Dispositivo ya registrado</h2>
                <p className="text-slate-400 text-sm">
                  Ya se registró una asistencia desde este dispositivo. Por seguridad, solo se permite 1 registro por celular.
                </p>
              </div>

              <button
                onClick={() => setShowEntrenadorModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
              >
                ¿Eres Entrenador? Ingresa tu código para registrar otro participante
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  1. Foto de la Cédula (Frontal) *
                </label>
                <div className="border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center bg-slate-950/50 hover:border-indigo-500/50 transition-colors">
                  {fotoCedula ? (
                    <div className="space-y-3">
                      <img src={fotoCedula} alt="Cédula capturada" className="h-32 mx-auto object-cover rounded-xl border border-slate-700" />
                      <label htmlFor="foto-input" className="inline-block bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer transition-all">
                        Cambiar Foto
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-3xl">📷</div>
                      <div className="text-sm text-slate-300">Toma una foto clara de tu cédula</div>
                      <label htmlFor="foto-input" className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-lg shadow-indigo-600/20">
                        Tomar / Subir Foto
                      </label>
                    </div>
                  )}
                  <input id="foto-input" type="file" accept="image/*" capture="environment" onChange={handleFotoCapture} className="hidden" />
                </div>
                {processingOcr && (
                  <p className="text-xs text-indigo-400 text-center animate-pulse">Procesando cédula con la nube (OCR)...</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Número de Cédula *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 1036943054"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Juan Camilo Tobón"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Empresa / Contratista</label>
                  <input
                    type="text"
                    placeholder="Ej: Industrial S.A.S."
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Curso *</label>
                  <select
                    value={curso}
                    onChange={(e) => setCurso(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    2. Firma Digital *
                  </label>
                  <button type="button" onClick={limpiarFirma} className="text-xs text-rose-400 hover:underline">
                    Limpiar firma
                  </button>
                </div>
                <div className="bg-white rounded-2xl overflow-hidden border border-slate-700">
                  <SignatureCanvas
                    ref={sigCanvasRef}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-40 cursor-crosshair bg-white' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={guardarFirma}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 rounded-xl text-xs transition-all cursor-pointer"
                >
                  Confirmar Firma
                </button>
                {firmaData && <p className="text-xs text-emerald-400 text-center">✓ Firma guardada correctamente</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Registrando...' : 'Firmar y Registrar Asistencia'}
              </button>
            </form>
          )}
        </div>
      </main>

      {showEntrenadorModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full space-y-4">
            <h3 className="text-lg font-bold text-center">🔓 Acceso de Entrenador</h3>
            <p className="text-xs text-slate-400 text-center">Ingresa tu código para desbloquear un nuevo registro.</p>
            
            {errorEntrenador && (
              <div className="p-2 bg-rose-500/10 text-rose-400 text-xs rounded-lg text-center">{errorEntrenador}</div>
            )}

            <form onSubmit={desbloquearConEntrenador} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Ej: ENT-01"
                value={codigoEntrenador}
                onChange={(e) => setCodigoEntrenador(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEntrenadorModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-2.5 rounded-xl text-xs font-semibold cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="py-6 text-center text-xs text-slate-600">
        Control de Asistencia Industrial • Sistema Seguro
      </footer>
    </div>
  )
}