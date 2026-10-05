import { useEffect, useState } from 'react'
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
  const ruta = ubicacion.pathname

  const grupoNormas = ruta.startsWith('/admin/normas')
  const grupoCatalogos = ruta.startsWith('/admin/catalogos')

  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({
    normas: grupoNormas,
    catalogos: grupoCatalogos,
  })

  useEffect(() => {
    setAbiertas(a => ({ ...a, normas: grupoNormas || a.normas, catalogos: grupoCatalogos || a.catalogos }))
  }, [grupoNormas, grupoCatalogos])

  if (!sesion) {
    return <Navigate to="/admin" replace />
  }

  function alternar(clave: string) {
    setAbiertas(a => ({ ...a, [clave]: !a[clave] }))
  }

  return (
    <div className="sin-textura min-h-screen bg-crema-50">
      <aside className="no-print fixed inset-y-0 left-0 z-30 flex w-60 flex-col overflow-y-auto bg-verde-950 text-crema-100">
        <Link to="/" className="mb-2 mt-4 flex items-center gap-2 px-4 font-display text-lg font-semibold">
          <img src="/logo-mark-mono.svg" alt="" width={32} height={32}
            className="h-8 w-8 text-crema-100" aria-hidden="true" />
          Backoffice
        </Link>
        <p className="mb-4 px-4 text-xs text-crema-100/50">{sesion.nombre} · {sesion.rol}</p>

        <nav aria-label="Menú del backoffice" className="flex-1 px-2 text-sm">
          <Rama titulo="Normas" icono="☰" abierta={!!abiertas.normas} onAlternar={() => alternar('normas')} activa={grupoNormas}>
            <Hoja ruta="/admin/normas" activa={ruta === '/admin/normas'}>Listado y carga de PDFs</Hoja>
            <Hoja ruta="/admin/normas#procesos" activa={false}>Procesos de ingesta</Hoja>
          </Rama>

          <Rama titulo="Catálogos" icono="✦" abierta={!!abiertas.catalogos} onAlternar={() => alternar('catalogos')} activa={grupoCatalogos}>
            <Hoja ruta="/admin/catalogos/tipos" activa={ruta === '/admin/catalogos/tipos'}>Tipos de norma</Hoja>
            <Hoja ruta="/admin/catalogos/organos" activa={ruta === '/admin/catalogos/organos'}>Órganos emisores</Hoja>
            <Hoja ruta="/admin/catalogos/materias" activa={ruta === '/admin/catalogos/materias'}>Materias</Hoja>
          </Rama>

          <HojaSimple ruta="/admin/boletines" icono="▣" activa={ruta === '/admin/boletines'}>Boletines oficiales</HojaSimple>
          <HojaSimple ruta="/admin/ai" icono="✦" activa={ruta === '/admin/ai'}>Inteligencia artificial</HojaSimple>
          <HojaSimple ruta="/admin/auditoria" icono="❝" activa={ruta === '/admin/auditoria'}>Auditoría</HojaSimple>
          <HojaSimple ruta="/admin/usuarios" icono="◉" activa={ruta === '/admin/usuarios'}>Usuarios y roles</HojaSimple>
        </nav>

        <div className="px-4 py-4 text-sm">
          <Link to="/" className="block rounded-sm px-2 py-1.5 text-crema-100/70 transition-colors hover:bg-crema-100/5 hover:text-crema-100">
            ← Volver al sitio público
          </Link>
          <button onClick={() => { cerrarSesion(); navegar('/admin') }}
            className="mt-1 block w-full rounded-sm px-2 py-1.5 text-left text-crema-100/70 transition-colors hover:bg-crema-100/5 hover:text-crema-100">
            Salir
          </button>
        </div>
      </aside>

      <div className="md:pl-60">
        <div className="no-print flex items-center gap-3 border-b border-line px-4 py-3 md:hidden">
          <Link to="/" className="font-display font-semibold text-verde-900">Digesto IUPA</Link>
          <button onClick={() => { cerrarSesion(); navegar('/admin') }} className="ml-auto text-sm text-ink-soft underline">Salir</button>
        </div>
        <nav aria-label="Navegación del backoffice (chica)" className="no-print flex gap-4 overflow-x-auto border-b border-line px-4 py-2 text-sm md:hidden">
          <Link to="/admin/normas">Normas</Link>
          <Link to="/admin/catalogos">Catálogos</Link>
          <Link to="/admin/auditoria">Auditoría</Link>
          <Link to="/admin/usuarios">Usuarios</Link>
        </nav>
        <div className="px-4 py-6 sm:px-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

function Rama({
  titulo,
  icono,
  abierta,
  onAlternar,
  activa,
  children,
}: {
  titulo: string
  icono: string
  abierta: boolean
  onAlternar: () => void
  activa: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierta}
        className={`flex w-full items-center gap-2 rounded-sm px-2 py-2 font-medium transition-colors ${
          activa ? 'text-crema-100' : 'text-crema-100/80 hover:bg-crema-100/5 hover:text-crema-100'
        }`}
      >
        <span aria-hidden="true" className="text-acento">{icono}</span>
        <span className="flex-1 text-left">{titulo}</span>
        <span aria-hidden="true" className={`text-xs transition-transform ${abierta ? 'rotate-90' : ''}`}>▸</span>
      </button>
      {abierta && <ul className="ml-5 border-l border-crema-100/15 pl-1">{children}</ul>}
    </div>
  )
}

function Hoja({ ruta, activa, children }: { ruta: string; activa: boolean; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={ruta}
        aria-current={activa ? 'page' : undefined}
        className={`block rounded-sm px-2 py-1.5 text-[13px] transition-colors ${
          activa
            ? 'bg-crema-100/10 font-semibold text-crema-100'
            : 'text-crema-100/60 hover:bg-crema-100/5 hover:text-crema-100'
        }`}
      >
        <span className="rombo" aria-hidden="true">{activa ? '✦' : ''}</span>
        {children}
      </Link>
    </li>
  )
}

function HojaSimple({ ruta, icono, activa, children }: { ruta: string; icono: string; activa: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <Link
        to={ruta}
        aria-current={activa ? 'page' : undefined}
        className={`flex items-center gap-2 rounded-sm px-2 py-2 transition-colors ${
          activa
            ? 'bg-crema-100/10 font-semibold text-crema-100'
            : 'text-crema-100/80 hover:bg-crema-100/5 hover:text-crema-100'
        }`}
      >
        <span aria-hidden="true" className="text-acento">{icono}</span>
        {children}
      </Link>
    </div>
  )
}
