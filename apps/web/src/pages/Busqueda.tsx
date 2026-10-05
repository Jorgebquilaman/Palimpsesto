import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDebounce } from '../components/useDebounce'
import {
  construirConsultaBusqueda,
  traerBusqueda,
  traerCatalogos,
  traerSugerencias,
} from '../api/cliente'

const ETIQUETAS_VIGENCIA: Record<string, string> = {
  vigente: 'Vigente',
  modificada: 'Modificada',
  derogada: 'Derogada',
  derogada_parcialmente: 'Derogada parcialmente',
  deja_sin_efecto: 'Deja sin efecto',
}

const MODOS = [
  { valor: 'todas', etiqueta: 'Todas las palabras' },
  { valor: 'cualquiera', etiqueta: 'Cualquiera de las palabras' },
  { valor: 'frase', etiqueta: 'Frase exacta' },
]

const ORDENES = [
  { valor: 'relevancia', etiqueta: 'Relevancia' },
  { valor: 'fecha_desc', etiqueta: 'Más recientes' },
  { valor: 'fecha_asc', etiqueta: 'Más antiguas' },
]

export default function Busqueda() {
  const [parametros, setParametros] = useSearchParams()

  const q = parametros.get('q') ?? ''
  const modo = parametros.get('modo') ?? 'todas'
  const numero = parametros.get('numero') ?? ''
  const anio = parametros.get('anio') ?? ''
  const tipoId = parametros.get('tipoId') ?? ''
  const organoId = parametros.get('organoId') ?? ''
  const desde = parametros.get('desde') ?? ''
  const hasta = parametros.get('hasta') ?? ''
  const vigencia = parametros.get('vigencia') ?? ''
  const orden = parametros.get('orden') ?? 'relevancia'
  const page = Number(parametros.get('page') ?? '1')

  const [textoBusqueda, setTextoBusqueda] = useState(q)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const textoDebounced = useDebounce(textoBusqueda, 350)

  useEffect(() => {
    setTextoBusqueda(q)
  }, [q])


  function actualizar(cambios: Record<string, string | number | undefined>) {
    const nuevos = new URLSearchParams(parametros)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === undefined || valor === '' || valor === 0) {
        nuevos.delete(clave)
      } else {
        nuevos.set(clave, String(valor))
      }
    }
    if (!('page' in cambios)) {
      nuevos.delete('page')
    }
    setParametros(nuevos)
  }

  function limpiarTodo() {
    setParametros(new URLSearchParams())
    setTextoBusqueda('')
  }

  const { data: catalogos } = useQuery({ queryKey: ['catalogos'], queryFn: traerCatalogos, staleTime: 60_000 })

  const { data: sugerencias } = useQuery({
    queryKey: ['sugerencias', textoDebounced],
    queryFn: () => traerSugerencias(textoDebounced),
    enabled: textoDebounced.trim().length >= 2,
    staleTime: 30_000,
  })

  const consulta = useMemo(
    () => construirConsultaBusqueda({ q, modo, numero, anio, tipoId, organoId, desde, hasta, vigencia, orden, page }),
    [q, modo, numero, anio, tipoId, organoId, desde, hasta, vigencia, orden, page],
  )

  const { data: resultados, isPending, isError, error } = useQuery({
    queryKey: ['busqueda', consulta],
    queryFn: ({ signal }) => traerBusqueda(new URLSearchParams(consulta), signal),
    placeholderData: (anterior) => anterior,
  })

  const chipsActivos = [
    q && { etiqueta: `Texto: ${q}`, clave: 'q' },
    numero && { etiqueta: `N° ${numero}`, clave: 'numero' },
    anio && { etiqueta: `Año ${anio}`, clave: 'anio' },
    tipoId && { etiqueta: catalogos?.tipos.find(t => String(t.id) === tipoId)?.nombre ?? 'Tipo', clave: 'tipoId' },
    organoId && { etiqueta: catalogos?.organos.find(o => String(o.id) === organoId)?.nombre ?? 'Órgano', clave: 'organoId' },
    desde && { etiqueta: `Desde ${desde}`, clave: 'desde' },
    hasta && { etiqueta: `Hasta ${hasta}`, clave: 'hasta' },
    vigencia && { etiqueta: ETIQUETAS_VIGENCIA[vigencia] ?? vigencia, clave: 'vigencia' },
  ].filter(Boolean) as { etiqueta: string; clave: string }[]

  return (
    <>
      <section className="hero-verde no-print relative px-4 pb-10 pt-14 sm:pb-14">
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-crema-100/70">
            Instituto Universitario Patagónico de las Artes
          </p>
          <h1 className="font-display text-display font-semibold tracking-tight">
            Búsqueda de normas
          </h1>
          <p className="mx-auto mt-3 max-w-lg font-lectura text-sm opacity-80 sm:text-base">
            El PDF firmado es el documento oficial.{' '}
            <Link to="/boletin" className="underline underline-offset-2">
              Boletín Oficial →
            </Link>
          </p>
        </div>
      </section>

      <main className="mx-auto -mt-7 max-w-6xl px-4 pb-16 sm:-mt-10">
      <section aria-label="Formulario de búsqueda" className="panel panel-elevada rounded-lg p-4 sm:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            actualizar({ q: textoBusqueda })
          }}
        >
          <div className="grid gap-3 md:grid-cols-4">
            <label className="md:col-span-4">
              <span className="sr-only">Texto de la norma</span>
              <input
                type="search"
                value={textoBusqueda}
                onChange={(e) => setTextoBusqueda(e.target.value)}
                placeholder="Buscar en el texto, o una cita como Res. 123/2024"
                className="campo"
                list="sugerencias-codigos"
              />
              {sugerencias && sugerencias.length > 0 && (
                <>
                  <datalist id="sugerencias-codigos">
                    {sugerencias.map(s => (
                      <option key={s.codigo} value={s.codigo}>{s.titulo}</option>
                    ))}
                  </datalist>
                  <ul className="mt-1 text-xs text-ink-faint dark:text-ink-faint" aria-label="Sugerencias">
                    {sugerencias.slice(0, 3).map(s => (
                      <li key={s.codigo}>
                        <button type="button" className="underline hover:text-ink" onClick={() => actualizar({ q: s.codigo })}>
                          {s.titulo}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </label>

            <fieldset className="md:col-span-2">
              <legend className="mb-1 text-xs font-medium text-ink-soft">Modo de búsqueda</legend>
              <div className="flex flex-wrap gap-3 text-sm">
                {MODOS.map(m => (
                  <label key={m.valor} className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="modo"
                      checked={modo === m.valor}
                      onChange={() => actualizar({ modo: m.valor })}
                    />
                    <span>{m.etiqueta}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="text-sm">
              <span className="sr-only">Número</span>
              <input
                type="number"
                inputMode="numeric"
                value={numero}
                onChange={(e) => actualizar({ numero: e.target.value })}
                placeholder="Número"
                className="campo"
              />
            </label>

            <label className="text-sm">
              <span className="sr-only">Año</span>
              <select
                value={anio}
                onChange={(e) => actualizar({ anio: e.target.value })}
                className="campo"
              >
                <option value="">Año</option>
                {(catalogos?.anios ?? []).map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFiltrosAbiertos(a => !a)}
              aria-expanded={filtrosAbiertos}
              className="text-sm font-medium text-acento-texto underline"
            >
              {filtrosAbiertos ? 'Ocultar filtros avanzados' : 'Filtros avanzados'}
            </button>
            <button type="submit" className="btn-primario">
              Buscar
            </button>
          </div>

          {filtrosAbiertos && (
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <label className="text-sm">
                Tipo
                <select value={tipoId} onChange={(e) => actualizar({ tipoId: e.target.value })}
                  className="mt-1 campo">
                  <option value="">Todos</option>
                  {(catalogos?.tipos ?? []).map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Órgano emisor
                <select value={organoId} onChange={(e) => actualizar({ organoId: e.target.value })}
                  className="mt-1 campo">
                  <option value="">Todos</option>
                  {(catalogos?.organos ?? []).map(o => (
                    <option key={o.id} value={o.id}>{o.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Sanción desde
                <input type="date" value={desde} onChange={(e) => actualizar({ desde: e.target.value })}
                  className="mt-1 campo" />
              </label>
              <label className="text-sm">
                Sanción hasta
                <input type="date" value={hasta} onChange={(e) => actualizar({ hasta: e.target.value })}
                  className="mt-1 campo" />
              </label>
              <label className="text-sm">
                Vigencia
                <select value={vigencia} onChange={(e) => actualizar({ vigencia: e.target.value })}
                  className="mt-1 campo">
                  <option value="">Todas</option>
                  {(catalogos?.vigencias ?? []).map(v => (
                    <option key={v} value={v}>{ETIQUETAS_VIGENCIA[v] ?? v}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </form>
      </section>

      {chipsActivos.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
          {chipsActivos.map(chip => (
            <button
              key={chip.clave}
              type="button"
              onClick={() => actualizar({ [chip.clave]: undefined })}
              className="chip chip-activo"
            >
              {chip.etiqueta} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" onClick={limpiarTodo} className="text-xs underline text-ink-soft">
            limpiar filtros
          </button>
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <section aria-label="Resultados">
          {isError && (
            <p role="alert" className="panel p-4 text-sm text-derogada-texto">
              Error al buscar: {(error as Error)?.message ?? 'intente de nuevo'}
            </p>
          )}

          {isPending && !resultados && <p aria-live="polite" className="text-sm text-ink-faint">Cargando resultados…</p>}

          {resultados && (
            <>
              <div className="mb-3 flex items-center justify-between text-sm text-ink-soft">
                <p aria-live="polite">
                  {resultados.total} norma{resultados.total === 1 ? '' : 's'} · {resultados.tookMs} ms
                </p>
                <label className="flex items-center gap-2">
                  Orden
                  <select value={orden} onChange={(e) => actualizar({ orden: e.target.value })}
                    className="rounded border border-gray-300 bg-transparent px-1 py-0.5 dark:border-gray-700">
                    {ORDENES.map(o => (
                      <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                    ))}
                  </select>
                </label>
              </div>

              {resultados.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
                  <p className="font-medium">No se encontraron normas.</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Probá con menos palabras o sin filtros.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="space-y-3">
                    {resultados.items.map(item => (
                      <li key={item.id} className="panel p-4">
                        <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-faint dark:text-ink-faint">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono dark:bg-gray-800">{item.codigo}</span>
                          <BadgeVigencia vigencia={item.vigencia} />
                          {item.tieneOcr && <span className="rounded bg-barro-100 px-1.5 py-0.5 text-acento-texto">texto OCR</span>}
                        </p>
                        <h2 className="font-semibold">
                          <Link className="underline-offset-2 hover:underline" to={`/normas/${item.codigo}${q ? `?q=${encodeURIComponent(q)}` : ''}`}>
                            {item.tipoNombre} N° {item.numero}/{item.anio} — {item.titulo}
                          </Link>
                        </h2>
                        <p className="mt-1 text-sm text-ink-soft">
                          {item.organoNombre} · sanción {item.fechaSancion}
                          {item.fechaPublicacion && <> · publicación {item.fechaPublicacion}</>}
                        </p>
                        {item.snippet && (
                          <p className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: item.snippet }} />
                        )}
                      </li>
                    ))}
                  </ul>

                  <Paginador
                    page={page}
                    total={resultados.total}
                    pageSize={20}
                    onCambiar={p => actualizar({ page: p })}
                  />
                </>
              )}
            </>
          )}
        </section>

        <aside aria-label="Facetas" className="space-y-4">
          {resultados?.facetas.tipos && resultados.facetas.tipos.length > 0 && (
            <Faceta titulo="Tipo" conteos={resultados.facetas.tipos}
              seleccionar={(id) => actualizar({ tipoId: id === undefined ? undefined : String(id), organoId: undefined })}
              nombreActivo={tipoId} />
          )}
          {resultados?.facetas.organos && resultados.facetas.organos.length > 0 && (
            <Faceta titulo="Órgano emisor" conteos={resultados.facetas.organos}
              seleccionar={(id) => actualizar({ organoId: id === undefined ? undefined : String(id), tipoId: undefined })}
              nombreActivo={organoId} />
          )}
          {resultados?.facetas.vigencias && resultados.facetas.vigencias.length > 0 && (
            <Faceta titulo="Vigencia" conteos={resultados.facetas.vigencias}
              seleccionar={(id) => actualizar({ vigencia: id === undefined ? undefined : String(id) })}
              nombreActivo={vigencia}
              formatear={(nombre) => ETIQUETAS_VIGENCIA[nombre] ?? nombre} />
          )}
        </aside>
      </div>

    </main>
    </>
  )
}

function BadgeVigencia({ vigencia }: { vigencia: string }) {
  const estilos: Record<string, string> = {
    vigente: 'bg-verde-100 text-vigente-texto',
    modificada: 'bg-crema-200 text-modificada-texto',
    derogada: 'bg-barro-100 text-derogada-texto',
    derogada_parcialmente: 'bg-barro-100 text-derogada-texto',
    deja_sin_efecto: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  }
  return (
    <span className={`rounded px-1.5 py-0.5 ${estilos[vigencia] ?? 'bg-gray-100 text-gray-700'}`}>
      {ETIQUETAS_VIGENCIA[vigencia] ?? vigencia}
    </span>
  )
}

function Faceta({
  titulo,
  conteos,
  seleccionar,
  formatear = (s) => s,
  nombreActivo,
}: {
  titulo: string
  conteos: { id: number; nombre: string; cantidad: number }[]
  seleccionar: (id: number | undefined) => void
  formatear?: (nombre: string) => string
  nombreActivo?: string
}) {
  return (
    <div className="panel p-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint dark:text-ink-faint">{titulo}</h3>
      <ul className="space-y-1 text-sm">
        {conteos.map(c => {
          const seleccionado = nombreActivo === String(c.id)
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => seleccionar(seleccionado ? undefined : c.id)}
                className={`flex w-full items-center justify-between rounded px-1 py-0.5 text-left hover:bg-verde-50 ${seleccionado ? 'font-semibold text-blue-700 dark:text-blue-400' : ''}`}
                aria-pressed={seleccionado}
              >
                <span>{formatear(c.nombre)}</span>
                <span className="text-xs text-ink-faint dark:text-ink-faint">{c.cantidad}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Paginador({ page, total, pageSize, onCambiar }: { page: number; total: number; pageSize: number; onCambiar: (page: number) => void }) {
  const paginas = Math.ceil(total / pageSize)
  if (paginas <= 1) return null
  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center gap-2">
      <button type="button" disabled={page <= 1} onClick={() => onCambiar(page - 1)}
        className="btn-secundario px-3 py-1">
        ← Anterior
      </button>
      <span className="text-sm text-ink-soft">Página {page} de {paginas}</span>
      <button type="button" disabled={page >= paginas} onClick={() => onCambiar(page + 1)}
        className="btn-secundario px-3 py-1">
        Siguiente →
      </button>
    </nav>
  )
}
