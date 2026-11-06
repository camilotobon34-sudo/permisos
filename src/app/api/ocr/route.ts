import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import Tesseract from 'tesseract.js'
import { extractColombianIdentity } from '@/lib/identity-ocr'

export const maxDuration = 60

const maxRequestBytes = 4 * 1024 * 1024
const maxImageBytes = 1_200_000
const maxImages = 3
const maxConcurrentJobs = 2
const require = createRequire(join(process.cwd(), 'package.json'))
let activeJobs = 0

function jsonResponse(body: object, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Solicitud no permitida.' }, 403)
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > maxRequestBytes) {
    return jsonResponse({ error: 'Las imágenes exceden el tamaño permitido.' }, 413)
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return jsonResponse({ error: 'No se pudo leer el formulario de imagen.' }, 400)
  }

  const images = formData.getAll('images').filter((entry): entry is File => entry instanceof File)
  if (images.length < 1 || images.length > maxImages) {
    return jsonResponse({ error: 'Envía entre una y tres imágenes para analizar.' }, 400)
  }

  if (images.some((image) =>
    !['image/jpeg', 'image/png', 'image/webp'].includes(image.type) ||
    image.size === 0 ||
    image.size > maxImageBytes,
  )) {
    return jsonResponse({ error: 'El formato o tamaño de imagen no es válido.' }, 400)
  }

  if (images.reduce((total, image) => total + image.size, 0) > maxRequestBytes) {
    return jsonResponse({ error: 'Las imágenes exceden el tamaño permitido.' }, 413)
  }
  if (activeJobs >= maxConcurrentJobs) {
    return jsonResponse({ error: 'El servicio está ocupado. Inténtalo de nuevo en unos segundos.' }, 429)
  }

  activeJobs += 1
  let worker: Awaited<ReturnType<typeof Tesseract.createWorker>> | undefined
  try {
    const cachePath = join(tmpdir(), 'permisos-tesseract-cache')
    await mkdir(cachePath, { recursive: true })
    const tesseractEntry = require.resolve('tesseract.js')
    const workerPath = join(dirname(tesseractEntry), 'worker-script', 'node', 'index.js')

    worker = await Tesseract.createWorker('spa', Tesseract.OEM.LSTM_ONLY, {
      workerPath,
      cachePath,
      langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/spa/4.0.0_best_int',
    })

    let best = { cedula: '', nombre: '' }
    for (const image of images) {
      const buffer = Buffer.from(await image.arrayBuffer())
      const result = await worker.recognize(buffer)
      const extracted = extractColombianIdentity(result.data.text)
      const currentScore = Number(Boolean(best.cedula)) + Number(Boolean(best.nombre))
      const extractedScore = Number(Boolean(extracted.cedula)) + Number(Boolean(extracted.nombre))

      if (extractedScore > currentScore) best = extracted
      if (extractedScore === 2) break
    }

    return jsonResponse({
      cedula: best.cedula,
      nombre: best.nombre,
      complete: Boolean(best.cedula && best.nombre),
    })
  } catch (error) {
    console.error('No se pudo procesar la imagen en el servicio OCR interno.', error)
    return jsonResponse({ error: 'No fue posible analizar la foto. Inténtalo de nuevo.' }, 500)
  } finally {
    activeJobs -= 1
    if (worker) {
      try {
        await worker.terminate()
      } catch (error) {
        console.error('No se pudo cerrar el worker OCR.', error)
      }
    }
  }
}
