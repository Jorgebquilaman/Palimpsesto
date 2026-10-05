import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Busqueda from './pages/Busqueda'
import Norma from './pages/Norma'
import Boletin from './pages/Boletin'
import Admin, { LayoutAdmin } from './pages/Admin'
import NormasAdmin from './pages/NormasAdmin'
import RevisionNorma from './pages/RevisionNorma'
import CatalogosAdmin from './pages/CatalogosAdmin'
import AuditoriaAdmin from './pages/AuditoriaAdmin'
import UsuariosAdmin from './pages/UsuariosAdmin'
import Styleguide from './pages/Styleguide'
import { Cabecera } from './components/Cabecera'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/styleguide" element={<Styleguide />} />
        <Route path="/" element={<Busqueda />} />
        <Route path="/normas/:codigo" element={<Norma />} />
        <Route path="/boletin" element={<Boletin />} />
        <Route path="/admin" element={<Admin />}>
          <Route index element={<Navigate to="/admin/normas" replace />} />
          <Route element={<LayoutAdmin />}>
            <Route path="normas" element={<NormasAdmin />} />
            <Route path="normas/:id" element={<RevisionNorma />} />
            <Route path="catalogos" element={<CatalogosAdmin />} />
            <Route path="auditoria" element={<AuditoriaAdmin />} />
            <Route path="usuarios" element={<UsuariosAdmin />} />
          </Route>
        </Route>
        <Route path="*" element={
          <main className="mx-auto max-w-3xl p-8">
            <h1 className="text-2xl font-bold">Digesto Normativo IUPA</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Página no encontrada.</p>
          </main>
        } />
      </Routes>
    </BrowserRouter>
  )
}
