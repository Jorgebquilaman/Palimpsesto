import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  traerFragmentos,
  traerNorma,
  traerRelaciones,
} from '../api/cliente'
import { Badge } from '../components/ui'

const NOMBRE_TIPO: Record<string, string> = {
  encabezado: 'Encabezado',
  visto: 'Visto',
  considerando: 'Considerando',
  parte_dispositiva: 'Parte dispositiva',
  articulo: 'Artículo',
  anexo: 'Anexo',
  pagina: 'Página',
}

const PESTANAS = [
  ['texto', 'Texto'],
  ['pdf', 'PDF original'],
  ['relaciones', 'Relaciones'],
  ['metadatos', 'Metadatos'],
] as const

export default function Norma() {
  const { codigo = '' } = useParams()
  const [parametros] = useSearchParams()
  const q = parametros.get('q') ?? ''
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number][0]>('texto')
  const [terminoInterior, setTerminoInterior] = useState('')
  const [mensaje, setMensaje] = useState('')

  const { data: norma, isError } = useQuery({
    queryKey: ['norma', codigo],
    queryFn: () => traerNorma(codigo),
    retry: false,
  })

  const { data: texto } = useQuery({
    queryKey: ['norma-html', codigo],
    queryFn: () => traerFragmentos(codigo),
    enabled: !!norma,
  })

  const { data: relaciones } = useQuery({
    queryKey: ['norma-relaciones', codigo],
    queryFn: () => traerRelaciones(codigo),
    enabled: !!norma,
  })

  useEffect(() => {
    if (isError) {
      document.title = 'Norma no encontrada — Digesto IUPA'
    } else if (norma) {
      document.title = `${norma.codigoNormalizado} — Digesto IUPA`
    }
  }, [norma, isError])

  useEffect(() => {
    if (!mensaje) return
    const t = setTimeout(() => setMensaje(''), 3000)
    return () => clearTimeout(t)
  }, [mensaje])

  function copiar(contenido: string, msj: string) {
    void navigator.clipboard.writeText(contenido)
    setMensaje(msj)
  }

  function copiarCita() {
    if (!norma) return
    const cita = `${norma.tipo.nombre} N° ${norma.numero}/${norma.anio} del ${norma.organo.nombre} (${norma.codigoNormalizado}), sancionada el ${norma.fechaSancion}. Disponible en: ${window.location.origin}/normas/${norma.codigoNormalizado}`
    copiar(cita, 'Cita copiada al portapapeles')
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Link to={q ? `/?q=${encodeURIComponent(q)}` : '/'} className="text-sm text-ink-faint underline hover:text-ink">
        ← Volver a la búsqueda
      </Link>

      {isError && (
        <div className="mt-6 panel p-6">
          <h1 className="text-lg font-bold text-derogada-texto">Norma no encontrada</h1>
          <p className="text-sm text-derogada-texto">El código {codigo} no existe o no está publicada.</p>
        </div>
      )}

      {norma && (
        <>
          <header className="mt-3 panel p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="num-tabulares rounded bg-verde-900 px-2 py-0.5 font-mono text-[11px] font-medium text-crema-50 dark:bg-crema-100/10 dark:text-crema-100">
                {norma.codigoNormalizado}
              </span>
              <Badge vigencia={norma.vigencia} />
              {norma.textoOrigen === 2 && (
                <span
                  className="rounded bg-barro-100 px-2 py-0.5 text-[11px] font-medium text-acento-texto"
                  title="Este texto fue obtenido por OCR y puede contener errores"
                >
                  texto OCR
                </span>
              )}
            </div>
            <h1 className="font-lectura text-2xl font-bold leading-tight tracking-tight sm:text-[26px]">
              {norma.tipo.nombre} N° {norma.numero}/{norma.anio} — {norma.titulo}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-soft">
              <span className="font-medium text-ink">{norma.organo.nombre}</span>
              <span aria-hidden="true" className="text-ink-faint">·</span>
              sanción {norma.fechaSancion}
              {norma.fechaPublicacion && (
                <>
                  <span aria-hidden="true" className="text-ink-faint">·</span>
                  publicación {norma.fechaPublicacion}
                </>
              )}
            </p>
            <div className="no-print mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <button onClick={copiarCita} className="btn-primario">
                <span aria-hidden="true">❝</span> Copiar cita
              </button>
              <button onClick={() => copiar(`${window.location.origin}/normas/${norma.codigoNormalizado}`, 'Enlace permanente copiado')}
                className="btn-secundario">
                <span aria-hidden="true">⌁</span> Enlace permanente
              </button>
              <a href={`/api/v1/normas/${norma.codigoNormalizado}/pdf`} download={norma.codigoNormalizado + '.pdf'}
                className="btn-secundario">
                <span aria-hidden="true">⇩</span> Descargar PDF
              </a>
              <button onClick={() => window.print()} className="btn-secundario">
                <span aria-hidden="true">⎙</span> Imprimir
              </button>
            </div>
            <div aria-live="polite">
              {mensaje && <p className="mt-2 text-xs text-vigente-texto">{mensaje}</p>}
            </div>
          </header>

          <div className="no-print mt-6">
            <div role="tablist" aria-label="Secciones de la norma" className="flex gap-5 border-b border-line">
              {PESTANAS.map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  role="tab"
                  aria-selected={pestana === valor}
                  onClick={() => setPestana(valor)}
                  className={`-mb-px border-b-2 px-1 pb-2.5 pt-1 text-sm font-medium transition-colors ${pestana === valor
                    ? 'border-acento text-acento-texto'
                    : 'border-transparent text-ink-faint hover:text-ink'}`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            {pestana === 'texto' && texto && (
              <div className="grid gap-4 md:grid-cols-[260px_1fr]">
                <aside aria-label="Índice de artículos" className="no-print sticky top-24 max-h-[75vh] overflow-auto self-start rounded-md border border-line bg-surface p-3 shadow-xs">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">Índice</h3>
                  <ol className="space-y-1 text-sm">
                    {texto.fragmentos.map(f => (
                      <li key={f.orden}>
                        <a href={`#fragmento-${f.orden}`} className="block rounded px-1 py-0.5 hover:bg-verde-50">
                          {f.etiqueta ?? NOMBRE_TIPO[f.tipo] ?? 'Fragmento'}
                        </a>
                      </li>
                    ))}
                  </ol>
                  <label className="mt-3 block text-xs">
                    Buscar dentro de la norma
                    <input value={terminoInterior} onChange={(e) => setTerminoInterior(e.target.value)}
                      className="mt-1 campo"
                      placeholder="término" />
                  </label>
                </aside>
                <section aria-label="Texto de la norma" className="panel p-6">
                  <TextoNorma
                    fragmentos={texto.fragmentos}
                    terminos={terminoInterior || q}
                  />
                </section>
              </div>
            )}

            {pestana === 'pdf' && norma && <VisorPdf codigo={norma.codigoNormalizado} />}

            {pestana === 'relaciones' && (
              <section aria-label="Relaciones" className="panel p-6">
                {relaciones?.origen.length === 0 && relaciones?.destino.length === 0 && (
                  <p className="text-sm text-ink-soft">Esta norma no tiene relaciones registradas.</p>
                )}
                {relaciones && relaciones.origen.length > 0 && (
                  <div className="mb-4">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">Modifica / deroga / reglamenta a</h3>
                    <ul className="space-y-1 text-sm">
                      {relaciones.origen.map((r, i) => (
                        <li key={i}>
                          <strong>{r.tipo}</strong> →{' '}
                          <Link className="underline" to={`/normas/${r.normaDestino.codigoNormalizado}`}>
                            {r.normaDestino.codigoNormalizado}
                          </Link>{' '}
                          {r.normaDestino.titulo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {relaciones && relaciones.destino.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint">Modificada por / derogada por</h3>
                    <ul className="space-y-1 text-sm">
                      {relaciones.destino.map((r, i) => (
                        <li key={i}>
                          <strong>{r.tipo}</strong> ←{' '}
                          <Link className="underline" to={`/normas/${r.normaOrigen.codigoNormalizado}`}>
                            {r.normaOrigen.codigoNormalizado}
                          </Link>{' '}
                          {r.normaOrigen.titulo}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {pestana === 'metadatos' && (
              <section aria-label="Metadatos" className="panel p-6">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ['Código', norma.codigoNormalizado],
                      ['Tipo', `${norma.tipo.nombre} (${norma.tipo.codigo})`],
                      ['Órgano emisor', `${norma.organo.nombre} (${norma.organo.codigo})`],
                      ['Número', `${norma.numero}${norma.sufijo ? `—${norma.sufijo}` : ''}`],
                      ['Año', String(norma.anio)],
                      ['Fecha de sanción', norma.fechaSancion],
                      ['Fecha de publicación', norma.fechaPublicacion ?? '—'],
                      ['Boletín oficial', norma.boletin ? `N° ${norma.boletin.numero} del ${norma.boletin.fechaPublicacion}` : '—'],
                      ['Expediente', norma.expediente ?? '—'],
                      ['Palabras clave', norma.palabrasClave?.join(', ') || '—'],
                      ['Origen del texto', norma.textoOrigen === 1 ? 'PDF con texto nativo' : 'OCR (puede contener errores)'],
                      ['Resumen', norma.resumen ?? '—'],
                    ].map(([clave, valor]) => (
                      <tr key={clave} className="border-b border-line">
                        <th scope="row" className="w-48 text-left py-2 font-medium text-ink-soft">{clave}</th>
                        <td className="py-2">{valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>

          <p className="mt-6 text-xs text-ink-faint">
            El PDF firmado es el documento oficial; el texto en pantalla es una copia de lectura.
          </p>
        </>
      )}
    </main>
  )
}

function TextoNorma({ fragmentos, terminos }: { fragmentos: { orden: number; paginaDesde: number | null; paginaHasta: number | null; html: string | null; texto: string }[]; terminos?: string }) {
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const raiz = contenedor.current
    if (!raiz) return

    raiz.querySelectorAll('mark.resaltado-digesto').forEach(m => {
      const padre = m.parentNode
      if (padre) {
        padre.replaceChild(document.createTextNode(m.textContent ?? ''), m)
        Normalizer()
      }
    })

    const termino = terminos?.trim()
    if (!termino || termino.length < 3) {
      Normalizer()
      return
    }

    const regex = new RegExp(`^${termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu')
    const treeWalker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
    const candidatos: Text[] = []
    while (treeWalker.nextNode()) {
      const node = treeWalker.currentNode as Text
      if (node.textContent && regex.test(node.textContent)) candidatos.push(node)
    }
    for (const nodo of candidatos) {
      const texto = nodo.textContent as string
      const marca = document.createElement('mark')
      marca.className = 'resaltado-digesto'
      marca.textContent = texto
      nodo.parentNode?.replaceChild(marca, nodo)
    }
  }, [terminos, fragmentos])

  return (
    <div ref={contenedor} className="lectura space-y-6">
      {fragmentos.map(f => (
        <article key={f.orden} id={`fragmento-${f.orden}`} data-page={f.paginaDesde ?? undefined}>
          {f.html
            ? <div className="texto-norma prose-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(f.html) }} />
            : <p className="whitespace-pre-wrap text-sm">{f.texto}</p>}
          {f.paginaDesde && (
            <p className="mt-1 text-right text-[10px] text-ink-faint">
              página {f.paginaDesde}{f.paginaHasta && f.paginaHasta !== f.paginaDesde ? `–${f.paginaHasta}` : ''}
            </p>
          )}
        </article>
      ))}
    </div>
  )
}

function Normalizer() {
  void 0
}

function VisorPdf({ codigo }: { codigo: string }) {
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [escala, setEscala] = useState(1.5)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  const pdfUrl = useMemo(() => `/api/v1/normas/${encodeURIComponent(codigo)}/pdf`, [codigo])

  return (
    <section aria-label="Visor del PDF original" className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1}
          className="btn-secundario px-2 py-1 disabled:opacity-40">←</button>
        <span>Página {pagina} de {totalPaginas}</span>
        <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas}
          className="btn-secundario px-2 py-1 disabled:opacity-40">→</button>
        <span className="mx-2">|</span>
        <button onClick={() => setEscala(e => Math.max(0.5, e - 0.25))} className="btn-secundario px-2 py-1">−</button>
        <span>{Math.round(escala * 100)}%</span>
        <button onClick={() => setEscala(e => Math.min(3, e + 0.25))} className="btn-secundario px-2 py-1">+</button>
        <a href={pdfUrl} download className="ml-auto btn-secundario px-2 py-1">Descargar PDF</a>
      </div>
      {errorCarga && <p role="alert" className="mb-2 text-sm text-derogada-texto">{errorCarga}</p>}
      <LienzosPdf pdfUrl={pdfUrl} pagina={pagina} escala={escala}
        onPaginas={(n) => {
          setTotalPaginas(n)
          if (pagina > n) setPagina(1)
        }}
        onEstado={(estado) => {
          setCargando(estado === 'cargando')
          if (estado === 'error') setErrorCarga('No se pudo mostrar el PDF; usá el botón Descargar PDF.')
          else setErrorCarga('')
        }} />
      <div aria-live="polite">{cargando && <p className="mt-2 text-sm text-ink-faint">Cargando PDF…</p>}</div>
      <p className="mt-3 text-xs text-ink-faint dark:text-ink-faint">
        Si el texto se ve con errores, usá el PDF original: es el documento oficial.
      </p>
    </section>
  )
}

function LienzosPdf({
  pdfUrl,
  pagina,
  escala,
  onPaginas,
  onEstado,
}: {
  pdfUrl: string
  pagina: number
  escala: number
  onPaginas: (total: number) => void
  onEstado: (estado: 'cargando' | 'listo' | 'error') => void
}) {
  const lienzo = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let vigente = true
    onEstado('cargando')
    const cargando = (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

        const tarea = await pdfjs.getDocument({ url: pdfUrl }).promise
        if (!vigente) return
        onPaginas(tarea.numPages)

        const doc = await tarea.getPage(Math.min(pagina, tarea.numPages))
        const viewport = doc.getViewport({ scale: escala })
        const canvas = lienzo.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = viewport.width
        canvas.height = viewport.height
        await doc.render({ canvas, canvasContext: ctx, viewport }).promise
        if (vigente) onEstado('listo')
      } catch (err) {
        if (vigente) onEstado('error')
        console.error('PDF', err)
      }
    })()

    return () => {
      vigente = false
      void cargando
    }
  }, [pdfUrl, pagina, escala, onPaginas, onEstado])

  return (
    <div className="mx-auto min-h-[70vh] max-h-[85vh] overflow-auto bg-canvas p-2">
      <canvas ref={lienzo} className="mx-auto block shadow-lg" />
    </div>
  )
}

