import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { pedirAiEstado, guardarAi, probarAi } from '../api/adminApi'
import { TituloSeccion } from '../components/ui'

export default function AiAdmin() {
  const cliente = useQueryClient()
  const { data: estado, isPending, isError, error } = useQuery({
    queryKey: ['ai-estado'],
    queryFn: pedirAiEstado,
  })

  const [clave, setClave] = useState('')
  const [modelo, setModelo] = useState('deepseek-v4-flash')
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com')
  const [mensaje, setMensaje] = useState('')

  const guardar = useMutation({
    mutationFn: () => guardarAi(clave.length > 0 ? clave : null, modelo, baseUrl),
    onSuccess: () => {
      setMensaje('Configuración guardada')
      setClave('')
      void cliente.invalidateQueries({ queryKey: ['ai-estado'] })
    },
    onError: (e) => setMensaje(`Error: ${(e as Error).message}`),
  })

  const probar = useMutation({
    mutationFn: probarAi,
    onSuccess: (r) => setMensaje(r.detalle),
    onError: (e) => setMensaje(`Error: ${(e as Error).message}`),
  })

  return (
    <div className="max-w-2xl space-y-6">
      <TituloSeccion>Inteligencia artificial (DeepSeek)</TituloSeccion>
      <p className="text-sm text-ink-soft">
        La clave se guarda en la base de datos del sistema (nunca en el repositorio) y se usa para
        completar metadatos, resúmenes y relaciones en la pantalla de revisión de cada norma.
      </p>

      <div aria-live="polite">
        {mensaje && <p className={`text-sm ${mensaje.startsWith('Error') ? 'text-derogada-texto' : 'text-vigente-texto'}`}>{mensaje}</p>}
      </div>

      {isError && <p role="alert" className="text-derogada-texto">{(error as Error).message}</p>}
      {isPending && <p aria-live="polite">Cargando…</p>}

      {estado && (
        <>
          <div className="panel p-4 text-sm text-ink-soft">
            {estado.configurada ? (
              <>✦ Configurada — modelo <strong className="text-ink">{estado.modelo}</strong>, clave {estado.clave}</>
            ) : (
              'Sin configurar: cargá la clave para habilitar el botón en las revisiones.'
            )}
          </div>

          <form className="panel space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); guardar.mutate() }}>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                Clave de la API {estado.configurada && <span className="text-ink-faint">(vacío = no cambia)</span>}
              </span>
              <input
                type="password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder={estado.configurada ? '••••' + (estado.clave ?? '') : 'sk-…'}
                className="campo"
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Modelo</span>
              <select value={modelo} onChange={(e) => setModelo(e.target.value)} className="campo">
                <option value="deepseek-v4-flash">deepseek-v4-flash (rápido, económico)</option>
                <option value="deepseek-v4-pro">deepseek-v4-pro (pro)</option>
                <option value="deepseek-v4-flash-vision-exp">deepseek-v4-flash-vision-exp (visión)</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Base URL</span>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="campo num-tabulares" />
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={guardar.isPending} className="btn-primario">
                {guardar.isPending ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={() => probar.mutate()} disabled={probar.isPending} className="btn-secundario">
                {probar.isPending ? 'Probando…' : 'Probar conexión'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
