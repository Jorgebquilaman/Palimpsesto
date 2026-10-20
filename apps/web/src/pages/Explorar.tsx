import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import MapaBusqueda from '../components/MapaBusqueda'
import { construirConsultaBusqueda, traerBusqueda, traerCatalogos } from '../api/cliente'

export default function Explorar() {
  const [parametros, setParametros] = useSearchParams()

  const tipoId = parametros.get('tipoId') ?? ''
  const palabra = parametros.get('palabra') ?? ''

  const [textoPalabra, setTextoPalabra] = useState(palabra)
  const [palabraSincronizada, setPalabraSincronizada] = useState(palabra)
  const [tab, setTab] = useState<'palabra' | 'tipo'>('palabra')


  useEffect(() => {
    document.title = 'Exploración visual — Digesto IUPA'
  }, [])

  if (palabra !== palabraSincronizada) {
    setPalabraSincronizada(palabra)
    setTextoPalabra(palabra)
  }

  function fijarNavegacion(cambios: Record<string, string | undefined>) {
    const nuevos = new URLSearchParams(parametros)
    nuevos.delete('tipoId')
    nuevos.delete('palabra')
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === undefined || valor === '') nuevos.delete(clave)
      else nuevos.set(clave, valor)
    }
    setParametros(nuevos)
  }

  function elegirPalabra(p: string | undefined) {
    fijarNavegacion({ palabra: p })
  }

  function elegirTipo(id: string | undefined) {
    fijarNavegacion({ tipoId: id })
  }

  function enviarPalabra() {
    const p = textoPalabra.trim()
    elegirPalabra(p || undefined)
  }

  const { data: catalogos } = useQuery({ queryKey: ['catalogos'], queryFn: traerCatalogos, staleTime: 60_000 })

  const consultaNormas = useMemo(
    () => construirConsultaBusqueda({ tipoId, palabra, pageSize: 100 }),
    [tipoId, palabra],
  )

  const { data: datosPalabra } = useQuery({
    queryKey: ['explorar-normas', consultaNormas],
    queryFn: ({ signal }) => traerBusqueda(new URLSearchParams(consultaNormas), signal),
    placeholderData: (anterior) => anterior,
  })

  const esRespaldoTexto = Boolean(palabra) && palabra.trim().length >= 3 && datosPalabra?.total === 0

  const consultaRespaldo = useMemo(
    () => construirConsultaBusqueda({ q: palabra, tipoId, pageSize: 100 }),
    [tipoId, palabra],
  )

  const { data: datosRespaldo } = useQuery({
    queryKey: ['explorar-respaldo', consultaRespaldo],
    queryFn: ({ signal }) => traerBusqueda(new URLSearchParams(consultaRespaldo), signal),
    enabled: esRespaldoTexto,
    placeholderData: (anterior) => anterior,
  })

  const datosNormas = esRespaldoTexto ? datosRespaldo : datosPalabra
  const consultaVista = esRespaldoTexto ? consultaRespaldo : consultaNormas

  const tipoNombre = catalogos?.tipos.find(t => String(t.id) === tipoId)?.nombre

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
          Buscá por palabra o elegí un tipo de norma y generá el mapa conceptual o la red conceptual de los
          documentos que cumple la búsqueda.
        </p>
      </header>

      <section aria-label="Filtros del explorador" className="panel mt-4 p-4 sm:p-5">
        <div role="radiogroup" aria-label="Modo de exploración" className="flex gap-2 rounded-full bg-verde-50 p-1 dark:bg-crema-100/5 w-fit">
          {([['palabra', 'Por palabra'], ['tipo', 'Por tipo']] as const).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={tab === valor}
              onClick={() => setTab(valor)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                tab === valor ? 'bg-primario text-sobre-primario shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {tab === 'palabra' && (
          <form
            className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3"
            onSubmit={(e) => { e.preventDefault(); enviarPalabra() }}
            aria-label="Cargar el grafo por palabra clave"
          >
            <label className="min-w-[12rem] flex-1 text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Palabra clave</span>
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
        )}

        {tab === 'tipo' && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3" role="group" aria-label="Tipo de norma">
            {(catalogos?.tipos ?? []).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => elegirTipo(String(t.id) === tipoId ? undefined : String(t.id))}
                aria-pressed={String(t.id) === tipoId}
                className={`chip ${String(t.id) === tipoId ? 'chip-activo' : ''}`}
              >
                {t.nombre}
              </button>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Vista visual" className="mt-4">
        <MapaBusqueda
          consulta={consultaVista}
          normas={datosNormas?.items ?? []}
          palabra={palabra}
          onElegirPalabra={(p) => elegirPalabra(p || undefined)}
        />
      </section>

      <p className="mt-3 text-xs text-ink-faint" aria-live="polite">
        {esRespaldoTexto ? (
          <>
            La palabra “{palabra}” no coincide con ninguna palabra clave de las normas; se muestran las normas que la
            mencionan en su texto.{' '}
          </>
        ) : (
          (tipoNombre || palabra) && (
            <>
              Mostrando las normas {tipoNombre ? <>del tipo {tipoNombre.toLowerCase()}</> : null}
              {tipoNombre && palabra ? ' y ' : null}
              {palabra ? <>de la palabra “{palabra}”</> : null}.{' '}
            </>
          )
        )}
        {datosNormas?.total !== undefined && (
          <span className="num-tabulares">{datosNormas.total} normas publicadas en la vista.</span>
        )}
      </p>
    </main>
  )
}
