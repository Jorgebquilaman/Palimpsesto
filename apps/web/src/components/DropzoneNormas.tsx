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
    <section id="carga" className="ancla-con-header scroll-mt-4 space-y-2" aria-label="Carga de PDFs">
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
        className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center transition-colors ${
          arrastrando
            ? 'border-barro-500 bg-barro-100'
            : 'border-line bg-surface hover:border-barro-300 hover:bg-crema-50'
        }`}
      >
        <input ref={input} type="file" accept="application/pdf" multiple className="sr-only"
          onChange={(e) => procesar(e.target.files)} />
        <p className="font-medium">Arrastrá los PDFs acá, o hacé clic para elegirlos</p>
        <p className="mt-1 text-xs text-ink-faint dark:text-ink-faint">
          Máximo 50 MB por archivo · solo PDF se acepta · los originales quedan inmutables
        </p>
        {subir.isPending && <p aria-live="polite" className="mt-3 text-sm text-blue-700 dark:text-blue-400">Subiendo y procesando…</p>}
      </div>

      {subir.isError && <p role="alert" className="text-sm text-derogada-texto">{(subir.error as Error).message}</p>}

      {subir.data && (
        <div className="panel p-3 text-sm">
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
            <p key={e.archivo} className="text-derogada-texto">❌ {e.archivo}: {e.error}</p>
          ))}
        </div>
      )}
    </section>
  )
}
