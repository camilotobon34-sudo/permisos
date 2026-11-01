'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

interface Asistencia {
  id: number
  created_at: string
  nombre_completo: string
  cedula: string
  curso: string
  empresa: string
  firma: string
}

interface AsistentePermitido {
  id: number
  cedula: string
  nombre_completo: string
  empresa: string
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorLogin, setErrorLogin] = useState('')

  const [activeTab, setActiveTab] = useState<'asistencias' | 'permitidos'>('asistencias')
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])
  const [permitidos, setPermitidos] = useState<AsistentePermitido[]>([])
  const [cursoFiltro, setCursoFiltro] = useState('TODOS')
  const [busqueda, setBusqueda] = useState('')
  const [firmaAmpliada, setFirmaAmpliada] = useState<string | null>(null)
  const [loadingExcel, setLoadingExcel] = useState(false)
  const [mensajeExcel, setMensajeExcel] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorLogin('')

    try {
      const { data, error } = await supabase
        .from('entrenadores')
        .select('*')
        .eq('usuario', username.trim())
        .eq('password', password.trim())
        .single()

      if (error || !data) {
        setErrorLogin('Usuario o contraseña incorrectos.')
      } else {
        setIsAuthenticated(true)
        cargarDatos()
      }
    } catch (err) {
      setErrorLogin('Error al conectar con la base de datos.')
    }
  }

  const cargarDatos = async () => {
    const { data: dataAsist } = await supabase
      .from('asistencias')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (dataAsist) setAsistencias(dataAsist)

    const { data: dataPerm } = await supabase
      .from('asistentes_permitidos')
      .select('*')
      .order('nombre_completo', { ascending: true })

    if (dataPerm) setPermitidos(dataPerm)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoadingExcel(true)
    setMensajeExcel(null)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json<any>(ws)

        const nuevosPermitidos = data.map((row) => ({
          cedula: String(row.cedula || row.Cédula || row.CEDULA || '').trim(),
          nombre_completo: String(row.nombre_completo || row.Nombre || row.NOMBRE || '').trim(),
          empresa: String(row.empresa || row.Empresa || row.EMPRESA || 'N/A').trim(),
        })).filter(item => item.cedula && item.nombre_completo)

        if (nuevosPermitidos.length === 0) {
          setMensajeExcel('El Excel no tiene el formato correcto (requiere columnas cedula, nombre_completo, empresa).')
          setLoadingExcel(false)
          return
        }

        const { error } = await supabase.from('asistentes_permitidos').insert(nuevosPermitidos)

        if (error) throw error

        setMensajeExcel(`¡Se cargaron ${nuevosPermitidos.length} asistentes exitosamente!`)
        cargarDatos()
      } catch (err) {
        setMensajeExcel('Error al procesar el archivo Excel.')
      } finally {
        setLoadingExcel(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const vaciarPermitidos = async () => {
    if (!confirm('¿Estás seguro de vaciar todo el listado de asistentes permitidos?')) return
    const { error } = await supabase.from('asistentes_permitidos').delete().neq('id', 0)
    if (!error) {
      setPermitidos([])
      setMensajeExcel('Listado oficial vaciado correctamente.')
    }
  }

  const exportarExcelAsistencias = () => {
    const datosExportar = asistencias.map((item) => ({
      'Fecha y Hora': new Date(item.created_at).toLocaleString(),
      'Nombre Completo': item.nombre_completo,
      'Cédula': item.cedula,
      'Empresa': item.empresa,
      'Curso Realizado': item.curso,
    }))

    const ws = XLSX.utils.json_to_sheet(datosExportar)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencias')
    XLSX.writeFile(wb, 'Reporte_Asistencias_Industrial.xlsx')
  }

  const asistenciasFiltradas = asistencias.filter(item => {
    const cumpleCurso = cursoFiltro === 'TODOS' || item.curso === cursoFiltro
    const cumpleBusqueda = item.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) || item.cedula.includes(busqueda)
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
                Portal Administrador
              </h1>
              <p className="text-slate-400 text-sm">Ingresa tus credenciales de entrenador</p>
            </div>

            {errorLogin && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl text-center">
                {errorLogin}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Usuario</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: alexander"
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
                Iniciar Sesión
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
        <span className="font-bold text-indigo-400">🛡️ Control Industrial - Admin</span>
        <div className="flex gap-4 items-center">
          <Link href="/" className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-sm">Ir a Registro</Link>
          <button onClick={() => setIsAuthenticated(false)} className="bg-rose-600/20 text-rose-400 border border-rose-500/30 px-3 py-1.5 rounded-lg text-sm hover:bg-rose-600/30">Cerrar Sesión</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Panel de Gestión</h1>
            <p className="text-slate-400 text-sm">Control de asistencias registradas y listados oficiales autorizados.</p>
          </div>
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button onClick={() => setActiveTab('asistencias')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'asistencias' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Asistencias Firmadas ({asistencias.length})
            </button>
            <button onClick={() => setActiveTab('permitidos')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'permitidos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Listado Oficial ({permitidos.length})
            </button>
          </div>
        </div>

        {mensajeExcel && (
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-xl text-sm">
            {mensajeExcel}
          </div>
        )}

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
                <button onClick={exportarExcelAsistencias} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-600/20">
                  📊 Exportar Excel
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4">Fecha / Hora</th>
                      <th className="p-4">Participante</th>
                      <th className="p-4">Cédula</th>
                      <th className="p-4">Empresa</th>
                      <th className="p-4">Curso</th>
                      <th className="p-4 text-center">Firma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {asistenciasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">No hay registros de asistencia encontrados.</td>
                      </tr>
                    ) : (
                      asistenciasFiltradas.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(item.created_at).toLocaleString()}</td>
                          <td className="p-4 font-semibold text-white">{item.nombre_completo}</td>
                          <td className="p-4 text-slate-300">{item.cedula}</td>
                          <td className="p-4 text-slate-300">{item.empresa}</td>
                          <td className="p-4 text-slate-300 max-w-xs truncate">{item.curso}</td>
                          <td className="p-4 text-center">
                            {item.firma && (
                              <img
                                src={item.firma}
                                alt="Firma"
                                onClick={() => setFirmaAmpliada(item.firma)}
                                className="h-10 mx-auto bg-white rounded cursor-pointer hover:opacity-80 border border-slate-700 p-0.5"
                                title="Hacer clic para ampliar"
                              />
                            )}
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
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div>
                <h2 className="text-lg font-bold">Gestión de Cédulas Autorizadas</h2>
                <p className="text-slate-400 text-sm">Sube un archivo Excel con columnas: `cedula`, `nombre_completo`, `empresa`.</p>
              </div>
              <div className="flex items-center gap-3">
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" id="excel-upload" />
                <label htmlFor="excel-upload" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all shadow-lg shadow-indigo-600/20">
                  {loadingExcel ? 'Subiendo...' : '📂 Subir Excel Autorizado'}
                </label>
                {permitidos.length > 0 && (
                  <button onClick={vaciarPermitidos} className="bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
                    Vaciar Lista
                  </button>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="p-4">Cédula</th>
                      <th className="p-4">Nombre Completo</th>
                      <th className="p-4">Empresa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {permitidos.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-500">No hay cédulas autorizadas cargadas actualmente. Sube un Excel.</td>
                      </tr>
                    ) : (
                      permitidos.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-semibold text-white">{p.cedula}</td>
                          <td className="p-4 text-slate-300">{p.nombre_completo}</td>
                          <td className="p-4 text-slate-300">{p.empresa}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {firmaAmpliada && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setFirmaAmpliada(null)}>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Firma Digital Ampliada</h3>
            <div className="bg-white p-4 rounded-xl border border-slate-700">
              <img src={firmaAmpliada} alt="Firma ampliada" className="w-full h-48 object-contain" />
            </div>
            <button onClick={() => setFirmaAmpliada(null)} className="w-full bg-slate-800 hover:bg-slate-700 py-2.5 rounded-xl font-semibold text-sm transition-all">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}