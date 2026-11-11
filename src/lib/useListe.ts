import { useCallback, useEffect, useState } from 'react'
import { hataMetni } from './sunucu'

/** Sunucudan liste okur; yükleniyor ve hata durumlarını taşır. yenile() listeyi yeniden çeker. */
export function useListe<T>(oku: () => Promise<T[]>, anahtar: string) {
  const [liste, setListe] = useState<T[] | null>(null)
  const [hata, setHata] = useState('')
  const [sira, setSira] = useState(0)
  const yenile = useCallback(() => setSira((s) => s + 1), [])

  useEffect(() => {
    let iptal = false
    oku()
      .then((l) => {
        if (iptal) return
        setListe(l)
        setHata('')
      })
      .catch((e) => !iptal && setHata(hataMetni(e)))
    return () => {
      iptal = true
    }
    // oku her çizimde yeni bir işlev olabilir; yeniden okuma yalnızca anahtar ya da yenile() ile tetiklenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, sira])

  return { liste, hata, yenile }
}
