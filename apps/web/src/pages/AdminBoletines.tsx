import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { pedirAdmin } from '../api/adminApi'
import { TituloSeccion } from '../components/ui'

interface BoletinLista {
  id: number
  numero: string
  fechaPublicacion: string
  totalNormas: number
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
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-semibold">{b.numero}</span>
                <span className="num-tabulares text-ink-soft">{b.fechaPublicacion}</span>
                <span className="ml-auto text-xs text-ink-faint">{b.totalNormas} normas</span>
                <Link to={`/boletines/${encodeURIComponent(b.numero)}`} className="text-xs underline text-ink-faint hover:text-ink">
                  ver
                </Link>
              </li>
            ))}
            {boletines.items.length === 0 && <li className="px-4 py-3 text-sm text-ink-faint">Aún no hay boletines.</li>}
          </ul>
        )}
      </section>
    </div>
  )
}
