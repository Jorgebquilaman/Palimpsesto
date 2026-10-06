import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import DOMPurify from 'dompurify'
import {
  traerFragmentos,
  traerNorma,
  traerRelaciones,
} from '../api/cliente'
import { Badge } from '../components/ui'
import { VisorPdf } from '../components/VisorPdf'

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
  ['texto', 'Texto', 'texto'],
  ['pdf', 'PDF original', 'pdf'],
  ['relaciones', 'Relaciones', 'relaciones'],
  ['metadatos', 'Metadatos', 'metadatos'],
] as const

function IconoPestana({ solapa }: { solapa: (typeof PESTANAS)[number][0] }) {
  const comun = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const
  switch (solapa) {
    case 'texto':
      return (<svg {...comun} aria-hidden="true"><path d="M4 4h16v16H4V4Z" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>)
    case 'pdf':
      return (<svg {...comun} aria-hidden="true"><path d="M6 2h9l5 5v15H6V2Z" /><path d="M14 2v6h6" /><path d="M12 11v7M8.5 14.5 12 11l3.5 3.5" /></svg>)
    case 'relaciones':
      return (<svg {...comun} aria-hidden="true"><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" /><circle cx="12" cy="18" r="3" /><path d="M8.4 8.4l2.2 6.3M15.6 8.4l-2.2 6.3M9 6h6" /></svg>)
    case 'metadatos':
      return (<svg {...comun} aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="1.6" fill="currentColor" /><circle cx="15" cy="12" r="1.6" fill="currentColor" /><circle cx="7" cy="18" r="1.6" fill="currentColor" /></svg>)
  }
}

export default function Norma() {
  const { codigo = '' } = useParams()
  const [parametros] = useSearchParams()
  const q = parametros.get('q') ?? ''
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number][0]>('texto')
  const [terminoInterior, setTerminoInterior] = useState('')
  const [indiceAbierto, setIndiceAbierto] = useState(false)
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
    <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-6">
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
            {/* Solapas tradicionales: solo escritorio */}
            <div role="tablist" aria-label="Secciones de la norma" className="hidden md:flex gap-5 border-b border-line">
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
            {/* Indicador del menú inferior activo (móvil) */}
            <div className="md:hidden sr-only" role="status">
              Viendo: {PESTANAS.find(([v]) => v === pestana)?.[1]}
            </div>
          </div>

          {/* Menú inferior tipo iPhone: solo móvil */}
          <nav
            aria-label="Secciones de la norma"
            className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
          >
            <ul className="grid grid-cols-4">
              {PESTANAS.map(([valor, etiqueta]) => (
                <li key={valor}>
                  <button
                    role="tab"
                    aria-selected={pestana === valor}
                    onClick={() => setPestana(valor)}
                    className={`flex w-full flex-col items-center gap-1 px-1 pb-1.5 pt-2 text-[10px] font-medium transition-colors ${pestana === valor
                      ? 'text-acento-texto'
                      : 'text-ink-faint'}`}
                  >
                    <IconoPestana solapa={valor} />
                    {etiqueta}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-4">
            {pestana === 'texto' && texto && (
              <>
              <div className="grid gap-4 grid-cols-[minmax(0,1fr)] md:grid-cols-[260px_1fr]">
                {norma.resumen && (
                  <section aria-label="Resumen de la norma" className="panel min-w-0 p-4 sm:p-5 md:col-span-2">
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-faint"><span className="rombo" aria-hidden="true">✦</span>Resumen</h2>
                    <p className="font-lectura wrap-anywhere text-[15px] leading-relaxed sm:text-base">{norma.resumen}</p>
                  </section>
                )}
                {texto.fragmentos.length === 0 && (
                  <div className="panel border-dashed p-6 text-center text-sm text-ink-faint">
                    El texto completo todavía no está estructurado. El documento oficial es el PDF de la solapa "PDF original".
                  </div>
                )}
                {texto.fragmentos.length > 0 && (
                  <>
                  {indiceAbierto && (
                    <div className="no-print fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Índice de artículos">
                      <button type="button" aria-label="Cerrar índice" onClick={() => setIndiceAbierto(false)} className="absolute inset-0 cursor-default bg-ink/40" />
                      <div className="absolute inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] max-h-[65vh] overflow-auto rounded-2xl border border-line bg-surface p-4 shadow-xl">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-ink-faint">Índice</h3>
                          <button type="button" onClick={() => setIndiceAbierto(false)} aria-label="Convertir en menú flotante"
                            className="grid h-8 w-8 place-items-center rounded-full bg-verde-900 text-base leading-none text-crema-50 shadow-md transition-colors hover:bg-verde-950">
                            ↓
                          </button>
                        </div>
                        <ol className="space-y-1 text-sm">
                          {texto.fragmentos.map(f => (
                            <li key={f.orden}>
                              <a href={`#fragmento-${f.orden}`} onClick={() => setIndiceAbierto(false)} className="block rounded px-1 py-0.5 hover:bg-verde-50">
                                {f.etiqueta ?? NOMBRE_TIPO[f.tipo] ?? 'Fragmento'}
                              </a>
                            </li>
                          ))}
                        </ol>
                        <label className="mt-3 block text-xs">
                          Buscar dentro de la norma
                          <input value={terminoInterior} onChange={e => setTerminoInterior(e.target.value)}
                            className="mt-1.5 w-full rounded-sm border border-line bg-surface px-2 py-1 text-sm" />
                        </label>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIndiceAbierto(true)}
                    aria-label="Mostrar índice"
                    className="no-print fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-verde-900 text-crema-50 shadow-lg transition-colors hover:bg-verde-950 md:hidden"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
                      <path d="M3 6h18M3 12h12M3 18h8" />
                    </svg>
                  </button>
                  <aside aria-label="Índice de artículos" className="no-print sticky top-24 hidden max-h-[75vh] overflow-auto self-start rounded-md border border-line bg-surface p-3 shadow-xs md:block">
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
                      <input value={terminoInterior} onChange={e => setTerminoInterior(e.target.value)}
                        className="mt-1.5 w-full rounded-sm border border-line bg-surface px-2 py-1 text-sm" />
                    </label>
                  </aside>
                  <section aria-label="Texto de la norma" className="panel min-w-0 p-4 sm:p-6">
                    <TextoNorma
                      fragmentos={texto.fragmentos}
                      terminos={terminoInterior || q}
                    />
                  </section>
                  </>
                )}
              </div>
              <footer className="no-print mt-6 border-t border-line pt-3 text-xs text-ink-faint">
                <p role="note">
                  <strong>Nota:</strong> este texto es una transcripción con fines de lectura. En caso de
                  diferencia con el documento original firmado, <strong>prevalece el PDF</strong> de la
                  solapa «PDF original».
                </p>
              </footer>
              </>
            )}

            {pestana === 'pdf' && norma && <VisorPdf pdfUrl={`/api/v1/normas/${encodeURIComponent(norma.codigoNormalizado)}/pdf`} />}

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
      m.replaceWith(document.createTextNode(m.textContent ?? ''))
    })
    raiz.normalize()

    const termino = terminos?.trim()
    if (!termino || termino.length < 3) {
      return
    }

    const regex = new RegExp(termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
    const treeWalker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
    const candidatos: Text[] = []
    while (treeWalker.nextNode()) {
      const nodo = treeWalker.currentNode as Text
      if (nodo.textContent) {
        regex.lastIndex = 0
        if (regex.test(nodo.textContent)) candidatos.push(nodo)
      }
    }

    for (const nodo of candidatos) {
      const texto = nodo.textContent ?? ''
      const trozo = document.createDocumentFragment()
      let ultimo = 0
      regex.lastIndex = 0
      let hallazgo: RegExpExecArray | null
      while ((hallazgo = regex.exec(texto))) {
        if (hallazgo.index > ultimo) {
          trozo.append(document.createTextNode(texto.slice(ultimo, hallazgo.index)))
        }
        const marca = document.createElement('mark')
        marca.className = 'resaltado-digesto'
        marca.textContent = hallazgo[0]
        trozo.append(marca)
        ultimo = hallazgo.index + hallazgo[0].length
        if (hallazgo[0].length === 0) regex.lastIndex += 1
      }
      if (ultimo < texto.length) {
        trozo.append(document.createTextNode(texto.slice(ultimo)))
      }
      nodo.parentNode?.replaceChild(trozo, nodo)
    }
  }, [terminos, fragmentos])

  return (
    <div ref={contenedor} className="lectura space-y-6">
      {fragmentos.map(f => (
        <article key={f.orden} id={`fragmento-${f.orden}`} data-page={f.paginaDesde ?? undefined}>
          {f.html
            ? <div className="texto-norma prose-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(f.html) }} />
            : <p className="wrap-anywhere whitespace-pre-wrap text-sm">{f.texto}</p>}
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

