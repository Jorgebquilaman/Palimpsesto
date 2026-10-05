import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ETIQUETAS_ESTADO, ETIQUETAS_VISIBILIDAD, ETIQUETAS_VIGENCIA, pedirAdmin } from '../api/adminApi'
import type { NormaAdminDetalle } from '../api/adminApi'

export default function RevisionNorma() {
  const { id = '' } = useParams()
  const cliente = useQueryClient()

  const { data: normaa, isPending, isError, error } = useQuery({
    queryKey: ['admin-norma', id],
    queryFn: () => pedirAdmin<NormaAdminDetalle>(`/admin/normas/${id}`),
    refetchInterval: (consulta) =>
      consulta.state.data?.estado === 'procesando' ? 4_000 : false,
  })

  const { data: catalogue } = useQuery({
    queryKey: ['admin-catalogos'],
    queryFn: () => pedirAdmin<{
      tipos: { id: number; codigo: string; nombre: string }[]
      organos: { id: number; codigo: string; nombre: string }[]
      boletin: { id: number; numero: string; fechaPublicacion: string }[]
    }>('/admin/catalogos'),
  })

  const [formulario, setConfigurar] = useState<Partial<NormaAdminDetalle>>({})
  const [fragmentosEdit, setFragmentosEdit] = useState<Record<number, string>>({})
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    if (normaa && Object.keys(formulario).length === 0) {
      setConfigurar({
        titulo: normaa.titulo,
        numero: normaa.numero,
        anio: normaa.anio,
        tipoNormaId: normaa.tipoNormaId,
        organoEmisorId: normaa.organoEmisorId,
        fechaSancion: normaa.fechaSancion,
        visibilidad: normaa.visibilidad,
        vigencia: normaa.vigencia,
        expediente: normaa.expediente ?? '',
        resumen: normaa.resumen ?? '',
      })
    }
  }, [normaa])

  function campo<K extends keyof NormaAdminDetalle>(clave: K, valor: NormaAdminDetalle[K]) {
    setConfigurar(f => ({ ...f, [clave]: valor }))
  }

  function input(k: keyof NormaAdminDetalle): string {
    const v = formulario[k] ?? (normaa?.[k] as unknown)
    return v === undefined || v === null ? '' : String(v)
  }

  const guardar = useMutation({
    mutationFn: () => pedirAdmin(`/admin/normas/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        titulo: formulario.titulo ?? normaa?.titulo,
        numero: formulario.numero ?? normaa?.numero,
        anio: formulario.anio ?? normaa?.anio,
        sufijo: formulario.sufijo ?? null,
        tipoNormaId: formulario.tipoNormaId ?? normaa?.tipoNormaId,
        organoEmisorId: formulario.organoEmisorId ?? normaa?.organoEmisorId,
        fechaSancion: formulario.fechaSancion ?? normaa?.fechaSancion,
        fechaPublicacion: formulario.fechaPublicacion ?? null,
        resumen: formulario.resumen ?? null,
        palabrasClave: formulario.palabrasClave ?? undefined,
        expediente: formulario.expediente ?? null,
        visibilidad: formulario.visibilidad ?? undefined,
        vigencia: formulario.vigencia ?? undefined,
      }),
    }),
    onSuccess: () => {
      setMensaje('Cambios guardados')
      void cliente.invalidateQueries({ queryKey: ['admin-norma', id] })
    },
    onError: (e) => setMensaje(`Error: ${(e as Error).message}`),
  })

  const publicar = useMutation({
    mutationFn: () => pedirAdmin(`/admin/normas/${id}/publicar`, { method: 'POST' }),
    onSuccess: () => {
      setMensaje('Norma publicada')
      void cliente.invalidateQueries({ queryKey: ['admin-norma', id] })
    },
    onError: (e) => setMensaje(`Error: ${(e as Error).message}`),
  })

  const despublicar = useMutation({
    mutationFn: () => pedirAdmin(`/admin/normas/${id}/despublicar`, { method: 'POST' }),
    onSuccess: () => {
      setMensaje('Norma despublicada (en revisión)')
      void cliente.invalidateQueries({ queryKey: ['admin-norma', id] })
    },
    onError: (e) => setMensaje(`Error: ${(e as Error).message}`),
  })

  const reprocesar = useMutation({
    mutationFn: () => pedirAdmin(`/admin/normas/${id}/reprocesar`, { method: 'POST' }),
    onSuccess: () => {
      setMensaje('Reprocesamiento encolado')
      void cliente.invalidateQueries({ queryKey: ['admin-norma', id] })
      void cliente.invalidateQueries({ queryKey: ['admin-procesos'] })
    },
    onError: (e) => setMensaje(`Error: ${(e as Error).message}`),
  })

  const guardarFragmentos = useMutation({
    mutationFn: (fragmentos: { orden: number; texto: string; html: string | null; etiqueta: string | null }[]) =>
      pedirAdmin(`/admin/normas/${id}/fragmentos`, { method: 'PUT', body: JSON.stringify(fragmentos) }),
    onSuccess: () => {
      setMensaje('Fragmentos guardados')
      void cliente.invalidateQueries({ queryKey: ['admin-norma', id] })
    },
    onError: (e) => setMensaje(`Error: ${(e as Error).message}`),
  })

  if (isPending) return <p aria-live="polite">Cargando…</p>
  if (isError) return <p role="alert" className="text-red-600">{(error as Error).message}</p>

  const norma = normaa!

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/normas" className="text-sm underline text-gray-500">← Volver</Link>
        <h1 className="text-xl font-bold">{norma.codigoNormalizado}</h1>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
          {ETIQUETAS_ESTADO[norma.estado] ?? norma.estado}
        </span>
        {norma.textoOrigen === 'ocr' && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">texto OCR</span>}
        <div className="ml-auto flex gap-2">
          <button onClick={() => reprocesar.mutate()} className="rounded-lg border px-3 py-1.5 text-sm dark:border-gray-700">
            Reprocesar
          </button>
          {norma.estado === 'publicada'
            ? <button onClick={() => despublicar.mutate()} className="rounded-lg border px-3 py-1.5 text-sm dark:border-gray-700">Despublicar</button>
            : <button onClick={() => publicar.mutate()} disabled={norma.estado !== 'en_revision'}
                className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
                Publicar
              </button>}
        </div>
      </div>

      <div aria-live="polite">{mensaje && <p className="text-sm text-green-700 dark:text-green-400">{mensaje}</p>}</div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="PDF original" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">PDF original (documento oficial, inmutable)</h2>
          {norma.archivos.find(a => a.rol === 'original') ? (
            <embed src={`/api/v1/admin/normas/${norma.id}/pdf-admin`} type="application/pdf" className="h-[70vh] w-full rounded-lg" />
          ) : (
            <p className="text-sm text-gray-500">Sin PDF cargado.</p>
          )}
        </section>

        <section aria-label="Metadatos sugeridos" className="space-y-3">

          <form
            onSubmit={(e) => { e.preventDefault(); guardar.mutate() }}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Metadatos (sugeridos por el sistema: corregí antes de publicar)</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="col-span-2 block">
                Título
                <input value={input('titulo')} onChange={(e) => campo('titulo', e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800" />
              </label>
              <label className="block">
                Tipo
                <select value={`${input('tipoNormaId')}`} onChange={(e) => campo('tipoNormaId', Number(e.target.value))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800">
                  {(catalogue?.tipos ?? []).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </label>
              <label className="block">
                Órgano emisor
                <select value={`${input('organoEmisorId')}`} onChange={(e) => campo('organoEmisorId', Number(e.target.value))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800">
                  {(catalogue?.organos ?? []).map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </label>
              <label className="block">
                Número
                <input type="number" value={`${input('numero')}`} onChange={(e) => campo('numero', Number(e.target.value))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800" />
              </label>
              <label className="block">
                Año
                <input type="number" value={`${input('anio')}`} onChange={(e) => campo('anio', Number(e.target.value))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800" />
              </label>
              <label className="block">
                Fecha de sanción
                <input type="date" value={`${input('fechaSancion')}`} onChange={(e) => campo('fechaSancion', e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800" />
              </label>
              <label className="block">
                Fecha de publicación
                <input type="date" value={`${input('fechaPublicacion')}` || ''} onChange={(e) => campo('fechaPublicacion', e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800" />
              </label>
              <label className="block">
                Vigencia
                <select value={`${input('vigencia')}`} onChange={(e) => campo('vigencia', e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800">
                  {Object.entries(ETIQUETAS_VIGENCIA).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
                </select>
              </label>
              <label className="block">
                Visibilidad
                <select value={`${input('visibilidad')}`} onChange={(e) => campo('visibilidad', e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800">
                  {Object.entries(ETIQUETAS_VISIBILIDAD).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
                </select>
              </label>
              <label className="col-span-2 block">
                Expediente
                <input value={`${input('expediente')}`} onChange={(e) => campo('expediente', e.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800" />
              </label>
              <label className="col-span-2 block">
                Resumen
                <textarea value={`${input('resumen')}`} onChange={(e) => campo('resumen', e.target.value)} rows={2}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800" />
              </label>
            </div>
            <button type="submit" className="mt-3 rounded-lg bg-blue-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-800">
              Guardar metadatos
            </button>
          </form>

          <section aria-label="Fragmentos de texto" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Fragmentos (corrección manual)</h2>
            <div className="max-h-[45vh] space-y-3 overflow-auto">
              {norma.fragmentos.map(f => (
                <label key={f.orden} className="block text-sm">
                  <span className="text-xs font-medium text-gray-500">
                    {f.orden}. {f.etiqueta ?? f.tipo}{f.paginaDesde ? ` (pág. ${f.paginaDesde})` : ''}
                  </span>
                  <textarea
                    value={f.texto}
                    rows={3}
                    onChange={(e) => setFragmentosEdit(prev => ({ ...prev, [f.orden]: e.target.value }))}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => guardarFragmentos.mutate(norma.fragmentos.map(f => ({
                orden: f.orden,
                texto: fragmentosEdit[f.orden] ?? f.texto,
                html: null,
                etiqueta: f.etiqueta,
              })))}
              className="mt-3 rounded-lg bg-blue-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Guardar fragmentos
            </button>
          </section>
        </section>
      </div>
    </div>
  )
}

