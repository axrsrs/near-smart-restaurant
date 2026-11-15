-- Tetra · mali hazırlık (Faz 0): ürün KDV oranı, siparişte "mali fiş kesildi" takibi, raporda KDV kırılımı
-- Yazarkasa entegrasyonu gelince "kesildi" işaretini kasiyer yerine cihaz koyacak; veri yapısı aynı kalır.
-- NearMenu tabloları değişmez: KDV oranı Tetra'nın kendi tablosunda (private.tetra_kdv) tutulur.
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run. Tek işlemde çalışır.

begin;

-- ───────── ayarlar ve tablolar ─────────
alter table private.tetra_isletme add column if not exists kdv_varsayilan smallint not null default 10;
alter table private.tetra_isletme add column if not exists mali_takip boolean not null default true;
do $$ begin
  alter table private.tetra_isletme add constraint tetra_isletme_kdv_kontrol check (kdv_varsayilan in (1, 10, 20));
exception when duplicate_object then null; end $$;

create table if not exists private.tetra_kdv (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  urun_id uuid not null references public.products(id) on delete cascade,
  oran smallint not null check (oran in (1, 10, 20)),
  primary key (restaurant_id, urun_id)
);
alter table private.tetra_kdv enable row level security;
revoke all on private.tetra_kdv from public, anon, authenticated;

-- sipariş: mali fiş durumu. Eski siparişler boş kalır (takip öncesi); yeni siparişler takip açıksa "bekliyor" başlar.
alter table private.tetra_siparis add column if not exists mali_durum text;
alter table private.tetra_siparis add column if not exists mali_fis_no text;
alter table private.tetra_siparis add column if not exists mali_zaman timestamptz;
alter table private.tetra_siparis add column if not exists mali_kisi text;
do $$ begin
  alter table private.tetra_siparis add constraint tetra_siparis_mali_kontrol check (mali_durum in ('bekliyor', 'kesildi') and (mali_fis_no is null or char_length(mali_fis_no) <= 30));
exception when duplicate_object then null; end $$;
create index if not exists tetra_siparis_mali_bekleyen on private.tetra_siparis (restaurant_id, gun) where mali_durum = 'bekliyor' and durum <> 'iptal';

alter table private.tetra_gun_ozet add column if not exists kdv jsonb not null default '[]'::jsonb;

-- ───────── yardımcılar ─────────
-- KDV kırılımı: kalem tutarları (KDV dahil, kuruş) orana göre toplanır; KDV = tutar × oran / (100 + oran)
create or replace function private.tetra_kdv_kir(p_satirlar jsonb) returns jsonb
language sql immutable set search_path to '' as
$$
  select coalesce(jsonb_agg(jsonb_build_object('oran', x.oran, 'tutar', x.tutar, 'kdv', round(x.tutar * x.oran / (100.0 + x.oran))::bigint) order by x.oran), '[]'::jsonb)
  from (select (e->>'oran')::int as oran, sum((e->>'tutar')::bigint) as tutar from jsonb_array_elements(p_satirlar) e group by 1) x;
$$;

create or replace function private.tetra_siparis_json(s private.tetra_siparis, p_tam boolean) returns jsonb
language sql stable set search_path to '' as
$$
  select jsonb_build_object('id', s.id, 'no', s.no, 'gun', s.gun, 'zaman', s.zaman, 'tur', s.tur, 'durum', s.durum,
           'kalemler', s.kalemler, 'personel_ad', s.personel_ad, 'hazir_zaman', s.hazir_zaman)
      || case when p_tam then jsonb_build_object('odeme', s.odeme, 'toplam', s.toplam, 'takip_kod', s.takip_kod,
           'mali', case when s.mali_durum is not null then jsonb_build_object('durum', s.mali_durum, 'fis_no', s.mali_fis_no, 'zaman', s.mali_zaman, 'kisi', s.mali_kisi) end)
         else '{}'::jsonb end;
$$;

