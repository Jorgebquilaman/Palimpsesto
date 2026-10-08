import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ETIQUETAS_RELACION, ETIQUETAS_VIGENCIA } from '../components/etiquetas'
import { GrafoExplorador, type DatosGrafo, type RelacionGrafo } from '../components/GrafoExplorador'
import { Badge, Estado } from '../components/ui'
import {
  construirConsultaBusqueda,
  traerBusqueda,
  traerCatalogos,
  traerPalabrasClave,
  traerRelaciones,
} from '../api/cliente'

type Seleccion =
  | { kind: 'tipo' }
  | { kind: 'palabra'; id: string }
  | { kind: 'norma'; id: string }
  | { kind: 'relacion'; id: string; origen: string; tipoRelacion: string }

export default function Explorar() {
  const [parametros, setParametros] = useSearchParams()

  const tipoId = parametros.get('tipoId') ?? ''
  const organoId = parametros.get('organoId') ?? ''
  const anio = parametros.get('anio') ?? ''
  const desde = parametros.get('desde') ?? ''
  const hasta = parametros.get('hasta') ?? ''
  const vigencia = parametros.get('vigencia') ?? ''
  const palabra = parametros.get('palabra') ?? ''

  const [limitePalabras, setLimitePalabras] = useState(60)
  const [tamanoNormas, setTamanoNormas] = useState(20)
  const [expandidos, setExpandidos] = useState<string[]>([])
  const [relaciones, setRelaciones] = useState<Record<string, RelacionGrafo[]>>({})
  const [cargandoRel, setCargandoRel] = useState<string[]>([])
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)

  useEffect(() => {
    document.title = 'Explorar por grafo — Digesto IUPA'
  }, [])

  const { data: catalogos } = useQuery({ queryKey: ['catalogos'], queryFn: traerCatalogos, staleTime: 60_000 })
  const { data: resumen } = useQuery({ queryKey: ['resumen-global'], queryFn: () => traerBusqueda(new URLSearchParams()), staleTime: 300_000 })

  useEffect(() => {
    if (tipoId || !resumen) return
    const top = [...(resumen.facetas.tipos ?? [])].sort((a, b) => b.cantidad - a.cantidad)[0]
    if (top) {
      setParametros(prev => {
        const nuevos = new URLSearchParams(prev)
        nuevos.set('tipoId', String(top.id))
        return nuevos
      }, { replace: true })
    }
  }, [resumen, tipoId, setParametros])

  function actualizar(cambios: Record<string, string | undefined>, conservarPalabra = false) {
    const nuevos = new URLSearchParams(parametros)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === undefined || valor === '') nuevos.delete(clave)
      else nuevos.set(clave, valor)
    }
    if (!conservarPalabra && !('palabra' in cambios)) nuevos.delete('palabra')
    setParametros(nuevos)
  }

  function reiniciarExpansion() {
    setLimitePalabras(60)
    setTamanoNormas(20)
    setExpandidos([])
    setRelaciones({})
    setSeleccion(null)
  }

  function cambiarFiltros(cambios: Record<string, string | undefined>) {
    actualizar(cambios)
    reiniciarExpansion()
  }

  function elegirPalabra(p: string | undefined) {
    actualizar({ palabra: p }, true)
    setTamanoNormas(20)
    setExpandidos([])
    setRelaciones({})
    setSeleccion(p ? { kind: 'palabra', id: p } : null)
  }

  function limpiarFiltros() {
    cambiarFiltros({ organoId: undefined, anio: undefined, desde: undefined, hasta: undefined, vigencia: undefined })
  }

  async function alternarRelaciones(codigo: string) {
    if (expandidos.includes(codigo)) {
      setExpandidos(e => e.filter(c => c !== codigo))
      return
    }
    setExpandidos(e => [...e, codigo])
    if (relaciones[codigo]) return
    setCargandoRel(c => [...c, codigo])
    try {
      const r = await traerRelaciones(codigo)
      const lista: RelacionGrafo[] = [
        ...r.origen.map(x => ({ tipo: x.tipo, direccion: 'saliente' as const, codigo: x.normaDestino.codigoNormalizado, titulo: x.normaDestino.titulo })),
        ...r.destino.map(x => ({ tipo: x.tipo, direccion: 'entrante' as const, codigo: x.normaOrigen.codigoNormalizado, titulo: x.normaOrigen.titulo })),
      ]
      setRelaciones(m => ({ ...m, [codigo]: lista }))
    } catch {
      setExpandidos(e => e.filter(c => c !== codigo))
    } finally {
      setCargandoRel(c => c.filter(x => x !== codigo))
    }
  }

  const { data: datosPalabras, isPending: cargandoPalabras } = useQuery({
    queryKey: ['palabras', tipoId, organoId, anio, desde, hasta, vigencia, limitePalabras],
    queryFn: () => traerPalabrasClave({ tipoId, organoId, desde, hasta, anio, vigencia, limite: limitePalabras }),
    enabled: !!tipoId,
    placeholderData: (anterior) => anterior,
  })

  const consultaNormas = useMemo(
    () => construirConsultaBusqueda({ tipoId, organoId, desde, hasta, anio, vigencia, palabra, page: 1, pageSize: tamanoNormas }),
    [tipoId, organoId, desde, hasta, anio, vigencia, palabra, tamanoNormas],
  )

  const { data: datosNormas } = useQuery({
    queryKey: ['explorar-normas', consultaNormas],
    queryFn: ({ signal }) => traerBusqueda(new URLSearchParams(consultaNormas), signal),
    enabled: !!palabra,
    placeholderData: (anterior) => anterior,
  })

  const tipoNombre = catalogos?.tipos.find(t => String(t.id) === tipoId)?.nombre ?? ''
  const tipoCantidad = resumen?.facetas.tipos.find(t => String(t.id) === tipoId)?.cantidad ?? 0

  const normaSeleccionada = seleccion?.kind === 'norma' || seleccion?.kind === 'relacion' ? seleccion.id : null

  const datos: DatosGrafo = useMemo(() => ({
    tipo: tipoId ? { nombre: tipoNombre || 'Tipo', cantidad: tipoCantidad } : null,
    palabras: datosPalabras?.palabras ?? [],
    palabraSeleccionada: palabra,
    normas: palabra ? (datosNormas?.items ?? []) : [],
    normaSeleccionada,
    relaciones,
    expandidos,
  }), [tipoId, tipoNombre, tipoCantidad, datosPalabras, palabra, datosNormas, normaSeleccionada, relaciones, expandidos])

  const claveFiltros = [tipoId, organoId, anio, desde, hasta, vigencia].join('|')
  const claveEncuadre = [
    datos.palabras.length,
    datos.palabraSeleccionada,
    datos.normas.length,
    datos.expandidos.join(','),
    Object.values(datos.relaciones).reduce((acc, r) => acc + r.length, 0),
  ].join('|')

  const normaDetalle = seleccion?.kind === 'norma'
    ? datosNormas?.items.find(n => n.codigo === seleccion.id) ?? null
    : null
  const relacionDetalle = seleccion?.kind === 'relacion'
    ? Object.values(relaciones).flat().find(r => r.codigo === seleccion.id) ?? null
    : null

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-10">
      <Link to="/" className="text-sm text-ink-faint underline hover:text-ink">
        ← Volver a la búsqueda
      </Link>

      <header className="mt-3">
        <h1 className="font-display text-titulo font-semibold tracking-tight">
          <span className="rombo" aria-hidden="true">✦</span>Explorar por grafo
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Recorré los documentos desde el tipo de norma, pasando por las palabras clave hasta cada norma y sus relaciones.
          Tocá un nodo para verlo, doble tocá una norma para mostrar sus relaciones.
        </p>
      </header>

      <section aria-label="Filtros del explorador" className="panel mt-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de norma">
          {(catalogos?.tipos ?? []).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => cambiarFiltros({ tipoId: String(t.id) })}
              aria-pressed={String(t.id) === tipoId}
              className={`chip ${String(t.id) === tipoId ? 'chip-activo' : ''}`}
            >
              {t.nombre}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Órgano emisor</span>
            <select value={organoId} onChange={(e) => cambiarFiltros({ organoId: e.target.value || undefined })} className="campo">
              <option value="">Todos</option>
              {(catalogos?.organos ?? []).map(o => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Año</span>
            <select value={anio} onChange={(e) => cambiarFiltros({ anio: e.target.value || undefined })} className="campo num-tabulares">
              <option value="">Todos</option>
              {(catalogos?.anios ?? []).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Sanción desde</span>
            <input type="date" value={desde} onChange={(e) => cambiarFiltros({ desde: e.target.value || undefined })} className="campo" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Sanción hasta</span>
            <input type="date" value={hasta} onChange={(e) => cambiarFiltros({ hasta: e.target.value || undefined })} className="campo" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Vigencia</span>
            <select value={vigencia} onChange={(e) => cambiarFiltros({ vigencia: e.target.value || undefined })} className="campo">
              <option value="">Todas</option>
              {(catalogos?.vigencias ?? []).map(v => (
                <option key={v} value={v}>{ETIQUETAS_VIGENCIA[v] ?? v}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3">
          <button type="button" onClick={limpiarFiltros} className="btn-sutil">Limpiar filtros</button>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="Grafo de documentos" className="panel min-w-0 overflow-hidden">
          <p className="num-tabulares border-b border-line px-4 py-2 text-xs text-ink-soft" aria-live="polite">
            {tipoNombre || '…'}
            {palabra && <> <span aria-hidden="true"> › </span> {palabra}</>}
            {normaSeleccionada && <> <span aria-hidden="true"> › </span> {normaSeleccionada}</>}
          </p>
          <div className="h-[62vh] min-h-[420px]">
            {!tipoId || (cargandoPalabras && !datosPalabras) ? (
              <div className="grid h-full place-items-center p-6">
                <Estado tipo="cargando" titulo="Armando el grafo…" detalle="Agregando las palabras clave del tipo seleccionado." />
              </div>
            ) : (datosPalabras?.palabras.length ?? 0) === 0 ? (
              <div className="grid h-full place-items-center p-6">
                <Estado tipo="vacio" titulo="Sin palabras clave" detalle="Ninguna norma con estos filtros tiene palabras clave cargadas." />
              </div>
            ) : (
              <GrafoExplorador
                key={claveFiltros}
                datos={datos}
                claveEncuadre={claveEncuadre}
                onPalabra={(p) => elegirPalabra(p)}
                onNorma={(codigo) => setSeleccion({ kind: 'norma', id: codigo })}
                onRelacion={(codigo, origen, tipoRelacion) => setSeleccion({ kind: 'relacion', id: codigo, origen, tipoRelacion })}
                onDobleNorma={(codigo) => void alternarRelaciones(codigo)}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-sm">
            <p className="text-xs text-ink-faint">
              <span aria-hidden="true" className="mr-1 inline-block h-px w-4 bg-ink-faint align-middle" /> contiene
              <span aria-hidden="true" className="ml-3 mr-1 inline-block h-px w-4 bg-acento align-middle" /> modifica / deroga / reglamenta…
            </p>
            <span className="ml-auto flex flex-wrap gap-2">
              {datosPalabras?.hayMas && (
                <button
                  type="button"
                  onClick={() => setLimitePalabras(l => Math.min(l + 60, 200))}
                  className="btn-sutil"
                >
                  Ver más palabras
                </button>
              )}
              {palabra && datosNormas && datosNormas.total > datosNormas.items.length && (
                <button
                  type="button"
                  onClick={() => setTamanoNormas(t => Math.min(t + 20, 100))}
                  className="btn-sutil"
                >
                  Ver más normas ({datosNormas.total - datosNormas.items.length} restantes)
                </button>
              )}
            </span>
          </div>
        </section>

        <aside aria-label="Detalle del nodo" className="panel min-w-0 self-start p-4 sm:p-5 lg:sticky lg:top-24 lg:max-h-[75vh] lg:overflow-auto">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">
            <span className="rombo" aria-hidden="true">✦</span>Detalle
          </h2>
          {!seleccion && (
            <p className="text-sm text-ink-soft">Tocá un nodo del grafo para ver su detalle y seguir recorriendo.</p>
          )}
          {seleccion?.kind === 'tipo' && (
            <div className="text-sm">
              <p className="font-semibold">{tipoNombre}</p>
              <p className="num-tabulares mt-1 text-ink-soft">{tipoCantidad} {tipoCantidad === 1 ? 'norma publicada' : 'normas publicadas'}</p>
              <p className="mt-2 text-ink-soft">Elegí una palabra clave del grafo para ver sus normas.</p>
            </div>
          )}
          {seleccion?.kind === 'palabra' && (
            <div className="text-sm">
              <p className="font-semibold">“{seleccion.id}”</p>
              <p className="num-tabulares mt-1 text-ink-soft">
                {datosNormas && palabra === seleccion.id ? datosNormas.total : '…'} {datosNormas?.total === 1 ? 'norma' : 'normas'} con esta palabra
              </p>
              {palabra !== seleccion.id || !datosNormas ? (
                <button type="button" onClick={() => elegirPalabra(seleccion.id)} className="btn-primario mt-3">
                  Ver normas
                </button>
              ) : (
                <button type="button" onClick={() => elegirPalabra(undefined)} className="btn-sutil mt-3">
                  Ocultar normas
                </button>
              )}
            </div>
          )}
          {seleccion?.kind === 'norma' && normaDetalle && (
            <div className="text-sm">
              <p className="num-tabulares font-mono text-xs text-ink-soft">{normaDetalle.codigo}</p>
              <p className="mt-1 font-semibold leading-snug">{normaDetalle.titulo}</p>
              <div className="mt-2"><Badge vigencia={normaDetalle.vigencia} /></div>
              <p className="mt-2 text-[13px] text-ink-soft">
                {normaDetalle.tipoNombre} N° {normaDetalle.numero}/{normaDetalle.anio} · {normaDetalle.organoNombre}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/normas/${normaDetalle.codigo}`} className="btn-primario">
                  Abrir ficha
                </Link>
                <button
                  type="button"
                  onClick={() => void alternarRelaciones(normaDetalle.codigo)}
                  disabled={cargandoRel.includes(normaDetalle.codigo)}
                  className="btn-secundario disabled:opacity-50"
                >
                  {expandidos.includes(normaDetalle.codigo)
                    ? 'Ocultar relaciones'
                    : cargandoRel.includes(normaDetalle.codigo) ? 'Cargando…' : 'Mostrar relaciones'}
                </button>
              </div>
            </div>
          )}
          {seleccion?.kind === 'relacion' && relacionDetalle && (
            <div className="text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-acento-texto">
                {ETIQUETAS_RELACION[relacionDetalle.tipo] ?? relacionDetalle.tipo}
              </p>
              <RelacionDetalle relacion={relacionDetalle} origen={seleccion.origen} />
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

function RelacionDetalle({ relacion, origen }: { relacion: RelacionGrafo; origen: string }) {
  return (
    <>
      <p className="num-tabulares mt-1 font-mono text-xs text-ink-soft">{relacion.codigo}</p>
      <p className="mt-1 font-semibold leading-snug">{relacion.titulo}</p>
      <p className="mt-2 text-[13px] text-ink-soft">
        Relacionada con {origen}
      </p>
      <Link to={`/normas/${relacion.codigo}`} className="btn-primario mt-3">
        Abrir ficha
      </Link>
    </>
  )
}
