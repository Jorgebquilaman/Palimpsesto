import { useEffect, useState } from 'react'

export function useDebounce<T>(valor: T, milisegundos: number): T {
  const [ajustado, setAjustado] = useState(valor)

  useEffect(() => {
    const temporizador = setTimeout(() => setAjustado(valor), milisegundos)
    return () => clearTimeout(temporizador)
  }, [valor, milisegundos])

  return ajustado
}
