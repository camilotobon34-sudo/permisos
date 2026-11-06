'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import SignatureCanvas from 'react-signature-canvas'
import { createClient } from '@supabase/supabase-js'
import { sanitizeColombianName } from '@/lib/identity-ocr'

type OcrStatus = 'idle' | 'processing' | 'success' | 'error'
const STORAGE_KEY = 'asistencia_registrada_industrial'

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No se pudo preparar la imagen para su análisis.'))
    }, 'image/jpeg', quality)
  })
}

async function createOcrImages(file: File) {
  const image = await createImageBitmap(file)
  const variants: Blob[] = []
  const baseScale = Math.min(1, 1800 / Math.max(image.width, image.height))

  try {
    for (const degrees of [0, 90, 270] as const) {
      const rotated = degrees !== 0
      let scale = baseScale
      let variant: Blob | null = null

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const canvas = document.createElement('canvas')
        canvas.width = Math.round((rotated ? image.height : image.width) * scale)
        canvas.height = Math.round((rotated ? image.width : image.height) * scale)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('No se pudo preparar la imagen para su análisis.')

        context.translate(canvas.width / 2, canvas.height / 2)
        context.rotate((degrees * Math.PI) / 180)
        context.drawImage(
          image,
          -(image.width * scale) / 2,
          -(image.height * scale) / 2,
          image.width * scale,
          image.height * scale,
        )
        variant = await canvasToJpeg(canvas, 0.72 - attempt * 0.08)
        if (variant.size <= 1_100_000) break
        scale *= 0.8
      }

      if (!variant || variant.size > 1_200_000) {
        throw new Error('No se pudo reducir la imagen al tamaño permitido para el análisis.')
      }
      variants.push(variant)
    }
  } finally {
    image.close()
  }

  return variants
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('No se pudo leer el archivo de imagen.'))
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'))
    reader.readAsDataURL(file)
  })
}

