-- Tetra · kasa ürün görünümü (büyük kart / küçük kart / sade liste)
-- İşletme sahibi varsayılanı Yönetim › İşletme'den seçer; her kasa kendi cihazında değiştirebilir (tarayıcıda saklanır).
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run.

begin;

alter table private.tetra_isletme add column if not exists kasa_gorunum text not null default 'buyuk';
do $$ begin
  alter table private.tetra_isletme add constraint tetra_isletme_kasa_gorunum_kontrol check (kasa_gorunum in ('buyuk', 'kucuk', 'liste'));
exception when duplicate_object then null; end $$;

create or replace function public.tetra_kasa_gorunum_kaydet(p_restaurant uuid, p_gorunum text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  if p_gorunum is null or p_gorunum not in ('buyuk', 'kucuk', 'liste') then return jsonb_build_object('tamam', false, 'hata', 'Geçersiz görünüm.'); end if;
  update private.tetra_isletme set kasa_gorunum = p_gorunum, updated_at = now() where restaurant_id = p_restaurant;
  perform private.tetra_duyur(p_restaurant, 'ayar');
  return jsonb_build_object('tamam', true);
end $$;

-- ayar okuma: kasa görünümü eklendi
create or replace function public.tetra_mali_ayar_oku(p_restaurant uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  return (select jsonb_build_object('kdv_varsayilan', t.kdv_varsayilan, 'mali_takip', t.mali_takip, 'kasa_gorunum', t.kasa_gorunum,
            'urunler', coalesce((select jsonb_object_agg(d.urun_id::text, d.oran) from private.tetra_kdv d where d.restaurant_id = p_restaurant), '{}'::jsonb))
          from private.tetra_isletme t where t.restaurant_id = p_restaurant);
end $$;

-- cihaz durumu: kasa görünümü işletme kaydına eklendi
create or replace function public.tetra_cihaz_durum(p_anahtar text, p_oturum text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; p private.tetra_personel;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  p := private.tetra_oturum_bul(c, p_oturum);
  return (select jsonb_build_object(
      'cihaz', jsonb_build_object('id', c.id, 'ekran', c.ekran, 'ad', c.ad),
      'isletme', jsonb_build_object('id', r.id, 'slug', r.slug, 'ad', r.name, 'logo', r.logo, 'mali', t.mali_takip, 'kasa_gorunum', t.kasa_gorunum),
      'kanal', t.kanal,
      'gorunum', t.gorunum,
      'personel', case when p.id is not null then jsonb_build_object('id', p.id, 'ad', p.ad) end,
      'personel_tanimli', exists (select 1 from private.tetra_personel x where x.restaurant_id = c.restaurant_id and x.aktif and c.ekran = any (x.yetkiler)))
    from public.restaurants r join private.tetra_isletme t on t.restaurant_id = r.id where r.id = c.restaurant_id);
end $$;

revoke all on function public.tetra_kasa_gorunum_kaydet(uuid, text) from public, anon, authenticated;
grant execute on function public.tetra_kasa_gorunum_kaydet(uuid, text) to authenticated;

commit;
