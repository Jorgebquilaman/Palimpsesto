import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { pedirAdmin, subirPdfBoletin } from '../api/adminApi'
import { TituloSeccion } from '../components/ui'

interface BoletinLista {
  id: number
  numero: string
  fechaPublicacion: string
  observaciones: string | null
  totalNormas: number
  tienePdf: boolean
}

export default function AdminBoletines() {
  const cliente = useQueryClient()

  const { data: boletines, isPending, isError, error } = useQuery({
    queryKey: ['admin-boletines'],
    queryFn: () => pedirAdmin<{ items: BoletinLista[] }>('/boletines?page=1'),
  })

  const [numero, setNumero] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [observaciones, setObservaciones] = useState('')
  const [mensaje, setMensaje] = useState('')

  const [subiendoPdf, setSubiendoPdf] = useState<number | null>(null)

  async function subirPdf(boletinId: number, archivo: File) {
    setSubiendoPdf(boletinId)
    try {
      await subirPdfBoletin(boletinId, archivo)
      setMensaje('PDF del boletín cargado')
      void cliente.invalidateQueries({ queryKey: ['admin-boletines'] })
    } catch (e) {
      setMensaje(`Error: ${(e as Error).message}`)
    } finally {
      setSubiendoPdf(null)
    }
  }

  const crear = useMutation({
    mutationFn: () => pedirAdmin('/admin/boletines', {
      method: 'POST',
      body: JSON.stringify({ numero, fechaPublicacion: fecha, observaciones }),
    }),
    onSuccess: () => {
      setMensaje(`Boletín ${numero} creado`)
      setNumero('')
      setObservaciones('')
      void cliente.invalidateQueries({ queryKey: ['admin-boletines'] })
    },
    onError: (e) => setMensaje(`Error: ${(e as Error).message}`),
  })

  return (
    <div className="max-w-2xl space-y-6">
      <TituloSeccion>Boletines oficiales</TituloSeccion>
      <p className="text-sm text-ink-soft">
        Cada boletín agrupa las normas publicadas en esa edición. Desde el listado podés abrir
        la vista pública de cada boletín.
      </p>

      <div aria-live="polite">
        {mensaje && <p className={`text-sm ${mensaje.startsWith('Error') ? 'text-derogada-texto' : 'text-vigente-texto'}`}>{mensaje}</p>}
      </div>

      <form className="panel space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); crear.mutate() }}>
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-faint">Nuevo boletín</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Número</span>
            <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="p. ej. 19.440"
              className="campo" required maxLength={50} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Fecha de publicación</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
              className="campo" required />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-ink-soft">Observaciones (opcional)</span>
            <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              className="campo" />
          </label>
        </div>
        <button type="submit" disabled={crear.isPending} className="btn-primario">
          {crear.isPending ? 'Creando…' : 'Crear boletín'}
        </button>
      </form>

      <section aria-label="Listado de boletines">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">Cargados</h2>
        {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
        {isPending && <p aria-live="polite" className="text-sm text-ink-faint">Cargando…</p>}
        {boletines && (
          <ul className="panel divide-y divide-line">
            {boletines.items.map(b => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-semibold">{b.numero}</span>
                <span className="num-tabulares text-ink-soft">{b.fechaPublicacion}</span>
                {b.tienePdf
                  ? <a href={`/api/v1/boletines/${encodeURIComponent(b.numero)}/pdf`} target="_blank" rel="noreferrer"
                      className="text-xs underline text-vigente-texto">⇩ PDF</a>
                  : <span className="text-xs text-ink-faint">sin PDF</span>}
                <span className="ml-auto text-xs text-ink-faint">{b.totalNormas} normas</span>
                <label className="text-xs underline text-ink-faint hover:text-ink cursor-pointer">
                  {subiendoPdf === b.id ? 'Subiendo…' : (b.tienePdf ? 'reemplazar PDF' : 'subir PDF')}
                  <input type="file" accept="application/pdf" className="sr-only"
                    disabled={subiendoPdf === b.id}
                    onChange={(e) => {
                      const archivo = e.target.files?.[0]
                      if (archivo) void subirPdf(b.id, archivo)
                      e.target.value = ''
                    }} />
                </label>
                <Link to={`/boletines/${encodeURIComponent(b.numero)}`} className="text-xs underline text-ink-faint hover:text-ink">
                  ver
                </Link>
                {b.observaciones && <p className="w-full text-xs text-ink-faint">{b.observaciones}</p>}
              </li>
            ))}
            {boletines.items.length === 0 && <li className="px-4 py-3 text-sm text-ink-faint">Aún no hay boletines.</li>}
          </ul>
        )}
      </section>
    </div>
  )
}
