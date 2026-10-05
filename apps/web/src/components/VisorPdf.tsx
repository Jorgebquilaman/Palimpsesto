import { useEffect, useRef, useState } from 'react'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export function VisorPdf({ pdfUrl }: { pdfUrl: string }) {
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [escala, setEscala] = useState(1.5)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

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
  const tareaRender = useRef<{ cancel: () => void } | null>(null)
  const cbPaginas = useRef(onPaginas)
  const cbEstado = useRef(onEstado)
  cbPaginas.current = onPaginas
  cbEstado.current = onEstado

  useEffect(() => {
    let vigente = true
    cbEstado.current('cargando')
    const cargando = (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

        const tarea = await pdfjs.getDocument({ url: pdfUrl }).promise
        if (!vigente) return
        cbPaginas.current(tarea.numPages)

        const doc = await tarea.getPage(Math.min(pagina, tarea.numPages))
        const viewport = doc.getViewport({ scale: escala })
        const canvas = lienzo.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        tareaRender.current?.cancel()
        canvas.width = viewport.width
        canvas.height = viewport.height
        const render = doc.render({ canvasContext: ctx, viewport })
        tareaRender.current = render
        await render.promise
        if (vigente) cbEstado.current('listo')
      } catch (err) {
        if (vigente && !String((err as Error)?.message ?? '').includes('cancelled')) {
          console.error('PDF', err)
          cbEstado.current('error')
        }
      }
    })()

    return () => {
      vigente = false
      tareaRender.current?.cancel()
      void cargando
    }
  }, [pdfUrl, pagina, escala])

  return (
    <div className="mx-auto min-h-[70vh] max-h-[85vh] overflow-auto bg-canvas p-2">
      <canvas ref={lienzo} className="mx-auto block shadow-lg" />
    </div>
  )
}
