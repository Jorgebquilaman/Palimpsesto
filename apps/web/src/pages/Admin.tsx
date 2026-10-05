import { useState } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
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
      <form onSubmit={iniciar} className="w-full space-y-3 panel p-6">
        <h1 className="text-xl font-bold">Backoffice — Digesto IUPA</h1>
        <label className="block text-sm">
          Usuario
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus required
            className="mt-1 campo" />
        </label>
        <label className="block text-sm">
          Contraseña
          <input type="password" value={contrasenia} onChange={(e) => setContrasenia(e.target.value)} required
            className="mt-1 campo" />
        </label>
        {error && <p role="alert" className="text-sm text-derogada-texto">{error}</p>}
        <button type="submit" disabled={cargando}
          className="w-full btn-primario disabled:opacity-50">
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}

export function LayoutAdmin() {
  const sesion = sesionActual()
  const navegar = useNavigate()
  const ubicacion = useLocation()

  if (!sesion) {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="sin-textura min-h-screen bg-crema-50">
      <div className="mx-auto flex max-w-7xl">
        <aside className="no-print sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-verde-950 p-4 text-crema-100 md:flex">
          <span className="mb-6 mt-2 flex items-center gap-2 font-display text-lg font-semibold">
            <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-sm bg-acento text-sm text-verde-950">✦</span>
            Backoffice
          </span>
          <nav flex-col className="flex">
            <EnlaceSidebar ruta="/admin/normas" activa={ubicacion.pathname.startsWith('/admin/normas')}>Normas</EnlaceSidebar>
            <EnlaceSidebar ruta="/admin/catalogos" activa={ubicacion.pathname === '/admin/catalogos'}>Catálogos</EnlaceSidebar>
            <EnlaceSidebar ruta="/admin/auditoria" activa={ubicacion.pathname === '/admin/auditoria'}>Auditoría</EnlaceSidebar>
            <EnlaceSidebar ruta="/admin/usuarios" activa={ubicacion.pathname === '/admin/usuarios'}>Usuarios</EnlaceSidebar>
          </nav>
          <div className="mt-auto space-y-1 text-sm">
            <p>{sesion.nombre}</p>
            <p className="text-xs text-crema-100/50">{sesion.rol}</p>
            <button onClick={() => { cerrarSesion(); navegar('/admin') }} className="mt-2 underline underline-offset-2 hover:text-barro-300">
              Salir
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="no-print flex items-center gap-3 px-4 py-3 md:hidden">
            <Link to="/" className="font-display font-semibold text-verde-900">Digesto IUPA</Link>
            <button onClick={() => { cerrarSesion(); navegar('/admin') }} className="ml-auto text-sm text-ink-soft underline">Salir</button>
          </div>
          <nav aria-label="Navegación del backoffice" className="no-print flex gap-3 overflow-x-auto border-b border-line px-4 pb-2 text-sm md:hidden">
            <Link to="/admin/normas">Normas</Link>
            <Link to="/admin/catalogos">Catálogos</Link>
            <Link to="/admin/auditoria">Auditoría</Link>
            <Link to="/admin/usuarios">Usuarios</Link>
          </nav>
          <div className="px-4 py-6 sm:px-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

function EnlaceSidebar({ ruta, activa, children }: { ruta: string; activa: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={ruta}
      aria-current={activa ? 'page' : undefined}
      className={`mb-1 flex items-center rounded-sm px-3 py-2 text-sm transition-colors ${
        activa
          ? 'bg-crema-100/10 font-semibold text-crema-100'
          : 'text-crema-100/70 hover:bg-crema-100/5 hover:text-crema-100'
      }`}
    >
      <span className="rombo" aria-hidden="true">{activa ? '✦' : ''}</span>
      {children}
    </Link>
  )
}
