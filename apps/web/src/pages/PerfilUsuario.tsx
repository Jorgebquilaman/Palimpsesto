import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { pedirAdmin } from '../api/adminApi'
import { TituloSeccion } from '../components/ui'

export default function PerfilUsuario() {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [exito, setExito] = useState(false)

  const cambiar = useMutation({
    mutationFn: () => pedirAdmin('/auth/cambiar-contrasenia', {
      method: 'POST',
      body: JSON.stringify({
        contraseniaActual: actual,
        contraseniaNueva: nueva,
        contraseniaNuevaRepetida: repetida,
      }),
    }),
    onSuccess: () => {
      setExito(true)
      setActual(''); setNueva(''); setRepetida('')
      setMensaje('Contraseña cambiada')
    },
    onError: (e) => { setExito(false); setMensaje((e as Error).message) },
  })

  return (
    <div className="max-w-md space-y-5">
      <header>
        <TituloSeccion>Mi perfil</TituloSeccion>
        <p className="text-sm text-ink-soft">Cambiá tu propia contraseña de acceso al backoffice.</p>
      </header>

      <div aria-live="polite">
        {mensaje && (
          <p role={exito ? undefined : 'alert'} className={`text-sm ${exito ? 'text-vigente-texto' : 'text-derogada-texto'}`}>
            {mensaje}
          </p>
        )}
      </div>

      <form className="panel space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); cambiar.mutate() }}>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Contraseña actual</span>
          <input type="password" value={actual} onChange={(e) => setActual(e.target.value)}
            className="campo" autoComplete="current-password" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Contraseña nueva</span>
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)}
            className="campo" autoComplete="new-password" required minLength={8} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-ink-soft">Repetir contraseña nueva</span>
          <input type="password" value={repetida} onChange={(e) => setRepetida(e.target.value)}
            className="campo" autoComplete="new-password" required minLength={8} />
        </label>
        <p className="text-xs text-ink-faint">
          Mínimo 8 caracteres, con mayúscula, minúscula, dígito y un símbolo (por ejemplo ! - _).
        </p>
        <button type="submit" disabled={cambiar.isPending} className="btn-primario disabled:opacity-50">
          {cambiar.isPending ? 'Cambiando…' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  )
}
