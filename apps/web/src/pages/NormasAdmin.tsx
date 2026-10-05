import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ETIQUETAS_ESTADO, pedirAdmin } from '../api/adminApi'
import type { NormaAdminListado, ProcesoAdmin } from '../api/adminApi'
import DropzoneNormas from '../components/DropzoneNormas'

export default function NormasAdmin() {
  const [estado, setEstado] = useState('')
  const [q, setQ] = useState('')

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin-normas', estado, q],
    queryFn: () => pedirAdmin<{ total: number; items: NormaAdminListado[] }>(
      `/admin/normas?${new URLSearchParams({ ...(estado && { estado }), ...(q && { q }) })}`),
    refetchInterval: 10_000,
  })

  const { data: procesos } = useQuery({
    queryKey: ['admin-procesos'],
    queryFn: () => pedirAdmin<ProcesoAdmin[]>('/admin/procesos'),
    refetchInterval: 5_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Normas</h1>
      </div>

      <DropzoneNormas />

      {procesos && procesos.length > 0 && (
        <section aria-label="Procesos de ingesta" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Últimos procesos</h2>
          <ul className="space-y-1 text-sm">
            {procesos.slice(0, 5).map(p => (
              <li key={p.id} className="flex items-center gap-3">
                <span className={`rounded px-2 py-0.5 text-xs ${badgeProceso(p.estado)}`}>
                  {['pendiente', 'en curso', 'ok', 'error'][p.estado - 1] ?? p.estado}
                </span>
                <Link to={`/admin/normas/${p.normaId}`} className="underline">
                  norma {p.normaId.slice(0, 8)}
                </Link>
                {p.etapa && <span className="text-xs text-gray-500">etapa: {p.etapa}</span>}
                {p.error && <span className="truncate text-xs text-red-600 dark:text-red-400">{p.error}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="flex flex-wrap gap-2" onSubmit={(e) => e.preventDefault()}>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
          <option value="">Todos los estados</option>
          {Object.entries(ETIQUETAS_ESTADO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
      </form>

      {isError && <p role="alert" className="text-sm text-red-600">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite" className="text-sm text-gray-500">Cargando…</p>}

      {data && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Sanción</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(n => (
                <tr key={n.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link to={`/admin/normas/${n.id}`} className="underline">{n.codigoNormalizado}</Link>
                  </td>
                  <td className="px-3 py-2">{n.titulo}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                      {ETIQUETAS_ESTADO[n.estado] ?? n.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{n.fechaSancion}</td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500">Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function badgeProceso(estado: number): string {
  return ['', 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
    'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'][estado] ?? ''
}
