const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '.env.local') })

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])

async function findImages(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const images = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      images.push(...(await findImages(entryPath)))
    } else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      images.push(entryPath)
    }
  }

  return images
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local')
  }

  const downloadsPath = path.join(os.homedir(), 'Downloads')
  const images = (await findImages(downloadsPath)).sort((a, b) => a.localeCompare(b))
  if (images.length === 0) {
    throw new Error('No se encontraron imágenes JPG, JPEG o PNG en la carpeta Downloads')
  }

  const imageBuffer = await fs.readFile(images[0])
  const fotoCedulaUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
  let httpStatus = null
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (input, init) => {
        const response = await fetch(input, init)
        httpStatus = response.status
        return response
      },
    },
  })

  const { error } = await supabase.from('asistencias').insert([
    {
      cedula_extraida_ocr: '1036943054',
      nombre_extraido_ocr: 'Camilo Tobon',
      empresa_nombre: 'Prueba SAS',
      curso: 'Trabajo en alturas – Trabajador autorizado',
      foto_cedula_url: fotoCedulaUrl,
      firma: 'data:image/png;base64,firmafalsa123',
      fecha: '2026-11-12',
      hora: '13:40:00',
      gps: 'N/A',
      metodo: 'test_local',
    },
  ])

  if (error) {
    console.error('Error devuelto por Supabase:')
    console.log("ERROR SUPABASE COMPLETO:", JSON.stringify(error, null, 2))
    console.dir(error, { depth: null })
    console.error(
      JSON.stringify(
        {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          status: error.status ?? httpStatus,
          statusCode: error.statusCode,
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  console.log('INSERT completado correctamente en asistencias.')
}

main().catch((error) => {
  console.error('No se pudo ejecutar la prueba:', error.message)
  process.exitCode = 1
})
