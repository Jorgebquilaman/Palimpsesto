import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDebounce } from '../components/useDebounce'
import { Badge, Estado, EquemaEsqueletos } from '../components/ui'
import { OrnamentoLinea } from '../components/OrnamentoLinea'
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
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'cualquiera', etiqueta: 'Cualquiera' },
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
  const { data: resumen } = useQuery({ queryKey: ['resumen-global'], queryFn: () => traerBusqueda(new URLSearchParams()), staleTime: 300_000 })

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
      <section className="hero-verde no-print relative px-4 pb-24 pt-8 sm:pb-28 sm:pt-12">
        <div className="relative mx-auto grid max-w-5xl gap-10 sm:grid-cols-[1.2fr_1fr] sm:items-center">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-crema-100/60">
              Instituto Universitario Patagónico de las Artes
            </p>
            <h1 className="font-display text-display font-semibold leading-[1.05] tracking-tight">
              Digesto<br />Normativo
            </h1>
            <p className="mt-4 max-w-md font-lectura text-sm leading-relaxed text-crema-100/75 sm:text-[15px]">
              Ordenanzas, resoluciones y declaraciones de la institución, con su texto completo
              y el PDF firmado como documento oficial.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/boletin" className="btn-acento">
                Ver boletín oficial
              </Link>
              <a href="#formulario-busqueda" className="rounded-full border border-crema-100/30 px-5 py-2.5 text-sm font-medium text-crema-100 transition-colors hover:bg-crema-100/10">
                Buscar una norma
              </a>
            </div>
          </div>
          <div className="relative hidden sm:block">
            <OrnamentoLinea className="h-20 w-full opacity-90" />
            <div className="mt-4 space-y-3 rounded-md bg-crema-100/10 p-5 backdrop-blur-sm">
              {[['✦', 'Texto completo por artículo'], ['⎙', 'PDF original firmado, siempre intacto'], ['◉', 'Estados de vigencia siempre visibles']].map(([icono, texto]) => (
                <p key={texto} className="flex items-center gap-3 text-sm text-crema-100/85">
                  <span aria-hidden="true" className="text-acento">{icono}</span>
                  {texto}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-10 mx-auto -mt-8 max-w-6xl px-4 pb-20 sm:-mt-12">
        <section id="formulario-busqueda" className="ancla-con-header panel panel-elevada rounded-lg p-4 sm:p-5" aria-label="Formulario de búsqueda">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              actualizar({ q: textoBusqueda })
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                value={textoBusqueda}
                onChange={(e) => setTextoBusqueda(e.target.value)}
                placeholder="Buscar en el texto… o una cita como Res. 123/2024"
                className="campo h-12 flex-1 text-base"
                list="sugerencias-codigos"
                aria-label="Texto de la norma"
              />
              <datalist id="sugerencias-codigos">
                {(sugerencias ?? []).map(s => (
                  <option key={s.codigo} value={s.codigo}>{s.titulo}</option>
                ))}
              </datalist>
              <button type="submit" className="btn-primario h-12 px-6">
                Buscar
              </button>
            </div>

            {sugerencias && sugerencias.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Sugerencias">
                {sugerencias.slice(0, 4).map(s => (
                  <button key={s.codigo} type="button" className="chip" onClick={() => actualizar({ q: s.codigo })}>
                    <span className="font-mono text-[10px]">{s.codigo}</span>
                    <span className="truncate max-w-[16rem]">{s.titulo}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <div role="radiogroup" aria-label="Modo de búsqueda" className="flex rounded-full bg-verde-50 p-1 dark:bg-crema-100/5">
                {MODOS.map(m => (
                  <button
                    key={m.valor}
                    type="button"
                    role="radio"
                    aria-checked={modo === m.valor}
                    onClick={() => actualizar({ modo: m.valor })}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      modo === m.valor
                        ? 'bg-primario text-sobre-primario shadow-xs'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {m.etiqueta}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={numero}
                  onChange={(e) => actualizar({ numero: e.target.value })}
                  placeholder="N°"
                  aria-label="Número de norma"
                  className="campo num-tabulares w-24"
                />
                <select
                  value={anio}
                  onChange={(e) => actualizar({ anio: e.target.value })}
                  aria-label="Año"
                  className="campo num-tabulares w-28"
                >
                  <option value="">Año</option>
                  {(catalogos?.anios ?? []).map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setFiltrosAbiertos(a => !a)}
                  aria-expanded={filtrosAbiertos}
                  className={`btn-sutil ${filtrosAbiertos ? 'bg-verde-100 dark:bg-crema-100/10' : ''}`}
                >
                  <span aria-hidden="true">{filtrosAbiertos ? '−' : '+'}</span>
                  Filtros
                </button>
              </div>
            </div>

            {filtrosAbiertos && (
              <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Tipo</span>
                  <select value={tipoId} onChange={(e) => actualizar({ tipoId: e.target.value })} className="campo">
                    <option value="">Todos</option>
                    {(catalogos?.tipos ?? []).map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Órgano emisor</span>
                  <select value={organoId} onChange={(e) => actualizar({ organoId: e.target.value })} className="campo">
                    <option value="">Todos</option>
                    {(catalogos?.organos ?? []).map(o => (
                      <option key={o.id} value={o.id}>{o.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Sanción desde</span>
                  <input type="date" value={desde} onChange={(e) => actualizar({ desde: e.target.value })} className="campo" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Sanción hasta</span>
                  <input type="date" value={hasta} onChange={(e) => actualizar({ hasta: e.target.value })} className="campo" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-ink-soft">Vigencia</span>
                  <select value={vigencia} onChange={(e) => actualizar({ vigencia: e.target.value })} className="campo">
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
            <button type="button" onClick={limpiarTodo} className="btn-sutil">
              Limpiar todo
            </button>
          </div>
        )}

        <div className="mt-8 mx-auto max-w-5xl">
          <section aria-label="Resultados">
            {isError && (
              <Estado tipo="error" titulo="Error al buscar" detalle={(error as Error)?.message ?? 'Reintentá en unos segundos.'} />
            )}

            {isPending && !resultados && <EquemaEsqueletos cantidad={4} />}

            {resultados && (
              <>
                <div className="mb-4 flex items-center justify-between border-b border-line pb-3 text-sm">
                  <p aria-live="polite" className="num-tabulares text-ink-soft">
                    <strong className="font-semibold text-ink">{resultados.total}</strong>{' '}
                    {resultados.total === 1 ? 'norma' : 'normas'}
                    <span className="ml-2 text-xs text-ink-faint">({resultados.tookMs} ms)</span>
                  </p>
                  <select
                    value={orden}
                    onChange={(e) => actualizar({ orden: e.target.value })}
                    aria-label="Orden de resultados"
                    className="campo w-auto"
                  >
                    {ORDENES.map(o => (
                      <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                    ))}
                  </select>
                </div>

                {resultados.items.length === 0 ? (
                  <Estado
                    tipo="vacio"
                    titulo="No se encontraron normas"
                    detalle="Probá con menos palabras o sin filtros."
                  />
                ) : (
                  <>
                    <ul className="space-y-4">
                      {resultados.items.map((item, indice) => (
                        <li
                          key={item.id}
                          className="panel panel-hover aparece group p-5"
                          style={{ animationDelay: `${Math.min(indice, 8) * 45}ms` }}
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Link
                              to={`/normas/${item.codigo}${q ? `?q=${encodeURIComponent(q)}` : ''}`}
                              className="num-tabulares rounded bg-verde-900 px-2 py-0.5 font-mono text-[11px] font-medium text-crema-50 dark:bg-crema-100/10 dark:text-crema-100"
                            >
                              {item.codigo}
                            </Link>
                            <Badge vigencia={item.vigencia} />
                            {item.tieneOcr && (
                              <span className="rounded bg-barro-100 px-2 py-0.5 text-[11px] font-medium text-acento-texto">
                                texto OCR
                              </span>
                            )}
                          </div>
                          <h2 className="font-lectura text-lg font-semibold leading-snug">
                            <Link
                              className="underline-offset-4 decoration-acento/0 transition-[text-decoration-color] hover:underline hover:decoration-acento/60"
                              to={`/normas/${item.codigo}${q ? `?q=${encodeURIComponent(q)}` : ''}`}
                            >
                              {item.titulo}
                            </Link>
                          </h2>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-soft">
                            <span className="font-medium">{item.tipoNombre} N° {item.numero}/{item.anio}</span>
                            <span aria-hidden="true" className="text-ink-faint">·</span>
                            {item.organoNombre}
                            <span aria-hidden="true" className="text-ink-faint">·</span>
                            sanción {item.fechaSancion}
                            {item.fechaPublicacion && (
                              <>
                                <span aria-hidden="true" className="text-ink-faint">·</span>
                                publicación {item.fechaPublicacion}
                              </>
                            )}
                          </p>
                          {item.snippet && (
                            <p
                              className="mt-3 border-l-2 border-barro-300 pl-3 font-lectura text-sm leading-relaxed text-ink-soft"
                              dangerouslySetInnerHTML={{ __html: item.snippet }}
                            />
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
        </div>
      </main>

      <footer className="no-print bg-verde-950 px-4 py-12 text-crema-100">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-display text-titulo font-semibold tracking-tight">
            El Digesto en números
          </h2>
          <div className="mt-8 grid gap-8 text-center sm:grid-cols-3">
            <ResumenPie titulo="Tipo" conteos={resumen?.facetas.tipos ?? null} />
            <ResumenPie titulo="Órgano emisor" conteos={resumen?.facetas.organos ?? null} />
            <ResumenPie titulo="Vigencia" conteos={resumen?.facetas.vigencias ?? null} vigencias />
          </div>
          <p className="mt-10 text-center text-xs text-crema-100/50">
            Digesto Normativo IUPA · Los boletines y normas del instituto
          </p>
        </div>
      </footer>
    </>
  )
}

function Paginador({ page, total, pageSize, onCambiar }: { page: number; total: number; pageSize: number; onCambiar: (page: number) => void }) {
  const paginas = Math.ceil(total / pageSize)
  if (paginas <= 1) return null
  return (
    <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-3">
      <button type="button" disabled={page <= 1} onClick={() => onCambiar(page - 1)}
        className="btn-secundario">
        ← Anterior
      </button>
      <span className="num-tabulares text-sm text-ink-soft">Página {page} de {paginas}</span>
      <button type="button" disabled={page >= paginas} onClick={() => onCambiar(page + 1)}
        className="btn-secundario">
        Siguiente →
      </button>
    </nav>
  )
}

function ResumenPie({ titulo, conteos, vigencias = false }: { titulo: string; conteos: { id: number; nombre: string; cantidad: number }[] | null; vigencias?: boolean }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-crema-100/60">
        <span aria-hidden="true" className="rombo mr-1">✦</span>{titulo}
      </h3>
      {conteos ? (
        <ul className="space-y-1.5 text-sm">
          {conteos.map(c => (
            <li key={c.id} className="flex items-baseline justify-center gap-2">
              <span>{vigencias ? (ETIQUETAS_VIGENCIA[c.nombre] ?? c.nombre) : c.nombre}</span>
              <span className="num-tabulares text-crema-100/60">{c.cantidad}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-crema-100/40">Cargando…</p>
      )}
    </div>
  )
}
