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
  const [verContrasenia, setVerContrasenia] = useState(false)
  const [recordar, setRecordar] = useState(true)
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
      guardarToken(datos.token, datos.nombre, datos.rol, recordar)
      window.location.assign('/admin/normas')
    } catch {
      setError('No se pudo conectar con el servidor. Verificá que el sistema esté corriendo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <main
      className="no-print flex min-h-screen items-center justify-center bg-verde-950 px-4 py-10"
      style={{
        backgroundImage: 'url(/firma-iupa.jpeg)',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-verde-950/55" />

      <form
        onSubmit={iniciar}
        className="relative w-full max-w-sm rounded-3xl border border-crema-100/40 bg-crema-100/15 p-8 text-crema-100 shadow-2xl backdrop-blur-xl"
      >
        <img src="/logo-iupa.svg" alt="IUPA" width={160} height={44} className="mx-auto h-9 w-auto" />
        <h1 className="mt-5 text-center font-display text-2xl font-semibold">Iniciar sesión</h1>
        <p className="mt-1 text-center text-sm text-crema-100/80">
          Te damos la bienvenida, ingresá a tu cuenta
        </p>

        <label className="mt-6 block text-sm">
          <span className="sr-only">Nombre de usuario</span>
          <span className="flex items-center gap-2 rounded-full border border-crema-100/50 bg-verde-950/20 px-4 py-2.5 backdrop-blur-sm focus-within:border-crema-100">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
            </svg>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoFocus
              required
              placeholder="Nombre de usuario"
              autoComplete="username"
              className="w-full bg-transparent text-crema-100 placeholder:text-crema-100/60 focus:outline-none"
            />
          </span>
        </label>

        <label className="mt-3 block text-sm">
          <span className="sr-only">Contraseña</span>
          <span className="flex items-center gap-2 rounded-full border border-crema-100/50 bg-verde-950/20 px-4 py-2.5 backdrop-blur-sm focus-within:border-crema-100">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              type={verContrasenia ? 'text' : 'password'}
              value={contrasenia}
              onChange={(e) => setContrasenia(e.target.value)}
              required
              placeholder="Contraseña"
              autoComplete="current-password"
              className="w-full bg-transparent text-crema-100 placeholder:text-crema-100/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setVerContrasenia(v => !v)}
              aria-label={verContrasenia ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={verContrasenia ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="text-crema-100/70 hover:text-crema-100"
            >
              {verContrasenia ? (
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 12s3.5-6 10-6c2.4 0 4.4.8 6 2M22 12s-3.5 6-10 6c-2.4 0-4.4-.8-6-2" />
                  <path d="M3 3l18 18" />
                </svg>
              ) : (
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
          </span>
        </label>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-crema-100/90">
          <input
            type="checkbox"
            checked={recordar}
            onChange={(e) => setRecordar(e.target.checked)}
            className="h-4 w-4 rounded accent-[#d6865b]"
          />
          Recuérdame
        </label>

        {error && <p role="alert" className="mt-3 rounded-md bg-[var(--derogada)]/30 px-3 py-2 text-sm text-crema-100">{error}</p>}

        <button type="submit" disabled={cargando}
          className="btn-acento mt-5 w-full disabled:opacity-50">
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>

        <p className="mt-4 text-center text-xs text-crema-100/70">
          Backoffice del Digesto Normativo IUPA
        </p>
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
  const [menuOculto, setMenuOculto] = useState(() => {
    try { return localStorage.getItem('digesto-menu-oculto') === 'si' } catch { return false }
  })

  function alternarMenu() {
    setMenuOculto(v => {
      const nuevo = !v
      try { localStorage.setItem('digesto-menu-oculto', nuevo ? 'si' : 'no') } catch { }
      return nuevo
    })
  }

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
      <aside className={"no-print fixed inset-y-0 left-0 z-30 flex w-60 flex-col overflow-y-auto bg-verde-950 text-crema-100 transition-transform duration-200 " + (menuOculto ? "-translate-x-full" : "")}>
        <button type="button" onClick={alternarMenu}
          className="absolute right-2 top-3 text-xs text-crema-100/50 hover:text-crema-100"
          aria-label="Ocultar menú" title="Ocultar menú (máximo espacio)">
          « ocultar
        </button>
        <Link to="/" className="mb-2 mt-4 flex flex-col items-start gap-1 px-4">
          <img src="/logo-iupa.svg" alt="IUPA" width={160} height={44}
            className="h-9 w-auto" aria-hidden="true" />
          <span className="text-xs text-crema-100/50">Backoffice</span>
        </Link>
        <p className="mb-4 px-4 text-xs text-crema-100/50">{sesion.nombre} · {sesion.rol}</p>

        <nav aria-label="Menú del backoffice" className="flex-1 px-2 text-sm">
          <Rama titulo="Normas" icono={<Icono nombre="normas" />} abierta={!!abiertas.normas} onAlternar={() => alternar('normas')} activa={grupoNormas}>
            <Hoja ruta="/admin/normas" activa={ruta === '/admin/normas'}>Listado y carga de PDFs</Hoja>
            <Hoja ruta="/admin/normas#procesos" activa={false}>Procesos de ingesta</Hoja>
          </Rama>

          <Rama titulo="Catálogos" icono={<Icono nombre="catalogos" />} abierta={!!abiertas.catalogos} onAlternar={() => alternar('catalogos')} activa={grupoCatalogos}>
            <Hoja ruta="/admin/catalogos/tipos" activa={ruta === '/admin/catalogos/tipos'}>Tipos de norma</Hoja>
            <Hoja ruta="/admin/catalogos/organos" activa={ruta === '/admin/catalogos/organos'}>Órganos emisores</Hoja>
            <Hoja ruta="/admin/catalogos/materias" activa={ruta === '/admin/catalogos/materias'}>Materias</Hoja>
          </Rama>

          <HojaSimple ruta="/admin/boletines" icono={<Icono nombre="boletines" />} activa={ruta === '/admin/boletines'}>Boletines oficiales</HojaSimple>
          <HojaSimple ruta="/admin/ai" icono={<Icono nombre="ai" />} activa={ruta === '/admin/ai'}>Inteligencia artificial</HojaSimple>
          <HojaSimple ruta="/admin/auditoria" icono={<Icono nombre="auditoria" />} activa={ruta === '/admin/auditoria'}>Auditoría</HojaSimple>
          <HojaSimple ruta="/admin/perfil" icono={<Icono nombre="perfil" />} activa={ruta === '/admin/perfil'}>Mi perfil</HojaSimple>
          <HojaSimple ruta="/admin/usuarios" icono={<Icono nombre="usuarios" />} activa={ruta === '/admin/usuarios'}>Usuarios y roles</HojaSimple>
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

      {menuOculto && (
        <button type="button" onClick={alternarMenu}
          className="no-print fixed left-3 top-3 z-30 rounded-md bg-verde-950 px-2.5 py-1.5 text-sm text-crema-100 shadow-md hover:bg-verde-900"
          aria-label="Mostrar menú" title="Mostrar menú">
          ☰
        </button>
      )}
      <div className={"transition-[padding] duration-200 " + (menuOculto ? "md:pl-0" : "md:pl-60")}>
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

function Icono({ nombre }: { nombre: 'normas' | 'catalogos' | 'boletines' | 'ai' | 'auditoria' | 'perfil' | 'usuarios' }) {
  const comun = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const
  switch (nombre) {
    case 'normas':
      return (<svg {...comun} aria-hidden="true"><path d="M6 2h9l5 5v15H6V2Z" /><path d="M14 2v6h6" /><path d="M9 13h7M9 17h7" /></svg>)
    case 'catalogos':
      return (<svg {...comun} aria-hidden="true"><path d="M3 3v7l9 9 7-7-9-9H3Z" /><circle cx="7.5" cy="7.5" r="1.2" /></svg>)
    case 'boletines':
      return (<svg {...comun} aria-hidden="true"><path d="M5 3h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V3Z" /><path d="M19 17v2a2 2 0 0 1-2 2H5" /><path d="M9 8h6M9 12h6" /></svg>)
    case 'ai':
      return (<svg {...comun} aria-hidden="true"><path d="M12 2c.7 4.8 3.2 7.3 8 8-4.8.7-7.3 3.2-8 8-.7-4.8-3.2-7.3-8-8 4.8-.7 7.3-3.2 8-8Z" /><path d="M19 3v4M21 5h-4" /></svg>)
    case 'auditoria':
      return (<svg {...comun} aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4a3 3 0 0 1 6 0" /><path d="m9.5 14 2 2 3.5-4" /></svg>)
    case 'perfil':
      return (<svg {...comun} aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" /></svg>)
    case 'usuarios':
      return (<svg {...comun} aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" /><path d="M16 5a3.5 3.5 0 0 1 0 6.8M18.5 14.7c2 .8 3 2.3 3 4.3" /></svg>)
  }
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
  icono: React.ReactNode
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

function HojaSimple({ ruta, icono, activa, children }: { ruta: string; icono: React.ReactNode; activa: boolean; children: React.ReactNode }) {
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
