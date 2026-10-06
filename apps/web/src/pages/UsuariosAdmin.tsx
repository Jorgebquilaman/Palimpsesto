import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { pedirAdmin } from '../api/adminApi'
import type { CrearUsuarioRequest } from '../api/adminApi'
import { TituloSeccion } from '../components/ui'

interface UsuarioListado {
  id: string
  userName: string
  nombre: string
  email: string | null
  rol: string
  bloqueado: boolean
}

const ESTILO_ROL: Record<string, string> = {
  admin: 'bg-[var(--derogada)]/10 text-derogada-texto',
  editor: 'bg-verde-100 text-vigente-texto dark:bg-crema-100/10',
  revisor: 'bg-crema-200 text-ink-soft dark:bg-crema-100/10 dark:text-crema-100',
}

export default function UsuariosAdmin() {
  const cliente = useQueryClient()
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin-usuarios'],
    queryFn: () => pedirAdmin<UsuarioListado[]>('/admin/usuarios'),
  })

  const [form, setForm] = useState<CrearUsuarioRequest>({
    usuario: '', email: '', nombre: '', contrasenia: '', rol: 'editor',
  })
  const [mensaje, setMensaje] = useState('')
  const [exito, setExito] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [formEdicion, setFormEdicion] = useState({ nombre: '', email: '', rol: 'editor' })

  const crear = useMutation({
    mutationFn: () => pedirAdmin('/admin/usuarios', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setExito(true)
      setMensaje('Usuario creado')
      setForm({ usuario: '', email: '', nombre: '', contrasenia: '', rol: 'editor' })
      void cliente.invalidateQueries({ queryKey: ['admin-usuarios'] })
    },
    onError: (e) => { setExito(false); setMensaje((e as Error).message) },
  })

  const guardarEdicion = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      pedirAdmin(`/admin/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(formEdicion) }),
    onSuccess: () => {
      setEditando(null)
      setExito(true)
      setMensaje('Usuario actualizado')
      void cliente.invalidateQueries({ queryKey: ['admin-usuarios'] })
    },
    onError: (e) => { setExito(false); setMensaje((e as Error).message) },
  })

  const cambiarBloqueo = useMutation({
    mutationFn: ({ id, bloqueado }: { id: string; bloqueado: boolean }) =>
      pedirAdmin(`/admin/usuarios/${id}/bloqueo`, { method: 'PUT', body: JSON.stringify({ bloqueado }) }),
    onSuccess: (_, v) => {
      setExito(true)
      setMensaje(v.bloqueado ? 'Usuario dado de baja' : 'Usuario reactivado')
      void cliente.invalidateQueries({ queryKey: ['admin-usuarios'] })
    },
    onError: (e) => { setExito(false); setMensaje((e as Error).message) },
  })

  const empezarEdicion = (u: UsuarioListado) => {
    setEditando(u.id)
    setFormEdicion({ nombre: u.nombre, email: u.email ?? '', rol: u.rol || 'editor' })
    setMensaje('')
  }

  return (
    <div className="max-w-4xl space-y-5">
      <header>
        <TituloSeccion>Usuarios y roles</TituloSeccion>
        <p className="text-sm text-ink-soft">
          Quiénes pueden entrar al backoffice y con qué permisos: <strong>admin</strong> gestiona todo,
          <strong> editor</strong> carga y revisa normas, <strong>revisor</strong> solo revisa.
        </p>
      </header>

      <div aria-live="polite">
        {mensaje && (
          <p role={exito ? undefined : 'alert'} className={`text-sm ${exito ? 'text-vigente-texto' : 'text-derogada-texto'}`}>
            {mensaje}
          </p>
        )}
      </div>

      <form className="panel flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => { e.preventDefault(); crear.mutate() }}>
        <label className="block min-w-32 flex-1 text-xs font-medium text-ink-soft">
          Usuario
          <input value={form.usuario} onChange={e => setForm((f: CrearUsuarioRequest) => ({ ...f, usuario: e.target.value }))}
            placeholder="jperez" autoComplete="off" className="campo mt-1" required />
        </label>
        <label className="block min-w-40 flex-[2] text-xs font-medium text-ink-soft">
          Nombre
          <input value={form.nombre} onChange={e => setForm((f: CrearUsuarioRequest) => ({ ...f, nombre: e.target.value }))}
            placeholder="Juan Pérez" autoComplete="off" className="campo mt-1" required />
        </label>
        <label className="block min-w-44 flex-[2] text-xs font-medium text-ink-soft">
          Email
          <input type="email" value={form.email} onChange={e => setForm((f: CrearUsuarioRequest) => ({ ...f, email: e.target.value }))}
            placeholder="jperez@iupa.edu.ar" autoComplete="off" className="campo mt-1" />
        </label>
        <label className="block min-w-36 flex-1 text-xs font-medium text-ink-soft">
          Contraseña
          <input type="password" value={form.contrasenia} onChange={e => setForm((f: CrearUsuarioRequest) => ({ ...f, contrasenia: e.target.value }))}
            placeholder="8+ caracteres" autoComplete="new-password" minLength={8} className="campo mt-1" required />
        </label>
        <label className="block text-xs font-medium text-ink-soft">
          Rol
          <select value={form.rol} onChange={e => setForm((f: CrearUsuarioRequest) => ({ ...f, rol: e.target.value }))}
            className="campo mt-1">
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="revisor">revisor</option>
          </select>
        </label>
        <button type="submit" disabled={crear.isPending}
          className="btn-primario disabled:opacity-50">
          {crear.isPending ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>

      {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite" className="text-sm text-ink-faint">Cargando…</p>}

      {data && (
        <table className="panel w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
              <th scope="col" className="px-4 py-2.5">Usuario</th>
              <th scope="col" className="px-4 py-2.5">Email</th>
              <th scope="col" className="px-4 py-2.5">Rol</th>
              <th scope="col" className="px-4 py-2.5">Estado</th>
              <th scope="col" className="px-4 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map(u => (
              <tr key={u.id} className="border-b border-line last:border-0 hover:bg-verde-50 dark:hover:bg-crema-100/5">
                <td className="px-4 py-2.5">
                  {editando === u.id ? (
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-verde-900 text-xs font-bold text-crema-50 dark:bg-crema-100/15 dark:text-crema-100">
                        {(u.nombre || u.userName).trim().charAt(0).toUpperCase()}
                      </span>
                      <input value={formEdicion.nombre}
                        onChange={e => setFormEdicion(f => ({ ...f, nombre: e.target.value }))}
                        aria-label="Nombre" className="campo w-40" required />
                    </span>
                  ) : (
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-verde-900 text-xs font-bold text-crema-50 dark:bg-crema-100/15 dark:text-crema-100">
                        {(u.nombre || u.userName).trim().charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <span className="block font-medium">{u.nombre}</span>
                        <span className="block font-mono text-xs text-ink-faint">{u.userName}</span>
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {editando === u.id ? (
                    <input type="email" value={formEdicion.email}
                      onChange={e => setFormEdicion(f => ({ ...f, email: e.target.value }))}
                      aria-label="Email" className="campo w-44" />
                  ) : (u.email ?? '—')}
                </td>
                <td className="px-4 py-2.5">
                  {editando === u.id ? (
                    <select value={formEdicion.rol}
                      onChange={e => setFormEdicion(f => ({ ...f, rol: e.target.value }))}
                      aria-label="Rol" className="campo">
                      <option value="admin">admin</option>
                      <option value="editor">editor</option>
                      <option value="revisor">revisor</option>
                    </select>
                  ) : (
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_ROL[u.rol] ?? ESTILO_ROL.revisor}`}>
                      {u.rol}
                    </span>
                  )}
                </td>
                <td className={`px-4 py-2.5 text-xs ${u.bloqueado ? 'text-derogada-texto' : 'text-vigente-texto'}`}>
                  {u.bloqueado ? 'de baja' : 'activo'}
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex flex-wrap items-center gap-2">
                    {editando === u.id ? (
                      <>
                        <button type="button" onClick={() => guardarEdicion.mutate({ id: u.id })}
                          disabled={guardarEdicion.isPending}
                          className="btn-primario px-2.5 py-1 text-xs disabled:opacity-50">
                          {guardarEdicion.isPending ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button type="button" onClick={() => { setEditando(null); setMensaje('') }}
                          className="btn-secundario px-2.5 py-1 text-xs">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => empezarEdicion(u)}
                          className="btn-secundario px-2.5 py-1 text-xs">
                          Editar
                        </button>
                        <button type="button" onClick={() => cambiarBloqueo.mutate({ id: u.id, bloqueado: !u.bloqueado })}
                          disabled={cambiarBloqueo.isPending}
                          className={`px-2 py-1 text-xs underline-offset-2 hover:underline disabled:opacity-50 ${u.bloqueado ? 'text-vigente-texto' : 'text-derogada-texto'}`}>
                          {u.bloqueado ? 'Reactivar' : 'Dar de baja'}
                        </button>
                      </>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
