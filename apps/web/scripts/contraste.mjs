import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const css = readFileSync(join(raiz, 'index.css'), 'utf8')

function extraerBloque(nombre) {
  const reg = new RegExp(`${nombre.replace(/[. ：:]/g, (c) => '\\' + c)}\\s*\\{([\\s\\S]*?)\\n\\}`)
  const m = css.match(reg)
  if (!m) {
    throw new Error(`No se encontró el bloque ${nombre}`)
  }
  const valores = {}
  for (const linea of m[1].split('\n')) {
    const pm = linea.match(/^\s*--([a-z0-9-]+):\s*([^;]+);/)
    if (pm) {
      valores[pm[1]] = pm[2].trim()
    }
  }
  return valores
}

function hexAListaHex(valor) {
  const m = valor.match(/^#([0-9a-f]{6})$/i)
  if (!m) {
    throw new Error(`Valor no es hex de 6 dígitos: ${valor}`)
  }
  return m[1]
}

function luminancia(hex) {
  const sep = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = sep.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(hex1, hex2) {
  const l1 = luminancia(hex1)
  const l2 = luminancia(hex2)
  const claro = Math.max(l1, l2)
  const oscuro = Math.min(l1, l2)
  return (claro + 0.05) / (oscuro + 0.05)
}

function resolverValor(variables, valor, profundidad = 0) {
  if (profundidad > 10) {
    throw new Error(`Referencia circular al resolver: ${valor}`)
  }
  const m = valor.match(/^var\(--([a-z0-9-]+)\)$/)
  if (m) {
    const siguiente = variables[m[1]]
    if (!siguiente) {
      throw new Error(`Variable sin valor en el bloque: --${m[1]}`)
    }
    return resolverValor(variables, siguiente, profundidad + 1)
  }
  return valor
}

// [nombre, texto, fondo, mínimo, modo ('claro'|'oscuro'|'ambos')]
const paresDefinidos = [
  ['texto/canvas', 'text', 'bg', 4.5, 'ambos'],
  ['texto/surface', 'text', 'surface', 4.5, 'ambos'],
  ['texto-atenuado/canvas', 'text-muted', 'bg', 4.5, 'ambos'],
  ['texto-atenuado/surface', 'text-muted', 'surface', 4.5, 'ambos'],
  ['sobre-primario/primario (botones)', 'on-primary', 'primary', 4.5, 'ambos'],
  ['sobre-acento/acento (botón pill)', 'on-acento', 'accent', 4.5, 'ambos'],
  ['acento-texto/canvas', 'accent-text', 'bg', 4.5, 'ambos'],
  ['acento-texto/surface', 'accent-text', 'surface', 4.5, 'ambos'],
  ['vigente-texto/verde-100 (badge claro)', 'vigente-texto', 'verde-100', 4.5, 'claro'],
  ['modificada-texto/crema-200 (badge claro)', 'modificada-texto', 'crema-200', 4.5, 'claro'],
  ['derogada-texto/barro-100 (badge claro)', 'derogada-texto', 'barro-100', 4.5, 'claro'],
  ['reservada-texto/verde-100 (badge claro)', 'reservada-texto', 'verde-100', 4.5, 'claro'],
  ['vigente-texto/surface (badge oscuro)', 'vigente-texto', 'surface', 4.5, 'oscuro'],
  ['modificada-texto/surface (badge oscuro)', 'modificada-texto', 'surface', 4.5, 'oscuro'],
  ['derogada-texto/surface (badge oscuro)', 'derogada-texto', 'surface', 4.5, 'oscuro'],
  ['reservada-texto/surface (badge oscuro)', 'reservada-texto', 'surface', 4.5, 'oscuro'],
]

const claroBloque = extraerBloque(':root')
const oscuroBruto = extraerBloque('.dark')
// El bloque .dark solo redefine una parte de los tokens; los demás heredan de :root (cascada).
const oscuroBloque = { ...claroBloque, ...oscuroBruto }

function evaluar(bloque, modo) {
  const fallos = []
  for (const [nombre, a, b, minimo, modoPar] of paresDefinidos) {
    if (modoPar !== 'ambos' && modoPar !== modo) {
      continue
    }
    const hexA = hexAListaHex(resolverValor(bloque, bloque[a]))
    const hexB = hexAListaHex(resolverValor(bloque, bloque[b]))
    const c = contraste(hexA, hexB)
    if (c < minimo) {
      fallos.push(`${nombre}: ${c.toFixed(2)}:1 < ${minimo}:1`)
    }
  }
  return fallos
}

const claroF = evaluar(claroBloque, 'claro')
const oscuroF = evaluar(oscuroBloque, 'oscuro')

if (claroF.length > 0 || oscuroF.length > 0) {
  console.error('FALLA contraste WCAG AA:')
  claroF.forEach((f) => console.error('  [claro]  ' + f))
  oscuroF.forEach((f) => console.error('  [oscuro] ' + f))
  process.exit(1)
}

console.log('Contraste WCAG AA correcto para', paresDefinidos.length, 'pares (claro y oscuro).')
