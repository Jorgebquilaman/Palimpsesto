import { useEffect, useRef, useState } from 'react'
import {
  Controls,
  Handle,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ETIQUETAS_RELACION } from './etiquetas'
import { Badge } from './ui'
import type { PalabraClaveConteo, ResultadoItem } from '../api/cliente'

export interface RelacionGrafo {
  tipo: string
  direccion: 'saliente' | 'entrante'
  codigo: string
  titulo: string
}

type DatoNodo =
  | { kind: 'tipo'; nombre: string; cantidad: number }
  | { kind: 'palabra'; palabra: string; cantidad: number }
  | { kind: 'norma'; codigo: string; titulo: string; vigencia: string }
  | { kind: 'relacion'; codigo: string; titulo: string; tipoRelacion: string; origen: string }

export interface DatosGrafo {
  tipo: { nombre: string; cantidad: number } | null
  palabras: PalabraClaveConteo[]
  palabraSeleccionada: string
  normas: ResultadoItem[]
  normaSeleccionada: string | null
  relaciones: Record<string, RelacionGrafo[]>
  expandidos: string[]
}

const ANCHO_COLUMNA = 300
const ALTURAS = { tipo: 66, palabra: 54, norma: 120, relacion: 76 }
const SEPARACION = 14

function NodoTipo({ data, selected }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'tipo') return null
  return (
    <div className={`panel w-56 p-3 ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
      <Handle type="source" position={Position.Right} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Tipo de norma</p>
      <p className="mt-0.5 text-sm font-semibold leading-snug">{data.nombre}</p>
      <p className="num-tabulares mt-0.5 text-xs text-ink-soft">{data.cantidad} {data.cantidad === 1 ? 'norma' : 'normas'}</p>
    </div>
  )
}

function NodoPalabra({ data, selected }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'palabra') return null
  return (
    <div className={`panel w-60 cursor-pointer px-3 py-2 transition-shadow hover:shadow-md ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <p className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold">{data.palabra}</span>
        <span className="num-tabulares shrink-0 text-xs text-ink-soft">{data.cantidad}</span>
      </p>
    </div>
  )
}

function NodoNorma({ data, selected }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'norma') return null
  return (
    <div className={`panel w-64 cursor-pointer p-3 transition-shadow hover:shadow-md ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <p className="num-tabulares font-mono text-[11px] font-medium text-ink-soft">{data.codigo}</p>
      <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug">{data.titulo}</p>
      <div className="mt-1.5"><Badge vigencia={data.vigencia} /></div>
    </div>
  )
}

function NodoRelacion({ data, selected }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'relacion') return null
  return (
    <div className={`panel w-60 cursor-pointer border-dashed p-2.5 transition-shadow hover:shadow-md ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-acento-texto">{ETIQUETAS_RELACION[data.tipoRelacion] ?? data.tipoRelacion}</p>
      <p className="num-tabulares mt-0.5 font-mono text-[11px] font-medium text-ink-soft">{data.codigo}</p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-snug">{data.titulo}</p>
    </div>
  )
}

const TIPOS_NODO = {
  tipoNodo: NodoTipo,
  palabraNodo: NodoPalabra,
  normaNodo: NodoNorma,
  relacionNodo: NodoRelacion,
}

