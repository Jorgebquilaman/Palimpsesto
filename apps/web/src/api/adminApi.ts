const BASE = '/api/v1'

const TOKEN_CLAVE = 'digesto-accessToken'

function leerClave(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave)
  } catch {
    return null
  }
}

function escribirClave(clave: string, valor: string) {
  try {
    window.localStorage.setItem(clave, valor)
  } catch {
  }
}

function borrarClave(clave: string) {
  try {
    window.localStorage.removeItem(clave)
  } catch {
  }
}

export function tokenActual(): string | null {
  return leerClave(TOKEN_CLAVE)
}

export function guardarToken(token: string, nombre: string, rol: string) {
  escribirClave(TOKEN_CLAVE, token)
  escribirClave('digestoNombre', nombre)
  escribirClave('digestoRol', rol)
}

export function cerrarSesion() {
  borrarClave(TOKEN_CLAVE)
  borrarClave('digestoNombre')
  borrarClave('digestoRol')
}

export function sesionActual(): { nombre: string; rol: string } | null {
  const token = leerClave(TOKEN_CLAVE)
  if (!token) return null
  return {
    nombre: leerClave('digestoNombre') ?? '',
    rol: leerClave('digestoRol') ?? '',
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

export interface EstadoAi {
  configurada: boolean
  modelo: string
  clave: string | null
}

export interface ResultadoAi {
  camposAplicados: string[]
  relacionesCreadas: { codigoDestino: string; tipoRelacion: string }[]
  advertencias: string[]
}

export function pedirAiEstado(): Promise<EstadoAi> {
  return pedirAdmin<EstadoAi>('/admin/ai')
}

export function guardarAi(clave: string | null, modelo: string | null, baseUrl: string | null): Promise<unknown> {
  return pedirAdmin('/admin/ai', { method: 'PUT', body: JSON.stringify({ claveApi: clave, modelo, baseUrl }) })
}

export function probarAi(): Promise<{ ok: boolean; detalle: string }> {
  return pedirAdmin<{ ok: boolean; detalle: string }>('/admin/ai/probar', { method: 'POST' })
}

export function completarConAi(normaId: string): Promise<ResultadoAi> {
  return pedirAdmin<ResultadoAi>(`/admin/ai/normas/${normaId}/completar`, { method: 'POST' })
}

export function limpiarNorma(normaId: string): Promise<unknown> {
  return pedirAdmin(`/admin/normas/${normaId}/limpiar`, { method: 'POST' })
}

export function eliminarNorma(normaId: string): Promise<unknown> {
  return pedirAdmin(`/admin/normas/${normaId}`, { method: 'DELETE' })
}

export interface EventoProgresoAi {
  etapa: string
  detalle: string | null
}

export interface FinalProgresoAi {
  estado: 'exito' | 'error'
  camposAplicados?: string[]
  relacionesCreadas?: { codigoDestino: string; tipoRelacion: string }[]
  advertencias?: string[]
  detalle?: string
}

export function completarConAiStream(
  normaId: string,
  onEvento: (evento: EventoProgresoAi) => void,
): Promise<FinalProgresoAi> {
  return new Promise(async (resolver, rechazar) => {
    try {
      const respuesta = await fetch(`/api/v1/admin/ai/normas/${normaId}/completar-stream`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenActual() ?? ''}` },
      })
      if (!respuesta.ok || !respuesta.body) {
        rechazar(new Error(`Error ${respuesta.status}`))
        return
      }
      const lector = respuesta.body.getReader()
      const decodificador = new TextDecoder()
      let pendiente = ''
      let final: FinalProgresoAi | null = null
      for (;;) {
        const { done, value } = await lector.read()
        if (done) break
        pendiente += decodificador.decode(value, { stream: true })
        const lineas = pendiente.split('\n')
        pendiente = lineas.pop() ?? ''
        for (const linea of lineas) {
          const limpio = linea.trim()
          if (!limpio) continue
          const dato = JSON.parse(limpio)
          if (dato.estado) {
            final = dato as FinalProgresoAi
          } else if (dato.etapa) {
            onEvento(dato as EventoProgresoAi)
          }
        }
      }
      if (final) resolver(final)
      else rechazar(new Error('La AI terminó sin responder'))
    } catch (e) {
      rechazar(e as Error)
    }
  })
}
