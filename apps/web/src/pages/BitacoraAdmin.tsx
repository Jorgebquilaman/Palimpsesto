import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDebounce } from '../components/useDebounce'
import {
  ETIQUETAS_ESTADO,
  ETIQUETAS_VISIBILIDAD,
  pedirAdmin,
  bitacoraDocumentos,
  bitacoraHistorial,
  anotarBitacora,
  borrarNotaBitacora,
  editarNotaBitacora,
} from '../api/adminApi'
import type { DocumentoBitacora, RegistroAuditoria } from '../api/adminApi'

const ETIQUETAS_ACCION: Record<string, string> = {
  subir_pdf: 'Subió el PDF',
  actualizar: 'Editó los datos',
  agregar_texto: 'Agregó texto',
  editar_texto: 'Editó el texto',
  limpiar_datos: 'Limpió el contenido',
  eliminar: 'Eliminó la norma',
  nota: 'Nota manual',
  estado_borrador: 'Puesta en borrador',
  estado_en_revision: 'Pasó a revisión',
  estado_publicada: 'Publicada',
  estado_archivada: 'Archivada',
  estado_procesando: 'En procesamiento',
}

export default function BitacoraAdmin() {
  const [tab, setTab] = useState<'documentos' | 'movimientos'>('documentos')

  return (
    <div className="space-y-4">
      <h1 className="font-display text-titulo font-semibold tracking-tight"><span className="rombo" aria-hidden="true">✦</span>Bitácora</h1>
      <p className="text-sm text-ink-soft">
        Historial completo de todos los documentos que están y estuvieron en el sistema: quién los subió, qué se
        hizo con cada uno y sus anotaciones manuales.
      </p>

      <div role="radiogroup" aria-label="Vista de la bitácora" className="flex w-fit gap-2 rounded-full bg-verde-50 p-1 dark:bg-crema-100/5">
        {([['documentos', 'Documentos'], ['movimientos', 'Movimientos']] as const).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={tab === valor}
            onClick={() => setTab(valor)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              tab === valor ? 'bg-primario text-sobre-primario shadow-xs' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {tab === 'documentos' ? <DocumentosBitacora /> : <MovimientosBitacora />}
    </div>
  )
}

function DocumentosBitacora() {
  const [busqueda, setBusqueda] = useState('')
  const textoDebounced = useDebounce(busqueda, 300)
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(50)
  const [elegido, setElegido] = useState<DocumentoBitacora | null>(null)

  useEffect(() => {
    setPagina(1)
  }, [textoDebounced, porPagina])

  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ['bitacora-documentos', textoDebounced, pagina, porPagina],
    queryFn: () => bitacoraDocumentos(textoDebounced.trim() || null, pagina, porPagina),
    placeholderData: (anterior) => anterior,
    refetchInterval: 60_000,
  })

  const documentos = data?.items ?? []
  const total = data?.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / porPagina))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[16rem] flex-1 text-sm">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Buscar por código o título</span>
          <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="campo" aria-label="Buscar documento en la bitácora" />
        </label>
        <p className="text-xs text-ink-faint num-tabulares">{total} documentos en el registro.</p>
      </div>

      {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite">Cargando…</p>}

      {data && (
        <div className="overflow-x-auto rounded-md border border-line shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-crema-50 text-left text-xs uppercase tracking-wide text-ink-faint dark:bg-verde-950/60">
              <tr>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Última actividad</th>
                <th className="px-3 py-2">Último usuario</th>
                <th className="px-3 py-2 text-right">Movimientos</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map(d => (
                <tr
                  key={d.documentoId ?? d.id ?? d.codigo}
                  onClick={() => setElegido(elegido === d ? null : d)}
                  className={`cursor-pointer border-t border-line transition-colors hover:bg-verde-50 ${elegido === d ? 'bg-verde-50 dark:bg-verde-900/30' : ''}`}
                >
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{d.codigo}</span>
                    <span className="block max-w-[24rem] truncate text-xs text-ink-soft">{d.titulo}</span>
                  </td>
                  <td className="px-3 py-2">
                    <EtiquetaEstado estado={d.estado} />
                    {d.visibilidad === 'reservada' || d.visibilidad === 'interna' ? (
                      <span className="ml-1 text-[10px] text-ink-faint">{ETIQUETAS_VISIBILIDAD[d.visibilidad]}</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-faint">{new Date(d.ultimaActividad).toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2 text-xs">{d.ultimoUsuario ?? '—'}</td>
                  <td className="px-3 py-2 text-right num-tabulares text-xs">{d.eventos}</td>
                </tr>
              ))}
              {documentos.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-faint">No hay documentos que coincidan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {elegido && <HistorialDocumento clave={elegido.documentoId ?? elegido.id} documento={elegido} onCerrar={() => setElegido(null)} />}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="btn-secundario text-xs" disabled={pagina <= 1 || isFetching} onClick={() => setPagina(p => p - 1)}>← Anteriores</button>
        <span className="num-tabulares text-xs text-ink-soft">Página {pagina} de {paginas}</span>
        <button type="button" className="btn-secundario text-xs" disabled={pagina >= paginas || isFetching} onClick={() => setPagina(p => p + 1)}>Siguientes →</button>
        <label className="flex items-center gap-2 text-xs text-ink-faint">
          por página
          <select value={String(porPagina)} onChange={(e) => setPorPagina(Number(e.target.value))} className="campo py-1 text-xs" aria-label="Documentos por página">
            {[50, 100].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

function EtiquetaEstado({ estado }: { estado: string }) {
  if (estado === 'eliminado') {
    return <span className="rounded bg-[var(--derogada)]/15 px-2 py-0.5 text-[11px] font-medium text-derogada-texto">Eliminado</span>
  }
  const et = ETIQUETAS_ESTADO[estado] ?? estado
  return <span className="rounded bg-verde-50 px-2 py-0.5 text-[11px] font-medium text-ink-soft dark:bg-verde-900/40 dark:text-crema-100">{et}</span>
}

function HistorialDocumento({ clave, documento, onCerrar }: { clave: string | null; documento: DocumentoBitacora; onCerrar: () => void }) {
  const cliente = useQueryClient()
  const [nota, setNota] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [editando, setEditando] = useState<number | null>(null)
  const [textoEdicion, setTextoEdicion] = useState('')

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['bitacora-historial', clave],
    queryFn: () => bitacoraHistorial(clave ?? ''),
    enabled: !!clave,
  })

  const anotar = useMutation({
    mutationFn: () => anotarBitacora(documento.id, nota),
    onSuccess: () => {
      setNota('')
      setMensaje('Nota agregada a la bitácora.')
      setTimeout(() => setMensaje(''), 2500)
      void cliente.invalidateQueries({ queryKey: ['bitacora-historial', clave] })
      void cliente.invalidateQueries({ queryKey: ['bitacora-documentos'] })
    },
  })

  const editar = useMutation({
    mutationFn: ({ id, texto }: { id: number; texto: string }) => editarNotaBitacora(id, texto),
    onSuccess: () => {
      setEditando(null)
      void cliente.invalidateQueries({ queryKey: ['bitacora-historial', clave] })
    },
  })

  const borrar = useMutation({
    mutationFn: (id: number) => borrarNotaBitacora(id),
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['bitacora-historial', clave] })
      void cliente.invalidateQueries({ queryKey: ['bitacora-documentos'] })
    },
  })

  return (
    <section aria-label="Historial del documento" className="panel p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="font-mono text-sm font-semibold">{documento.codigo}</h2>
          <p className="text-xs text-ink-soft">{documento.titulo}</p>
        </div>
        <div className="flex items-center gap-2">
          {documento.id && (
            <Link to={`/admin/normas/${documento.id}`} className="btn-sutil text-xs">Abrir la norma</Link>
          )}
          <button type="button" className="btn-sutil text-xs" onClick={onCerrar}>Cerrar</button>
        </div>
      </header>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => { e.preventDefault(); if (nota.trim()) anotar.mutate() }}
      >
        <label className="flex-1 text-sm">
          <span className="sr-only">Nueva nota</span>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Anotar algo en la bitácora de este documento…"
            className="campo"
            aria-label="Nueva nota de la bitácora"
          />
        </label>
        <button type="submit" className="btn-primario text-sm" disabled={!nota.trim() || anotar.isPending}>
          {anotar.isPending ? 'Guardando…' : 'Anotar'}
        </button>
      </form>
      {mensaje && <p className="mt-1 text-xs text-verde-800 dark:text-verde-300">{mensaje}</p>}

      {isError && <p role="alert" className="mt-2 text-derogada-texto">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite" className="mt-3 text-sm">Cargando el historial…</p>}

      <ol className="mt-4 space-y-3">
        {(data ?? []).map(r => (
          <li key={r.id} className="border-l-2 border-line pl-3">
            <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-ink-faint">
              <span className="num-tabulares">{new Date(r.fecha).toLocaleString('es-AR')}</span>
              <span>·</span>
              <span className="font-medium text-ink">{r.usuario}</span>
            </div>
            <p className="mt-0.5 text-sm">
              {r.accion === 'nota' ? (
                <span className="font-medium text-acento-texto">Nota manual</span>
              ) : (
                <span className="font-medium">{ETIQUETAS_ACCION[r.accion] ?? r.accion}</span>
              )}
            </p>
            {r.accion === 'nota' ? (
              editando === r.id ? (
                <div className="mt-1 flex flex-col gap-1 sm:flex-row">
                  <input
                    value={textoEdicion}
                    onChange={(e) => setTextoEdicion(e.target.value)}
                    className="campo"
                    aria-label="Editar nota"
                  />
                  <div className="flex gap-1">
                    <button type="button" className="btn-primario text-xs" onClick={() => editar.mutate({ id: r.id, texto: textoEdicion })} disabled={!textoEdicion.trim()}>
                      Guardar
                    </button>
                    <button type="button" className="btn-sutil text-xs" onClick={() => setEditando(null)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 flex items-start gap-2">
                  <p className="flex-1 rounded-sm bg-crema-100 px-2 py-1.5 text-sm dark:bg-verde-950/60">{r.texto}</p>
                  <button type="button" className="text-xs text-ink-faint underline hover:text-ink" onClick={() => { setEditando(r.id); setTextoEdicion(r.texto ?? '') }}>editar</button>
                  <button type="button" className="text-xs text-derogada-texto underline hover:text-derogada-texto" onClick={() => { if (window.confirm('¿Borrar esta nota?')) borrar.mutate(r.id) }}>borrar</button>
                </div>
              )
            ) : (
              <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                {r.antes && <span className="line-through">{r.antes.slice(0, 100)}</span>}
                {r.antes && r.despues && <span className="mx-1">→</span>}
                {r.despues?.slice(0, 100)}
              </p>
            )}
          </li>
        ))}
        {data && data.length === 0 && <li className="text-sm text-ink-faint">Sin movimientos registrados todavía.</li>}
      </ol>
    </section>
  )
}

function MovimientosBitacora() {
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(100)
  const { data, isPending, isError, error, isFetching } = useQuery({
    queryKey: ['bitacora-movimientos', pagina, porPagina],
    queryFn: () => pedirAdminAuditoria(pagina, porPagina),
    placeholderData: (anterior) => anterior,
  })

  const registros = data ?? []
  return (
    <div className="space-y-3">
      {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite">Cargando…</p>}
      {registros.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-line shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-crema-50 text-left text-xs uppercase tracking-wide text-ink-faint dark:bg-verde-950/60">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id} className="border-t border-line">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-ink-faint">{new Date(r.fecha).toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2 text-xs">{r.usuario}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.normaCodigo ?? `${r.entidad} ${r.entidadId.slice(0, 8)}`}</td>
                  <td className="px-3 py-2 text-xs">{ETIQUETAS_ACCION[r.accion] ?? r.accion}</td>
                  <td className="max-w-md px-3 py-2 text-xs text-ink-faint">
                    {r.texto && <span className="rounded-sm bg-crema-100 px-1.5 py-0.5 dark:bg-verde-950/60">{r.texto.slice(0, 160)}</span>}
                    {!r.texto && r.antes && <span className="line-through">{r.antes.slice(0, 100)}</span>}
                    {!r.texto && r.despues && <span className="mx-1">→</span>}
                    {!r.texto && r.despues?.slice(0, 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="btn-secundario text-xs" disabled={pagina <= 1 || isFetching} onClick={() => setPagina(p => p - 1)}>← Anteriores</button>
        <span className="num-tabulares text-xs text-ink-soft">Página {pagina}</span>
        <button type="button" className="btn-secundario text-xs" disabled={registros.length < porPagina || isFetching} onClick={() => setPagina(p => p + 1)}>Siguientes →</button>
        <label className="flex items-center gap-2 text-xs text-ink-faint">
          por página
          <select value={String(porPagina)} onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(1) }} className="campo py-1 text-xs" aria-label="Movimientos por página">
            {[50, 100].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

function pedirAdminAuditoria(pagina: number, porPagina: number): Promise<RegistroAuditoria[]> {
  return pedirAdmin(`/admin/auditoria?page=${pagina}&pageSize=${porPagina}`)
}
