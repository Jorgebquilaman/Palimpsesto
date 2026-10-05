import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { pedirAdmin } from '../api/adminApi'

interface ResultadoSubida {
  subidos: { fileName: string; normaId: string; avisoDuplicado: boolean }[]
  errores: { archivo: string; error: string }[]
}

export default function DropzoneNormas() {
  const [arrastrando, setArrastrando] = useState(false)

  const input = useRef<HTMLInputElement>(null)

  const subir = useMutation({
    mutationFn: (archivos: File[]) => {
      const form = new FormData()
      archivos.forEach(a => form.append('archivos', a))
      return pedirAdmin<ResultadoSubida>('/admin/normas', { method: 'POST', body: form })
    },
  })

  function procesar(archivos: FileList | null) {
    if (!archivos || archivos.length === 0) return
    subir.mutate(Array.from(archivos))
  }

  return (
    <section aria-label="Carga de PDFs" className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') input.current?.click() }}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          procesar(e.dataTransfer.files)
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          arrastrando
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900'
        }`}
      >
        <input ref={input} type="file" accept="application/pdf" multiple className="sr-only"
          onChange={(e) => procesar(e.target.files)} />
        <p className="font-medium">Arrastrá los PDFs acá, o hacé clic para elegirlos</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Máximo 50 MB por archivo · solo PDF se acepta · los originales quedan inmutables
        </p>
        {subir.isPending && <p aria-live="polite" className="mt-3 text-sm text-blue-700 dark:text-blue-400">Subiendo y procesando…</p>}
      </div>

      {subir.isError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{(subir.error as Error).message}</p>}

      {subir.data && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-800">
          {subir.data.subidos.length > 0 && (
            <ul className="space-y-1">
              {subir.data.subidos.map(s => (
                <li key={s.normaId}>
                  ✅ {s.fileName} —{' '}
                  <Link to={`/admin/normas/${s.normaId}`} className="font-medium underline">
                    revisar y publicar
                  </Link>
                  {s.avisoDuplicado && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400"> (misma firma SHA-256 que otra subida)</span>}
                </li>
              ))}
            </ul>
          )}
          {subir.data.errores.map(e => (
            <p key={e.archivo} className="text-red-600 dark:text-red-400">❌ {e.archivo}: {e.error}</p>
          ))}
        </div>
      )}
    </section>
  )
}
