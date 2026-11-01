'use client'

import { useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

interface Asistencia {
  id: string
  created_at: string
  nombre_completo: string
  cedula: string
  empresa: string
  curso: string
  firma: string
}

interface AsistentePermitido {
  id: string
  nombre_completo: string
  cedula: string
  empresa: string
}

const LISTA_CURSOS = [
  'Todos los cursos',
  'Trabajo en alturas – Trabajador autorizado',
  'Trabajo en alturas – Coordinador',
  'Reentrenamiento sectorial – Trabajo en alturas',
  'Tareas de alto riesgo y trabajo en caliente',
  'Armado de andamios para trabajo en alturas',
  'Rescate en alturas',
  'Brigadas de emergencia – Primeros auxilios'
]

export default function AdminPage() {
  const [autenticado, setAutenticado] = useState(false)
  const [entrenadorActual, setEntrenadorActual] = useState('')
  const [usuarioInput, setUsuarioInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [errorLogin, setErrorLogin] = useState(false)
  const [loadingLogin, setLoadingLogin] = useState(false)

  const [pestana, setPestana] = useState<'asistencias' | 'permitidos'>('asistencias')
  const [asistencias, setAsistencias] = useState<Asistencia[]>([])
  const [permitidos, setPermitidos] = useState<AsistentePermitido[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [cursoFiltro, setCursoFiltro] = useState('Todos los cursos')
  const [subiendoExcel, setSubiendoExcel] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)
  const [firmaSeleccionada, setFirmaSeleccionada] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingLogin(true)
    setErrorLogin(false)

    try {
      const { data, error } = await supabase
        .from('entrenadores')
        .select('*')
        .eq('usuario', usuarioInput.trim())
        .eq('password', passwordInput.trim())
        .single()

      if (error || !data) {
        setErrorLogin(true)
      } else {
        setAutenticado(true)
        setEntrenadorActual(data.nombre)
        cargarDatos()
      }
    } catch (err) {
      setErrorLogin(true)
    } finally {
      setLoadingLogin(false)
    }
  }

  const cargarDatos = async () => {
    setLoading(true)
    try {
      const { data: dataAsistencias } = await supabase.from('asistencias').select('*').order('created_at', { ascending: false })
      if (dataAsistencias) setAsistencias(dataAsistencias)

      const { data: dataPermitidos } = await supabase.from('asistentes_permitidos').select('*').order('nombre_completo', { ascending: true })
      if (dataPermitidos) setPermitidos(dataPermitidos)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const exportarReporteAsistencias = () => {
    if (filtradasAsistencias.length === 0) {
      setMensaje({ tipo: 'error', texto: 'No hay datos para exportar.' })
      return
    }

    const dataExportar = filtradasAsistencias.map((a) => ({
      'Fecha y Hora': new Date(a.created_at).toLocaleString('es-CO'),
      'Nombre Completo': a.nombre_completo,
      'Cédula': a.cedula,
      'Empresa': a.empresa || 'N/A',
      'Curso': a.curso,
      'Firma': a.firma ? 'Registrada' : 'Sin Firma'
    }))

    const worksheet = XLSX.utils.json_to_sheet(dataExportar)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte')
    XLSX.writeFile(workbook, `reporte_asistencia_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const descargarPlantilla = () => {
    const worksheetData = [
      ['PLANTILLA OFICIAL DE ASISTENCIA'],
      ['Instrucciones: Ingrese nombre, cédula y empresa.'],
      [],
      ['nombre_completo', 'cedula', 'empresa'],
      ['Ej: Carlos Ruiz', '1023456789', 'Seguridad S.A.S.']
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla')
    XLSX.writeFile(workbook, 'plantilla_oficial_asistencia.xlsx')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSubiendoExcel(true)
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawData = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })
        
        let headerIndex = 0
        for (let i = 0; i < rawData.length; i++) {
          if (JSON.stringify(rawData[i]).toLowerCase().includes('cedula')) {
            headerIndex = i
            break
          }
        }

        const data = XLSX.utils.sheet_to_json<any>(ws, { range: headerIndex })
        const registros = data.map((row) => ({
          nombre_completo: String(row.nombre_completo || row.nombre || '').trim(),
          cedula: String(row.cedula || row.documento || '').trim(),
          empresa: String(row.empresa || 'N/A').trim()
        })).filter(r => r.cedula)

        if (registros.length === 0) throw new Error()

        await supabase.from('asistentes_permitidos').insert(registros)
        setMensaje({ tipo: 'exito', texto: `¡Se cargaron ${registros.length} registros!` })
        cargarDatos()
      } catch (err) {
        setMensaje({ tipo: 'error', texto: 'Error al procesar Excel.' })
      } finally {
        setSubiendoExcel(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const vaciarListaPermitidos = async () => {
    if (!confirm('¿Vaciar listado oficial?')) return
    await supabase.from('asistentes_permitidos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    cargarDatos()
  }

  const filtradasAsistencias = asistencias.filter((a) => {
    const texto = (a.nombre_completo + a.cedula + a.empresa).toLowerCase()
    return texto.includes(busqueda.toLowerCase()) && (cursoFiltro === 'Todos los cursos' || a.curso === cursoFiltro)
  })

  const filtradasPermitidos = permitidos.filter((p) =>
    (p.nombre_completo + p.cedula + p.empresa).toLowerCase().includes(busqueda.toLowerCase())
  )

  if (!autenticado) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex justify-between items-center">
          <span className="font-bold text-indigo-400">🛡️ Control Industrial</span>
          <div className="flex gap-4 text-sm font-medium">
            <Link href="/" className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Registro</Link>
            <Link href="/admin" className="text-white bg-indigo-600 px-3 py-1.5 rounded-lg">Administrador</Link>
          </div>
        </nav>
        <div className="flex items-center justify-center p-4 h-[85vh]">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
            <h1 className="text-2xl font-bold text-center bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Portal de Entrenadores</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Usuario *</label>
                <input type="text" required placeholder="Ej: alexander" value={usuarioInput} onChange={(e) => setUsuarioInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Contraseña *</label>
                <input type="password" required placeholder="••••••••" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm" />
              </div>
              {errorLogin && <div className="p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs text-center rounded-lg">Credenciales incorrectas.</div>}
              <button type="submit" disabled={loadingLogin} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl cursor-pointer">Ingresar</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <span className="font-bold text-indigo-400">🛡️ Control Industrial</span>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/" className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">Registro</Link>
          <Link href="/admin" className="text-white bg-indigo-600 px-3 py-1.5 rounded-lg">Administrador</Link>
        </div>
      </nav>

      <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <div>
            <span className="text-xs uppercase font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">Instructor: {entrenadorActual}</span>
            <h1 className="text-2xl font-bold mt-2">Panel de Control</h1>
          </div>
          <button onClick={() => setAutenticado(false)} className="bg-slate-800 text-rose-300 px-4 py-2 rounded-xl text-sm border border-slate-700 cursor-pointer">🔒 Salir</button>
        </div>

        <div className="flex gap-3 border-b border-slate-800 pb-3">
          <button onClick={() => setPestana('asistencias')} className={`px-5 py-2.5 rounded-xl text-sm cursor-pointer ${pestana === 'asistencias' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Asistencias ({asistencias.length})</button>
          <button onClick={() => setPestana('permitidos')} className={`px-5 py-2.5 rounded-xl text-sm cursor-pointer ${pestana === 'permitidos' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Listado Oficial ({permitidos.length})</button>
        </div>

        {mensaje && <div className={`p-4 rounded-xl text-sm ${mensaje.tipo === 'exito' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{mensaje.texto}</div>}

        <div className="flex flex-col md:flex-row gap-4 justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex gap-3 w-full md:w-auto">
            <input type="text" placeholder="🔍 Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white w-full sm:w-80" />
            {pestana === 'asistencias' && (
              <select value={cursoFiltro} onChange={(e) => setCursoFiltro(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white">
                {LISTA_CURSOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-3">
            {pestana === 'asistencias' ? (
              <button onClick={exportarReporteAsistencias} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer">📊 Exportar Excel</button>
            ) : (
              <>
                <button onClick={descargarPlantilla} className="bg-slate-800 text-indigo-300 px-4 py-2.5 rounded-lg text-sm border border-slate-700 cursor-pointer">📥 Plantilla</button>
                <label className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer">{subiendoExcel ? 'Procesando...' : '📁 Subir Excel'}
                  <input type="file" accept=".xlsx" onChange={handleFileUpload} disabled={subiendoExcel} className="hidden" />
                </label>
                {permitidos.length > 0 && <button onClick={vaciarListaPermitidos} className="bg-rose-900/40 text-rose-300 border border-rose-800 px-3 py-2.5 rounded-lg text-sm cursor-pointer">🗑️ Vaciar</button>}
              </>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? <div className="p-8 text-center text-slate-400">Cargando...</div> : pestana === 'asistencias' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Nombre</th>
                    <th className="px-6 py-4">Cédula</th>
                    <th className="px-6 py-4">Empresa</th>
                    <th className="px-6 py-4">Curso</th>
                    <th className="px-6 py-4 text-center">Firma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtradasAsistencias.map(a => (
                    <tr key={a.id} className="hover:bg-slate-800/40">
                      <td className="px-6 py-4 text-xs text-slate-400">{new Date(a.created_at).toLocaleString('es-CO')}</td>
                      <td className="px-6 py-4 font-semibold text-white">{a.nombre_completo}</td>
                      <td className="px-6 py-4">{a.cedula}</td>
                      <td className="px-6 py-4">{a.empresa}</td>
                      <td className="px-6 py-4">{a.curso}</td>
                      <td className="px-6 py-4 text-center">
                        {a.firma && <button onClick={() => setFirmaSeleccionada(a.firma)} className="bg-white p-1 rounded"><img src={a.firma} alt="Firma" className="h-8 object-contain" /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Nombre Autorizado</th>
                    <th className="px-6 py-4">Cédula</th>
                    <th className="px-6 py-4">Empresa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filtradasPermitidos.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="px-6 py-4 font-semibold text-white">{p.nombre_completo}</td>
                      <td className="px-6 py-4">{p.cedula}</td>
                      <td className="px-6 py-4">{p.empresa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {firmaSeleccionada && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-4">
            <h3 className="text-lg font-bold text-center">Firma Digital</h3>
            <div className="bg-white p-4 rounded-xl flex justify-center"><img src={firmaSeleccionada} alt="Firma" className="max-h-48 object-contain" /></div>
            <button onClick={() => setFirmaSeleccionada(null)} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}