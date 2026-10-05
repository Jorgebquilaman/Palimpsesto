import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ResultadoAi } from '../api/adminApi'
import { limpiarNorma, eliminarNorma } from '../api/adminApi'
import { completarConAiStream, ETIQUETAS_ESTADO, ETIQUETAS_VISIBILIDAD, ETIQUETAS_VIGENCIA, pedirAdmin, pedirAiEstado, tokenActual } from '../api/adminApi'
import type { NormaAdminDetalle } from '../api/adminApi'

const PASOS_AI = ['preparar', 'renderizar', 'consultar', 'aplicar']

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
  const [aiModal, setAiModal] = useState<{ fase: 'proceso' | 'exito' | 'error'; resultado?: ResultadoAi; error?: string } | null>(null)
  const [confirmar, setConfirmar] = useState<{ titulo: string; detalle: string; accion: 'limpiar' | 'eliminar' } | null>(null)
  const [pasosAi, setPasosAi] = useState<{ texto: string; detalle: string | null; estado: 'pendiente' | 'haciendo' | 'hecho' | 'error' }[]>([])

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
    mutationFn: () => {
      setPasosAi([
        { texto: 'Tomar el PDF original', detalle: null, estado: 'pendiente' },
        { texto: 'Renderizar las páginas como imágenes', detalle: null, estado: 'pendiente' },
        { texto: 'Consultar a DeepSeek (lee el documento)', detalle: null, estado: 'pendiente' },
        { texto: 'Aplicar los datos deducidos', detalle: null, estado: 'pendiente' },
      ])
      return completarConAiStream(id, (evento: { etapa: string; detalle: string | null }) => {
        setPasosAi(prev => {
          const indice = PASOS_AI.indexOf(evento.etapa)
          if (indice < 0) return prev
          return prev.map((paso, i) => ({
            ...paso,
            estado: i < indice ? 'hecho' : (i === indice ? 'haciendo' : 'pendiente'),
            detalle: i === indice ? (evento.detalle ?? paso.detalle) : paso.detalle,
          }))
        })
      })
    },
    onMutate: () => setAiModal({ fase: 'proceso' }),
    onSuccess: (final) => {
      setPasosAi(prev => prev.map(p => (p.estado === 'haciendo' || p.estado === 'pendiente') ? { ...p, estado: final.estado === 'exito' ? 'hecho' : 'error', detalle: p.estado === 'haciendo' ? p.detalle : p.detalle } : p))
      if (final.estado === 'exito') {
        setAiModal({ fase: 'exito', resultado: { camposAplicados: final.camposAplicados ?? [], relacionesCreadas: final.relacionesCreadas ?? [], advertencias: final.advertencias ?? [] } })
      } else {
        setAiModal({ fase: 'error', error: final.detalle ?? 'Sin detalle' })
      }
      setConfigurar({})
      setFragmentosEdit({})
      void cliente.invalidateQueries({ queryKey: ['admin-norma', id] })
      void cliente.invalidateQueries({ queryKey: ['admin-norma-relaciones', id] })
    },
    onError: (e) => setAiModal({ fase: 'error', error: (e as Error).message }),
  })

  const accionConfirmada = useMutation({
    mutationFn: async () => {
      if (confirmar?.accion === 'limpiar') return await limpiarNorma(id)
      return await eliminarNorma(id)
    },
    onSuccess: () => {
      if (confirmar?.accion === 'limpiar') {
        setConfirmar(null)
        setConfigurar({})
        setFragmentosEdit({})
        setMensaje('Datos en blanco')
        void cliente.invalidateQueries({ queryKey: ['admin-norma', id] })
      } else {
        void cliente.invalidateQueries({ queryKey: ['admin-normas'] })
        window.location.assign('/admin/normas')
      }
    },
    onError: (e) => {
      setMensaje(`Error: ${(e as Error).message}`)
      setConfirmar(null)
    },
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
            <span aria-hidden="true">✦</span> Completar con AI
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
            <embed src={pdfUrl} type="application/pdf" className="h-[70vh] w-full rounded-md lg:h-[calc(100vh-13rem)]" aria-label="PDF original de la norma" />
          ) : (
            <p className="text-sm text-ink-faint">Sin PDF cargado.</p>
          )}
        </section>

        <section aria-label="Metadatos sugeridos" className="space-y-3 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1">

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

          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <button
              onClick={() => setConfirmar({
                titulo: '¿Poner los datos en blanco?',
                detalle: 'Se borran TODOS los metadatos (título, resumen, palabras clave, expediente, fechas, número) y los fragmentos de texto. Solo queda el PDF. No se toca el PDF.',
                accion: 'limpiar',
              })}
              className="btn-secundario"
            >
              Poner en blanco los datos
            </button>
            <button
              onClick={() => setConfirmar({
                titulo: '¿Eliminar la norma?',
                detalle: `Se elimina ${norma.codigoNormalizado} con sus fragmentos, relaciones, procesos y los PDF asociados. No se puede deshacer.`,
                accion: 'eliminar',
              })}
              className="rounded-lg bg-[var(--derogada)] px-3 py-1.5 text-sm font-semibold text-[var(--crema-50)] hover:opacity-90"
            >
              Eliminar norma
            </button>
          </div>
        </section>
      </div>

      {confirmar && (
        <div role="dialog" aria-modal="true" aria-labelledby="titulo-confirmar" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel max-w-sm p-6 shadow-xl">
            <h2 id="titulo-confirmar" className="mb-2 text-lg font-bold">{confirmar.titulo}</h2>
            <p className="mb-4 text-sm text-ink-soft">{confirmar.detalle}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmar(null)} className="btn-secundario">Cancelar</button>
              <button
                onClick={() => accionConfirmada.mutate()}
                disabled={accionConfirmada.isPending}
                className={confirmar.accion === 'eliminar'
                  ? 'rounded-lg bg-[var(--derogada)] px-4 py-1.5 text-sm font-semibold text-[var(--crema-50)] hover:opacity-90 disabled:opacity-50'
                  : 'btn-acento'}
              >
                {accionConfirmada.isPending ? 'Procesando…' : (confirmar.accion === 'eliminar' ? 'Eliminar definitivamente' : 'Poner en blanco')}
              </button>
            </div>
          </div>
        </div>
      )}
      {aiModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-ai"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="panel max-w-md p-6 shadow-xl">
            {aiModal.fase === 'proceso' && (
              <>
                <h2 id="titulo-ai" className="mb-3 flex items-center gap-2 text-lg font-bold">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-acento border-t-transparent" aria-hidden="true" />
                  Completando con AI…
                </h2>
                <ol className="space-y-2 text-sm">
                  {pasosAi.map((paso, i) => (
                    <li key={i} className={
                      paso.estado === 'hecho' ? 'text-ink-faint'
                        : paso.estado === 'haciendo' ? 'font-bold text-ink'
                        : paso.estado === 'error' ? 'text-derogada-texto font-bold'
                        : 'text-ink-faint/70'
                    }>
                      <span aria-hidden="true" className="mr-1">
                        {paso.estado === 'hecho' ? '✓' : paso.estado === 'error' ? '✗' : paso.estado === 'haciendo' ? '▸' : '·'}
                      </span>
                      {paso.texto}
                      {paso.estado === 'haciendo' && paso.detalle && <span className="ml-1 font-normal text-ink-soft">— {paso.detalle}</span>}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-ink-faint">Puede tardar hasta un minuto. No cierres esta ventana.</p>
              </>
            )}
            {aiModal.fase === 'exito' && (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-verde-100 text-2xl text-verde-700" aria-hidden="true">✓</div>
                <h2 id="titulo-ai" className="mb-2 text-lg font-bold">La AI terminó bien</h2>
                {aiModal.resultado?.camposAplicados?.length ? (
                  <p className="text-sm text-ink-soft"><strong>Campos completados:</strong> {aiModal.resultado.camposAplicados.join(', ')}</p>
                ) : <p className="text-sm text-ink-soft">No encontró campos para completar.</p>}
                {aiModal.resultado?.relacionesCreadas?.length ? (
                  <p className="mt-2 text-sm text-ink-soft"><strong>Relaciones creadas:</strong> {aiModal.resultado.relacionesCreadas.map(x => `${x.tipoRelacion} → ${x.codigoDestino}`).join(', ')}</p>
                ) : null}
                {aiModal.resultado?.advertencias?.length ? (
                  <p className="mt-2 text-xs text-derogada-texto">{aiModal.resultado.advertencias.join(' · ')}</p>
                ) : null}
                <div className="mt-4 text-center"><button onClick={() => setAiModal(null)} className="btn-acento">Aceptar</button></div>
              </>
            )}
            {aiModal.fase === 'error' && (
              <>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--derogada)]/15 text-2xl text-derogada-texto" aria-hidden="true">✗</div>
                <h2 id="titulo-ai" className="mb-2 text-lg font-bold">La AI no pudo completar</h2>
                <p className="text-sm text-derogada-texto">{aiModal.error}</p>
                <div className="mt-4 text-center"><button onClick={() => setAiModal(null)} className="btn-secundario">Cerrar</button></div>
              </>
            )}
          </div>
        </div>
      )}

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
