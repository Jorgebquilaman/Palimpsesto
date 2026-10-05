import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { pedirAdmin } from '../api/adminApi'
import type { CatalogosAdmin } from '../api/adminApi'
import { TituloSeccion } from '../components/ui'

const TITULOS: Record<string, { titulo: string; descripcion: string }> = {
  tipos: {
    titulo: 'Tipos de norma',
    descripcion: 'Las categorías con las que se identifican los documentos (RES, DIS, ORD…). Definen la primera parte del código.',
  },
  organos: {
    titulo: 'Órganos emisores',
    descripcion: 'Quiénes dictan las normas (Rectorado, Secretarías…). Definen la segunda parte del código.',
  },
  materias: {
    titulo: 'Materias',
    descripcion: 'La estructura temática para agrupar y encontrar normas por tema.',
  },
}

export default function CatalogosAdmin() {
  const { seccion } = useParams()
  if (!seccion || !(seccion in TITULOS)) {
    return <Navigate to="/admin/catalogos/tipos" replace />
  }

  const meta = TITULOS[seccion]

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <TituloSeccion>{meta.titulo}</TituloSeccion>
        <p className="text-sm text-ink-soft">{meta.descripcion}</p>
      </header>
      {seccion === 'tipos' && <SeccionTipos />}
      {seccion === 'organos' && <SeccionOrganos />}
      {seccion === 'materias' && <SeccionMaterias />}
    </div>
  )
}

