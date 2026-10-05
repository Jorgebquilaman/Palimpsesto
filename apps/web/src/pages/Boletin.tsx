import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

interface BoletinListado {
  id: number
  numero: string
  fechaPublicacion: string
  observaciones: string | null
}

interface BoletinDetalle extends BoletinListado {
  normas: {
    codigoNormalizado: string
    tipo: string
    numero: number
    anio: number
    titulo: string
    fechaSancion: string
    vigencia: string
  }[]
  totalNormas: number
}

export default function Boletin() {
  const [parametros] = useSearchParams()
  const numero = parametros.get('numero')

  const { data: listado, isPending } = useQuery({
    queryKey: ['boletines'],
    queryFn: async () => {
      const r = await fetch('/api/v1/boletines')
      if (!r.ok) throw new Error('Error al cargar boletines')
      const d = await r.json()
      return d.items as BoletinListado[]
    },
  })

  const { data: detalle } = useQuery({
    queryKey: ['boletin', numero],
    queryFn: async () => {
      const r = await fetch(`/api/v1/boletines/${encodeURIComponent(numero ?? '')}`)
      if (!r.ok) throw new Error('Boletín inexistente')
      return r.json() as Promise<BoletinDetalle>
    },
    enabled: !!numero,
  })

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-sm text-ink-faint underline">← Volver</Link>
      <h1 className="mt-3 text-2xl font-bold">Boletín Oficial</h1>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]">
        <ul aria-label="Listado de boletines" className="space-y-1">
          {(listado ?? []).map(b => (
            <li key={b.id}>
              <Link to={`/boletin?numero=${encodeURIComponent(b.numero)}`}
                className={`flex items-baseline justify-between rounded-sm border px-3 py-2.5 transition-colors ${numero === b.numero
                  ? 'border-acento bg-barro-100/60'
                  : 'border-line bg-surface hover:border-verde-300 hover:bg-verde-50'}`}>
                <span className="font-medium">N° {b.numero}</span>
                <span className="num-tabulares text-xs text-ink-faint">{b.fechaPublicacion}</span>

              </Link>
            </li>
          ))}
          {isPending && <li className="text-sm text-ink-faint">Cargando…</li>}
          {listado && listado.length === 0 && <li className="text-sm text-ink-faint">No hay boletines cargados.</li>}
        </ul>

        <section aria-label="Normas del boletín">
          {detalle ? (
            <div className="panel p-4">
              <h2 className="text-lg font-bold">Boletín N° {detalle.numero}</h2>
              <p className="text-sm text-ink-soft">
                Publicado el {detalle.fechaPublicacion} · {detalle.normas.length} norma{detalle.normas.length === 1 ? '' : 's'} públicas de {detalle.totalNormas}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {detalle.normas.map(n => (
                  <li key={n.codigoNormalizado} className="rounded-sm border border-line p-2">
                    <Link className="font-medium underline" to={`/normas/${n.codigoNormalizado}`}>
                      {n.tipo} N° {n.numero}/{n.anio}
                    </Link>
                    <p className="text-xs text-ink-faint">sanción {n.fechaSancion} · {n.titulo}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="panel border-dashed p-8 text-center text-sm text-ink-faint">
              {numero ? 'Boletín no encontrado.' : 'Elegí un boletín para ver sus normas.'}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
