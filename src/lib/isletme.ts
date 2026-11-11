import { useMenu } from './menu'
import { useSlug } from './veri'

/** İşletmenin adı ve logosu NearMenu'deki kayıttan gelir. */
export function useIsletme() {
  const slug = useSlug()
  const { menu } = useMenu(slug)
  return { slug, ad: menu?.isletme.ad || 'Tetra', logo: menu?.isletme.logo || null }
}
