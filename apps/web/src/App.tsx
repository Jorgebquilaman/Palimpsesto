import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Cabecera } from './components/Cabecera'
import Busqueda from './pages/Busqueda'
import Norma from './pages/Norma'
import Boletin from './pages/Boletin'
import Styleguide from './pages/Styleguide'
import Admin, { LayoutAdmin } from './pages/Admin'
import NormasAdmin from './pages/NormasAdmin'
import RevisionNorma from './pages/RevisionNorma'
import CatalogosAdmin from './pages/CatalogosAdmin'
import AuditoriaAdmin from './pages/AuditoriaAdmin'
import UsuariosAdmin from './pages/UsuariosAdmin'
import AiAdmin from './pages/AiAdmin'
import AdminBoletines from './pages/AdminBoletines'

function EnPantallaPublica() {
  const ubicacion = useLocation()
  const enAdmin = ubicacion.pathname.startsWith('/admin')
  const enStyleguide = ubicacion.pathname === '/styleguide'

  if (enAdmin || enStyleguide) {
    return <Outlet />
  }

  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:px-4 focus:py-2"
      >
        Saltar al contenido
      </a>
      <Cabecera />
      <div id="contenido" className="paper min-h-[calc(100vh-4rem)] pt-16">
        <Outlet />
      </div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<EnPantallaPublica />}>
          <Route path="/" element={<Busqueda />} />
          <Route path="/normas/:codigo" element={<Norma />} />
          <Route path="/boletin" element={<Boletin />} />
        </Route>

        <Route path="/styleguide" element={<Styleguide />} />

        <Route path="/admin" element={<Admin />}>
          <Route index element={<Navigate to="/admin/normas" replace />} />
          <Route element={<LayoutAdmin />}>
            <Route path="normas" element={<NormasAdmin />} />
            <Route path="normas/:id" element={<RevisionNorma />} />
            <Route path="catalogos" element={<CatalogosAdmin />} />
            <Route path="auditoria" element={<AuditoriaAdmin />} />
            <Route path="usuarios" element={<UsuariosAdmin />} />
            <Route path="ai" element={<AiAdmin />} />
            <Route path="boletines" element={<AdminBoletines />} />
          </Route>
        </Route>

        <Route
          path="*"
          element={
            <main className="mx-auto max-w-3xl p-8">
              <h1 className="text-2xl font-bold">Digesto Normativo IUPA</h1>
              <p className="mt-2 text-ink-soft">Página no encontrada.</p>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
