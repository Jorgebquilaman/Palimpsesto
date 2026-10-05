import { useQuery } from '@tanstack/react-query'
import { pedirAdmin } from '../api/adminApi'
import type { RegistroAuditoria } from '../api/adminApi'

export default function AuditoriaAdmin() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin-auditoria'],
    queryFn: () => pedirAdmin<RegistroAuditoria[]>('/admin/auditoria'),
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Auditoría</h1>
      {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite">Cargando…</p>}
      {data && (
        <div className="overflow-x-auto rounded-md border border-line shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-ink-faint dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Entidad</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-faint">{new Date(r.fecha).toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2">{r.usuario}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.entidad} {r.entidadId.slice(0, 8)}</td>
                  <td className="px-3 py-2">{r.accion}</td>
                  <td className="max-w-md px-3 py-2 font-mono text-[10px] text-ink-faint">
                    {r.antes && <span className="line-through opacity-60">{r.antes.slice(0, 120)}</span>}
                    {r.antes && <span className="mx-1">→</span>}
                    {r.despues?.slice(0, 120)}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-faint">Sin registros aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
