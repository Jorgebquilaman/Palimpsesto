import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Controls,
  Handle,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { traerPalabrasClave, traerRelaciones, type ResultadoItem } from '../api/cliente'
import { ETIQUETAS_RELACION } from './etiquetas'
import { Badge } from './ui'

type DatoNodo =
  | { kind: 'tema'; texto: string }
  | { kind: 'palabra'; palabra: string; cantidad: number; elegida: boolean }
  | { kind: 'norma'; codigo: string; titulo: string; vigencia: string; origen: boolean }

const ALTURAS = { tema: 70, palabra: 50, norma: 106 }
const ANCHO_COLUMNA = 300
const SEPARACION = 14

function NodoTema({ data }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'tema') return null
  return (
    <div className="panel w-44 text-center p-3">
      <Handle type="source" position={Position.Right} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Búsqueda</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{data.texto}</p>
    </div>
  )
}

function NodoPalabra({ data }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'palabra') return null
  return (
    <div className={`panel w-60 cursor-pointer px-3 py-2 transition-shadow hover:shadow-md ${data.elegida ? 'outline-2 outline-[var(--accent)]' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <p className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold">{data.palabra}</span>
        <span className="num-tabulares shrink-0 text-xs text-ink-soft">{data.cantidad}</span>
      </p>
    </div>
  )
}

function NodoNorma({ data }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'norma') return null
  return (
    <div className={`panel w-64 cursor-pointer p-3 transition-shadow hover:shadow-md ${data.origen ? '' : 'border-dashed'}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <p className="num-tabulares font-mono text-[11px] font-medium text-ink-soft">{data.codigo}</p>
      <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug">{data.titulo}</p>
      {data.vigencia && <div className="mt-1.5"><Badge vigencia={data.vigencia} /></div>}
    </div>
  )
}

const TIPOS_NODO = { temaNodo: NodoTema, palabraNodo: NodoPalabra, normaNodo: NodoNorma }

function Encuadrar({ clave }: { clave: string }) {
  const { fitView, getViewport, setViewport } = useReactFlow()
  const anterior = useRef<string | null>(null)
  useEffect(() => {
    if (anterior.current === clave) return
    anterior.current = clave
    if (getViewport().zoom > 0.98) {
      setViewport({ zoom: getViewport().zoom, x: 32, y: 16 }, { duration: 200 })
      return
    }
    fitView({ padding: 0.1, maxZoom: 1, duration: 200 })
  }, [clave, fitView, getViewport, setViewport])
  return null
}

type Modelo = { nodos: Node<DatoNodo>[]; aristas: Edge[] }

function acomodar(columnas: string[][], modelo: Modelo): Modelo {
  const alturaColumna = (columna: string[]) =>
    columna.reduce((suma, id) => {
      const nodo = modelo.nodos.find(n => n.id === id)
      const kind = (nodo?.data as DatoNodo | undefined)?.kind
      return suma + (kind ? ALTURAS[kind] : 80) + SEPARACION
    }, 0)
  const altoMax = Math.max(1, ...columnas.map(alturaColumna))
  columnas.forEach((columna, col) => {
    let y = (altoMax - alturaColumna(columna)) / 2
    for (const id of columna) {
      const nodo = modelo.nodos.find(n => n.id === id)
      if (nodo) nodo.position = { x: col * ANCHO_COLUMNA, y }
      const kind = (nodo?.data as DatoNodo | undefined)?.kind
      y += (kind ? ALTURAS[kind] : 80) + SEPARACION
    }
  })
  return modelo
}

function aristaRelacion(origen: string, destino: string, tipo: string, id: string, animada = false): Edge {
  return {
    id,
    source: origen,
    target: destino,
    type: 'smoothstep',
    animated: animada,
    label: ETIQUETAS_RELACION[tipo] ?? (tipo ? tipo : undefined),
    labelStyle: { fontSize: 10 },
    labelBgStyle: { fill: 'var(--surface)' },
    labelBgPadding: [4, 2] as [number, number],
    style: { stroke: 'var(--accent)' },
  }
}

