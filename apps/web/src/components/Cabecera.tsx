import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

export function Cabecera() {
  const [elevada, setElevada] = useState(false)
  const [oscuro, setOscuro] = useState(() => document.documentElement.classList.contains('dark'))
  const ubicacion = useLocation()
  const nombre = import.meta.env.VITE_BRAND_NAME ?? 'Digesto IUPA'

  useEffect(() => {
    const alScrollear = () => setElevada(window.scrollY > 8)
    alScrollear()
    window.addEventListener('scroll', alScrollear, { passive: true })
    return () => window.removeEventListener('scroll', alScrollear)
  }, [])

  function alternarTema() {
    const modoOscuro = document.documentElement.classList.toggle('dark')
    setOscuro(modoOscuro)
    try {
      localStorage.setItem('digesto-tema', modoOscuro ? 'oscuro' : 'claro')
    } catch {
    }
  }

  const esActiva = (ruta: string) =>
    ruta === '/' ? ubicacion.pathname === '/' : ubicacion.pathname.startsWith(ruta)

  return (
    <header
      className={`header-fijo no-print fixed inset-x-0 top-0 z-40 transition-shadow duration-200 ${
        elevada ? 'header-fijo-elevada' : ''
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" aria-label={`Ir al inicio — ${nombre}`}>
          <span className="flex items-center gap-2">
            <img src="/logo-mark.svg" alt="" width={36} height={36}
              className="h-9 w-9 rounded-sm" aria-hidden="true" />
            <span className="font-display text-lg font-semibold tracking-tight text-ink">
              {nombre}
            </span>
          </span>
        </Link>
        <nav aria-label="Navegación principal" className="ml-6 hidden gap-1 text-sm sm:flex">
          <EnlacePanel ruta="/" activa={esActiva('/')}>
            Digesto
          </EnlacePanel>
          <EnlacePanel ruta="/boletin" activa={esActiva('/boletin')}>
            Boletín
          </EnlacePanel>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={alternarTema}
            aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-verde-100 hover:text-ink"
          >
            <span aria-hidden="true">{oscuro ? '☀' : '☾'}</span>
          </button>
          <Link to="/admin" className="btn-acento hidden sm:inline-flex">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </header>
  )
}

function EnlacePanel({
  ruta,
  activa,
  children,
}: {
  ruta: string
  activa: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      to={ruta}
      aria-current={activa ? 'page' : undefined}
      className={`rounded-full px-3 py-1.5 transition-colors ${
        activa
          ? 'bg-verde-100 font-semibold text-verde-900 dark:bg-crema-100/10 dark:text-crema-100'
          : 'text-ink-soft hover:bg-verde-100/60 hover:text-ink dark:hover:bg-crema-100/5'
      }`}
    >
      {children}
    </Link>
  )
}
