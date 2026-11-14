-- Tetra · işletmeye özel görünüm (palet + isteğe bağlı vurgu rengi)
-- İşletme sahibi Yönetim > İşletme'den seçer; kasa, mutfak, TV, yönetim ve müşteri takip sayfası uygular.
-- Kayıt: private.tetra_isletme.gorunum = {"palet": "...", "vurgu": "#rrggbb" | null}. Boş (null) = varsayılan (Orman).
-- Değişiklikte cihazlara "gorunum" haberi gider; cihazlar durumunu yeniden okuyup yeni renge geçer.

alter table private.tetra_isletme add column if not exists gorunum jsonb;

create or replace function public.tetra_gorunum_kaydet(p_restaurant uuid, p_palet text, p_vurgu text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare g jsonb;
begin
  perform private.tetra_sahip_sart(p_restaurant);
  if p_palet is null or p_palet not in ('orman', 'near', 'gece', 'bordo', 'kahve', 'mandalina', 'siyah-altin', 'lavanta') then
    return jsonb_build_object('tamam', false, 'hata', 'Geçersiz palet.');
  end if;
  if p_vurgu is not null and p_vurgu !~ '^#[0-9a-fA-F]{6}$' then
    return jsonb_build_object('tamam', false, 'hata', 'Geçersiz renk.');
  end if;
  g := jsonb_build_object('palet', p_palet, 'vurgu', lower(p_vurgu));
  update private.tetra_isletme set gorunum = g, updated_at = now() where restaurant_id = p_restaurant;
  perform private.tetra_duyur(p_restaurant, 'gorunum');
  return jsonb_build_object('tamam', true, 'gorunum', g);
end $$;

revoke all on function public.tetra_gorunum_kaydet(uuid, text, text) from public, anon;
grant execute on function public.tetra_gorunum_kaydet(uuid, text, text) to authenticated;

-- işletme sahibinin işletme listesi: görünüm eklendi
create or replace function public.tetra_baslangic() returns jsonb
language sql stable security definer set search_path to '' as
$$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'slug', r.slug, 'ad', r.name, 'logo', r.logo, 'rol', x.rol,
           'tetra', coalesce(t.aktif, false), 'abonelik', private.is_public_restaurant(r.id), 'gorunum', t.gorunum) order by r.name), '[]'::jsonb)
  from public.restaurants r
  cross join lateral (select coalesce(
      (select m.role from public.members m where m.restaurant_id = r.id and m.user_id = (select auth.uid())),
      case when private.is_super_admin() then 'super' end) as rol) x
  left join private.tetra_isletme t on t.restaurant_id = r.id
  where x.rol in ('owner', 'super');
$$;

-- cihaz durumu: görünüm eklendi
create or replace function public.tetra_cihaz_durum(p_anahtar text, p_oturum text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; p private.tetra_personel;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  p := private.tetra_oturum_bul(c, p_oturum);
  return (select jsonb_build_object(
      'cihaz', jsonb_build_object('id', c.id, 'ekran', c.ekran, 'ad', c.ad),
      'isletme', jsonb_build_object('id', r.id, 'slug', r.slug, 'ad', r.name, 'logo', r.logo),
      'kanal', t.kanal,
      'gorunum', t.gorunum,
      'personel', case when p.id is not null then jsonb_build_object('id', p.id, 'ad', p.ad) end,
      'personel_tanimli', exists (select 1 from private.tetra_personel x where x.restaurant_id = c.restaurant_id and x.aktif and c.ekran = any (x.yetkiler)))
    from public.restaurants r join private.tetra_isletme t on t.restaurant_id = r.id where r.id = c.restaurant_id);
end $$;

-- müşteri takip sayfası: görünüm eklendi (yalnızca renk bilgisi; başka işletme verisi yok)
create or replace function public.tetra_takip(p_kod text) returns jsonb
language sql stable security definer set search_path to '' as
$$
  select jsonb_build_object('no', s.no, 'durum', s.durum, 'tur', s.tur, 'isletme', jsonb_build_object('ad', r.name, 'logo', r.logo), 'gorunum', t.gorunum)
  from private.tetra_siparis s join public.restaurants r on r.id = s.restaurant_id
  left join private.tetra_isletme t on t.restaurant_id = s.restaurant_id
  where p_kod ~ '^[0-9a-f]{32}$' and s.takip_kod = p_kod and s.zaman > now() - interval '24 hours';
$$;