function armarMapa(
  textoTema: string,
  palabras: { palabra: string; cantidad: number }[],
  palabraElegida: string,
  normas: ResultadoItem[],
): Modelo {
  const nodos: Node<DatoNodo>[] = []
  const aristas: Edge[] = []

  nodos.push({ id: 'tema', type: 'temaNodo', position: { x: 0, y: 0 }, data: { kind: 'tema', texto: textoTema } })

  const columnaPalabras: string[] = []
  const palabrasVisibles = palabraElegida && !palabras.some(p => p.palabra === palabraElegida)
    ? [...palabras, { palabra: palabraElegida, cantidad: normas.length }]
    : palabras
  for (const p of palabrasVisibles) {
    const id = `palabra:${p.palabra}`
    columnaPalabras.push(id)
    nodos.push({
      id,
      type: 'palabraNodo',
      position: { x: 0, y: 0 },
      data: { kind: 'palabra', palabra: p.palabra, cantidad: p.cantidad, elegida: p.palabra === palabraElegida },
    })
    aristas.push({ id: `e-tema-${id}`, source: 'tema', target: id, type: 'smoothstep' })
  }

  const fuenteNormas = palabraElegida ? `palabra:${palabraElegida}` : 'tema'
  const columnaNormas: string[] = []
  for (const n of normas) {
    const id = `norma:${n.codigo}`
    columnaNormas.push(id)
    nodos.push({
      id,
      type: 'normaNodo',
      position: { x: 0, y: 0 },
      data: { kind: 'norma', codigo: n.codigo, titulo: n.titulo, vigencia: n.vigencia, origen: true },
    })
    aristas.push({ id: `e-${fuenteNormas}-${id}`, source: fuenteNormas, target: id, type: 'smoothstep' })
  }

  return acomodar([['tema'], columnaPalabras, columnaNormas], { nodos, aristas })
}

function armarRed(
  normas: ResultadoItem[],
  relaciones: Record<string, { tipo: string; codigo: string; titulo: string }[]>,
): Modelo {
  const nodos: Node<DatoNodo>[] = []
  const aristas: Edge[] = []
  const codigosBusqueda = new Set(normas.map(n => n.codigo))

  const columnaNormas: string[] = []
  for (const n of normas) {
    const id = `norma:${n.codigo}`
    columnaNormas.push(id)
    nodos.push({
      id,
      type: 'normaNodo',
      position: { x: 0, y: 0 },
      data: { kind: 'norma', codigo: n.codigo, titulo: n.titulo, vigencia: n.vigencia, origen: true },
    })
  }

  const columnaOtras: string[] = []
  const vistas = new Set<string>()
  for (const [origen, lista] of Object.entries(relaciones)) {
    for (const r of lista) {
      const idArista = `e-${origen}:${r.tipo}:${r.codigo}`
      if (vistas.has(idArista)) continue
      vistas.add(idArista)
      if (codigosBusqueda.has(r.codigo)) {
        if (origen !== r.codigo) {
          aristas.push(aristaRelacion(`norma:${origen}`, `norma:${r.codigo}`, r.tipo, idArista))
        }
        continue
      }
      const idOtra = `otra:${r.codigo}`
      if (!columnaOtras.includes(idOtra)) {
        columnaOtras.push(idOtra)
        nodos.push({
          id: idOtra,
          type: 'normaNodo',
          position: { x: 0, y: 0 },
          data: { kind: 'norma', codigo: r.codigo, titulo: r.titulo, vigencia: '', origen: false },
        })
      }
      aristas.push(aristaRelacion(`norma:${origen}`, idOtra, r.tipo, idArista, true))
    }
  }

  return acomodar([columnaNormas, columnaOtras], { nodos, aristas })
}

const CAMPOS_PALABRAS = ['q', 'tipoId', 'organoId', 'desde', 'hasta', 'anio', 'vigencia'] as const
const CAMPOS_FILTROS = ['q', 'numero', 'anio', 'tipoId', 'organoId', 'desde', 'hasta', 'vigencia', 'palabra'] as const

