export interface TiposNorma {
  id: number
  codigo: string
  nombre: string
  alcance: string
}

export interface Organos {
  id: number
  codigo: string
  nombre: string
  padreId: number | null
}

export interface Catalogo {
  tipos: TiposNorma[]
  organos: Organos[]
  anios: number[]
  vigencias: string[]
}

export interface FacetaConteo {
  id: number
  nombre: string
  cantidad: number
}

export interface Facetas {
  tipos: FacetaConteo[]
  organos: FacetaConteo[]
  anios: FacetaConteo[]
  vigencias: FacetaConteo[]
}

export interface ResultadoItem {
  id: string
  codigo: string
  tipoCodigo: string
  tipoNombre: string
  organoNombre: string
  numero: number
  anio: number
  titulo: string
  fechaSancion: string
  fechaPublicacion: string | null
  vigencia: string
  snippet: string | null
  tieneOcr: boolean
}

export interface ResultadoBusqueda {
  items: ResultadoItem[]
  facetas: Facetas
  total: number
  tookMs: number
  codigoCitaDirecta: string | null
}

export interface NormaDetalle {
  id: string
  codigoNormalizado: string
  tipo: { codigo: string; nombre: string }
  organo: { codigo: string; nombre: string }
  numero: number
  anio: number
  sufijo: string | null
  titulo: string
  resumen: string | null
  palabrasClave: string[] | null
  expediente: string | null
  fechaSancion: string
  fechaPublicacion: string | null
  boletin: { numero: string; fechaPublicacion: string } | null
  vigencia: string
  textoOrigen: number
  calidadOcr: number | null
  estadoPublicacion: number
}

export interface Fragmento {
  orden: number
  tipo: string
  etiqueta: string | null
  texto: string
  html: string | null
  paginaDesde: number | null
  paginaHasta: number | null
}

const BASE = '/api/v1'

async function pedir<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`${BASE}${ruta}`)
  if (!respuesta.ok) {
    throw new Error(`Error ${respuesta.status} en ${ruta}`)
  }
  return respuesta.json() as Promise<T>
}

export function traerCatalogos(): Promise<Catalogo> {
  return pedir('/catalogos')
}

export function traerSugerencias(q: string): Promise<{ codigo: string; titulo: string }[]> {
  return pedir(`/sugerencias?q=${encodeURIComponent(q)}`)
}

export function construirConsultaBusqueda(parametros: {
  q?: string
  modo?: string
  numero?: string
  anio?: string
  tipoId?: string
  organoId?: string
  desde?: string
  hasta?: string
  vigencia?: string
  orden?: string
  page?: number
}): string {
  const sp = new URLSearchParams()
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === null || valor === '' || valor === 0 || (clave === 'page' && valor === 1)) {
      continue
    }
    sp.set(clave === 'page' ? 'page' : clave, String(valor))
  }
  return sp.toString()
}

export function traerBusqueda(sp: URLSearchParams, _senal?: AbortSignal): Promise<ResultadoBusqueda> {
  const qs = sp.toString()
  return pedir(`/normas${qs ? `?${qs}` : ''}`)
}

export function traerNorma(codigo: string): Promise<NormaDetalle> {
  return pedir(`/normas/${encodeURIComponent(codigo)}`)
}

export function traerFragmentos(codigo: string): Promise<{ codigo: string; fragmentos: Fragmento[] }> {
  return pedir(`/normas/${encodeURIComponent(codigo)}/html`)
}

export function traerRelaciones(codigo: string): Promise<{
  origen: { direccion: string; tipo: string; detalle: string | null; normaDestino: { codigoNormalizado: string; titulo: string } }[]
  destino: { direccion: string; tipo: string; detalle: string | null; normaOrigen: { codigoNormalizado: string; titulo: string } }[]
}> {
  return pedir(`/normas/${encodeURIComponent(codigo)}/relaciones`)
}
