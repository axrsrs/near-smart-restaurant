-- Tetra · mutfak fişi (fiyatsız; sipariş no, tür, ürünler, notlar)
-- İşletme sahibi Yönetim › İşletme › Mutfak fişi'nden seçer: kapalı / kasada (müşteri fişiyle birlikte) / mutfakta (yeni sipariş gelince).
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run.

begin;

alter table private.tetra_isletme add column if not exists mutfak_fisi text not null default 'kapali';
do $$ begin
  alter table private.tetra_isletme add constraint tetra_isletme_mutfak_fisi_kontrol check (mutfak_fisi in ('kapali', 'kasa', 'mutfak'));
exception when duplicate_object then null; end $$;

create or replace function public.tetra_mutfak_fisi_kaydet(p_restaurant uuid, p_yer text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  if p_yer is null or p_yer not in ('kapali', 'kasa', 'mutfak') then return jsonb_build_object('tamam', false, 'hata', 'Geçersiz seçim.'); end if;
  update private.tetra_isletme set mutfak_fisi = p_yer, updated_at = now() where restaurant_id = p_restaurant;
  perform private.tetra_duyur(p_restaurant, 'ayar');
  return jsonb_build_object('tamam', true);
end $$;

-- ayar okuma: mutfak fişi eklendi
create or replace function public.tetra_mali_ayar_oku(p_restaurant uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  return (select jsonb_build_object('kdv_varsayilan', t.kdv_varsayilan, 'mali_takip', t.mali_takip, 'kasa_gorunum', t.kasa_gorunum, 'mutfak_fisi', t.mutfak_fisi,
            'urunler', coalesce((select jsonb_object_agg(d.urun_id::text, d.oran) from private.tetra_kdv d where d.restaurant_id = p_restaurant), '{}'::jsonb))
          from private.tetra_isletme t where t.restaurant_id = p_restaurant);
end $$;

-- cihaz durumu: mutfak fişi işletme kaydına eklendi
create or replace function public.tetra_cihaz_durum(p_anahtar text, p_oturum text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; p private.tetra_personel;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  p := private.tetra_oturum_bul(c, p_oturum);
  return (select jsonb_build_object(
      'cihaz', jsonb_build_object('id', c.id, 'ekran', c.ekran, 'ad', c.ad),
      'isletme', jsonb_build_object('id', r.id, 'slug', r.slug, 'ad', r.name, 'logo', r.logo, 'mali', t.mali_takip, 'kasa_gorunum', t.kasa_gorunum, 'mutfak_fisi', t.mutfak_fisi),
      'kanal', t.kanal,
      'gorunum', t.gorunum,
      'personel', case when p.id is not null then jsonb_build_object('id', p.id, 'ad', p.ad) end,
      'personel_tanimli', exists (select 1 from private.tetra_personel x where x.restaurant_id = c.restaurant_id and x.aktif and c.ekran = any (x.yetkiler)))
    from public.restaurants r join private.tetra_isletme t on t.restaurant_id = r.id where r.id = c.restaurant_id);
end $$;

revoke all on function public.tetra_mutfak_fisi_kaydet(uuid, text) from public, anon, authenticated;
grant execute on function public.tetra_mutfak_fisi_kaydet(uuid, text) to authenticated;

commit;