-- ───────── sipariş: kalemlere KDV oranı yazılır, mali durum başlar ─────────
create or replace function public.tetra_siparis_olustur(p_anahtar text, p_oturum text, p_kalemler jsonb, p_tur text, p_odeme text, p_istek uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare
  c private.tetra_cihaz; p private.tetra_personel; s private.tetra_siparis; t private.tetra_isletme;
  k jsonb; u public.products; v_kalemler jsonb := '[]'::jsonb; v_toplam bigint := 0; v_adet int; v_not text; v_fiyat int; v_gun date; v_no int; v_kdv int;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  if c.ekran <> 'kasa' then raise exception 'Sipariş yalnızca kasa ekranından alınır.' using errcode = '42501'; end if;
  p := private.tetra_oturum_sart(c, p_oturum);
  if p_istek is null then return jsonb_build_object('tamam', false, 'hata', 'İstek kimliği eksik.'); end if;
  perform pg_advisory_xact_lock(hashtext('tetra_no'), hashtext(c.restaurant_id::text));
  select * into s from private.tetra_siparis x where x.restaurant_id = c.restaurant_id and x.istek = p_istek;
  if s.id is not null then return jsonb_build_object('tamam', true, 'siparis', private.tetra_siparis_json(s, true)); end if;
  if p_tur is null or p_tur not in ('burada','paket') then return jsonb_build_object('tamam', false, 'hata', 'Sipariş türünü seçin.'); end if;
  if p_odeme is null or p_odeme not in ('nakit','kart') then return jsonb_build_object('tamam', false, 'hata', 'Ödeme türünü seçin.'); end if;
  if p_kalemler is null or jsonb_typeof(p_kalemler) <> 'array' or jsonb_array_length(p_kalemler) = 0 then return jsonb_build_object('tamam', false, 'hata', 'Sepet boş.'); end if;
  if jsonb_array_length(p_kalemler) > 100 then return jsonb_build_object('tamam', false, 'hata', 'Bir siparişte en fazla 100 satır olabilir.'); end if;
  select * into t from private.tetra_isletme x where x.restaurant_id = c.restaurant_id;

  for k in select * from jsonb_array_elements(p_kalemler) loop
    if jsonb_typeof(k) <> 'object' or coalesce(k->>'urun_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or coalesce(k->>'adet', '') !~ '^\d{1,2}$' then
      return jsonb_build_object('tamam', false, 'hata', 'Sepette geçersiz satır var.');
    end if;
    v_adet := (k->>'adet')::int;
    if v_adet < 1 then return jsonb_build_object('tamam', false, 'hata', 'Adet 1–99 arasında olmalı.'); end if;
    v_not := left(regexp_replace(trim(coalesce(k->>'not', '')), '\s+', ' ', 'g'), 80);
    select * into u from public.products x where x.id = (k->>'urun_id')::uuid and x.restaurant_id = c.restaurant_id;
    if u.id is null then return jsonb_build_object('tamam', false, 'hata', 'Sepetteki bir ürün artık menüde yok. Menüyü yenileyin.'); end if;
    if u.sold then return jsonb_build_object('tamam', false, 'hata', format('"%s" tükendi; sepetten çıkarın.', u.name), 'tukenen', u.id); end if;
    v_fiyat := round(u.price * 100)::int;
    v_kdv := coalesce((select d.oran from private.tetra_kdv d where d.restaurant_id = c.restaurant_id and d.urun_id = u.id), t.kdv_varsayilan, 10);
    v_toplam := v_toplam + v_fiyat::bigint * v_adet;
    v_kalemler := v_kalemler || jsonb_build_object('urun_id', u.id, 'ad', u.name, 'fiyat', v_fiyat, 'adet', v_adet, 'not', v_not, 'kdv', v_kdv);
  end loop;
  if v_toplam > 2000000000 then return jsonb_build_object('tamam', false, 'hata', 'Sipariş tutarı çok yüksek.'); end if;

  v_gun := private.tetra_bugun();
  select coalesce(max(x.no), 0) + 1 into v_no from private.tetra_siparis x where x.restaurant_id = c.restaurant_id and x.gun = v_gun;
  insert into private.tetra_siparis (restaurant_id, no, gun, tur, odeme, toplam, kalemler, personel_id, personel_ad, cihaz_id, takip_kod, istek, mali_durum)
  values (c.restaurant_id, v_no, v_gun, p_tur, p_odeme, v_toplam::int, v_kalemler, p.id, p.ad, c.id, encode(extensions.gen_random_bytes(16), 'hex'), p_istek,
          case when coalesce(t.mali_takip, true) then 'bekliyor' end)
  returning * into s;
  perform private.tetra_duyur(c.restaurant_id, 'siparis');
  return jsonb_build_object('tamam', true, 'siparis', private.tetra_siparis_json(s, true));
end $$;

-- ───────── mali fiş işareti ─────────
create or replace function private.tetra_mali_yaz(rid uuid, p_id uuid, p_kesildi boolean, p_fis_no text, p_kisi text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare s private.tetra_siparis; v_no text := nullif(left(regexp_replace(trim(coalesce(p_fis_no, '')), '\s+', ' ', 'g'), 30), '');
begin
  if v_no is not null and v_no !~ '^[0-9A-Za-zÇĞİÖŞÜçğıöşü /.\-]+$' then return jsonb_build_object('tamam', false, 'hata', 'Fiş numarasında yalnızca harf, rakam, boşluk, / . - olabilir.'); end if;
  select * into s from private.tetra_siparis x where x.id = p_id and x.restaurant_id = rid for update;
  if s.id is null then return jsonb_build_object('tamam', false, 'hata', 'Sipariş bulunamadı.'); end if;
  if s.mali_durum is null then return jsonb_build_object('tamam', false, 'hata', 'Bu sipariş mali fiş takibinde değil.'); end if;
  if s.durum = 'iptal' and coalesce(p_kesildi, false) then return jsonb_build_object('tamam', false, 'hata', 'İptal edilen sipariş için mali fiş işaretlenmez.'); end if;
  update private.tetra_siparis set
    mali_durum = case when coalesce(p_kesildi, false) then 'kesildi' else 'bekliyor' end,
    mali_fis_no = case when coalesce(p_kesildi, false) then v_no end,
    mali_zaman = case when coalesce(p_kesildi, false) then now() end,
    mali_kisi = case when coalesce(p_kesildi, false) then left(p_kisi, 60) end
  where id = s.id returning * into s;
  perform private.tetra_duyur(rid, 'siparis');
  return jsonb_build_object('tamam', true, 'siparis', private.tetra_siparis_json(s, true));
end $$;

-- kasadan (personel oturumuyla)
create or replace function public.tetra_mali_isaretle(p_anahtar text, p_oturum text, p_id uuid, p_kesildi boolean, p_fis_no text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; p private.tetra_personel;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  if c.ekran <> 'kasa' then raise exception 'Mali fiş işareti yalnızca kasa ekranından verilir.' using errcode = '42501'; end if;
  p := private.tetra_oturum_sart(c, p_oturum);
  return private.tetra_mali_yaz(c.restaurant_id, p_id, p_kesildi, p_fis_no, p.ad);
end $$;

-- yönetimden (işletme sahibi)
create or replace function public.tetra_mali_isaretle_sahip(p_restaurant uuid, p_id uuid, p_kesildi boolean, p_fis_no text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  return private.tetra_mali_yaz(p_restaurant, p_id, p_kesildi, p_fis_no, 'Yönetim');
end $$;

-- fişi kesilmemiş siparişler (son 90 gün, iptaller hariç, en fazla 300)
create or replace function public.tetra_mali_bekleyen(p_restaurant uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  return (select coalesce(jsonb_agg(private.tetra_siparis_json(s, true) order by s.gun desc, s.no desc), '[]'::jsonb)
    from (select * from private.tetra_siparis x where x.restaurant_id = p_restaurant and x.mali_durum = 'bekliyor' and x.durum <> 'iptal'
          order by x.gun desc, x.no desc limit 300) s);
end $$;

-- ───────── mali ayarlar ve ürün KDV oranları (işletme sahibi) ─────────
create or replace function public.tetra_mali_ayar_oku(p_restaurant uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  return (select jsonb_build_object('kdv_varsayilan', t.kdv_varsayilan, 'mali_takip', t.mali_takip,
            'urunler', coalesce((select jsonb_object_agg(d.urun_id::text, d.oran) from private.tetra_kdv d where d.restaurant_id = p_restaurant), '{}'::jsonb))
          from private.tetra_isletme t where t.restaurant_id = p_restaurant);
end $$;

create or replace function public.tetra_mali_ayar_kaydet(p_restaurant uuid, p_kdv_varsayilan smallint, p_mali_takip boolean) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  if p_kdv_varsayilan is null or p_kdv_varsayilan not in (1, 10, 20) then return jsonb_build_object('tamam', false, 'hata', 'KDV oranı %1, %10 ya da %20 olmalı.'); end if;
  if p_mali_takip is null then return jsonb_build_object('tamam', false, 'hata', 'Mali fiş takibi seçimi eksik.'); end if;
  update private.tetra_isletme set kdv_varsayilan = p_kdv_varsayilan, mali_takip = p_mali_takip, updated_at = now() where restaurant_id = p_restaurant;
  perform private.tetra_duyur(p_restaurant, 'ayar');
  return jsonb_build_object('tamam', true);
end $$;

-- p_oran boş: ürün işletmenin varsayılan oranını kullanır
create or replace function public.tetra_kdv_kaydet(p_restaurant uuid, p_urun uuid, p_oran smallint) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  if not exists (select 1 from public.products x where x.id = p_urun and x.restaurant_id = p_restaurant) then return jsonb_build_object('tamam', false, 'hata', 'Ürün bulunamadı.'); end if;
  if p_oran is null then
    delete from private.tetra_kdv where restaurant_id = p_restaurant and urun_id = p_urun;
  elsif p_oran not in (1, 10, 20) then
    return jsonb_build_object('tamam', false, 'hata', 'KDV oranı %1, %10 ya da %20 olmalı.');
  else
    insert into private.tetra_kdv (restaurant_id, urun_id, oran) values (p_restaurant, p_urun, p_oran)
    on conflict (restaurant_id, urun_id) do update set oran = excluded.oran;
  end if;
  return jsonb_build_object('tamam', true);
end $$;

-- ───────── cihaz durumu: mali takip bilgisi işletme kaydına eklendi ─────────
create or replace function public.tetra_cihaz_durum(p_anahtar text, p_oturum text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; p private.tetra_personel;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  p := private.tetra_oturum_bul(c, p_oturum);
  return (select jsonb_build_object(
      'cihaz', jsonb_build_object('id', c.id, 'ekran', c.ekran, 'ad', c.ad),
      'isletme', jsonb_build_object('id', r.id, 'slug', r.slug, 'ad', r.name, 'logo', r.logo, 'mali', t.mali_takip),
      'kanal', t.kanal,
      'gorunum', t.gorunum,
      'personel', case when p.id is not null then jsonb_build_object('id', p.id, 'ad', p.ad) end,
      'personel_tanimli', exists (select 1 from private.tetra_personel x where x.restaurant_id = c.restaurant_id and x.aktif and c.ekran = any (x.yetkiler)))
    from public.restaurants r join private.tetra_isletme t on t.restaurant_id = r.id where r.id = c.restaurant_id);
end $$;

-- ───────── 90 günlük özet: KDV kırılımı da saklanır ─────────
create or replace function private.tetra_ozetle(rid uuid) returns void
language plpgsql security definer set search_path to '' as
$$
declare v_sinir date := private.tetra_bugun() - 90; v_varsayilan int := coalesce((select t.kdv_varsayilan from private.tetra_isletme t where t.restaurant_id = rid), 10);
begin
  insert into private.tetra_gun_ozet (restaurant_id, gun, siparis, iptal, ciro, nakit, kart, burada, paket, urunler, kdv)
  select rid, g.gun, g.siparis, g.iptal, g.ciro, g.nakit, g.kart, g.burada, g.paket,
         coalesce((select jsonb_agg(jsonb_build_object('ad', u.ad, 'adet', u.adet, 'ciro', u.ciro) order by u.ciro desc)
           from (select k->>'ad' as ad, sum((k->>'adet')::int) as adet, sum((k->>'adet')::int * (k->>'fiyat')::bigint) as ciro
                 from private.tetra_siparis s2, jsonb_array_elements(s2.kalemler) k
                 where s2.restaurant_id = rid and s2.gun = g.gun and s2.durum <> 'iptal' group by 1) u), '[]'::jsonb),
         private.tetra_kdv_kir(coalesce((select jsonb_agg(jsonb_build_object('oran', coalesce((k->>'kdv')::int, v_varsayilan), 'tutar', (k->>'adet')::int * (k->>'fiyat')::bigint))
                 from private.tetra_siparis s3, jsonb_array_elements(s3.kalemler) k
                 where s3.restaurant_id = rid and s3.gun = g.gun and s3.durum <> 'iptal'), '[]'::jsonb))
  from (select s.gun,
          count(*) filter (where s.durum <> 'iptal')::int as siparis, count(*) filter (where s.durum = 'iptal')::int as iptal,
          coalesce(sum(s.toplam) filter (where s.durum <> 'iptal'), 0) as ciro,
          coalesce(sum(s.toplam) filter (where s.durum <> 'iptal' and s.odeme = 'nakit'), 0) as nakit,
          coalesce(sum(s.toplam) filter (where s.durum <> 'iptal' and s.odeme = 'kart'), 0) as kart,
          count(*) filter (where s.durum <> 'iptal' and s.tur = 'burada')::int as burada,
          count(*) filter (where s.durum <> 'iptal' and s.tur = 'paket')::int as paket
        from private.tetra_siparis s where s.restaurant_id = rid and s.gun < v_sinir group by s.gun) g
  on conflict (restaurant_id, gun) do nothing;
  delete from private.tetra_siparis s where s.restaurant_id = rid and s.gun < v_sinir;
end $$;

-- ───────── rapor: KDV kırılımı ve fişi kesilmemiş sipariş sayısı eklendi ─────────
create or replace function public.tetra_rapor(p_restaurant uuid, p_bas date, p_bit date) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare v_gunler jsonb; v_urunler jsonb; v_ozet jsonb; v_kdv jsonb; v_mali jsonb;
  v_varsayilan int := coalesce((select t.kdv_varsayilan from private.tetra_isletme t where t.restaurant_id = p_restaurant), 10);
begin
  perform private.tetra_sahip_sart(p_restaurant);
  if p_bas is null or p_bit is null or p_bit < p_bas or p_bit - p_bas > 366 then
    raise exception 'Tarih aralığı geçersiz (en fazla 1 yıl).' using errcode = 'TT004';
  end if;
  perform private.tetra_ozetle(p_restaurant);
  with gunluk as (
    select s.gun,
      count(*) filter (where s.durum <> 'iptal')::int as siparis, count(*) filter (where s.durum = 'iptal')::int as iptal,
      coalesce(sum(s.toplam) filter (where s.durum <> 'iptal'), 0)::bigint as ciro,
      coalesce(sum(s.toplam) filter (where s.durum <> 'iptal' and s.odeme = 'nakit'), 0)::bigint as nakit,
      coalesce(sum(s.toplam) filter (where s.durum <> 'iptal' and s.odeme = 'kart'), 0)::bigint as kart,
      count(*) filter (where s.durum <> 'iptal' and s.tur = 'burada')::int as burada,
      count(*) filter (where s.durum <> 'iptal' and s.tur = 'paket')::int as paket
    from private.tetra_siparis s where s.restaurant_id = p_restaurant and s.gun between p_bas and p_bit group by s.gun
    union all
    select o.gun, o.siparis, o.iptal, o.ciro, o.nakit, o.kart, o.burada, o.paket
    from private.tetra_gun_ozet o where o.restaurant_id = p_restaurant and o.gun between p_bas and p_bit
  )
  select coalesce(jsonb_agg(to_jsonb(g) order by g.gun desc), '[]'::jsonb),
         jsonb_build_object('siparis', coalesce(sum(g.siparis), 0), 'iptal', coalesce(sum(g.iptal), 0), 'ciro', coalesce(sum(g.ciro), 0),
           'nakit', coalesce(sum(g.nakit), 0), 'kart', coalesce(sum(g.kart), 0), 'burada', coalesce(sum(g.burada), 0), 'paket', coalesce(sum(g.paket), 0))
    into v_gunler, v_ozet from gunluk g;
  select coalesce(jsonb_agg(jsonb_build_object('ad', x.ad, 'adet', x.adet, 'ciro', x.ciro) order by x.ciro desc), '[]'::jsonb) into v_urunler
  from (select y.ad, sum(y.adet)::int as adet, sum(y.ciro)::bigint as ciro from (
          select k->>'ad' as ad, (k->>'adet')::int as adet, (k->>'adet')::int * (k->>'fiyat')::bigint as ciro
          from private.tetra_siparis s, jsonb_array_elements(s.kalemler) k
          where s.restaurant_id = p_restaurant and s.gun between p_bas and p_bit and s.durum <> 'iptal'
          union all
          select u->>'ad', (u->>'adet')::int, (u->>'ciro')::bigint
          from private.tetra_gun_ozet o, jsonb_array_elements(o.urunler) u
          where o.restaurant_id = p_restaurant and o.gun between p_bas and p_bit) y
        group by y.ad order by 3 desc limit 20) x;
  -- KDV kırılımı: canlı siparişlerin kalemleri + özetlenmiş günlerin oran toplamları
  select private.tetra_kdv_kir(coalesce(jsonb_agg(z), '[]'::jsonb)) into v_kdv from (
    select jsonb_build_object('oran', coalesce((k->>'kdv')::int, v_varsayilan), 'tutar', (k->>'adet')::int * (k->>'fiyat')::bigint) as z
    from private.tetra_siparis s, jsonb_array_elements(s.kalemler) k
    where s.restaurant_id = p_restaurant and s.gun between p_bas and p_bit and s.durum <> 'iptal'
    union all
    select jsonb_build_object('oran', (e->>'oran')::int, 'tutar', (e->>'tutar')::bigint)
    from private.tetra_gun_ozet o, jsonb_array_elements(o.kdv) e
    where o.restaurant_id = p_restaurant and o.gun between p_bas and p_bit) q;
  select jsonb_build_object('bekleyen', count(*), 'bekleyen_tutar', coalesce(sum(s.toplam), 0)) into v_mali
  from private.tetra_siparis s where s.restaurant_id = p_restaurant and s.gun between p_bas and p_bit and s.durum <> 'iptal' and s.mali_durum = 'bekliyor';
  return jsonb_build_object('ozet', v_ozet, 'gunler', v_gunler, 'urunler', v_urunler, 'kdv', v_kdv, 'mali', v_mali);
end $$;

-- ───────── yetkiler ─────────
revoke all on function private.tetra_kdv_kir(jsonb), private.tetra_mali_yaz(uuid, uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function public.tetra_mali_isaretle(text, text, uuid, boolean, text), public.tetra_mali_isaretle_sahip(uuid, uuid, boolean, text),
  public.tetra_mali_bekleyen(uuid), public.tetra_mali_ayar_oku(uuid), public.tetra_mali_ayar_kaydet(uuid, smallint, boolean),
  public.tetra_kdv_kaydet(uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.tetra_mali_isaretle(text, text, uuid, boolean, text) to anon, authenticated;
grant execute on function public.tetra_mali_isaretle_sahip(uuid, uuid, boolean, text), public.tetra_mali_bekleyen(uuid), public.tetra_mali_ayar_oku(uuid),
  public.tetra_mali_ayar_kaydet(uuid, smallint, boolean), public.tetra_kdv_kaydet(uuid, uuid, smallint) to authenticated;

commit;