function construir(datos: DatosGrafo, guardadas: Record<string, { x: number; y: number }>): { nodos: Node<DatoNodo>[]; aristas: Edge[] } {
  const columnas: { id: string; alto: number }[][] = [[], [], [], []]
  const nodos: Node<DatoNodo>[] = []
  const aristas: Edge[] = []

  if (datos.tipo) {
    columnas[0].push({ id: 'tipo', alto: ALTURAS.tipo })
    nodos.push({
      id: 'tipo',
      type: 'tipoNodo',
      position: { x: 0, y: 0 },
      data: { kind: 'tipo', nombre: datos.tipo.nombre, cantidad: datos.tipo.cantidad },
    })
  }

  for (const p of datos.palabras) {
    const id = `palabra:${p.palabra}`
    columnas[1].push({ id, alto: ALTURAS.palabra })
    nodos.push({
      id,
      type: 'palabraNodo',
      position: { x: 0, y: 0 },
      selected: p.palabra === datos.palabraSeleccionada,
      data: { kind: 'palabra', palabra: p.palabra, cantidad: p.cantidad },
    })
    aristas.push({ id: `e-tipo-${id}`, source: 'tipo', target: id, type: 'smoothstep' })
  }

  for (const n of datos.normas) {
    const id = `norma:${n.codigo}`
    columnas[2].push({ id, alto: ALTURAS.norma })
    nodos.push({
      id,
      type: 'normaNodo',
      position: { x: 0, y: 0 },
      selected: n.codigo === datos.normaSeleccionada,
      data: { kind: 'norma', codigo: n.codigo, titulo: n.titulo, vigencia: n.vigencia },
    })
    if (datos.palabraSeleccionada) {
      aristas.push({ id: `e-palabra-${id}`, source: `palabra:${datos.palabraSeleccionada}`, target: id, type: 'smoothstep' })
    }
  }

  for (const origen of datos.expandidos) {
    for (const r of datos.relaciones[origen] ?? []) {
      const id = `rel:${origen}:${r.codigo}`
      columnas[3].push({ id, alto: ALTURAS.relacion })
      nodos.push({
        id,
        type: 'relacionNodo',
        position: { x: 0, y: 0 },
        selected: r.codigo === datos.normaSeleccionada,
        data: { kind: 'relacion', codigo: r.codigo, titulo: r.titulo, tipoRelacion: r.tipo, origen },
      })
      aristas.push({
        id: `e-${id}`,
        source: `norma:${origen}`,
        target: id,
        type: 'smoothstep',
        animated: true,
        label: ETIQUETAS_RELACION[r.tipo] ?? r.tipo,
        labelStyle: { fontSize: 10 },
        labelBgStyle: { fill: 'var(--surface)' },
        labelBgPadding: [4, 2] as [number, number],
        style: { stroke: 'var(--accent)' },
      })
    }
  }

  const altoMax = Math.max(1, ...columnas.map(c => c.reduce((acc, n) => acc + n.alto + SEPARACION, 0)))
  columnas.forEach((columna, col) => {
    const altoCol = columna.reduce((acc, n) => acc + n.alto + SEPARACION, 0)
    let y = (altoMax - altoCol) / 2
    for (const { id, alto } of columna) {
      const nodo = nodos.find(n => n.id === id)
      if (nodo) nodo.position = guardadas[id] ?? { x: col * ANCHO_COLUMNA, y }
      y += alto + SEPARACION
    }
  })

  return { nodos, aristas }
}

function Encuadrar({ clave }: { clave: string }) {
  const { fitView } = useReactFlow()
  const anterior = useRef(clave)
  useEffect(() => {
    if (anterior.current === clave) return
    anterior.current = clave
    fitView({ padding: 0.15, maxZoom: 1 })
  }, [clave, fitView])
  return null
}

export function GrafoExplorador({
  datos,
  claveEncuadre,
  onPalabra,
  onNorma,
  onRelacion,
  onDobleNorma,
}: {
  datos: DatosGrafo
  claveEncuadre: string
  onPalabra: (palabra: string) => void
  onNorma: (codigo: string) => void
  onRelacion: (codigo: string, origen: string, tipo: string) => void
  onDobleNorma: (codigo: string) => void
}) {
  const guardadas = useRef<Record<string, { x: number; y: number }>>({})
  const [modeloInicial] = useState(() => construir(datos, {}))
  const [nodos, setNodos, alCambiarNodos] = useNodesState(modeloInicial.nodos)
  const [aristas, setAristas, alCambiarAristas] = useEdgesState(modeloInicial.aristas)

  useEffect(() => {
    const modelo = construir(datos, guardadas.current)
    setNodos(modelo.nodos)
    setAristas(modelo.aristas)
  }, [datos, setNodos, setAristas])

  function alCambiar(cambios: Parameters<typeof alCambiarNodos>[0]) {
    for (const cambio of cambios) {
      if (cambio.type === 'position' && cambio.position) {
        guardadas.current[cambio.id] = cambio.position
      }
    }
    alCambiarNodos(cambios)
  }

  return (
    <ReactFlow
      nodes={nodos}
      edges={aristas}
      nodeTypes={TIPOS_NODO}
      onNodesChange={alCambiar}
      onEdgesChange={alCambiarAristas}
      onNodeClick={(_, nodo) => {
        const d = nodo.data as DatoNodo
        if (d.kind === 'palabra') onPalabra(d.palabra)
        else if (d.kind === 'norma') onNorma(d.codigo)
        else if (d.kind === 'relacion') onRelacion(d.codigo, d.origen, d.tipoRelacion)
      }}
      onNodeDoubleClick={(_, nodo) => {
        const d = nodo.data as DatoNodo
        if (d.kind === 'norma') onDobleNorma(d.codigo)
      }}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
      minZoom={0.2}
      className="bg-transparent"
    >
      <Controls />
      <Encuadrar clave={claveEncuadre} />
    </ReactFlow>
  )
}
