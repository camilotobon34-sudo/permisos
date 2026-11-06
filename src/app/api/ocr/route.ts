import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'
import Tesseract from 'tesseract.js'
import { extractColombianIdentity } from '@/lib/identity-ocr'

export const maxDuration = 60

const maxRequestBytes = 4 * 1024 * 1024
const maxImageBytes = 1_200_000
const maxImages = 3
const maxConcurrentJobs = 2
const minNameWordsForHighConfidence = 3
const require = createRequire(join(process.cwd(), 'package.json'))
let activeJobs = 0

function jsonResponse(body: object, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

function scoreIdentity(identity: { cedula: string; nombre: string }) {
  const nameWordCount = identity.nombre ? identity.nombre.split(/\s+/).length : 0
  const complete = Boolean(identity.cedula && nameWordCount >= 2)
  return {
    complete,
    highConfidence: Boolean(identity.cedula && nameWordCount >= minNameWordsForHighConfidence),
    score: Number(Boolean(identity.cedula)) * 10 + Math.min(nameWordCount, 6),
  }
}

async function createPreprocessedVariants(input: Buffer) {
  const image = sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })

  const [normalized, contrast] = await Promise.all([
    image.clone().greyscale().normalize().sharpen().jpeg({ quality: 90 }).toBuffer(),
    image.clone().greyscale().normalize().linear(1.25, -18).sharpen().jpeg({ quality: 90 }).toBuffer(),
  ])
  return [normalized, contrast]
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
    let bestScore = scoreIdentity(best).score
    let foundHighConfidence = false
    for (const image of images) {
      const buffer = Buffer.from(await image.arrayBuffer())
      const variants = await createPreprocessedVariants(buffer)
      for (const variant of variants) {
        const result = await worker.recognize(variant)
        const extracted = extractColombianIdentity(result.data.text)
        const quality = scoreIdentity(extracted)

        if (quality.score > bestScore) {
          best = extracted
          bestScore = quality.score
        }
        if (quality.highConfidence) {
          best = extracted
          foundHighConfidence = true
          break
        }
      }
      if (foundHighConfidence) break
    }

    const complete = scoreIdentity(best).complete
    return jsonResponse({
      cedula: complete ? best.cedula : '',
      nombre: complete ? best.nombre : '',
      complete,
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