function SeccionTipos() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin-catalogos'],
    queryFn: () => pedirAdmin<CatalogosAdmin>('/admin/catalogos'),
  })

  const cliente = useQueryClient()
  const [nuevo, setNuevo] = useState({ codigo: '', nombre: '' })
  const [mensaje, setMensaje] = useState('')

  const crear = useMutation({
    mutationFn: () => pedirAdmin('/admin/catalogos/tipos', {
      method: 'POST',
      body: JSON.stringify({ ...nuevo, alcance: 'general' }),
    }),
    onSuccess: () => { setMensaje('Tipo creado'); setNuevo({ codigo: '', nombre: '' }); void cliente.invalidateQueries({ queryKey: ['admin-catalogos'] }) },
    onError: (e) => setMensaje((e as Error).message),
  })

  const desactivar = useMutation({
    mutationFn: (id: number) => pedirAdmin(`/admin/catalogos/tipos/${id}`, { method: 'DELETE' }),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: ['admin-catalogos'] }),
  })

  const filas = data?.tipos ?? []
  const activos = filas.filter(t => t.activo).length

  return (
    <>
      <div aria-live="polite">{mensaje && <p className="text-sm text-vigente-texto">{mensaje}</p>}</div>
      <form className="panel flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => { e.preventDefault(); crear.mutate() }}>
        <label className="block flex-1 text-xs font-medium text-ink-soft">
          Código
          <input value={nuevo.codigo} onChange={e => setNuevo(t => ({ ...t, codigo: e.target.value.toUpperCase() }))}
            placeholder="RES" maxLength={10} className="campo mt-1" required />
        </label>
        <label className="block flex-[2] text-xs font-medium text-ink-soft">
          Nombre
          <input value={nuevo.nombre} onChange={e => setNuevo(t => ({ ...t, nombre: e.target.value }))}
            placeholder="Resolución" className="campo mt-1" required />
        </label>
        <button disabled={crear.isPending} type="submit" className="btn-primario disabled:opacity-50">
          {crear.isPending ? 'Creando…' : 'Crear tipo'}
        </button>
      </form>

      {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite" className="text-sm text-ink-faint">Cargando…</p>}

      {data && (
        <table className="panel w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="px-4 py-2.5">Código</th>
              <th scope="col" className="px-4 py-2.5">Nombre</th>
              <th scope="col" className="px-4 py-2.5">Estado</th>
              <th scope="col" className="px-4 py-2.5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id} className="border-b border-line last:border-0 hover:bg-verde-50 dark:hover:bg-crema-100/5">
                <td className="px-4 py-2.5 font-mono text-xs">{f.codigo}</td>
                <td className="px-4 py-2.5">{f.nombre} <span className="text-xs text-ink-faint">({f.alcance})</span></td>
                <td className={`px-4 py-2.5 text-xs ${f.activo ? 'text-vigente-texto' : 'text-ink-faint'}`}>{f.activo ? 'activo' : 'inactivo'}</td>
                <td className="px-4 py-2.5 text-right">
                  {f.activo && activos > 1 && (
                    <button type="button" onClick={() => desactivar.mutate(f.id)} className="text-xs underline text-ink-faint hover:text-ink">
                      desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function SeccionOrganos() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin-catalogos'],
    queryFn: () => pedirAdmin<CatalogosAdmin>('/admin/catalogos'),
  })

  const cliente = useQueryClient()
  const [nuevo, setNuevo] = useState({ codigo: '', nombre: '' })
  const [mensaje, setMensaje] = useState('')

  const crear = useMutation({
    mutationFn: () => pedirAdmin('/admin/catalogos/organos', {
      method: 'POST',
      body: JSON.stringify(nuevo),
    }),
    onSuccess: () => { setMensaje('Órgano creado'); setNuevo({ codigo: '', nombre: '' }); void cliente.invalidateQueries({ queryKey: ['admin-catalogos'] }) },
    onError: (e) => setMensaje((e as Error).message),
  })

  const desactivar = useMutation({
    mutationFn: (id: number) => pedirAdmin(`/admin/catalogos/organos/${id}`, { method: 'DELETE' }),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: ['admin-catalogos'] }),
  })

  return (
    <>
      <div aria-live="polite">{mensaje && <p className="text-sm text-vigente-texto">{mensaje}</p>}</div>
      <form className="panel flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => { e.preventDefault(); crear.mutate() }}>
        <label className="block flex-1 text-xs font-medium text-ink-soft">
          Código
          <input value={nuevo.codigo} onChange={e => setNuevo(o => ({ ...o, codigo: e.target.value.toUpperCase() }))}
            placeholder="REC" maxLength={10} className="campo mt-1" required />
        </label>
        <label className="block flex-[2] text-xs font-medium text-ink-soft">
          Nombre
          <input value={nuevo.nombre} onChange={e => setNuevo(o => ({ ...o, nombre: e.target.value }))}
            placeholder="Rectorado" className="campo mt-1" required />
        </label>
        <button disabled={crear.isPending} type="submit" className="btn-primario disabled:opacity-50">
          {crear.isPending ? 'Creando…' : 'Crear órgano'}
        </button>
      </form>

      {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite" className="text-sm text-ink-faint">Cargando…</p>}

      {data && (
        <table className="panel w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="px-4 py-2.5">Código</th>
              <th scope="col" className="px-4 py-2.5">Nombre</th>
              <th scope="col" className="px-4 py-2.5">Estado</th>
              <th scope="col" className="px-4 py-2.5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {data.organos.map(f => (
              <tr key={f.id} className="border-b border-line last:border-0 hover:bg-verde-50 dark:hover:bg-crema-100/5">
                <td className="px-4 py-2.5 font-mono text-xs">{f.codigo}</td>
                <td className="px-4 py-2.5">{f.nombre}</td>
                <td className={`px-4 py-2.5 text-xs ${f.activo ? 'text-vigente-texto' : 'text-ink-faint'}`}>{f.activo ? 'activo' : 'inactivo'}</td>
                <td className="px-4 py-2.5 text-right">
                  {f.activo && (
                    <button type="button" onClick={() => desactivar.mutate(f.id)} className="text-xs underline text-ink-faint hover:text-ink">
                      desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function SeccionMaterias() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin-catalogos'],
    queryFn: () => pedirAdmin<CatalogosAdmin>('/admin/catalogos'),
  })

  const cliente = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [mensaje, setMensaje] = useState('')

  const crear = useMutation({
    mutationFn: () => pedirAdmin('/admin/catalogos/materias', {
      method: 'POST',
      body: JSON.stringify({ nombre }),
    }),
    onSuccess: () => { setMensaje('Materia creada'); setNombre(''); void cliente.invalidateQueries({ queryKey: ['admin-catalogos'] }) },
    onError: (e) => setMensaje((e as Error).message),
  })

  return (
    <>
      <div aria-live="polite">{mensaje && <p className="text-sm text-vigente-texto">{mensaje}</p>}</div>
      <form className="panel flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => { e.preventDefault(); crear.mutate() }}>
        <label className="block flex-[2] text-xs font-medium text-ink-soft">
          Nombre
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Licencias" className="campo mt-1" required />
        </label>
        <button disabled={crear.isPending} type="submit" className="btn-primario disabled:opacity-50">
          {crear.isPending ? 'Creando…' : 'Crear materia'}
        </button>
      </form>

      {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite" className="text-sm text-ink-faint">Cargando…</p>}

      {data && (
        <table className="panel w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="px-4 py-2.5">Nombre</th>
              <th scope="col" className="px-4 py-2.5">Slug</th>
            </tr>
          </thead>
          <tbody>
            {data.materias.map(f => (
              <tr key={f.id} className="border-b border-line last:border-0 hover:bg-verde-50 dark:hover:bg-crema-100/5">
                <td className="px-4 py-2.5">{f.nombre}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-faint">{f.slug}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
