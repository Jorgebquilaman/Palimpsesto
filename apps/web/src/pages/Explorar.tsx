import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ETIQUETAS_RELACION, ETIQUETAS_VIGENCIA } from '../components/etiquetas'
import { GrafoExplorador, type DatosGrafo, type RelacionGrafo } from '../components/GrafoExplorador'
import MapaBusqueda from '../components/MapaBusqueda'
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
  | { kind: 'organo'; id: string }
  | { kind: 'anio'; id: string }
  | { kind: 'vigencia'; id: string }
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
  const [textoPalabra, setTextoPalabra] = useState(palabra)
  const [palabraSincronizada, setPalabraSincronizada] = useState(palabra)

  useEffect(() => {
    document.title = 'Exploración visual — Digesto IUPA'
  }, [])

  if (palabra !== palabraSincronizada) {
    setPalabraSincronizada(palabra)
    setTextoPalabra(palabra)
  }

  const vistaVisual = parametros.get('vista') !== 'jerarquia'

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

  function fijar(cambios: Record<string, string | undefined>, borrar: string[], conSeleccion: Seleccion | null = null) {
    const nuevos = new URLSearchParams(parametros)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === undefined || valor === '') nuevos.delete(clave)
      else nuevos.set(clave, valor)
    }
    for (const clave of borrar) nuevos.delete(clave)
    setParametros(nuevos)
    setLimitePalabras(60)
    setTamanoNormas(20)
    setExpandidos([])
    setRelaciones({})
    setSeleccion(conSeleccion)
  }

  function elegirTipo(id: string) {
    fijar({ tipoId: id }, ['organoId', 'anio', 'vigencia', 'palabra'], { kind: 'tipo' })
  }

  function elegirOrgano(id: string | undefined) {
    fijar({ organoId: id }, ['anio', 'vigencia', 'palabra'], id ? { kind: 'organo', id } : null)
  }

  function elegirAnio(a: string | undefined) {
    fijar({ anio: a }, ['vigencia', 'palabra'], a ? { kind: 'anio', id: a } : null)
  }

  function elegirVigencia(v: string | undefined) {
    fijar({ vigencia: v }, ['palabra'], v ? { kind: 'vigencia', id: v } : null)
  }

  function elegirPalabra(p: string | undefined) {
    fijar({ palabra: p }, [], p ? { kind: 'palabra', id: p } : null)
  }

  function alternarVista(vista: 'jerarquia' | 'visual') {
    const nuevos = new URLSearchParams(parametros)
    if (vista === 'jerarquia') nuevos.set('vista', 'jerarquia')
    else nuevos.delete('vista')
    setParametros(nuevos)
  }

  function enviarPalabra() {
    const p = textoPalabra.trim()
    elegirPalabra(p || undefined)
  }

  function cambiarFechas(cambios: Record<string, string | undefined>) {
    const nuevos = new URLSearchParams(parametros)
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === undefined || valor === '') nuevos.delete(clave)
      else nuevos.set(clave, valor)
    }
    setParametros(nuevos)
  }

  function limpiarFiltros() {
    fijar({ organoId: undefined, anio: undefined, desde: undefined, hasta: undefined, vigencia: undefined }, ['palabra'])
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
    enabled: !!palabra || vistaVisual,
    placeholderData: (anterior) => anterior,
  })

  const consultaOrganos = useMemo(
    () => construirConsultaBusqueda({ tipoId, desde, hasta, pageSize: 1 }),
    [tipoId, desde, hasta],
  )
  const { data: datosOrganos } = useQuery({
    queryKey: ['explorar-facetas', consultaOrganos],
    queryFn: ({ signal }) => traerBusqueda(new URLSearchParams(consultaOrganos), signal),
    enabled: !!tipoId,
    placeholderData: (anterior) => anterior,
  })

  const consultaAnios = useMemo(
    () => construirConsultaBusqueda({ tipoId, organoId, desde, hasta, pageSize: 1 }),
    [tipoId, organoId, desde, hasta],
  )
  const { data: datosAnios } = useQuery({
    queryKey: ['explorar-facetas', consultaAnios],
    queryFn: ({ signal }) => traerBusqueda(new URLSearchParams(consultaAnios), signal),
    enabled: !!tipoId && !!organoId,
    placeholderData: (anterior) => anterior,
  })

  const consultaVigencias = useMemo(
    () => construirConsultaBusqueda({ tipoId, organoId, anio, desde, hasta, pageSize: 1 }),
    [tipoId, organoId, anio, desde, hasta],
  )
  const { data: datosVigencias } = useQuery({
    queryKey: ['explorar-facetas', consultaVigencias],
    queryFn: ({ signal }) => traerBusqueda(new URLSearchParams(consultaVigencias), signal),
    enabled: !!tipoId && !!organoId && !!anio,
    placeholderData: (anterior) => anterior,
  })

  const tipoNombre = catalogos?.tipos.find(t => String(t.id) === tipoId)?.nombre ?? ''
  const tipoCantidad = resumen?.facetas.tipos.find(t => String(t.id) === tipoId)?.cantidad ?? 0
  const organos = useMemo(
    () => (datosOrganos?.facetas.organos ?? []).map(o => ({ id: o.id, nombre: o.nombre, cantidad: o.cantidad })),
    [datosOrganos],
  )
  const anios = useMemo(
    () => (datosAnios?.facetas.anios ?? []).map(a => ({ anio: a.id, cantidad: a.cantidad })),
    [datosAnios],
  )
  const vigencias = useMemo(
    () => (datosVigencias?.facetas.vigencias ?? []).map(v => ({ vigencia: v.nombre, cantidad: v.cantidad })),
    [datosVigencias],
  )

  const normaSeleccionada = seleccion?.kind === 'norma' || seleccion?.kind === 'relacion' ? seleccion.id : null
  const organoNombre = organos.find(o => String(o.id) === organoId)?.nombre ?? ''
  const vigenciaNombre = vigencia ? (ETIQUETAS_VIGENCIA[vigencia] ?? vigencia) : ''

  const datos: DatosGrafo = useMemo(() => ({
    tipo: tipoId ? { nombre: tipoNombre || 'Tipo', cantidad: tipoCantidad } : null,
    organos,
    organoSeleccionado: organoId,
    anios: organoId ? anios : [],
    anioSeleccionado: anio,
    vigencias: anio ? vigencias : [],
    vigenciaSeleccionada: vigencia,
    palabras: datosPalabras?.palabras ?? [],
    palabraSeleccionada: palabra,
    normas: palabra ? (datosNormas?.items ?? []) : [],
    normaSeleccionada,
    relaciones,
    expandidos,
  }), [tipoId, tipoNombre, tipoCantidad, organos, organoId, anios, anio, vigencias, vigencia, datosPalabras, palabra, datosNormas, normaSeleccionada, relaciones, expandidos])

  const claveFiltros = [tipoId, organoId, anio, desde, hasta, vigencia].join('|')
  const claveEncuadre = [
    organos.length, organoId,
    anios.length, anio,
    vigencias.length, vigencia,
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
          <span className="rombo" aria-hidden="true">✦</span>Exploración visual
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Recorré los documentos desde el tipo de norma, pasando por órgano emisor, año, vigencia y palabras clave
          hasta cada norma y sus relaciones. Tocá un nodo para verlo, doble tocá una norma para mostrar sus relaciones.
        </p>
      </header>

      <section aria-label="Filtros del explorador" className="panel mt-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="radiogroup" aria-label="Modo de exploración" className="flex rounded-full bg-verde-50 p-1 dark:bg-crema-100/5">
            {([['jerarquia', 'Grafo jerárquico'], ['visual', 'Mapa / Red']] as const).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={(!vistaVisual && valor === 'jerarquia') || (vistaVisual && valor === 'visual')}
                onClick={() => alternarVista(valor)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  (!vistaVisual && valor === 'jerarquia') || (vistaVisual && valor === 'visual')
                    ? 'bg-primario text-sobre-primario shadow-xs'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
        <form
          className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3"
          onSubmit={(e) => { e.preventDefault(); enviarPalabra() }}
          aria-label="Cargar el grafo por palabra clave"
        >
          <label className="min-w-[12rem] flex-1 text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Palabra clave (dispara la carga del grafo)</span>
            <input
              type="search"
              value={textoPalabra}
              onChange={(e) => setTextoPalabra(e.target.value)}
              placeholder="ej.: acceso abierto, presupuesto, matrícula…"
              className="campo"
              aria-label="Palabra clave"
            />
          </label>
          <button type="submit" className="btn-primario">Grafo con palabra</button>
          {palabra && (
            <button type="button" className="btn-sutil" onClick={() => { setTextoPalabra(''); elegirPalabra(undefined) }}>
              Quitar palabra
            </button>
          )}
        </form>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3" role="group" aria-label="Tipo de norma">
          {(catalogos?.tipos ?? []).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => elegirTipo(String(t.id))}
              aria-pressed={String(t.id) === tipoId}
              className={`chip ${String(t.id) === tipoId ? 'chip-activo' : ''}`}
            >
              {t.nombre}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Sanción desde</span>
            <input type="date" value={desde} onChange={(e) => cambiarFechas({ desde: e.target.value || undefined })} className="campo" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Sanción hasta</span>
            <input type="date" value={hasta} onChange={(e) => cambiarFechas({ hasta: e.target.value || undefined })} className="campo" />
          </label>
        </div>
        <div className="mt-3">
          <button type="button" onClick={limpiarFiltros} className="btn-sutil">Limpiar filtros</button>
        </div>
      </section>

      <div className={vistaVisual ? "mt-4" : "mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"}>
        {vistaVisual ? (
          <section aria-label="Vista visual" className="min-w-0">
            <MapaBusqueda
              consulta={consultaNormas}
              normas={datosNormas?.items ?? []}
              palabra={palabra}
              onElegirPalabra={(p) => elegirPalabra(p || undefined)}
            />
          </section>
        ) : (
        <>
        <section aria-label="Grafo de documentos" className="panel min-w-0 overflow-hidden">
          <p className="num-tabulares border-b border-line px-4 py-2 text-xs text-ink-soft" aria-live="polite">
            {tipoNombre || '…'}
            {organoNombre && <> <span aria-hidden="true"> › </span> {organoNombre}</>}
            {anio && <> <span aria-hidden="true"> › </span> {anio}</>}
            {vigenciaNombre && <> <span aria-hidden="true"> › </span> {vigenciaNombre}</>}
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
                onTipo={() => setSeleccion({ kind: 'tipo' })}
                onOrgano={(id) => elegirOrgano(id)}
                onAnio={(a) => elegirAnio(a)}
                onVigencia={(v) => elegirVigencia(v)}
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
          {seleccion?.kind === 'organo' && (
            <div className="text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Órgano emisor</p>
              <p className="mt-0.5 font-semibold">{organoNombre || seleccion.id}</p>
              <p className="num-tabulares mt-1 text-ink-soft">
                {organos.find(o => String(o.id) === seleccion.id)?.cantidad ?? 0} normas
              </p>
              <p className="mt-2 text-ink-soft">Elegí un año del grafo para seguir recorriendo.</p>
              <button type="button" onClick={() => elegirOrgano(undefined)} className="btn-sutil mt-3">
                Quitar órgano
              </button>
            </div>
          )}
          {seleccion?.kind === 'anio' && (
            <div className="text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Año de sanción</p>
              <p className="num-tabulares mt-0.5 text-lg font-bold">{seleccion.id}</p>
              <p className="num-tabulares mt-1 text-ink-soft">
                {anios.find(a => String(a.anio) === seleccion.id)?.cantidad ?? 0} normas
              </p>
              <p className="mt-2 text-ink-soft">Elegí una vigencia del grafo para seguir recorriendo.</p>
              <button type="button" onClick={() => elegirAnio(undefined)} className="btn-sutil mt-3">
                Quitar año
              </button>
            </div>
          )}
          {seleccion?.kind === 'vigencia' && (
            <div className="text-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Vigencia</p>
              <div className="mt-1"><Badge vigencia={seleccion.id} /></div>
              <p className="num-tabulares mt-1 text-ink-soft">
                {vigencias.find(v => v.vigencia === seleccion.id)?.cantidad ?? 0} normas
              </p>
              <p className="mt-2 text-ink-soft">Elegí una palabra clave del grafo para ver sus normas.</p>
              <button type="button" onClick={() => elegirVigencia(undefined)} className="btn-sutil mt-3">
                Quitar vigencia
              </button>
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
        </>
        )}
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
