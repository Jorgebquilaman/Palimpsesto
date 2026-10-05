import { OrnamentoLinea } from './OrnamentoLinea'

export function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-titulo font-semibold tracking-tight text-ink">
      <span className="rombo">✦</span>
      {children}
    </h2>
  )
}

export function Badge({ vigencia }: { vigencia: string }) {
  const estilos: Record<string, { fondo: string; texto: string; icono: string; etiqueta: string }> = {
    vigente: { fondo: 'bg-verde-100 dark:bg-transparent', texto: 'text-vigente-texto', icono: '◉', etiqueta: 'Vigente' },
    modificada: { fondo: 'bg-crema-200 dark:bg-transparent', texto: 'text-modificada-texto', icono: '▸', etiqueta: 'Modificada' },
    derogada: { fondo: 'bg-barro-100 dark:bg-transparent', texto: 'text-derogada-texto', icono: '✕', etiqueta: 'Derogada' },
    derogada_parcialmente: { fondo: 'bg-barro-100 dark:bg-transparent', texto: 'text-derogada-texto', icono: '⊘', etiqueta: 'Derogada parcialmente' },
    deja_sin_efecto: { fondo: 'bg-verde-100 dark:bg-transparent', texto: 'text-reservada-texto', icono: '⊘', etiqueta: 'Deja sin efecto' },
  }
  const e = estilos[vigencia] ?? estilos.reservada
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold ${e.fondo} ${e.texto}`}
    >
      <span aria-hidden="true">{e.icono}</span>
      {e.etiqueta}
    </span>
  )
}

export function Estado({
  tipo,
  titulo,
  detalle,
}: {
  tipo: 'vacio' | 'cargando' | 'error'
  titulo: string
  detalle?: string
}) {
  const tono =
    tipo === 'error'
      ? 'text-derogada-texto'
      : tipo === 'cargando'
        ? 'text-ink-soft'
        : 'text-ink'
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`panel flex flex-col items-center gap-3 px-8 py-12 text-center ${tono}`}
    >
      {tipo === 'vacio' && <OrnamentoLinea className="h-20 w-56 opacity-40" />}
      {tipo === 'cargando' && <Esqueleto className="h-3 w-40" />}
      <p className="font-lectura text-lg font-semibold">{titulo}</p>
      {detalle && <p className="max-w-md text-sm text-ink-soft">{detalle}</p>}
    </div>
  )
}

export function Esqueleto({ className = '' }: { className?: string }) {
  return <div className={`esqueleto ${className}`} aria-hidden="true" />
}

export function EquemaEsqueletos({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-3">
      {Array.from({ length: cantidad }).map((_, i) => (
        <div key={i} className="panel space-y-2 p-4">
          <Esqueleto className="h-3 w-32" />
          <Esqueleto className="h-4 w-3/4" />
          <Esqueleto className="h-3 w-full" />
        </div>
      ))}
    </div>
  )
}
