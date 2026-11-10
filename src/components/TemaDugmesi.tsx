import { temaDegistir, useTema } from '../lib/tema'
import Ikon from './Ikon'

export default function TemaDugmesi({ className = '' }: { className?: string }) {
  const tema = useTema()
  const etiket = tema === 'light' ? 'Koyu moda geç' : 'Açık moda geç'
  return (
    <button
      type="button"
      data-dalga-yok
      aria-label={etiket}
      title={etiket}
      onClick={(e) => temaDegistir(e.currentTarget)}
      className={`grid size-11 flex-none place-items-center rounded-full border border-line bg-ink-2 text-text transition-transform hover:scale-105 active:scale-95 ${className}`}
    >
      <Ikon ad={tema === 'light' ? 'ay' : 'gunes'} className="size-5" />
    </button>
  )
}
