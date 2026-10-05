import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { pedirAdmin } from '../api/adminApi'
import type { CrearUsuarioRequest } from '../api/adminApi'

interface UsuarioListado {
  id: string
  userName: string
  nombre: string
  email: string | null
  rol: string
  bloqueado: boolean
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

  const crear = useMutation({
    mutationFn: () => pedirAdmin('/admin/usuarios', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      setMensaje('Usuario creado')
      setForm({ usuario: '', email: '', nombre: '', contrasenia: '', rol: 'editor' })
      void cliente.invalidateQueries({ queryKey: ['admin-usuarios'] })
    },
    onError: (e) => setMensaje((e as Error).message),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Usuarios y roles</h1>
      <div aria-live="polite">{mensaje && <p className="text-sm text-green-700 dark:text-green-400">{mensaje}</p>}</div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Crear usuario</h2>
        <form className="grid gap-3 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); crear.mutate() }}>
          <input placeholder="usuario" value={form.usuario} onChange={e => setForm((f: CrearUsuarioRequest) => ({ ...f, usuario: e.target.value }))}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <input placeholder="nombre" value={form.nombre} onChange={e => setForm((f: CrearUsuarioRequest) => ({ ...f, nombre: e.target.value }))}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <input placeholder="email" type="email" value={form.email} onChange={e => setForm((f: CrearUsuarioRequest) => ({ ...f, email: e.target.value }))}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <input placeholder="contraseña" type="password" value={form.contrasenia} onChange={e => setForm((f: CrearUsuarioRequest) => ({ ...f, contrasenia: e.target.value }))}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800" />
          <select value={form.rol} onChange={e => setForm((f: CrearUsuarioRequest) => ({ ...f, rol: e.target.value }))}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800">
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="revisor">revisor</option>
          </select>
          <button type="submit" disabled={crear.isPending}
            className="rounded-lg bg-blue-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            Crear usuario
          </button>
        </form>
      </section>

      {isError && <p role="alert" className="text-red-600">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite">Cargando…</p>}

      {data && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Rol</th>
              </tr>
            </thead>
            <tbody>
              {data.map(u => (
                <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2 font-mono text-xs">{u.userName}</td>
                  <td className="px-3 py-2">{u.nombre}</td>
                  <td className="px-3 py-2 text-xs">{u.email}</td>
                  <td className="px-3 py-2">{u.rol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
