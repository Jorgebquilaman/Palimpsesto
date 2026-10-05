const nombre = import.meta.env.VITE_BRAND_NAME ?? 'Digesto IUPA'
const logoUrl = import.meta.env.VITE_BRAND_LOGO ?? ''

export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-8 w-8 rounded-sm object-contain" />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-sm bg-primario font-display text-lg text-sobre-primario"
        >
          ✦
        </span>
      )}
      {!compacta && (
        <span className="font-display text-lg font-semibold tracking-tight">{nombre}</span>
      )}
    </span>
  )
}
