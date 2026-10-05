import { BrowserRouter, Route, Routes } from 'react-router-dom'

function Inicio() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Digesto Normativo IUPA</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Búsqueda de normas institucionales (en construcción).
      </p>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
      </Routes>
    </BrowserRouter>
  )
}
