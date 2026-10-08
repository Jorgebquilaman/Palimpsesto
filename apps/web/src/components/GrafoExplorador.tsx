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
  | { kind: 'organo'; id: number; nombre: string; cantidad: number }
  | { kind: 'anio'; anio: number; cantidad: number }
  | { kind: 'vigencia'; vigencia: string; cantidad: number }
  | { kind: 'palabra'; palabra: string; cantidad: number }
  | { kind: 'norma'; codigo: string; titulo: string; vigencia: string }
  | { kind: 'relacion'; codigo: string; titulo: string; tipoRelacion: string; origen: string }

export interface DatosGrafo {
  tipo: { nombre: string; cantidad: number } | null
  organos: { id: number; nombre: string; cantidad: number }[]
  organoSeleccionado: string
  anios: { anio: number; cantidad: number }[]
  anioSeleccionado: string
  vigencias: { vigencia: string; cantidad: number }[]
  vigenciaSeleccionada: string
  palabras: PalabraClaveConteo[]
  palabraSeleccionada: string
  normas: ResultadoItem[]
  normaSeleccionada: string | null
  relaciones: Record<string, RelacionGrafo[]>
  expandidos: string[]
}

const ANCHO_COLUMNA = 240
const ALTURAS = { tipo: 60, organo: 56, anio: 48, vigencia: 60, palabra: 50, norma: 114, relacion: 74 }
const SEPARACION = 10

function NodoTipo({ data, selected }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'tipo') return null
  return (
    <div className={`panel w-48 cursor-pointer p-2.5 ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
      <Handle type="source" position={Position.Right} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Tipo</p>
      <p className="mt-0.5 truncate text-sm font-semibold leading-snug">{data.nombre}</p>
      <p className="num-tabulares mt-0.5 text-xs text-ink-soft">{data.cantidad}</p>
    </div>
  )
}

function NodoOrgano({ data, selected }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'organo') return null
  return (
    <div className={`panel w-52 cursor-pointer p-2.5 transition-shadow hover:shadow-md ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Órgano</p>
      <p className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-semibold leading-snug">{data.nombre}</span>
        <span className="num-tabulares shrink-0 text-xs text-ink-soft">{data.cantidad}</span>
      </p>
    </div>
  )
}

function NodoAnio({ data, selected }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'anio') return null
  return (
    <div className={`panel w-24 cursor-pointer px-2 py-1.5 text-center transition-shadow hover:shadow-md ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <p className="num-tabulares text-base font-bold leading-none">{data.anio}</p>
      <p className="num-tabulares mt-0.5 text-[11px] leading-none text-ink-soft">{data.cantidad}</p>
    </div>
  )
}

function NodoVigencia({ data, selected }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'vigencia') return null
  return (
    <div className={`panel flex w-40 cursor-pointer flex-col items-center gap-1 p-2 transition-shadow hover:shadow-md ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Badge vigencia={data.vigencia} />
      <p className="num-tabulares text-[11px] leading-none text-ink-soft">{data.cantidad}</p>
    </div>
  )
}

