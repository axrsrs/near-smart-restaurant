import { useOutletContext } from 'react-router-dom'
import type { IsletmeKaydi } from './oturum'

/** Yönetim sekmeleri seçili işletmeyi buradan alır (Yonetim sayfası Outlet bağlamı olarak verir). */
export const useSeciliIsletme = () => useOutletContext<IsletmeKaydi>()