async function recognizeIdentity(images: Blob[]) {
  const formData = new FormData()
  for (const [index, image] of images.entries()) {
    formData.append('images', image, `cedula-${index}.jpg`)
  }

  const response = await fetch('/api/ocr', { method: 'POST', body: formData })
  const result = await response.json() as {
    cedula?: unknown
    nombre?: unknown
    complete?: unknown
    error?: unknown
  }

  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : 'No fue posible analizar la foto.')
  }

  const cedula = typeof result.cedula === 'string' && /^\d{8,10}$/.test(result.cedula)
    ? result.cedula
    : ''
  const nombre = typeof result.nombre === 'string' ? sanitizeColombianName(result.nombre) : ''
  const complete = result.complete === true && Boolean(cedula) && nombre.split(' ').length >= 2
  return complete ? { cedula, nombre } : null
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Falta configurar la conexión de Supabase en las variables de entorno.')
  }
  return createClient(url, key)
}

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('La geolocalización no está disponible en este dispositivo.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 60_000,
    })
  })
}

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Home() {
  const [cedula, setCedula] = useState('')
  const [nombre, setNombre] = useState('')
  const [curso, setCurso] = useState('Trabajo en alturas – Trabajador autorizado')
  const [empresa, setEmpresa] = useState('')
  const [fotoCedula, setFotoCedula] = useState<string | null>(null)
  const [firmaData, setFirmaData] = useState<string | null>(null)
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle')
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)
  const [hasHydrated, setHasHydrated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showEntrenadorModal, setShowEntrenadorModal] = useState(false)
  const [codigoEntrenador, setCodigoEntrenador] = useState('')
  const [errorEntrenador, setErrorEntrenador] = useState('')
  const [gpsAviso, setGpsAviso] = useState('')

  const sigCanvasRef = useRef<SignatureCanvas | null>(null)
  const photoRequestIdRef = useRef(0)
  const cedulaInputRef = useRef<HTMLInputElement | null>(null)
  const nombreInputRef = useRef<HTMLInputElement | null>(null)
  const cedulaManuallyEditedRef = useRef(false)
  const nombreManuallyEditedRef = useRef(false)

  const focusCedulaField = () => {
    window.requestAnimationFrame(() => {
      cedulaInputRef.current?.focus()
    })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAlreadyRegistered(Boolean(localStorage.getItem(STORAGE_KEY)))
      setHasHydrated(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const handleFotoCapture = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    const requestId = ++photoRequestIdRef.current
    cedulaManuallyEditedRef.current = false
    nombreManuallyEditedRef.current = false
    setErrorMsg(null)
    setCedula('')
    setNombre('')
    setFotoCedula(null)
    setFirmaData(null)
    sigCanvasRef.current?.clear()

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Selecciona una imagen válida de la parte frontal de la cédula.')
      focusCedulaField()
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setErrorMsg('La imagen supera el límite de 12 MB. Toma una foto más liviana.')
      focusCedulaField()
      return
    }

    try {
      const preview = await readImage(file)
      if (requestId !== photoRequestIdRef.current) return
      setFotoCedula(preview)
      setOcrStatus('processing')
      focusCedulaField()

      const extracted = await recognizeIdentity(await createOcrImages(file))
      if (requestId !== photoRequestIdRef.current) return

      if (!extracted) {
        if (!cedulaManuallyEditedRef.current) setCedula('')
        if (!nombreManuallyEditedRef.current) setNombre('')
        setOcrStatus('error')
        return
      }

      if (!cedulaManuallyEditedRef.current) setCedula(extracted.cedula)
      if (!nombreManuallyEditedRef.current) setNombre(extracted.nombre)
      setOcrStatus('success')
    } catch (error) {
      if (requestId !== photoRequestIdRef.current) return
      console.error('No se pudo cargar la foto de la cédula.', error)
      if (!cedulaManuallyEditedRef.current) setCedula('')
      if (!nombreManuallyEditedRef.current) setNombre('')
      setOcrStatus('error')
      setErrorMsg(error instanceof Error
        ? `${error.message} Puedes escribir los datos manualmente.`
        : 'No fue posible analizar la foto. Puedes escribir los datos manualmente.')
    }
  }

  const limpiarFirma = () => {
    sigCanvasRef.current?.clear()
    setFirmaData(null)
  }

  const guardarFirma = () => {
    const canvas = sigCanvasRef.current
    if (!canvas || canvas.isEmpty()) {
      setErrorMsg('Por favor realiza tu firma antes de confirmarla.')
      return
    }
    setFirmaData(canvas.getTrimmedCanvas().toDataURL('image/png'))
    setErrorMsg(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMsg(null)
    setGpsAviso('')

    if (!fotoCedula) {
      setErrorMsg('Debes tomar o subir la foto frontal de la cédula.')
      return
    }
    if (!cedula.trim() || !nombre.trim()) {
      setErrorMsg('Verifica que el número de cédula y el nombre completo estén diligenciados.')
      return
    }
    if (!firmaData) {
      setErrorMsg('Debes firmar y confirmar la firma digital.')
      return
    }

    setLoading(true)
    try {
      const now = new Date()
      let coordenadas = 'N/A'
      try {
        const position = await getCurrentPosition()
        coordenadas = `${position.coords.latitude}, ${position.coords.longitude}`
      } catch {
        setGpsAviso('No se obtuvo la ubicación. El registro continuará con GPS no disponible.')
      }

      const { error } = await getSupabaseClient().from('asistencias').insert({
        cedula_extraida_ocr: cedula.trim(),
        nombre_extraido_ocr: nombre.trim(),
        empresa_nombre: empresa.trim() || 'N/A',
        curso,
        foto_cedula_url: fotoCedula,
        firma: firmaData,
        fecha: localDate(now),
        hora: now.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
        gps: coordenadas,
        metodo: 'web_campo',
      })

      if (error) throw error

      localStorage.setItem(STORAGE_KEY, 'true')
      setSuccess(true)
      setAlreadyRegistered(true)
    } catch (error) {
      console.error('No se pudo guardar la asistencia en Supabase.', error)
      setErrorMsg(error instanceof Error
        ? `No se pudo guardar la asistencia: ${error.message}`
        : 'No se pudo guardar la asistencia. Verifica tu conexión e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const desbloquearConEntrenador = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorEntrenador('')

    const codigo = codigoEntrenador.trim()
    if (codigo === 'ENT-NEIVA-01') {
      permitirDesbloqueo()
      return
    }

    try {
      const { data, error } = await getSupabaseClient()
        .from('entrenadores')
        .select('id')
        .eq('codigo', codigo)
        .maybeSingle()
      if (error) throw error
      if (data) permitirDesbloqueo()
      else setErrorEntrenador('Código de entrenador incorrecto.')
    } catch (error) {
      console.error('No se pudo validar el código del entrenador.', error)
      setErrorEntrenador(error instanceof Error
        ? `No se pudo validar el código: ${error.message}`
        : 'No se pudo validar el código. Inténtalo de nuevo.')
    }
  }

  const permitirDesbloqueo = () => {
    localStorage.removeItem(STORAGE_KEY)
    setAlreadyRegistered(false)
    setSuccess(false)
    setShowEntrenadorModal(false)
    setCodigoEntrenador('')
    setCedula('')
    setNombre('')
    setEmpresa('')
    setFotoCedula(null)
    setFirmaData(null)
    setOcrStatus('idle')
    setErrorMsg(null)
    sigCanvasRef.current?.clear()
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-900/70 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/" className="font-bold tracking-tight text-indigo-300">
            Control Industrial <span className="text-slate-500">/ Campo</span>
          </Link>
          <Link href="/admin" className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white">
            Administrador
          </Link>
        </div>
      </nav>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <section className="w-full max-w-2xl space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl shadow-black/20 sm:p-8">
          <header className="space-y-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Registro de participante</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Asistencia en campo</h1>
            <p className="text-sm text-slate-400">Captura la cédula, verifica los datos y firma tu asistencia.</p>
          </header>

          {success && (
            <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm font-medium text-emerald-300">
              ¡Asistencia registrada con éxito! Muchas gracias.
            </div>
          )}
          {errorMsg && (
            <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center text-sm text-rose-300">
              {errorMsg}
            </div>
          )}
          {gpsAviso && <p className="text-center text-xs text-amber-300">{gpsAviso}</p>}

          {!hasHydrated ? (
            <div role="status" className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-400">
              Preparando el registro seguro...
            </div>
          ) : alreadyRegistered ? (
            <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center sm:p-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-2xl text-amber-300" aria-hidden="true">🔒</div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-amber-300">Dispositivo ya registrado</h2>
                <p className="text-sm text-slate-400">Ya se registró una asistencia desde este dispositivo. Para registrar otra, solicita el código a tu entrenador.</p>
              </div>
              <button type="button" onClick={() => setShowEntrenadorModal(true)} className="text-sm font-medium text-indigo-300 underline underline-offset-4 hover:text-indigo-200">
                Ingresar código de entrenador
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="space-y-3">
                <label htmlFor="foto-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  1. Foto frontal de la cédula <span className="text-rose-400">*</span>
                </label>
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/70 p-5 text-center transition hover:border-indigo-500/60">
                  {fotoCedula ? (
                    <div className="space-y-4">
                      <Image src={fotoCedula} alt="Foto frontal de la cédula" width={560} height={360} unoptimized className="mx-auto max-h-52 max-w-full rounded-xl border border-slate-700 object-contain" />
                      {ocrStatus === 'processing' && (
                        <p role="status" className="animate-pulse text-sm text-cyan-300">
                          Analizando la foto para detectar nombre y número...
                        </p>
                      )}
                      {ocrStatus === 'success' && (
                        <p role="status" className="text-sm font-semibold text-emerald-300">
                          ✓ Datos detectados automáticamente. Verifícalos antes de continuar.
                        </p>
                      )}
                      {ocrStatus === 'error' && (
                        <p role="status" className="text-sm text-amber-300">
                          No se pudieron leer los datos. Puedes escribirlos manualmente.
                        </p>
                      )}
                      {ocrStatus === 'idle' && (
                        <p role="status" className="text-sm font-semibold text-emerald-300">
                          ✓ Foto cargada correctamente
                        </p>
                      )}
                      <label htmlFor="foto-input" className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-700">
                        Cambiar foto
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-3 py-2">
                      <div className="text-3xl" aria-hidden="true">📷</div>
                      <p className="text-sm text-slate-300">Toma una foto nítida, frontal y bien iluminada.</p>
                      <label htmlFor="foto-input" className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold shadow-lg shadow-indigo-950/50 transition hover:bg-indigo-500">
                        Tomar o subir foto
                      </label>
                    </div>
                  )}
                  <input id="foto-input" type="file" accept="image/*" capture="environment" onChange={handleFotoCapture} className="sr-only" />
                </div>
                <p className="text-xs leading-relaxed text-slate-500">La foto se analiza en el servidor de esta aplicación. Verifica los datos detectados o escríbelos manualmente.</p>
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="cedula" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Número de cédula <span className="text-rose-400">*</span></label>
                  <input ref={cedulaInputRef} id="cedula" type="text" inputMode="numeric" autoComplete="off" required placeholder="Escribe tu número de cédula" value={cedula} onChange={(event) => { cedulaManuallyEditedRef.current = true; setCedula(event.target.value) }} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
                  <p className="text-xs text-slate-500">Escribe el número de cédula que aparece en el documento.</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="nombre" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Nombre completo <span className="text-rose-400">*</span></label>
                  <input ref={nombreInputRef} id="nombre" type="text" autoComplete="name" required placeholder="Escribe tu nombre completo" value={nombre} onChange={(event) => { nombreManuallyEditedRef.current = true; setNombre(event.target.value) }} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
                  <p className="text-xs text-slate-500">Escribe tus nombres y apellidos completos.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="empresa" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Empresa / contratista</label>
                  <input id="empresa" type="text" autoComplete="organization" placeholder="Nombre de la empresa" value={empresa} onChange={(event) => setEmpresa(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="curso" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Curso <span className="text-rose-400">*</span></label>
                  <select id="curso" required value={curso} onChange={(event) => setCurso(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
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

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">2. Firma digital <span className="text-rose-400">*</span></label>
                  <button type="button" onClick={limpiarFirma} className="text-xs font-medium text-rose-300 hover:text-rose-200">Limpiar firma</button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-700 bg-white">
                  <SignatureCanvas ref={sigCanvasRef} penColor="#0f172a" canvasProps={{ className: 'h-40 w-full cursor-crosshair bg-white', 'aria-label': 'Área para firmar' }} />
                </div>
                <button type="button" onClick={guardarFirma} className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-semibold transition hover:bg-slate-700">
                  Confirmar firma
                </button>
                {firmaData && <p role="status" className="text-center text-xs font-medium text-emerald-300">✓ Firma guardada correctamente</p>}
              </section>

              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-indigo-600 py-3.5 font-semibold shadow-lg shadow-indigo-950/50 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? 'Guardando asistencia...' : 'Firmar y registrar asistencia'}
              </button>
            </form>
          )}
        </section>
      </main>

      {showEntrenadorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="trainer-title" className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h2 id="trainer-title" className="text-center text-lg font-bold">Acceso de entrenador</h2>
            <p className="text-center text-sm text-slate-400">Ingresa tu código para habilitar un nuevo registro.</p>
            {errorEntrenador && <p role="alert" className="rounded-lg bg-rose-500/10 p-3 text-center text-xs text-rose-300">{errorEntrenador}</p>}
            <form onSubmit={desbloquearConEntrenador} className="space-y-4">
              <label htmlFor="codigo-entrenador" className="sr-only">Código de entrenador</label>
              <input id="codigo-entrenador" type="text" required autoComplete="off" placeholder="Código de entrenador" value={codigoEntrenador} onChange={(event) => setCodigoEntrenador(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm uppercase text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowEntrenadorModal(false)} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-semibold transition hover:bg-slate-700">Cancelar</button>
                <button type="submit" className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold transition hover:bg-indigo-500">Desbloquear</button>
              </div>
            </form>
          </section>
        </div>
      )}

      <footer className="px-4 py-5 text-center text-xs text-slate-600">
        Control de Asistencia Industrial · Registro seguro en campo
      </footer>
    </div>
  )
}
