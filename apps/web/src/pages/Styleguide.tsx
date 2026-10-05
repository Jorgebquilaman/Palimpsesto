import { useState } from 'react'
import { TituloSeccion, Badge, Estado, EquemaEsqueletos } from '../components/ui'
import { OrnamentoLinea } from '../components/OrnamentoLinea'
import { Marca } from '../components/Marca'

interface MuestraColor {
  nombre: string
  token: string
}

export default function Styleguide() {
  const [oscuro, setOscuro] = useState(() => document.documentElement.classList.contains('dark'))

  function alternar() {
    const modoOscuro = document.documentElement.classList.toggle('dark')
    setOscuro(modoOscuro)
  }

  return (
    <main className="paper mx-auto max-w-5xl px-4 pb-24 pt-10">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="font-display text-display font-semibold tracking-tight text-ink">
            Sistema de diseño
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Tokens, tipografías y componentes del Digesto IUPA. Modo actual:{' '}
            <strong>{oscuro ? 'oscuro' : 'claro'}</strong>.
          </p>
        </div>
        <button type="button" onClick={alternar} className="btn-secundario">
          {oscuro ? '☀ Modo claro' : '☾ Modo oscuro'}
        </button>
      </header>

      <Seccion titulo="Colores — verdes">
        <Muestras colores={[
          { nombre: 'verde-950', token: '--verde-950' },
          { nombre: 'verde-900', token: '--verde-900' },
          { nombre: 'verde-800', token: '--verde-800' },
          { nombre: 'verde-700', token: '--verde-700' },
          { nombre: 'verde-500', token: '--verde-500' },
          { nombre: 'verde-300', token: '--verde-300' },
          { nombre: 'verde-100', token: '--verde-100' },
          { nombre: 'verde-50', token: '--verde-50' },
        ]} />
      </Seccion>

      <Seccion titulo="Colores — terracota y crema">
        <div className="grid gap-6 md:grid-cols-2">
          <Muestras colores={[
            { nombre: 'barro-700', token: '--barro-700' },
            { nombre: 'barro-500', token: '--barro-500' },
            { nombre: 'barro-300', token: '--barro-300' },
            { nombre: 'barro-100', token: '--barro-100' },
          ]} />
          <Muestras colores={[
            { nombre: 'crema-200', token: '--crema-200' },
            { nombre: 'crema-100', token: '--crema-100' },
            { nombre: 'crema-50', token: '--crema-50' },
            { nombre: 'surface', token: '--surface' },
          ]} />
        </div>
      </Seccion>

      <Seccion titulo="Tipografía">
        <div className="panel space-y-5 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Display — Fraunces (variable --font-display)
            </p>
            <p className="mt-1 font-display text-display font-semibold tracking-tight text-ink">
              Digesto Normativo
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Título / lectura — Source Serif 4 (18 px / 1.7)
            </p>
            <p className="mt-1 font-lectura text-subtitulo text-ink">
              El PDF firmado es el documento oficial.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Interfaz — Montserrat 400/500/600
            </p>
            <p className="mt-1 text-sm text-ink">
              Búsqueda de normas institucionales con modos todas / cualquiera / frase exacta.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
              Números tabulares
            </p>
            <p className="num-tabulares mt-1 font-mono text-sm text-ink-soft">
              RES-CS-2024-0123 · 1234/2024
            </p>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Sombras y elevación">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { nombre: 'shadow-sm', clase: 'shadow-sm' },
            { nombre: 'shadow-md', clase: 'shadow-md' },
            { nombre: 'shadow-lg', clase: 'shadow-lg' },
            { nombre: 'shadow-xl', clase: 'shadow-xl' },
          ].map(s => (
            <div key={s.clase} className={`panel ${s.clase} grid h-24 place-items-center bg-surface text-xs text-ink-soft`}>
              {s.nombre}
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Botones">
        <div className="panel flex flex-wrap items-center gap-3 p-6">
          <button className="btn-primario">Buscar</button>
          <button className="btn-primario" disabled>Buscar</button>
          <button className="btn-secundario">Iniciar sesión</button>
          <button className="btn-sutil">Copiar cita</button>
        </div>
      </Seccion>

      <Seccion titulo="Campos">
        <div className="panel grid gap-4 p-6 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">Texto libre</span>
            <input className="campo" placeholder="Buscar en el texto…" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">Selección</span>
            <select className="campo">
              <option>Todas las normas</option>
              <option>Resoluciones</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-ink-soft">Textarea</span>
            <textarea className="campo" rows={2} placeholder="Resumen de la norma…" />
          </label>
        </div>
      </Seccion>

      <Seccion titulo="Panels y hero">
        <div className="space-y-4">
          <div className="panel panel-hover p-6">
            <p className="font-lectura text-ink">Tarjeta con hover: borde línea, sombra pequeña → mediana y translateY(-2px).</p>
          </div>
          <div className="hero-verde overflow-hidden rounded-md p-8">
            <OrnamentoLinea className="h-16 w-64" />
            <h2 className="mt-4 font-display text-titulo font-semibold">Hero con textura y degradado verde</h2>
            <p className="mt-2 max-w-md text-sm opacity-80">
              Fondo 160° verde con resplandor verde-700 arriba a la derecha y ruido soft-light.
            </p>
          </div>
        </div>
      </Seccion>

      <Seccion titulo="Badges de vigencia">
        <div className="panel flex flex-wrap gap-3 p-6">
          {['vigente', 'modificada', 'derogada', 'derogada_parcialmente', 'deja_sin_efecto'].map(v => (
            <Badge key={v} vigencia={v} />
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Chips de filtro">
        <div className="panel flex flex-wrap gap-2 p-6">
          <button className="chip chip-activo">Año 2024 <span aria-hidden="true">×</span></button>
          <button className="chip">Resolución</button>
          <button className="chip">Consejo Superior</button>
        </div>
      </Seccion>

      <Seccion titulo="Estados">
        <div className="grid gap-4 md:grid-cols-3">
          <Estado tipo="vacio" titulo="No se encontraron normas" detalle="Probá con menos palabras o sin filtros." />
          <Estado tipo="cargando" titulo="Cargando resultados…" />
          <Estado tipo="error" titulo="Error al buscar" detalle="Reintentá en unos segundos." />
        </div>
        <div className="mt-4">
          <EquemaEsqueletos cantidad={2} />
        </div>
      </Seccion>

      <Seccion titulo="Tabla densa (backoffice)">
        <div className="overflow-x-auto rounded-md border border-line shadow-sm">
          <table className="tabla w-full text-sm">
            <thead className="bg-crema-50 dark:bg-verde-950/50">
              <tr>
                <th>Código</th>
                <th>Título</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody className="bg-surface">
              <tr className="border-t border-line">
                <td className="num-tabulares font-mono text-xs">RES-CS-2024-0123</td>
                <td>Becas de extensión universitaria</td>
                <td><Badge vigencia="vigente" /></td>
              </tr>
              <tr className="border-t border-line">
                <td className="num-tabulares font-mono text-xs">ORD-CS-2023-0005</td>
                <td>Régimen académico</td>
                <td><Badge vigencia="modificada" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Marca configurable">
        <div className="panel flex items-center gap-6 p-6">
          <Marca />
          <p className="text-sm text-ink-soft">
            Nombre y logo desde <code className="text-acento-texto">VITE_BRAND_NAME</code> /{' '}
            <code className="text-acento-texto">VITE_BRAND_LOGO</code>.
          </p>
        </div>
      </Seccion>
    </main>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <TituloSeccion>{titulo}</TituloSeccion>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Muestras({ colores }: { colores: MuestraColor[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {colores.map(c => (
        <div key={c.token} className="overflow-hidden rounded-sm border border-line">
          <div className="h-14 w-full" style={{ background: `var(${c.token})` }} />
          <div className="bg-surface px-2 py-1.5">
            <p className="text-[11px] font-semibold text-ink">{c.nombre}</p>
            <p className="text-[10px] text-ink-faint">{c.token}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
