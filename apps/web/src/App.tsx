import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Busqueda from './pages/Busqueda'
import Norma from './pages/Norma'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Busqueda />} />
        <Route path="/normas/:codigo" element={<Norma />} />
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
