'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

interface Asistencia {
  id: number
  created_at: string
  nombre_extraido_ocr: string
  cedula_extraida_ocr: string
  curso: string
  empresa_nombre: string
  firma: string
  foto_cedula_url: string
  fecha: string
  hora: string
  gps: string
}

interface Entrenador {
  id: number
  codigo: string
  nombre: string
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [esSuperAdmin, setEsSuperAdmin] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorLogin, setErrorLogin] = useState('')

  const [activeTab, setActiveTab] = useState<'asistencias' | 'entrenadores'>('asistencias')
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])
  const [entrenadores, setEntrenadores] = useState<Entrenador[]>([])
  
  const [cursoFiltro, setCursoFiltro] = useState('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [firmaAmpliada, setFirmaAmpliada] = useState<string | null>(null)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  // Nuevo entrenador form
  const [nuevoCodigo, setNuevoCodigo] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoPassword, setNuevoPassword] = useState('')
  const [mensajeEntrenador, setMensajeEntrenador] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorLogin('')

    const userInput = username.trim()
    const passInput = password.trim()

    // 1. Validar primero las credenciales maestras y de super admin localmente (sin fallos)
    if (userInput.toLowerCase() === 'viviana' && passInput === 'viviana2026') {
      setIsAuthenticated(true)
      setEsSuperAdmin(true)
      cargarDatos(true)
      return
    }

    if (userInput === 'ENT-NEIVA-01' && passInput === 'viviana2026') {
      setIsAuthenticated(true)
      setEsSuperAdmin(false) // Entra como entrenador (ve lo de hoy)
      cargarDatos(false)
      return
    }

    // 2. Si no es maestro, buscar en la tabla entrenadores de Supabase
    try {
      const { data, error } = await supabase
        .from('entrenadores')
        .select('*')
        .eq('codigo', userInput)
        .eq('password', passInput)
        .maybeSingle()

      if (error || !data) {
        setErrorLogin('Código o contraseña incorrectos.')
      } else {
        setIsAuthenticated(true)
        setEsSuperAdmin(false)
        cargarDatos(false)
      }
    } catch (err) {
      setErrorLogin('Error al conectar con la base de datos.')
    }
  }

  const cargarDatos = async (adminMode: boolean) => {
    const fechaHoy = new Date().toISOString().split('T')[0]

    let query = supabase.from('asistencias').select('*').order('created_at', { ascending: false })

    // Si es entrenador, FILTRA EXCLUSIVAMENTE lo de hoy. Si es Viviana (Super Admin), trae TODO el histórico.
    if (!adminMode) {
      query = query.eq('fecha', fechaHoy)
    }

    const { data: dataAsist } = await query
    if (dataAsist) setAsistencias(dataAsist)

    // Cargar entrenadores si es Super Admin
    if (adminMode) {
      const { data: dataEnt } = await supabase.from('entrenadores').select('*').order('nombre', { ascending: true })
      if (dataEnt) setEntrenadores(dataEnt)
    }
  }

  const eliminarAsistencia = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return
    const { error } = await supabase.from('asistencias').delete().eq('id', id)
    if (!error) {
      setAsistencias(asistencias.filter(item => item.id !== id))
    }
  }

  const crearEntrenador = async (e: React.FormEvent) => {
    e.preventDefault()
    setMensajeEntrenador(null)

    const { error } = await supabase.from('entrenadores').insert([
      {
        codigo: nuevoCodigo.trim().toUpperCase(),
        nombre: nuevoNombre.trim(),
        password: nuevoPassword.trim()
      }
    ])

    if (error) {
      setMensajeEntrenador('Error al crear el código (quizá ya existe).')
    } else {
      setMensajeEntrenador('¡Código de entrenador creado con éxito!')
      setNuevoCodigo('')
      setNuevoNombre('')
      setNuevoPassword('')
      cargarDatos(true)
    }
  }

  const eliminarEntrenador = async (id: number) => {
    if (!confirm('¿Eliminar este código de entrenador?')) return
    const { error } = await supabase.from('entrenadores').delete().eq('id', id)
    if (!error) {
      setEntrenadores(entrenadores.filter(e => e.id !== id))
    }
  }

  const exportarExcel = () => {
    const datosExportar = asistencias.map((item) => ({
      'Fecha': item.fecha,
      'Hora': item.hora || '',
      'Nombre Completo': item.nombre_extraido_ocr,
      'Cédula': item.cedula_extraida_ocr,
      'Empresa': item.empresa_nombre,
      'Curso': item.curso,
      'Ubicación GPS': item.gps || 'N/A'
    }))

    const ws = XLSX.utils.json_to_sheet(datosExportar)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, esSuperAdmin ? 'Historico_Total' : 'Asistencias_Hoy')
    XLSX.writeFile(wb, esSuperAdmin ? 'Reporte_Historico_Viviana.xlsx' : 'Reporte_Asistencias_Entrenador.xlsx')
  }

  const asistenciasFiltradas = asistencias.filter(item => {
    const cumpleCurso = cursoFiltro === 'TODOS' || item.curso === cursoFiltro
    const nombre = item.nombre_extraido_ocr || ''
    const cedula = item.cedula_extraida_ocr || ''
    const cumpleBusqueda = nombre.toLowerCase().includes(busqueda.toLowerCase()) || cedula.includes(busqueda)
    return cumpleCurso && cumpleBusqueda
  })

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
        <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex justify-between items-center">
          <span className="font-bold text-indigo-400">🛡️ Control Industrial</span>
          <div className="flex gap-4 text-sm font-medium">
            <Link href="/" className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Registro</Link>
            <Link href="/admin" className="text-white bg-indigo-600 px-3 py-1.5 rounded-lg">Administrador</Link>
          </div>
        </nav>

        <div className="flex items-center justify-center p-6 my-auto">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Portal de Acceso
              </h1>
              <p className="text-slate-400 text-sm">Entrenador (Código) o Super Admin (Viviana)</p>
            </div>

            {errorLogin && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl text-center">
                {errorLogin}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Usuario o Código</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: ENT-NEIVA-01 o Viviana"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Contraseña</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer">
                Ingresar
              </button>
            </form>
          </div>
        </div>
        <div />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-12">
      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <span className="font-bold text-indigo-400">
          {esSuperAdmin ? '👑 Panel Super Admin (Viviana)' : '🛡️ Panel Entrenador (Solo Hoy)'}
        </span>
        <div className="flex gap-4 items-center">
          <Link href="/" className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-sm">Ir a Registro</Link>
          <button onClick={() => setIsAuthenticated(false)} className="bg-rose-600/20 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-lg text-sm hover:bg-rose-600/30">Cerrar Sesión</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {esSuperAdmin ? 'Histórico General de Asistencias' : 'Asistencias del Día (Hoy)'}
            </h1>
            <p className="text-slate-400 text-sm">
              {esSuperAdmin ? 'Visualización total de todos los registros y gestión de entrenadores.' : 'Registros capturados durante la jornada actual.'}
            </p>
          </div>

          {esSuperAdmin && (
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
              <button onClick={() => setActiveTab('asistencias')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'asistencias' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                Asistencias ({asistencias.length})
              </button>
              <button onClick={() => setActiveTab('entrenadores')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'entrenadores' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                Gestionar Entrenadores ({entrenadores.length})
              </button>
            </div>
          )}
        </div>

        {activeTab === 'asistencias' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <input
                type="text"
                placeholder="Buscar por nombre o cédula..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex flex-wrap items-center gap-3">
                <select value={cursoFiltro} onChange={(e) => setCursoFiltro(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="TODOS">Todos los cursos</option>
                  <option value="Trabajo en alturas – Trabajador autorizado">Trabajo en alturas – Trabajador autorizado</option>
                  <option value="Trabajo en alturas – Coordinador">Trabajo en alturas – Coordinador</option>
                  <option value="Reentrenamiento sectorial – Trabajo en alturas">Reentrenamiento sectorial – Trabajo en alturas</option>
                  <option value="Tareas de alto riesgo y trabajo en caliente">Tareas de alto riesgo y trabajo en caliente</option>
                  <option value="Armado de andamios para trabajo en alturas">Armado de andamios para trabajo en alturas</option>
                  <option value="Rescate en alturas">Rescate en alturas</option>
                  <option value="Brigadas de emergencia – Primeros auxilios">Brigadas de emergencia – Primeros auxilios</option>
                </select>
                <button onClick={exportarExcel} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20">
                  📊 Exportar Reporte Excel
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4">Fecha / Hora</th>
                      <th className="p-4">Cédula (Foto)</th>
                      <th className="p-4">Participante</th>
                      <th className="p-4">Empresa</th>
                      <th className="p-4">Curso</th>
                      <th className="p-4">GPS</th>
                      <th className="p-4 text-center">Firma</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {asistenciasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">No hay registros encontrados.</td>
                      </tr>
                    ) : (
                      asistenciasFiltradas.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 text-slate-400 whitespace-nowrap text-xs">
                            {item.fecha}<br />{item.hora || ''}
                          </td>
                          <td className="p-4">
                            {item.foto_cedula_url ? (
                              <img
                                src={item.foto_cedula_url}
                                alt="Cédula"
                                onClick={() => setFotoAmpliada(item.foto_cedula_url)}
                                className="h-10 w-14 object-cover rounded cursor-pointer hover:opacity-80 border border-slate-700"
                                title="Ver cédula"
                              />
                            ) : (
                              <span className="text-xs text-slate-500">Sin foto</span>
                            )}
                          </td>
                          <td className="p-4 font-semibold text-white">{item.nombre_extraido_ocr}<br /><span className="text-xs text-slate-400">{item.cedula_extraida_ocr}</span></td>
                          <td className="p-4 text-slate-300">{item.empresa_nombre}</td>
                          <td className="p-4 text-slate-300 max-w-xs truncate">{item.curso}</td>
                          <td className="p-4 text-xs text-slate-400">{item.gps || 'N/A'}</td>
                          <td className="p-4 text-center">
                            {item.firma && (
                              <img
                                src={item.firma}
                                alt="Firma"
                                onClick={() => setFirmaAmpliada(item.firma)}
                                className="h-8 mx-auto bg-white rounded cursor-pointer hover:opacity-80 border border-slate-700 p-0.5"
                                title="Ver firma"
                              />
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => eliminarAsistencia(item.id)}
                              className="bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h2 className="text-lg font-bold">Crear Nuevo Código de Entrenador</h2>
              {mensajeEntrenador && <div className="p-3 bg-indigo-500/10 text-indigo-300 rounded-xl text-sm">{mensajeEntrenador}</div>}
              
              <form onSubmit={crearEntrenador} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Código (Ej: ENT-BOGOTA-02)</label>
                  <input
                    type="text"
                    required
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Nombre del Entrenador</label>
                  <input
                    type="text"
                    required
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Contraseña</label>
                  <input
                    type="password"
                    required
                    value={nuevoPassword}
                    onChange={(e) => setNuevoPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white"
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer">
                  Guardar Código Entrenador
                </button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <h3 className="p-4 font-bold border-b border-slate-800">Entrenadores Activos</h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-xs">
                    <th className="p-3">Código</th>
                    <th className="p-3">Nombre</th>
                    <th className="p-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {entrenadores.map(e => (
                    <tr key={e.id}>
                      <td className="p-3 font-semibold text-indigo-400">{e.codigo}</td>
                      <td className="p-3">{e.nombre}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => eliminarEntrenador(e.id)} className="bg-rose-600/20 text-rose-400 px-2.5 py-1 rounded text-xs">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {firmaAmpliada && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setFirmaAmpliada(null)}>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Firma Digital</h3>
            <div className="bg-white p-4 rounded-xl">
              <img src={firmaAmpliada} alt="Firma" className="w-full h-48 object-contain" />
            </div>
            <button onClick={() => setFirmaAmpliada(null)} className="w-full bg-slate-800 py-2.5 rounded-xl font-semibold text-sm cursor-pointer">Cerrar</button>
          </div>
        </div>
      )}

      {fotoAmpliada && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setFotoAmpliada(null)}>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Foto de Cédula</h3>
            <div className="bg-slate-950 p-2 rounded-xl">
              <img src={fotoAmpliada} alt="Cédula" className="w-full h-auto max-h-96 object-contain rounded" />
            </div>
            <button onClick={() => setFotoAmpliada(null)} className="w-full bg-slate-800 py-2.5 rounded-xl font-semibold text-sm cursor-pointer">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}