function NodoPalabra({ data, selected }: NodeProps<Node<DatoNodo>>) {
  if (data.kind !== 'palabra') return null
  return (
    <div className={`panel w-56 cursor-pointer px-3 py-2 transition-shadow hover:shadow-md ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
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
    <div className={`panel w-60 cursor-pointer p-3 transition-shadow hover:shadow-md ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
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
    <div className={`panel w-56 cursor-pointer border-dashed p-2.5 transition-shadow hover:shadow-md ${selected ? 'outline-2 outline-[var(--accent)]' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <p className="text-[10px] font-bold uppercase tracking-wider text-acento-texto">{ETIQUETAS_RELACION[data.tipoRelacion] ?? data.tipoRelacion}</p>
      <p className="num-tabulares mt-0.5 font-mono text-[11px] font-medium text-ink-soft">{data.codigo}</p>
      <p className="mt-0.5 line-clamp-2 text-xs leading-snug">{data.titulo}</p>
    </div>
  )
}

const TIPOS_NODO = {
  tipoNodo: NodoTipo,
  organoNodo: NodoOrgano,
  anioNodo: NodoAnio,
  vigenciaNodo: NodoVigencia,
  palabraNodo: NodoPalabra,
  normaNodo: NodoNorma,
  relacionNodo: NodoRelacion,
}

function construir(datos: DatosGrafo, guardadas: Record<string, { x: number; y: number }>): { nodos: Node<DatoNodo>[]; aristas: Edge[] } {
  const columnas: { id: string; alto: number }[][] = [[], [], [], [], [], [], []]
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

  for (const o of datos.organos) {
    const id = `organo:${o.id}`
    columnas[1].push({ id, alto: ALTURAS.organo })
    nodos.push({
      id,
      type: 'organoNodo',
      position: { x: 0, y: 0 },
      selected: String(o.id) === datos.organoSeleccionado,
      data: { kind: 'organo', id: o.id, nombre: o.nombre, cantidad: o.cantidad },
    })
    aristas.push({ id: `e-tipo-${id}`, source: 'tipo', target: id, type: 'smoothstep' })
  }

  for (const a of datos.anios) {
    const id = `anio:${a.anio}`
    columnas[2].push({ id, alto: ALTURAS.anio })
    nodos.push({
      id,
      type: 'anioNodo',
      position: { x: 0, y: 0 },
      selected: String(a.anio) === datos.anioSeleccionado,
      data: { kind: 'anio', anio: a.anio, cantidad: a.cantidad },
    })
    if (datos.organoSeleccionado) {
      aristas.push({ id: `e-organo-${id}`, source: `organo:${datos.organoSeleccionado}`, target: id, type: 'smoothstep' })
    }
  }

  for (const v of datos.vigencias) {
    const id = `vigencia:${v.vigencia}`
    columnas[3].push({ id, alto: ALTURAS.vigencia })
    nodos.push({
      id,
      type: 'vigenciaNodo',
      position: { x: 0, y: 0 },
      selected: v.vigencia === datos.vigenciaSeleccionada,
      data: { kind: 'vigencia', vigencia: v.vigencia, cantidad: v.cantidad },
    })
    if (datos.anioSeleccionado) {
      aristas.push({ id: `e-anio-${id}`, source: `anio:${datos.anioSeleccionado}`, target: id, type: 'smoothstep' })
    }
  }

  const fuentePalabras = datos.vigenciaSeleccionada
    ? `vigencia:${datos.vigenciaSeleccionada}`
    : datos.anioSeleccionado
      ? `anio:${datos.anioSeleccionado}`
      : datos.organoSeleccionado
        ? `organo:${datos.organoSeleccionado}`
        : 'tipo'

  for (const p of datos.palabras) {
    const id = `palabra:${p.palabra}`
    columnas[4].push({ id, alto: ALTURAS.palabra })
    nodos.push({
      id,
      type: 'palabraNodo',
      position: { x: 0, y: 0 },
      selected: p.palabra === datos.palabraSeleccionada,
      data: { kind: 'palabra', palabra: p.palabra, cantidad: p.cantidad },
    })
    aristas.push({ id: `e-${fuentePalabras}-${id}`, source: fuentePalabras, target: id, type: 'smoothstep' })
  }

  for (const n of datos.normas) {
    const id = `norma:${n.codigo}`
    columnas[5].push({ id, alto: ALTURAS.norma })
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
      columnas[6].push({ id, alto: ALTURAS.relacion })
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
  onTipo,
  onOrgano,
  onAnio,
  onVigencia,
  onPalabra,
  onNorma,
  onRelacion,
  onDobleNorma,
}: {
  datos: DatosGrafo
  claveEncuadre: string
  onTipo: () => void
  onOrgano: (id: string) => void
  onAnio: (anio: string) => void
  onVigencia: (vigencia: string) => void
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
        if (d.kind === 'tipo') onTipo()
        else if (d.kind === 'organo') onOrgano(String(d.id))
        else if (d.kind === 'anio') onAnio(String(d.anio))
        else if (d.kind === 'vigencia') onVigencia(d.vigencia)
        else if (d.kind === 'palabra') onPalabra(d.palabra)
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
