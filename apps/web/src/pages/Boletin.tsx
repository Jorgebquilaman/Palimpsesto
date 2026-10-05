import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { VisorPdf } from '../components/VisorPdf'
import { useDebounce } from '../components/useDebounce'
import { Badge } from '../components/ui'

interface BoletinListado {
  id: number
  numero: string
  fechaPublicacion: string
  observaciones: string | null
  tienePdf: boolean
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

const porPagina = 10

export default function Boletin() {
  const { numero: numeroRuta } = useParams()
  const [parametros] = useSearchParams()
  const numero = numeroRuta ?? parametros.get('numero')

  if (numero) {
    return <DetalleBoletin numero={numero} />
  }
  return <ListadoBoletines />
}

function ListadoBoletines() {
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const textoDebounced = useDebounce(busqueda, 350)

  useEffect(() => { setPagina(1) }, [textoDebounced])

  const { data: listado, isPending, isError, error } = useQuery({
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

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="text-center">
        <h1 className="font-display text-titulo font-semibold tracking-tight">Boletín Oficial</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Cada publicación del boletín con las normas que la integran y su documento original
        </p>
      </header>

      <form className="mx-auto mt-6 max-w-md" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número u observaciones…"
          aria-label="Buscar boletines"
          className="campo w-full"
        />
      </form>

      <div className="mt-6">
        {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
        {isPending && <p aria-live="polite" className="text-sm text-ink-faint">Cargando…</p>}

        {listado && (
          <>
            {listado.items.length === 0 ? (
              <p className="panel border-dashed p-8 text-center text-sm text-ink-faint">
                {textoDebounced ? `Sin boletines que coincidan con “${textoDebounced}”.` : 'Aún no hay boletines cargados.'}
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listado.items.map(b => (
                  <li key={b.id}>
                    <Link
                      to={`/boletines/${encodeURIComponent(b.numero)}`}
                      className="panel block p-4 transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-lg font-semibold">N° {b.numero}</span>
                        {b.tienePdf && <span title="Tiene PDF cargado" aria-label="Tiene PDF" className="text-acento">⎙</span>}
                      </div>
                      <p className="num-tabulares mt-1 text-xs text-ink-faint">Publicado el {b.fechaPublicacion}</p>
                      {b.observaciones && <p className="mt-2 line-clamp-2 text-xs text-ink-soft">{b.observaciones}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <nav aria-label="Paginación de boletines" className="mt-8 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina <= 1} className="btn-secundario px-3 py-1.5 disabled:opacity-40">
                ← Anterior
              </button>
              <span className="num-tabulares text-sm text-ink-soft">
                Página {pagina} de {totalPaginas}
              </span>
              <button type="button" onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas} className="btn-secundario px-3 py-1.5 disabled:opacity-40">
                Siguiente →
              </button>
            </nav>
          </>
        )}
      </div>
    </main>
  )
}

function DetalleBoletin({ numero }: { numero: string }) {
  const [pestana, setPestana] = useState<'normas' | 'pdf'>('normas')

  const { data: detalle, isError } = useQuery({
    queryKey: ['boletin', numero],
    queryFn: async () => {
      const r = await fetch(`/api/v1/boletines/${encodeURIComponent(numero)}`)
      if (!r.ok) throw new Error('Boletín inexistente')
      return r.json() as Promise<BoletinDetalle>
    },
    retry: false,
  })

  useEffect(() => { setPestana('normas') }, [numero])

  if (isError) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <LinkVolver />
        <div className="panel mt-4 p-8 text-center">
          <h1 className="text-lg font-bold text-derogada-texto">Boletín no encontrado</h1>
          <p className="mt-1 text-sm text-derogada-texto">El boletín N° {numero} no existe.</p>
        </div>
      </main>
    )
  }

  if (!detalle) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <LinkVolver />
        <p aria-live="polite" className="mt-6 text-sm text-ink-faint">Cargando…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <LinkVolver />

      <header className="panel mt-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-display text-xl font-bold">Boletín N° {detalle.numero}</h1>
          <p className="num-tabulares text-sm text-ink-soft">Publicado el {detalle.fechaPublicacion}</p>
        </div>
        {detalle.observaciones && <p className="mt-2 text-sm text-ink-soft">{detalle.observaciones}</p>}
        <p className="mt-2 text-xs text-ink-faint">
          {detalle.normas.length} normas públicas de {detalle.totalNormas} cargadas
        </p>

        <div role="tablist" aria-label="Secciones del boletín" className="mt-4 flex gap-5 border-t border-line pt-3">
          <button role="tab" aria-selected={pestana === 'normas'} onClick={() => setPestana('normas')}
            className={`border-b-2 px-1 pb-1 text-sm font-medium transition-colors ${pestana === 'normas' ? 'border-acento text-acento-texto' : 'border-transparent text-ink-faint hover:text-ink'}`}>
            Normas ({detalle.normas.length})
          </button>
          {detalle.tienePdf && (
            <button role="tab" aria-selected={pestana === 'pdf'} onClick={() => setPestana('pdf')}
              className={`border-b-2 px-1 pb-1 text-sm font-medium transition-colors ${pestana === 'pdf' ? 'border-acento text-acento-texto' : 'border-transparent text-ink-faint hover:text-ink'}`}>
              PDF original
            </button>
          )}
        </div>
      </header>

      {pestana === 'normas' && (
        <section aria-label="Normas del boletín" className="mt-4">
          {detalle.normas.length === 0 ? (
            <p className="panel border-dashed p-8 text-center text-sm text-ink-faint">
              Todavía no hay normas públicas asociadas a este boletín.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {detalle.normas.map(n => (
                <li key={n.codigoNormalizado}>
                  <Link to={`/normas/${n.codigoNormalizado}`} className="panel block p-4 transition-shadow hover:shadow-md">
                    <span className="font-semibold">{n.tipo} N° {n.numero}/{n.anio}</span>
                    <Badge vigencia={n.vigencia} />
                    <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{n.titulo}</p>
                    <p className="num-tabulares mt-1 text-xs text-ink-faint">sanción {n.fechaSancion}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {pestana === 'pdf' && (
        <section aria-label="PDF del boletín" className="mt-4">
          <VisorPdf pdfUrl={`/api/v1/boletines/${encodeURIComponent(numero)}/pdf`} />
        </section>
      )}
    </main>
  )
}

function LinkVolver() {
  return <Link to="/boletin" className="text-sm text-ink-faint underline hover:text-ink">← Todos los boletines</Link>
}
