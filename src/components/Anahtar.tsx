/** Aç/kapat anahtarı. Dokunma alanı 44 px; görünen ray daha küçüktür. */
export default function Anahtar({ acik, degistir, etiket }: { acik: boolean; degistir: (yeni: boolean) => void; etiket: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      aria-label={etiket}
      title={etiket}
      onClick={() => degistir(!acik)}
      className="grid h-11 w-14 flex-none place-items-center"
    >
      <span className={`relative h-7 w-12 rounded-full transition-colors ${acik ? 'bg-ok' : 'bg-ink-3'}`}>
        <span className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform ${acik ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}
