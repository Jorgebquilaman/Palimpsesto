import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { VisorPdf } from '../components/VisorPdf'
import { useDebounce } from '../components/useDebounce'

interface BoletinListado {
  id: number
  numero: string
  fechaPublicacion: string
  observaciones: string | null
}

interface BoletinDetalle extends BoletinListado {
  tienePdf: boolean
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
  const { numero: numeroRuta } = useParams()
  const [parametros] = useSearchParams()
  const numero = numeroRuta ?? parametros.get('numero')
  const [pestana, setPestana] = useState<'normas' | 'pdf'>('normas')

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const porPagina = 10
  const textoDebounced = useDebounce(busqueda, 350)

  useEffect(() => { setPagina(1) }, [textoDebounced])

  const { data: listado, isPending } = useQuery({
    queryKey: ['boletines', textoDebounced, pagina],
    queryFn: async () => {
      const sp = new URLSearchParams({ page: String(pagina), pageSize: String(porPagina) })
      if (textoDebounced.trim().length > 0) sp.set('q', textoDebounced.trim())
      const r = await fetch(`/api/v1/boletines?${sp}`)
      if (!r.ok) throw new Error('Error al cargar boletines')
      return (await r.json()) as { total: number; items: BoletinListado[] }
    },
    placeholderData: (anterior) => anterior,
  })
  const totalPaginas = Math.max(1, Math.ceil((listado?.total ?? 0) / porPagina))

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
      <h1 className="mt-3 text-center font-display text-titulo font-semibold tracking-tight">
        Boletín Oficial
      </h1>
      <p className="mt-1 text-center text-sm text-ink-faint">
        Cada publicación con las normas que la integran
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="mb-3">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por número u observaciones"
            aria-label="Buscar boletines"
            className="campo w-full"
          />
        </div>
        <ul aria-label="Listado de boletines" className="space-y-1">
          {(listado?.items ?? []).map((b: BoletinListado) => (
            <li key={b.id}>
              <Link to={`/boletines/${encodeURIComponent(b.numero)}`}
                className={`flex items-baseline justify-between rounded-sm border px-3 py-2.5 transition-colors ${numero === b.numero
                  ? 'border-acento bg-barro-100/60'
                  : 'border-line bg-surface hover:border-verde-300 hover:bg-verde-50'}`}>
                <span className="font-medium">N° {b.numero}</span>
                <span className="num-tabulares text-xs text-ink-faint">{b.fechaPublicacion}</span>

              </Link>
            </li>
          ))}
          {isPending && <li className="text-sm text-ink-faint">Cargando…</li>}
          {listado && listado.items.length === 0 && (
            <li className="text-sm text-ink-faint">
              {textoDebounced ? `Sin boletines que coincidan con “${textoDebounced}”.` : 'No hay boletines cargados.'}
            </li>
          )}
        </ul>
        <nav aria-label="Paginación de boletines" className="mt-3 flex items-center justify-between text-xs text-ink-faint">
          <button type="button" onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1}
            className="btn-secundario px-2 py-1 disabled:opacity-40">← Anterior</button>
          <span>Página {pagina} de {totalPaginas}</span>
          <button type="button" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas}
            className="btn-secundario px-2 py-1 disabled:opacity-40">Siguiente →</button>
        </nav>

        <section aria-label="Detalle del boletín">
          {detalle ? (
            <div className="panel p-4">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="text-lg font-bold">Boletín N° {detalle.numero}</h2>
                <span className="text-sm text-ink-soft">
                  Publicado el {detalle.fechaPublicacion} · {detalle.normas.length} norma{detalle.normas.length === 1 ? '' : 's'} públicas de {detalle.totalNormas}
                </span>
              </div>
              <div role="tablist" aria-label="Secciones del boletín" className="mt-3 flex gap-4 border-b border-line">
                <button role="tab" aria-selected={pestana === 'normas'} onClick={() => setPestana('normas')}
                  className={`-mb-px border-b-2 px-1 pb-2 pt-1 text-sm font-medium ${pestana === 'normas' ? 'border-acento text-acento-texto' : 'border-transparent text-ink-faint hover:text-ink'}`}>
                  Normas
                </button>
                {detalle.tienePdf && (
                  <button role="tab" aria-selected={pestana === 'pdf'} onClick={() => setPestana('pdf')}
                    className={`-mb-px border-b-2 px-1 pb-2 pt-1 text-sm font-medium ${pestana === 'pdf' ? 'border-acento text-acento-texto' : 'border-transparent text-ink-faint hover:text-ink'}`}>
                    PDF original
                  </button>
                )}
              </div>
              {pestana === 'pdf' && <div className="mt-4"><VisorPdf pdfUrl={`/api/v1/boletines/${encodeURIComponent(numero ?? '')}/pdf`} /></div>}
              {pestana === 'normas' && (
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
              )}
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