export default function MapaBusqueda({
  consulta,
  normas,
  palabra,
  onElegirPalabra,
}: {
  consulta: string
  normas: ResultadoItem[]
  palabra: string
  onElegirPalabra: (palabra: string) => void
}) {
  const [vista, setVista] = useState<'mapa' | 'red'>('mapa')
  const navegar = useNavigate()

  const hayFiltros = useMemo(() => {
    const sp = new URLSearchParams(consulta)
    return CAMPOS_FILTROS.some(campo => !!sp.get(campo))
  }, [consulta])

  const parametrosPalabras = useMemo((): Record<string, string> => {
    const sp = new URLSearchParams(consulta)
    const datos: Record<string, string> = { limite: '12' }
    for (const campo of CAMPOS_PALABRAS) {
      const v = sp.get(campo)
      if (v) datos[campo] = v
    }
    return datos
  }, [consulta])

  const { data: palabras } = useQuery({
    queryKey: ['mapa-palabras', consulta],
    queryFn: () => traerPalabrasClave(parametrosPalabras),
    enabled: vista === 'mapa' && hayFiltros,
    placeholderData: (anterior) => anterior,
  })

  const { data: relaciones } = useQuery({
    queryKey: ['mapa-relaciones', consulta],
    queryFn: async () => {
      const pedidos = normas.slice(0, 10).map(async n => {
        try {
          const r = await traerRelaciones(n.codigo)
          const lista = [
            ...r.origen.map(o => ({ tipo: o.tipo, codigo: o.normaDestino.codigoNormalizado, titulo: o.normaDestino.titulo })),
            ...r.destino.map(o => ({ tipo: o.tipo, codigo: o.normaOrigen.codigoNormalizado, titulo: o.normaOrigen.titulo })),
          ]
          return [n.codigo, lista] as const
        } catch {
          return [n.codigo, []] as const
        }
      })
      return Object.fromEntries(await Promise.all(pedidos))
    },
    enabled: vista === 'red' && hayFiltros,
    placeholderData: (anterior) => anterior,
  })

  const modelo = useMemo(() => {
    if (vista === 'mapa') {
      return armarMapa(
        parametrosPalabras.q ?? 'Todo el digesto',
        palabras?.palabras.slice(0, 12) ?? [],
        palabra,
        normas.slice(0, 30),
      )
    }
    return armarRed(normas.slice(0, 10), relaciones ?? {})
  }, [vista, palabras, relaciones, normas, palabra, parametrosPalabras.q])

  const disposicion = JSON.stringify(modelo.nodos.map(n => n.id))

  return (
    <section aria-label="Vista visual de la búsqueda" className="panel panel-elevada mt-8 rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">
          <span className="rombo mr-1" aria-hidden="true">✦</span>Vista visual de la búsqueda
        </h2>
        <div role="radiogroup" aria-label="Tipo de vista" className="flex rounded-full bg-verde-50 p-1 dark:bg-crema-100/5">
          {([['mapa', 'Mapa conceptual'], ['red', 'Red conceptual']] as const).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={vista === valor}
              onClick={() => setVista(valor)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                vista === valor ? 'bg-primario text-sobre-primario shadow-xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      <p className="border-b border-line px-4 py-2 text-xs text-ink-faint">
        {!hayFiltros
          ? 'La vista aparece cuando la búsqueda tiene filtros o palabra.'
          : vista === 'mapa'
            ? 'Hacé clic en una palabra clave para filtrar los resultados.'
            : 'Las normas publicadas de la búsqueda y sus relaciones; las reservadas no aparecen.'}
      </p>
      <div className="h-[70vh] min-h-[540px] rounded-b-lg" role="application" aria-label={vista === 'mapa' ? 'Mapa conceptual' : 'Red conceptual'}>
        {!hayFiltros ? (
          <div className="grid h-full place-items-center p-6 text-center">
            <div>
              <p className="rombo text-2xl text-acento" aria-hidden="true">✦</p>
              <p className="mt-2 text-sm font-medium text-ink-soft">Todavía no hay nada filtrado.</p>
              <p className="mt-1 text-xs text-ink-faint">Escribí una palabra, elegí un tipo o ajustá los filtros para generar la vista visual.</p>
            </div>
          </div>
        ) : (
        <ReactFlow
          nodes={modelo.nodos}
          edges={modelo.aristas}
          nodeTypes={TIPOS_NODO}
          nodesConnectable={false}
          nodesDraggable={false}
          fitView
          fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
          minZoom={0.7}
          onNodeClick={(_, nodo) => {
            const d = nodo.data as DatoNodo
            if (d.kind === 'palabra') onElegirPalabra(d.palabra === palabra ? '' : d.palabra)
            else if (d.kind === 'norma') {
              const resaltado = consulta && palabra ? `?q=${encodeURIComponent(palabra)}` : ''
              navegar(`/normas/${encodeURIComponent(d.codigo)}${resaltado}`)
            }
          }}
          className="bg-transparent"
        >
          <Controls />
          <Encuadrar clave={`${vista}:${consulta}:${disposicion}`} />
        </ReactFlow>
        )}
      </div>
    </section>
  )
}
