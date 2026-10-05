import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { completarConAi, ETIQUETAS_ESTADO, ETIQUETAS_VISIBILIDAD, ETIQUETAS_VIGENCIA, pedirAdmin, pedirAiEstado, tokenActual } from '../api/adminApi'
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
  const [confirmado, setConfirmado] = useState(false)

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

  const guardarTodo = useMutation({
    mutationFn: async () => {
      await pedirAdmin(`/admin/normas/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          titulo: formulario.titulo ?? normaa?.titulo,
          numero: formulario.numero ?? normaa?.numero,
          anio: formulario.anio ?? normaa?.anio,
          sufijo: formulario.sufijo ?? null,
          tipoNormaId: formulario.tipoNormaId ?? normaa?.tipoNormaId,
          organoEmisorId: formulario.organoEmisorId ?? normaa?.organoEmisorId,
          fechaSancion: formulario.fechaSancion === undefined ? normaa?.fechaSancion : (formulario.fechaSancion === '' ? null : formulario.fechaSancion),
          fechaPublicacion: formulario.fechaPublicacion === '' ? null : (formulario.fechaPublicacion ?? null),
          resumen: formulario.resumen ?? null,
          palabrasClave: formulario.palabrasClave ?? undefined,
          expediente: formulario.expediente ?? null,
          visibilidad: formulario.visibilidad ?? undefined,
          vigencia: formulario.vigencia ?? undefined,
        }),
      })
      if (normaa && Object.keys(fragmentosEdit).length > 0) {
        await pedirAdmin(`/admin/normas/${id}/fragmentos`, {
          method: 'PUT',
          body: JSON.stringify(normaa.fragmentos.map(f => ({
            orden: f.orden,
            texto: fragmentosEdit[f.orden] ?? f.texto,
            html: null,
            etiqueta: f.etiqueta,
          }))),
        })
      }
    },
    onSuccess: () => {
      setMensaje('Cambios guardados')
      setConfirmado(true)
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

  const completarAi = useMutation({
    mutationFn: () => completarConAi(id),
    onSuccess: (r) => {
      const campos = r.camposAplicados.length > 0 ? `Campos: ${r.camposAplicados.join(', ')}` : ''
      const relaciones = r.relacionesCreadas.length > 0
        ? ` · relaciones: ${r.relacionesCreadas.map(x => `${x.tipoRelacion} ${x.codigoDestino}`).join(', ')}`
        : ''
      setMensaje(`AI completó la información. ${campos}${relaciones}`)
      void cliente.invalidateQueries({ queryKey: ['admin-norma', id] })
      void cliente.invalidateQueries({ queryKey: ['admin-norma-relaciones', id] })
    },
    onError: (e) => setMensaje(`Error: ${(e as Error).message}`),
  })

  const codigoNormalizado = normaa?.codigoNormalizado ?? ''

  const { data: estadoAi } = useQuery({
    queryKey: ['ai-estado'],
    queryFn: pedirAiEstado,
  })

  const { data: pdfUrl } = useQuery({
    queryKey: ['admin-norma-pdf', id],
    queryFn: async () => {
      const respuesta = await fetch(`/api/v1/admin/normas/${id}/pdf`, {
        headers: { Authorization: `Bearer ${tokenActual() ?? ''}` },
      })
      if (!respuesta.ok) {
        throw new Error('No se pudo cargar el PDF')
      }
      const blob = await respuesta.blob()
      return URL.createObjectURL(blob)
    },
    enabled: !!normaa,
    staleTime: Infinity,
    retry: 1,
  })

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl])

  const { data: relaciones } = useQuery({
    queryKey: ['admin-norma-relaciones', id, codigoNormalizado],
    queryFn: () => pedirAdmin<{
      origen: { id: number; tipo: string; detalle: string | null; normaDestino: { codigoNormalizado: string; titulo: string } }[]
      destino: { id: number; tipo: string; detalle: string | null; normaOrigen: { codigoNormalizado: string; titulo: string } }[]
    }>(`/normas/${encodeURIComponent(codigoNormalizado)}/relaciones`),
    enabled: !!normaa,
  })

  if (isPending) return <p aria-live="polite">Cargando…</p>
  if (isError) return <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>

  const norma = normaa!

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/normas" className="text-sm underline text-ink-faint">← Volver</Link>
        <h1 className="text-xl font-bold">{norma.codigoNormalizado}</h1>
        <span className="rounded bg-verde-100 px-2 py-0.5 text-xs dark:bg-crema-100/5">
          {ETIQUETAS_ESTADO[norma.estado] ?? norma.estado}
        </span>
        {norma.textoOrigen === 'ocr' && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">texto OCR</span>}
        <div className="ml-auto flex gap-2">
          <button onClick={() => completarAi.mutate()} disabled={!estadoAi?.configurada || completarAi.isPending}
            className="btn-acento" title={!estadoAi?.configurada ? 'Configurá la clave en Inteligencia artificial' : 'Completar metadatos, resumen y relaciones con DeepSeek'}>
            <span aria-hidden="true">✦</span> {completarAi.isPending ? 'Consultando a la AI…' : 'Completar con AI'}
          </button>
          <button onClick={() => reprocesar.mutate()} className="btn-secundario">
            Reprocesar
          </button>
          {norma.estado === 'publicada'
            ? <button onClick={() => despublicar.mutate()} className="btn-secundario">Despublicar</button>
            : <button onClick={() => publicar.mutate()} disabled={norma.estado !== 'en_revision'}
                className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
                Publicar
              </button>}
        </div>
      </div>

      <div aria-live="polite">{mensaje && <p className="text-sm text-vigente-texto">{mensaje}</p>}</div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="PDF original" className="panel p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint"><span className="rombo" aria-hidden="true">✦</span>PDF original (documento oficial, inmutable)</h2>
          {norma.archivos.find(a => a.rol === 'original') ? (
            <embed src={pdfUrl} type="application/pdf" className="h-[70vh] w-full rounded-md" aria-label="PDF original de la norma" />
          ) : (
            <p className="text-sm text-ink-faint">Sin PDF cargado.</p>
          )}
        </section>

        <section aria-label="Metadatos sugeridos" className="space-y-3">

          <form
            onSubmit={(e) => { e.preventDefault(); guardarTodo.mutate() }}
            className="panel p-4"
          >
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint"><span className="rombo" aria-hidden="true">✦</span>Metadatos (sugeridos: corregí antes de publicar)</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="col-span-2 block">
                Título
                <input value={input('titulo')} onChange={(e) => campo('titulo', e.target.value)}
                  className="mt-1 campo" />
              </label>
              <label className="block">
                Tipo
                <select value={`${input('tipoNormaId')}`} onChange={(e) => campo('tipoNormaId', Number(e.target.value))}
                  className="mt-1 campo">
                  {(catalogue?.tipos ?? []).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </label>
              <label className="block">
                Órgano emisor
                <select value={`${input('organoEmisorId')}`} onChange={(e) => campo('organoEmisorId', Number(e.target.value))}
                  className="mt-1 campo">
                  {(catalogue?.organos ?? []).map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </label>
              <label className="block">
                Número
                <input type="number" value={`${input('numero')}`} onChange={(e) => campo('numero', Number(e.target.value))}
                  className="mt-1 campo" />
              </label>
              <label className="block">
                Año
                <input type="number" value={`${input('anio')}`} onChange={(e) => campo('anio', Number(e.target.value))}
                  className="mt-1 campo" />
              </label>
              <label className="block">
                Fecha de sanción
                <input type="date" value={`${input('fechaSancion')}`} onChange={(e) => campo('fechaSancion', e.target.value)}
                  className="mt-1 campo" />
              </label>
              <label className="block">
                Fecha de publicación
                <input type="date" value={`${input('fechaPublicacion')}` || ''} onChange={(e) => campo('fechaPublicacion', e.target.value)}
                  className="mt-1 campo" />
              </label>
              <label className="block">
                Vigencia
                <select value={`${input('vigencia')}`} onChange={(e) => campo('vigencia', e.target.value)}
                  className="mt-1 campo">
                  {Object.entries(ETIQUETAS_VIGENCIA).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
                </select>
              </label>
              <label className="block">
                Visibilidad
                <select value={`${input('visibilidad')}`} onChange={(e) => campo('visibilidad', e.target.value)}
                  className="mt-1 campo">
                  {Object.entries(ETIQUETAS_VISIBILIDAD).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
                </select>
              </label>
              <label className="col-span-2 block">
                Expediente
                <input value={`${input('expediente')}`} onChange={(e) => campo('expediente', e.target.value)}
                  className="mt-1 campo" />
              </label>
              <label className="col-span-2 block">
                Resumen
                <textarea value={`${input('resumen')}`} onChange={(e) => campo('resumen', e.target.value)} rows={2}
                  className="mt-1 campo" />
              </label>
            </div>
            <button type="submit" disabled={guardarTodo.isPending} className="btn-acento mt-3">
              <span aria-hidden="true">✦</span> {guardarTodo.isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>

          <section aria-label="Relaciones" className="panel p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint"><span className="rombo" aria-hidden="true">✦</span>Relaciones</h2>
            <FormularioRelacion normaId={norma.id} onQueCambio={(msg) => setMensaje(msg)} clienteWebsocketRefresco={cliente} />
            {relaciones && (relaciones.origen.length > 0 || relaciones.destino.length > 0) ? (
              <ul className="mt-3 space-y-1 text-sm">
                {relaciones.origen.map(r => (
                  <li key={`o${r.id}`}>
                    <strong>{r.tipo}</strong> → {r.normaDestino.codigoNormalizado}
                    <button type="button" className="ml-2 text-xs underline text-ink-faint"
                      onClick={() => pedirAdmin(`/admin/relaciones/${r.id}`, { method: 'DELETE' }).then(() => cliente.invalidateQueries({ queryKey: ['admin-norma-relaciones', id] }))}>
                      quitar
                    </button>
                  </li>
                ))}
                {relaciones.destino.map(r => (
                  <li key={`d${r.id}`}>
                    <strong>{r.tipo}</strong> ← {r.normaOrigen.codigoNormalizado}
                    <button type="button" className="ml-2 text-xs underline text-ink-faint"
                      onClick={() => pedirAdmin(`/admin/relaciones/${r.id}`, { method: 'DELETE' }).then(() => cliente.invalidateQueries({ queryKey: ['admin-norma-relaciones', id] }))}>
                      quitar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-faint">Sin relaciones registradas.</p>
            )}
          </section>

          <section aria-label="Fragmentos de texto" className="panel p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-faint"><span className="rombo" aria-hidden="true">✦</span>Fragmentos (corrección manual)</h2>
            <div className="max-h-[45vh] space-y-3 overflow-auto">
              {norma.fragmentos.map(f => (
                <label key={f.orden} className="block text-sm">
                  <span className="text-xs font-medium text-ink-faint">
                    {f.orden}. {f.etiqueta ?? f.tipo}{f.paginaDesde ? ` (pág. ${f.paginaDesde})` : ''}
                  </span>
                  <textarea
                    value={fragmentosEdit[f.orden] ?? f.texto}
                    rows={3}
                    onChange={(e) => setFragmentosEdit(prev => ({ ...prev, [f.orden]: e.target.value }))}
                    className="mt-1 campo"
                  />
                </label>
              ))}
            </div>
          </section>
        </section>
      </div>
      {confirmado && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-confirmado"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setConfirmado(false)}
        >
          <div className="panel max-w-sm p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-verde-100 text-2xl text-verde-700" aria-hidden="true">✓</div>
            <h2 id="titulo-confirmado" className="mb-1 text-lg font-bold">Cambios guardados</h2>
            <p className="mb-4 text-sm text-ink-soft">El documento se guardó correctamente.</p>
            <button autoFocus onClick={() => setConfirmado(false)} className="btn-acento">
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


function FormularioRelacion({
  normaId,
  onQueCambio,
  clienteWebsocketRefresco,
}: {
  normaId: string
  onQueCambio: (m: string) => void
  clienteWebsocketRefresco: ReturnType<typeof useQueryClient>
}) {
  const [codigoDestino, setCodigoDestino] = useState('')
  const [tipo, setTipo] = useState('modifica')

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          const r = await fetch(`/api/v1/normas/${encodeURIComponent(codigoDestino)}`)
          if (!r.ok) {
            onQueCambio('Norma destino no encontrada')
            return
          }
          const d = await r.json()
          const tipos: Record<string, number> = {
            modifica: 1, deroga: 2, derogaparcialmente: 3, reglamenta: 4,
            complementa: 5, ratifica: 6, dejainsineffecto: 7,
          }
          await pedirAdmin(`/admin/normas/${normaId}/relaciones`, {
            method: 'POST',
            body: JSON.stringify({ normaDestinoId: d.id, tipo: tipos[tipo] }),
          })
          onQueCambio('Relación agregada')
          void clienteWebsocketRefresco.invalidateQueries({ queryKey: ['admin-norma-relaciones', normaId] })
        } catch (err) {
          onQueCambio(`Error: ${(err as Error).message}`)
        }
      }}
    >
      <input
        placeholder="código destino (ev. RES-CS-2024-0123)"
        value={codigoDestino}
        onChange={(e) => setCodigoDestino(e.target.value)}
        className="flex-1 campo"
      />
      <select value={tipo} onChange={(e) => setTipo(e.target.value)}
        className="campo">
        <option value="modifica">modifica</option>
        <option value="deroga">deroga</option>
        <option value="derogaparcialmente">deroga parcialmente</option>
        <option value="reglamenta">reglamenta</option>
        <option value="complementa">complementa</option>
        <option value="ratifica">ratifica</option>
        <option value="dejainsineffecto">deja sin efecto</option>
      </select>
      <button type="submit" className="rounded bg-blue-700 px-3 py-1 text-sm text-white hover:bg-blue-800">
        Agregar
      </button>
    </form>
  )
}
