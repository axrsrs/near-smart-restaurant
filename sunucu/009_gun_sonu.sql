-- Tetra · gün sonu raporu ve kasa sayımı
-- Kasiyer kasadan gün sonu özetini görür, isteğe bağlı olarak çekmecedeki nakdi girer; fark kaydedilir ve fiş basılır.
-- Kapanışlar Yönetim › Raporlar'da geçmişiyle listelenir. Yasal belge değildir (Z raporu yazarkasadan alınır).
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run.

begin;

alter table private.tetra_siparis add column if not exists iptal_kisi text;

create table if not exists private.tetra_gun_sonu (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  gun date not null,
  zaman timestamptz not null default now(),
  personel_ad text not null default '',
  cihaz_id uuid,
  beklenen_nakit bigint not null,                 -- kuruş
  sayilan_nakit bigint check (sayilan_nakit is null or sayilan_nakit between 0 and 100000000000),
  fark bigint,
  aciklama text not null default '' check (char_length(aciklama) <= 200),
  ozet jsonb not null
);
create index if not exists tetra_gun_sonu_isletme on private.tetra_gun_sonu (restaurant_id, gun desc);
alter table private.tetra_gun_sonu enable row level security;
revoke all on private.tetra_gun_sonu from public, anon, authenticated;

-- iptal eden personel kaydedilir (gün sonunda "kim iptal etti")
create or replace function public.tetra_siparis_durum(p_anahtar text, p_oturum text, p_id uuid, p_durum text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; p private.tetra_personel; s private.tetra_siparis; v_izin boolean;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  p := private.tetra_oturum_sart(c, p_oturum);
  select * into s from private.tetra_siparis x where x.id = p_id and x.restaurant_id = c.restaurant_id for update;
  if s.id is null then return jsonb_build_object('tamam', false, 'hata', 'Sipariş bulunamadı.'); end if;
  if s.durum = p_durum then return jsonb_build_object('tamam', true, 'siparis', private.tetra_siparis_json(s, c.ekran = 'kasa')); end if;
  v_izin := case c.ekran
    when 'mutfak' then (s.durum = 'hazirlaniyor' and p_durum = 'hazir') or (s.durum = 'hazir' and p_durum in ('teslim', 'hazirlaniyor'))
    when 'kasa' then (s.durum in ('hazirlaniyor', 'hazir') and p_durum = 'iptal') or (s.durum = 'hazir' and p_durum = 'teslim')
    else false end;
  if not coalesce(v_izin, false) then return jsonb_build_object('tamam', false, 'hata', 'Bu sipariş için bu işlem yapılamaz.'); end if;
  update private.tetra_siparis set durum = p_durum,
    hazir_zaman = case when p_durum = 'hazir' then now() when p_durum = 'hazirlaniyor' then null else hazir_zaman end,
    teslim_zaman = case when p_durum = 'teslim' then now() else teslim_zaman end,
    iptal_zaman = case when p_durum = 'iptal' then now() else iptal_zaman end,
    iptal_kisi = case when p_durum = 'iptal' then p.ad else iptal_kisi end
  where id = s.id returning * into s;
  perform private.tetra_duyur(c.restaurant_id, 'siparis');
  perform private.tetra_takip_duyur(s.takip_kod);
  return jsonb_build_object('tamam', true, 'siparis', private.tetra_siparis_json(s, c.ekran = 'kasa'), 'bildirim', (p_durum = 'hazir' and exists (select 1 from private.tetra_bildirim b where b.siparis_id = s.id)));
end $$;

-- bir günün özeti (iptaller hariç ciro)
create or replace function private.tetra_gun_ozeti(rid uuid, p_gun date) returns jsonb
language sql stable security definer set search_path to '' as
$$
  with s as (select * from private.tetra_siparis x where x.restaurant_id = rid and x.gun = p_gun),
  g as (select * from s where durum <> 'iptal'),
  v as (select coalesce((select t.kdv_varsayilan from private.tetra_isletme t where t.restaurant_id = rid), 10) as oran)
  select jsonb_build_object(
    'gun', p_gun,
    'siparis', (select count(*) from g),
    'ciro', (select coalesce(sum(toplam), 0) from g),
    'nakit', (select coalesce(sum(toplam), 0) from g where odeme = 'nakit'),
    'kart', (select coalesce(sum(toplam), 0) from g where odeme = 'kart'),
    'burada', (select count(*) from g where tur = 'burada'),
    'paket', (select count(*) from g where tur = 'paket'),
    'ilk', (select min(zaman) from s), 'son', (select max(zaman) from s),
    'iptal', jsonb_build_object('adet', (select count(*) from s where durum = 'iptal'), 'tutar', (select coalesce(sum(toplam), 0) from s where durum = 'iptal'),
      'liste', (select coalesce(jsonb_agg(jsonb_build_object('no', no, 'tutar', toplam, 'kisi', coalesce(iptal_kisi, ''), 'zaman', iptal_zaman) order by no), '[]'::jsonb) from s where durum = 'iptal')),
    'personel', (select coalesce(jsonb_agg(jsonb_build_object('ad', ad, 'siparis', n, 'ciro', ciro, 'nakit', nakit, 'kart', kart) order by ciro desc), '[]'::jsonb)
      from (select coalesce(nullif(personel_ad, ''), 'Kasa') as ad, count(*) as n, sum(toplam) as ciro,
              coalesce(sum(toplam) filter (where odeme = 'nakit'), 0) as nakit, coalesce(sum(toplam) filter (where odeme = 'kart'), 0) as kart from g group by 1) p),
    'kdv', private.tetra_kdv_kir(coalesce((select jsonb_agg(jsonb_build_object('oran', coalesce((k->>'kdv')::int, (select oran from v)), 'tutar', (k->>'adet')::int * (k->>'fiyat')::bigint))
      from g, jsonb_array_elements(g.kalemler) k), '[]'::jsonb)),
    'mali', jsonb_build_object('bekleyen', (select count(*) from g where mali_durum = 'bekliyor'), 'tutar', (select coalesce(sum(toplam), 0) from g where mali_durum = 'bekliyor')),
    'urunler', (select coalesce(jsonb_agg(jsonb_build_object('ad', ad, 'adet', adet, 'ciro', ciro) order by ciro desc), '[]'::jsonb)
      from (select k->>'ad' as ad, sum((k->>'adet')::int) as adet, sum((k->>'adet')::int * (k->>'fiyat')::bigint) as ciro
            from g, jsonb_array_elements(g.kalemler) k group by 1 order by 3 desc limit 5) u)
  );
$$;

create or replace function private.tetra_gun_sonu_json(x private.tetra_gun_sonu) returns jsonb
language sql stable set search_path to '' as
$$
  select jsonb_build_object('id', x.id, 'gun', x.gun, 'zaman', x.zaman, 'personel_ad', x.personel_ad, 'beklenen_nakit', x.beklenen_nakit,
    'sayilan_nakit', x.sayilan_nakit, 'fark', x.fark, 'aciklama', x.aciklama, 'ozet', x.ozet);
$$;

-- kasa: bugünün özeti ve bugün yapılmış kapanışlar
create or replace function public.tetra_gun_sonu_oku(p_anahtar text, p_oturum text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; v_gun date := private.tetra_bugun();
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  if c.ekran <> 'kasa' then raise exception 'Gün sonu yalnızca kasa ekranından alınır.' using errcode = '42501'; end if;
  perform private.tetra_oturum_sart(c, p_oturum);
  return jsonb_build_object('ozet', private.tetra_gun_ozeti(c.restaurant_id, v_gun),
    'kapanislar', (select coalesce(jsonb_agg(private.tetra_gun_sonu_json(x) order by x.zaman desc), '[]'::jsonb) from private.tetra_gun_sonu x where x.restaurant_id = c.restaurant_id and x.gun = v_gun));
end $$;

-- kasa: gün sonunu kaydet (sayım isteğe bağlı). Günde en fazla 20 kapanış (vardiya değişimi için birden fazla olabilir).
create or replace function public.tetra_gun_sonu_kaydet(p_anahtar text, p_oturum text, p_sayilan bigint default null, p_aciklama text default '') returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; p private.tetra_personel; v_gun date := private.tetra_bugun(); v_ozet jsonb; v_beklenen bigint; x private.tetra_gun_sonu;
  v_aciklama text := left(regexp_replace(trim(coalesce(p_aciklama, '')), '\s+', ' ', 'g'), 200);
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  if c.ekran <> 'kasa' then raise exception 'Gün sonu yalnızca kasa ekranından alınır.' using errcode = '42501'; end if;
  p := private.tetra_oturum_sart(c, p_oturum);
  if p_sayilan is not null and (p_sayilan < 0 or p_sayilan > 100000000000) then return jsonb_build_object('tamam', false, 'hata', 'Sayılan nakit tutarı geçersiz.'); end if;
  if (select count(*) from private.tetra_gun_sonu g where g.restaurant_id = c.restaurant_id and g.gun = v_gun) >= 20 then
    return jsonb_build_object('tamam', false, 'hata', 'Bugün için en fazla 20 gün sonu kaydı alınabilir.');
  end if;
  v_ozet := private.tetra_gun_ozeti(c.restaurant_id, v_gun);
  v_beklenen := (v_ozet->>'nakit')::bigint;
  insert into private.tetra_gun_sonu (restaurant_id, gun, personel_ad, cihaz_id, beklenen_nakit, sayilan_nakit, fark, aciklama, ozet)
  values (c.restaurant_id, v_gun, p.ad, c.id, v_beklenen, p_sayilan, case when p_sayilan is not null then p_sayilan - v_beklenen end, v_aciklama, v_ozet)
  returning * into x;
  return jsonb_build_object('tamam', true, 'kapanis', private.tetra_gun_sonu_json(x));
end $$;

-- yönetim: tarih aralığındaki kapanışlar
create or replace function public.tetra_gun_sonu_liste(p_restaurant uuid, p_bas date, p_bit date) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  if p_bas is null or p_bit is null or p_bit < p_bas or p_bit - p_bas > 366 then
    raise exception 'Tarih aralığı geçersiz (en fazla 1 yıl).' using errcode = 'TT004';
  end if;
  return (select coalesce(jsonb_agg(private.tetra_gun_sonu_json(x) order by x.zaman desc), '[]'::jsonb)
    from (select * from private.tetra_gun_sonu g where g.restaurant_id = p_restaurant and g.gun between p_bas and p_bit order by g.zaman desc limit 400) x);
end $$;

revoke all on function private.tetra_gun_ozeti(uuid, date), private.tetra_gun_sonu_json(private.tetra_gun_sonu) from public, anon, authenticated;
revoke all on function public.tetra_gun_sonu_oku(text, text), public.tetra_gun_sonu_kaydet(text, text, bigint, text), public.tetra_gun_sonu_liste(uuid, date, date) from public, anon, authenticated;
grant execute on function public.tetra_gun_sonu_oku(text, text), public.tetra_gun_sonu_kaydet(text, text, bigint, text) to anon, authenticated;
grant execute on function public.tetra_gun_sonu_liste(uuid, date, date) to authenticated;

commit;
