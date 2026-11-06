const ignoredNameWords = new Set([
  'REPUBLICA', 'DE', 'COLOMBIA', 'IDENTIFICACION', 'PERSONAL', 'CEDULA',
  'CIUDADANIA', 'TARJETA', 'IDENTIDAD', 'NUMERO', 'APELLIDOS', 'NOMBRES',
  'FIRMA', 'NACIMIENTO', 'ESTATURA', 'SANGRE', 'SEXO', 'MASCULINO',
  'FEMENINO', 'FECHA', 'LUGAR', 'LA', 'EL', 'NUIP', 'COL', 'DEPARTAMENTO',
  'BOLIVAR', 'CUNDINAMARCA', 'REGISTRADURIA', 'NACIONAL', 'DOCUMENTO',
  'EXPEDICION', 'VENCIMIENTO', 'VENCE', 'ESTADO', 'CIVIL', 'ORGANIZACION',
  'ELECTORAL', 'EXPEDIDA', 'EN', 'DEL', 'LOS', 'LAS', 'Y',
])

const institutionalNamePattern = new RegExp(
  [...ignoredNameWords]
    .filter((word) => word.length >= 4)
    .sort((a, b) => b.length - a.length)
    .join('|'),
  'g',
)
const dateLabelPattern = /\b(FECHA|NACIMIENTO|EXPEDICION|VENCIMIENTO|VENCE)\b/
const numberLabelPattern = /NUMERO/
const nextFieldLabelPattern = /\b(NUMERO|APELLIDOS|NOMBRES|FECHA|NACIMIENTO|EXPEDICION|VENCIMIENTO|FIRMA|SEXO|ESTATURA|SANGRE|LUGAR)\b/

function normalizeOcrLine(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9.\s,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameWords(value: string) {
  return normalizeOcrLine(value)
    .replace(institutionalNamePattern, ' ')
    .split(/[\s.,-]+/)
    .filter((word) => /^[A-Z]{2,}$/.test(word) && !ignoredNameWords.has(word))
}

export function sanitizeColombianName(value: string) {
  return nameWords(value).join(' ')
}

function extractNamePart(lines: string[], label: 'APELLIDOS' | 'NOMBRES') {
  const result: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const labelIndex = lines[index].indexOf(label)
    if (labelIndex < 0) continue

    const inlineText = lines[index].slice(labelIndex + label.length)
    const inlineStop = nextFieldLabelPattern.exec(inlineText)
    const inlineNames = nameWords(inlineStop ? inlineText.slice(0, inlineStop.index) : inlineText)
    if (inlineNames.length) {
      result.push(...inlineNames)
      continue
    }

    for (const candidate of lines.slice(index + 1, index + 4)) {
      if (nextFieldLabelPattern.test(candidate) || dateLabelPattern.test(candidate) || /\d/.test(candidate)) break
      const names = nameWords(candidate)
      if (names.length) {
        result.push(...names)
        break
      }
    }
  }

  return result
}

function extractDocumentNumber(line: string) {
  const candidates = [...line.matchAll(/(?:^|[^\d])(\d(?:[\d\s.,;:/()_-]*\d){7,9})(?!\d)/g)]
    .map((match) => match[1].replace(/\D/g, ''))
    .filter((number) => /^\d{8,10}$/.test(number))
  return candidates[0] ?? ''
}

export function extractColombianIdentity(text: string) {
  const lines = text.split(/\r?\n/).map(normalizeOcrLine).filter(Boolean)
  let cedula = ''

  for (let index = 0; index < lines.length; index += 1) {
    const label = numberLabelPattern.exec(lines[index])
    if (!label || label.index === undefined) continue

    cedula = extractDocumentNumber(lines[index].slice(label.index + label[0].length))
    if (cedula) break

    for (const candidate of lines.slice(index + 1, index + 3)) {
      if (nextFieldLabelPattern.test(candidate) || dateLabelPattern.test(candidate)) break
      cedula = extractDocumentNumber(candidate)
      if (cedula) break
    }
    if (cedula) break
  }

  const surnames = extractNamePart(lines, 'APELLIDOS')
  const givenNames = extractNamePart(lines, 'NOMBRES')

  return {
    cedula,
    nombre: [...surnames, ...givenNames].join(' '),
  }
}
