const BASE = '/api/v1'

const TOKEN_CLAVE = 'digesto-accessToken'

export function tokenActual(): string | null {
  return localStorage.getItem(TOKEN_CLAVE)
}

export function guardarToken(token: string, nombre: string, rol: string) {
  localStorage.setItem(TOKEN_CLAVE, token)
  localStorage.setItem('digestoNombre', nombre)
  localStorage.setItem('digestoRol', rol)
}

export function cerrarSesion() {
  localStorage.removeItem(TOKEN_CLAVE)
  localStorage.removeItem('digestoNombre')
  localStorage.removeItem('digestoRol')
}

export function sesionActual(): { nombre: string; rol: string } | null {
  const token = localStorage.getItem(TOKEN_CLAVE)
  if (!token) return null
  return {
    nombre: localStorage.getItem('digestoNombre') ?? '',
    rol: localStorage.getItem('digestoRol') ?? '',
  }
}

export async function pedirAdmin<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const token = tokenActual()
  const respuesta = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.body && !(opciones.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
  })
  if (respuesta.status === 401) {
    cerrarSesion()
    throw new Error('Sesión expirada: iniciá sesión de nuevo')
  }
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    throw new Error(`Error ${respuesta.status}: ${detalle || respuesta.statusText}`)
  }
  if (respuesta.status === 204) return undefined as T
  return respuesta.json() as Promise<T>
}

export interface NormaAdminListado {
  id: string
  codigoNormalizado: string
  tipo: string
  organo: string
  numero: number
  anio: number
  titulo: string
  fechaSancion: string
  estado: string
  visibilidad: number
  vigencia: number
}

export interface NormaAdminDetalle {
  id: string
  codigoNormalizado: string
  tipoNormaId: number
  tipoNombre: string
  organoEmisorId: number
  organoNombre: string
  numero: number
  anio: number
  sufijo: string | null
  titulo: string
  resumen: string | null
  palabrasClave: string[] | null
  expediente: string | null
  fechaSancion: string
  fechaPublicacion: string | null
  boletinId: number | null
  vigencia: string
  visibilidad: string
  estado: string
  textoOrigen: string
  archivos: { id: string; nombreOriginal: string; sha256: string; bytes: number; paginas: number; rol: string }[]
  fragmentos: { orden: number; tipo: string; etiqueta: string | null; texto: string; html: string | null; paginaDesde: number | null; paginaHasta: number | null }[]
}

export interface ProcesoAdmin {
  id: number
  normaId: string
  estado: number
  etapa: string | null
  intentos: number
  error: string | null
  lockedAt: string | null
}

export interface CatalogosAdmin {
  tipos: { id: number; codigo: string; nombre: string; alcance: string; activo: boolean }[]
  organos: { id: number; codigo: string; nombre: string; padreId: number | null; activo: boolean }[]
  materias: { id: number; nombre: string; slug: string; padreId: number | null }[]
}

export interface RegistroAuditoria {
  id: number
  usuario: string
  entidad: string
  entidadId: string
  accion: string
  antes: string | null
  despues: string | null
  fecha: string
}

export const ETIQUETAS_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  procesando: 'Procesando',
  en_revision: 'En revisión',
  publicada: 'Publicada',
  archivada: 'Archivada',
}

export const ETIQUETAS_VIGENCIA: Record<string, string> = {
  vigente: 'Vigente',
  modificada: 'Modificada',
  derogada: 'Derogada',
  derogada_parcialmente: 'Derogada parcialmente',
  deja_sin_efecto: 'Deja sin efecto',
}

export interface CrearUsuarioRequest {
  usuario: string
  email: string
  nombre: string
  contrasenia: string
  rol: string
}

export const ETIQUETAS_VISIBILIDAD: Record<string, string> = {
  publica: 'Pública',
  interna: 'Interna',
  reservada: 'Reservada',
}
