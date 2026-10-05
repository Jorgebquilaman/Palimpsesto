import { useState } from 'react'
import { Link, Navigate, Outlet } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { cerrarSesion, guardarToken, sesionActual } from '../api/adminApi'

export default function Admin() {
  const sesion = sesionActual()
  if (!sesion) {
    return <Login />
  }
  return <Outlet />
}

function Login() {
  const [usuario, setUsuario] = useState('')
  const [contrasenia, setContrasenia] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const iniciar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const respuesta = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, contrasenia }),
      })
      if (respuesta.status === 423 || respuesta.status === 429) {
        setError('Cuenta bloqueada por intentos fallidos; esperá unos minutos.')
        return
      }
      if (!respuesta.ok) {
        setError('Usuario o contraseña incorrectos')
        return
      }
      const datos = await respuesta.json()
      guardarToken(datos.token, datos.nombre, datos.rol)
      window.location.assign('/admin/normas')
    } catch {
      setError('No se pudo conectar con el servidor. Verificá que el sistema esté corriendo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-4">
      <form onSubmit={iniciar} className="w-full space-y-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-bold">Backoffice — Digesto IUPA</h1>
        <label className="block text-sm">
          Usuario
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
        </label>
        <label className="block text-sm">
          Contraseña
          <input type="password" value={contrasenia} onChange={(e) => setContrasenia(e.target.value)} required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-800" />
        </label>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={cargando}
          className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}

export function LayoutAdmin() {
  const sesion = sesionActual()
  const navegar = useNavigate()

  if (!sesion) {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="font-bold">Digesto IUPA</Link>
          <nav aria-label="Navegación del backoffice" className="flex gap-3 text-sm">
            <Link to="/admin/normas">Normas</Link>
            <Link to="/admin/catalogos">Catálogos</Link>
            <Link to="/admin/auditoria">Auditoría</Link>
            <Link to="/admin/usuarios">Usuarios</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-gray-600 dark:text-gray-400">{sesion.nombre} ({sesion.rol})</span>
            <button onClick={() => { cerrarSesion(); navegar('/admin') }} className="underline">
              Salir
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </div>
    </div>
  )
}
