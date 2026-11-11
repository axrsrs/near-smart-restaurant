import { ONIZLEME } from '../lib/oturum'

export default function OnizlemeEtiketi({ className = 'inline-flex' }: { className?: string }) {
  if (!ONIZLEME) return null
  return (
    <span
      title="Siparişler ve personel yalnızca bu cihazda saklanır; yönetici girişi henüz sunucuya bağlı değil."
      className={`items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-xs font-semibold text-warn ${className}`}
    >
      <span className="size-1.5 rounded-full bg-warn" />
      Önizleme
    </span>
  )
}
