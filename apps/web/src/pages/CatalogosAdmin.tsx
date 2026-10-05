import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { pedirAdmin } from '../api/adminApi'
import type { CatalogosAdmin } from '../api/adminApi'

export default function CatalogosAdmin() {
  const cliente = useQueryClient()

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin-catalogos'],
    queryFn: () => pedirAdmin<CatalogosAdmin>('/admin/catalogos'),
  })

  const [tipoNuevo, setTipoNuevo] = useState({ codigo: '', nombre: '', alcance: 'general' })
  const [organoNuevo, setOrganoNuevo] = useState({ codigo: '', nombre: '' })
  const [materiaNueva, setMateriaNueva] = useState({ nombre: '' })
  const [mensaje, setMensaje] = useState('')

  const crearTipo = useMutation({
    mutationFn: () => pedirAdmin('/admin/catalogos/tipos', { method: 'POST', body: JSON.stringify(tipoNuevo) }),
    onSuccess: () => { setMensaje('Tipo creado'); setTipoNuevo({ codigo: '', nombre: '', alcance: 'general' }); void cliente.invalidateQueries({ queryKey: ['admin-catalogos'] }) },
    onError: (e) => setMensaje((e as Error).message),
  })

  const crearOrgano = useMutation({
    mutationFn: () => pedirAdmin('/admin/catalogos/organos', { method: 'POST', body: JSON.stringify(organoNuevo) }),
    onSuccess: () => { setMensaje('Órgano creado'); setOrganoNuevo({ codigo: '', nombre: '' }); void cliente.invalidateQueries({ queryKey: ['admin-catalogos'] }) },
    onError: (e) => setMensaje((e as Error).message),
  })

  const crearMateria = useMutation({
    mutationFn: () => pedirAdmin('/admin/catalogos/materias', { method: 'POST', body: JSON.stringify(materiaNueva) }),
    onSuccess: () => { setMensaje('Materia creada'); setMateriaNueva({ nombre: '' }); void cliente.invalidateQueries({ queryKey: ['admin-catalogos'] }) },
    onError: (e) => setMensaje((e as Error).message),
  })

  const desactivarTipo = useMutation({
    mutationFn: (id: number) => pedirAdmin(`/admin/catalogos/tipos/${id}`, { method: 'DELETE' }),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: ['admin-catalogos'] }),
  })

  const desactivarOrgano = useMutation({
    mutationFn: (id: number) => pedirAdmin(`/admin/catalogos/organos/${id}`, { method: 'DELETE' }),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: ['admin-catalogos'] }),
  })

  return (
    <div className="space-y-6">
      <h1 className="font-display text-titulo font-semibold tracking-tight"><span className="rombo" aria-hidden="true">✦</span>Catálogos</h1>
      <div aria-live="polite">{mensaje && <p className="text-sm text-vigente-texto">{mensaje}</p>}</div>

      {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite">Cargando…</p>}

      {data && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Catalogo
            titulo="Tipos de norma"
            filas={data.tipos}
            columnas={f => ({ codigo: f.codigo, nombre: f.nombre, alcance: f.alcance, activo: f.activo ? 'activo' : 'inactivo' })}
            onDesactivar={data.tipos.filter(t => t.activo).length > 1 ? (id) => desactivarTipo.mutate(id) : undefined}
            formularios={{
              'Código': <input value={tipoNuevo.codigo} onChange={e => setTipoNuevo(t => ({ ...t, codigo: e.target.value.toUpperCase() }))} className="campo" />,
              'Nombre': <input value={tipoNuevo.nombre} onChange={e => setTipoNuevo(t => ({ ...t, nombre: e.target.value }))} className="campo" />,
            }}
            onCrear={() => crearTipo.mutate()}
            ocupado={crearTipo.isPending}
          />

          <Catalogo
            titulo="Órganos emisores"
            filas={data.organos}
            columnas={f => ({ codigo: f.codigo, nombre: f.nombre, activo: f.activo ? 'activo' : 'inactivo' })}
            onDesactivar={(id) => desactivarOrgano.mutate(id)}
            formularios={{
              'Código': <input value={organoNuevo.codigo} onChange={e => setOrganoNuevo(o => ({ ...o, codigo: e.target.value.toUpperCase() }))} className="campo" />,
              'Nombre': <input value={organoNuevo.nombre} onChange={e => setOrganoNuevo(o => ({ ...o, nombre: e.target.value }))} className="campo" />,
            }}
            onCrear={() => crearOrgano.mutate()}
            ocupado={crearOrgano.isPending}
          />

          <Catalogo
            titulo="Materias (estructura)"
            filas={data.materias}
            columnas={f => ({ nombre: f.nombre, slug: f.slug })}
            formularios={{
              'Nombre': <input value={materiaNueva.nombre} onChange={e => setMateriaNueva({ nombre: e.target.value })} className="campo" />,
            }}
            onCrear={() => crearMateria.mutate()}
            ocupado={crearMateria.isPending}
          />
        </div>
      )}
    </div>
  )
}

function Catalogo<Fila extends { id: number }>({
  titulo,
  filas,
  columnas,
  formularios,
  onCrear,
  onDesactivar,
  ocupado,
}: {
  titulo: string
  filas: Fila[]
  columnas: (fila: Fila) => Record<string, string>
  formularios: Record<string, React.ReactNode>
  onCrear: () => void
  onDesactivar?: (id: number) => void
  ocupado: boolean
}) {
  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint">{titulo}</h2>
      <ul className="mb-4 space-y-1 text-sm">
        {filas.map(fila => {
          const valores = columnas(fila as Fila)
          return (
            <li key={fila.id} className="flex items-center justify-between gap-2">
              <span>
                <span className="font-mono text-xs">{valores.codigo ?? valores.slug}</span>{' '}
                {valores.nombre}
                {valores.alcance && <span className="ml-1 text-xs text-ink-faint">({valores.alcance})</span>}
                {valores.activo && <span className={`ml-2 text-xs ${valores.activo === 'activo' ? 'text-vigente-texto' : 'text-ink-faint'}`}>{valores.activo}</span>}
              </span>
              {onDesactivar && valores.activo === 'activo' && (
                <button type="button" onClick={() => onDesactivar(fila.id)} className="text-xs underline text-ink-faint">
                  desactivar
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <form
        className="space-y-2 border-t border-line pt-3"
        onSubmit={(e) => { e.preventDefault(); onCrear() }}
      >
        {Object.entries(formularios).map(([etiqueta, control]) => (
          <label key={etiqueta} className="block text-xs">
            {etiqueta}
            {control}
          </label>
        ))}
        <button disabled={ocupado} type="submit"
          className="w-full btn-primario disabled:opacity-50">
          Crear
        </button>
      </form>
    </section>
  )
}
