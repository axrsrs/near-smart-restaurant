-- Tetra · güvenlik sıkılaştırmaları (denetim bulguları 2, 4, 5)
-- 1) PIN denemesi: kilit süreleri büyür (5 hatada 1 dk, 10'da 10 dk, 15 ve sonrası her 5 hatada 60 dk); sayaç 6 saatte sıfırlanır.
-- 2) Cihaz anahtarı yenilenir: 3 günden eski anahtar, cihaz durumu okunurken iki aşamalı değişir.
--    Sunucu yeni anahtarı "bekleyen" olarak üretir; cihaz yeni anahtarla ilk kez çağırdığında yeni anahtar geçerli olur,
--    eski anahtar 1 saat daha kabul edilir (aynı cihazdaki diğer sekmeler için). Yanıt kaybolursa eski anahtar çalışmaya devam eder;
--    cihaz hiçbir durumda kilitlenmez. Kopyalanmış eski anahtar en geç birkaç gün içinde geçersiz olur.
-- 3) Cihaz silinince işletmenin canlı bildirim kanalı değişir: silinen cihaz eski kanalı dinlemeye devam edemez.
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run.

begin;

-- ───────── 1) PIN kilidi ─────────
create or replace function private.tetra_hata_say(p_anahtar text) returns integer
language plpgsql security definer set search_path to '' as
$$
declare n int;
begin
  insert into private.tetra_deneme as d (anahtar, sayi, ilk) values (p_anahtar, 1, now())
  on conflict (anahtar) do update set
    sayi = case when d.ilk < now() - interval '6 hours' then 1 else d.sayi + 1 end,
    ilk = case when d.ilk < now() - interval '6 hours' then now() else d.ilk end
  returning d.sayi into n;
  if n % 5 = 0 then
    update private.tetra_deneme set kilit_bitis = now() + case when n >= 15 then interval '60 minutes' when n >= 10 then interval '10 minutes' else interval '1 minute' end
    where anahtar = p_anahtar;
    return 0;
  end if;
  if random() < 0.02 then delete from private.tetra_deneme where ilk < now() - interval '1 day'; end if;
  return 5 - (n % 5);
end $$;

-- ───────── 2) cihaz anahtarı yenileme ─────────
alter table private.tetra_cihaz add column if not exists anahtar_tarih timestamptz not null default now();
alter table private.tetra_cihaz add column if not exists bekleyen_ozet text;
alter table private.tetra_cihaz add column if not exists onceki_ozet text;
alter table private.tetra_cihaz add column if not exists onceki_bitis timestamptz;
create unique index if not exists tetra_cihaz_bekleyen on private.tetra_cihaz (bekleyen_ozet) where bekleyen_ozet is not null;
create unique index if not exists tetra_cihaz_onceki on private.tetra_cihaz (onceki_ozet) where onceki_ozet is not null;

create or replace function private.tetra_cihaz_bul(p_anahtar text) returns private.tetra_cihaz
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; v_ozet text;
begin
  if p_anahtar is null or p_anahtar !~ '^[0-9a-f]{64}$' then
    raise exception 'Cihaz tanınmadı.' using errcode = 'TT002';
  end if;
  v_ozet := private.tetra_ozet(p_anahtar);
  select * into c from private.tetra_cihaz x where x.anahtar_ozet = v_ozet and x.aktif;
  if c.id is null then
    -- yeni anahtarın ilk kullanımı: yeni anahtar geçerli olur, eski anahtar 1 saat daha kabul edilir
    update private.tetra_cihaz x set onceki_ozet = x.anahtar_ozet, onceki_bitis = now() + interval '1 hour',
      anahtar_ozet = v_ozet, bekleyen_ozet = null, anahtar_tarih = now()
    where x.bekleyen_ozet = v_ozet and x.aktif returning * into c;
  end if;
  if c.id is null then
    select * into c from private.tetra_cihaz x where x.onceki_ozet = v_ozet and x.onceki_bitis > now() and x.aktif;
  end if;
  if c.id is null then
    raise exception 'Cihaz tanınmadı. Yöneticinin bu cihazı yeniden tanıtması gerekir.' using errcode = 'TT002';
  end if;
  if not exists (select 1 from private.tetra_isletme t where t.restaurant_id = c.restaurant_id and t.aktif) then
    raise exception 'Bu işletmede Tetra paketi kapalı.' using errcode = 'TT003';
  end if;
  if not private.is_public_restaurant(c.restaurant_id) then
    raise exception 'İşletmenin aboneliği etkin değil.' using errcode = 'TT003';
  end if;
  update private.tetra_cihaz set son_gorulme = now() where id = c.id and (son_gorulme is null or son_gorulme < now() - interval '5 minutes');
  return c;
end $$;

-- cihaz durumu: 3 günden eski anahtarla çağrılırsa yeni (bekleyen) anahtar da döner
create or replace function public.tetra_cihaz_durum(p_anahtar text, p_oturum text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; p private.tetra_personel; v_yeni text;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  p := private.tetra_oturum_bul(c, p_oturum);
  if c.anahtar_ozet = private.tetra_ozet(p_anahtar) and c.anahtar_tarih < now() - interval '3 days' then
    v_yeni := private.tetra_anahtar();
    update private.tetra_cihaz set bekleyen_ozet = private.tetra_ozet(v_yeni) where id = c.id;
  end if;
  return (select jsonb_build_object(
      'cihaz', jsonb_build_object('id', c.id, 'ekran', c.ekran, 'ad', c.ad),
      'isletme', jsonb_build_object('id', r.id, 'slug', r.slug, 'ad', r.name, 'logo', r.logo, 'mali', t.mali_takip, 'kasa_gorunum', t.kasa_gorunum, 'mutfak_fisi', t.mutfak_fisi),
      'kanal', t.kanal,
      'gorunum', t.gorunum,
      'personel', case when p.id is not null then jsonb_build_object('id', p.id, 'ad', p.ad, 'indirim', p.indirim_yetkisi) end,
      'personel_tanimli', exists (select 1 from private.tetra_personel x where x.restaurant_id = c.restaurant_id and x.aktif and c.ekran = any (x.yetkiler)),
      'yeni_anahtar', v_yeni)
    from public.restaurants r join private.tetra_isletme t on t.restaurant_id = r.id where r.id = c.restaurant_id);
end $$;

-- ───────── 3) cihaz silinince kanal değişir ─────────
create or replace function public.tetra_cihaz_sil(p_restaurant uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare v_ad text;
begin
  perform private.tetra_sahip_sart(p_restaurant);
  delete from private.tetra_cihaz where id = p_id and restaurant_id = p_restaurant returning ad into v_ad;
  if v_ad is not null then
    perform private.tetra_kayit('tetra_cihaz_sil', 'restaurant', p_restaurant::text, v_ad, jsonb_build_object('cihaz', p_id));
    -- kalan cihazlara eski kanaldan "ayar değişti" haberi gider; cihazlar durumu okuyup yeni kanala geçer
    perform private.tetra_duyur(p_restaurant, 'ayar');
    update private.tetra_isletme set kanal = encode(extensions.gen_random_bytes(24), 'hex'), updated_at = now() where restaurant_id = p_restaurant;
  end if;
  return jsonb_build_object('tamam', true);
end $$;

commit;
