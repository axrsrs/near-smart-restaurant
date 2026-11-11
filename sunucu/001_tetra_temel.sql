-- Tetra · temel şema (NearMenu ile aynı Supabase projesi)
-- UYGULAMA: Supabase → SQL Editor → bu dosyanın tamamını yapıştır → Run. Tek işlemde çalışır: hata olursa hiçbir şey eklenmez.
-- NearMenu tabloları değişmez. Tüm Tetra tabloları "private" şemadadır: API'den doğrudan erişilemez,
-- yalnızca aşağıdaki yetki denetimli işlevler üzerinden okunur ve yazılır.
-- Tek istisna: tetra_tukendi() kasadan işaretlenen ürünün public.products.sold alanını günceller.

begin;

-- ───────────────────────── tablolar ─────────────────────────
create table private.tetra_isletme (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  aktif boolean not null default true,
  kanal text not null default encode(extensions.gen_random_bytes(24), 'hex'), -- cihazların canlı bildirim kanalı
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.tetra_personel (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  ad text not null check (char_length(ad) between 2 and 40),
  yetkiler text[] not null check (yetkiler <@ array['kasa','mutfak']::text[] and cardinality(yetkiler) >= 1),
  pin_ozet text not null,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index tetra_personel_ad on private.tetra_personel (restaurant_id, lower(ad));
create unique index tetra_personel_pin on private.tetra_personel (restaurant_id, pin_ozet);

create table private.tetra_cihaz (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  ekran text not null check (ekran in ('kasa','mutfak','tv')),
  ad text not null check (char_length(ad) between 2 and 40),
  anahtar_ozet text not null unique,
  personel_id uuid references private.tetra_personel(id) on delete set null,
  oturum_ozet text,
  oturum_bitis timestamptz,
  olusturan uuid,
  aktif boolean not null default true,
  son_gorulme timestamptz,
  created_at timestamptz not null default now()
);
create index tetra_cihaz_isletme on private.tetra_cihaz (restaurant_id);

create table private.tetra_siparis (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  no integer not null check (no > 0),
  gun date not null,
  zaman timestamptz not null default now(),
  tur text not null check (tur in ('burada','paket')),
  odeme text not null check (odeme in ('nakit','kart')),
  toplam integer not null check (toplam >= 0),            -- kuruş
  kalemler jsonb not null check (jsonb_typeof(kalemler) = 'array'),
  durum text not null default 'hazirlaniyor' check (durum in ('hazirlaniyor','hazir','teslim','iptal')),
  personel_id uuid,
  personel_ad text not null default '',
  cihaz_id uuid,
  takip_kod text not null unique,
  istek uuid not null,                                     -- aynı isteğin iki kez gönderilmesine karşı
  hazir_zaman timestamptz,
  teslim_zaman timestamptz,
  iptal_zaman timestamptz,
  unique (restaurant_id, gun, no),
  unique (restaurant_id, istek)
);
create index tetra_siparis_acik on private.tetra_siparis (restaurant_id, zaman) where durum in ('hazirlaniyor','hazir');

create table private.tetra_deneme (
  anahtar text primary key,
  sayi integer not null default 0,
  ilk timestamptz not null default now(),
  kilit_bitis timestamptz
);

alter table private.tetra_isletme enable row level security;
alter table private.tetra_personel enable row level security;
alter table private.tetra_cihaz enable row level security;
alter table private.tetra_siparis enable row level security;
alter table private.tetra_deneme enable row level security;

-- ───────────────────────── yardımcılar (private) ─────────────────────────
create function private.tetra_ozet(p text) returns text
language sql immutable set search_path to '' as
$$ select encode(extensions.digest(p, 'sha256'), 'hex'); $$;

create function private.tetra_pin_ozet(rid uuid, pin text) returns text
language sql stable security definer set search_path to '' as
$$ select encode(extensions.hmac(pin, (select s.salt from private.app_salt s limit 1) || rid::text, 'sha256'), 'hex'); $$;

create function private.tetra_anahtar() returns text
language sql set search_path to '' as
$$ select encode(extensions.gen_random_bytes(32), 'hex'); $$;

create function private.tetra_bugun() returns date
language sql stable set search_path to '' as
$$ select (now() at time zone 'Europe/Istanbul')::date; $$;

create function private.tetra_kayit(p_islem text, p_tur text, p_id text, p_ad text, p_detay jsonb default '{}'::jsonb) returns void
language sql security definer set search_path to '' as
$$
  insert into public.audit_log (actor, actor_email, action, target_kind, target_id, target_name, detail)
  values ((select auth.uid()), (select u.email from auth.users u where u.id = (select auth.uid())), p_islem, p_tur, p_id, p_ad, coalesce(p_detay, '{}'::jsonb));
$$;

-- deneme sınırı: art arda 5 hatada 30 sn, 15 dakikada 15 hatada 10 dk kilit
create function private.tetra_kilit_kalan(p_anahtar text) returns integer
language sql stable security definer set search_path to '' as
$$ select coalesce((select greatest(0, ceil(extract(epoch from d.kilit_bitis - now())))::int from private.tetra_deneme d where d.anahtar = p_anahtar), 0); $$;

create function private.tetra_hata_say(p_anahtar text) returns integer
language plpgsql security definer set search_path to '' as
$$
declare n int;
begin
  insert into private.tetra_deneme as d (anahtar, sayi, ilk) values (p_anahtar, 1, now())
  on conflict (anahtar) do update set
    sayi = case when d.ilk < now() - interval '15 minutes' then 1 else d.sayi + 1 end,
    ilk = case when d.ilk < now() - interval '15 minutes' then now() else d.ilk end
  returning d.sayi into n;
  if n % 5 = 0 then
    update private.tetra_deneme set kilit_bitis = now() + case when n >= 15 then interval '10 minutes' else interval '30 seconds' end where anahtar = p_anahtar;
    return 0;
  end if;
  if random() < 0.02 then delete from private.tetra_deneme where ilk < now() - interval '1 day'; end if;
  return 5 - (n % 5);
end $$;

create function private.tetra_deneme_sil(p_anahtar text) returns void
language sql security definer set search_path to '' as
$$ delete from private.tetra_deneme where anahtar = p_anahtar; $$;

-- sahip yetkisi: işletmenin sahibi (ya da süper yönetici) ve Tetra paketi açık
create function private.tetra_sahip_sart(rid uuid) returns void
language plpgsql stable security definer set search_path to '' as
$$
begin
  if not (private.is_super_admin() or exists (select 1 from public.members m where m.restaurant_id = rid and m.user_id = (select auth.uid()) and m.role = 'owner')) then
    raise exception 'Bu işlem için işletme sahibi olarak giriş yapmalısınız.' using errcode = '42501';
  end if;
  if not exists (select 1 from private.tetra_isletme t where t.restaurant_id = rid and t.aktif) then
    raise exception 'Bu işletmede Tetra paketi açık değil.' using errcode = 'TT003';
  end if;
end $$;

-- cihaz anahtarını doğrular; paket ve abonelik etkin değilse reddeder
create function private.tetra_cihaz_bul(p_anahtar text) returns private.tetra_cihaz
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz;
begin
  if p_anahtar is null or p_anahtar !~ '^[0-9a-f]{64}$' then
    raise exception 'Cihaz tanınmadı.' using errcode = 'TT002';
  end if;
  select * into c from private.tetra_cihaz x where x.anahtar_ozet = private.tetra_ozet(p_anahtar) and x.aktif;
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

-- cihazdaki personel oturumunu doğrular; geçerli değilse null
create function private.tetra_oturum_bul(c private.tetra_cihaz, p_oturum text) returns private.tetra_personel
language sql stable security definer set search_path to '' as
$$
  select p.* from private.tetra_personel p
  where p.id = c.personel_id and p.aktif and c.ekran = any (p.yetkiler)
    and p_oturum is not null and c.oturum_ozet = private.tetra_ozet(p_oturum) and c.oturum_bitis > now();
$$;

create function private.tetra_oturum_sart(c private.tetra_cihaz, p_oturum text) returns private.tetra_personel
language plpgsql stable security definer set search_path to '' as
$$
declare p private.tetra_personel;
begin
  p := private.tetra_oturum_bul(c, p_oturum);
  if p.id is null then
    raise exception 'Personel oturumu kapalı. PIN ile yeniden girin.' using errcode = 'TT001';
  end if;
  return p;
end $$;

create function private.tetra_duyur(rid uuid, p_konu text) returns void
language plpgsql security definer set search_path to '' as
$$
begin
  perform realtime.send(jsonb_build_object('konu', p_konu), 'degisti', 'tetra:' || (select t.kanal from private.tetra_isletme t where t.restaurant_id = rid), false);
exception when others then
  null; -- canlı bildirim gönderilemese de işlem tamamlanır; ekranlar düzenli aralıkla da tazelenir
end $$;

create function private.tetra_siparis_json(s private.tetra_siparis, p_tam boolean) returns jsonb
language sql stable set search_path to '' as
$$
  select jsonb_build_object('id', s.id, 'no', s.no, 'gun', s.gun, 'zaman', s.zaman, 'tur', s.tur, 'durum', s.durum,
           'kalemler', s.kalemler, 'personel_ad', s.personel_ad, 'hazir_zaman', s.hazir_zaman)
      || case when p_tam then jsonb_build_object('odeme', s.odeme, 'toplam', s.toplam, 'takip_kod', s.takip_kod) else '{}'::jsonb end;
$$;

-- ───────────────────────── sahip işlevleri (giriş yapmış kullanıcı) ─────────────────────────
create function public.tetra_baslangic() returns jsonb
language sql stable security definer set search_path to '' as
$$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'slug', r.slug, 'ad', r.name, 'logo', r.logo, 'rol', x.rol,
           'tetra', coalesce(t.aktif, false), 'abonelik', private.is_public_restaurant(r.id)) order by r.name), '[]'::jsonb)
  from public.restaurants r
  cross join lateral (select coalesce(
      (select m.role from public.members m where m.restaurant_id = r.id and m.user_id = (select auth.uid())),
      case when private.is_super_admin() then 'super' end) as rol) x
  left join private.tetra_isletme t on t.restaurant_id = r.id
  where x.rol in ('owner', 'super');
$$;

create function public.tetra_personel_liste(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'ad', p.ad, 'yetkiler', p.yetkiler, 'aktif', p.aktif) order by lower(p.ad)), '[]'::jsonb)
          from private.tetra_personel p where p.restaurant_id = p_restaurant);
end $$;

create function public.tetra_personel_kaydet(p_restaurant uuid, p_id uuid, p_ad text, p_yetkiler text[], p_pin text, p_aktif boolean) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare
  v_ad text := regexp_replace(trim(coalesce(p_ad, '')), '\s+', ' ', 'g');
  v_yetki text[] := array(select y from unnest(array['kasa','mutfak']) y where y = any (coalesce(p_yetkiler, '{}')));
  v_eski private.tetra_personel;
  v_ozet text;
begin
  perform private.tetra_sahip_sart(p_restaurant);
  if char_length(v_ad) not between 2 and 40 then return jsonb_build_object('tamam', false, 'hata', 'Ad 2–40 karakter olmalı.'); end if;
  if cardinality(v_yetki) = 0 then return jsonb_build_object('tamam', false, 'hata', 'En az bir ekran seçin.'); end if;
  if p_id is not null then
    select * into v_eski from private.tetra_personel p where p.id = p_id and p.restaurant_id = p_restaurant;
    if v_eski.id is null then return jsonb_build_object('tamam', false, 'hata', 'Personel bulunamadı.'); end if;
  elsif (select count(*) from private.tetra_personel p where p.restaurant_id = p_restaurant) >= 200 then
    return jsonb_build_object('tamam', false, 'hata', 'En fazla 200 personel eklenebilir.');
  end if;
  if coalesce(p_pin, '') <> '' or p_id is null then
    if coalesce(p_pin, '') !~ '^\d{4}$' then return jsonb_build_object('tamam', false, 'hata', 'PIN 4 haneli bir sayı olmalı.'); end if;
    v_ozet := private.tetra_pin_ozet(p_restaurant, p_pin);
  else
    v_ozet := v_eski.pin_ozet;
  end if;
  begin
    if p_id is null then
      insert into private.tetra_personel (restaurant_id, ad, yetkiler, pin_ozet, aktif) values (p_restaurant, v_ad, v_yetki, v_ozet, coalesce(p_aktif, true));
    else
      update private.tetra_personel set ad = v_ad, yetkiler = v_yetki, pin_ozet = v_ozet, aktif = coalesce(p_aktif, true), updated_at = now() where id = p_id;
      -- PIN değişti, giriş kapatıldı ya da yetki alındıysa bu personelin açık cihaz oturumları kapanır
      update private.tetra_cihaz c set personel_id = null, oturum_ozet = null, oturum_bitis = null
       where c.personel_id = p_id and (v_ozet <> v_eski.pin_ozet or not coalesce(p_aktif, true) or not (c.ekran = any (v_yetki)));
    end if;
  exception when unique_violation then
    if exists (select 1 from private.tetra_personel p where p.restaurant_id = p_restaurant and lower(p.ad) = lower(v_ad) and p.id is distinct from p_id) then
      return jsonb_build_object('tamam', false, 'hata', 'Bu adda bir personel zaten var.');
    end if;
    return jsonb_build_object('tamam', false, 'hata', 'Bu PIN başka bir personelde kullanılıyor. Farklı bir PIN seçin.');
  end;
  perform private.tetra_duyur(p_restaurant, 'personel');
  return jsonb_build_object('tamam', true);
end $$;

create function public.tetra_personel_sil(p_restaurant uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  update private.tetra_cihaz set personel_id = null, oturum_ozet = null, oturum_bitis = null where personel_id = p_id and restaurant_id = p_restaurant;
  delete from private.tetra_personel where id = p_id and restaurant_id = p_restaurant;
  perform private.tetra_duyur(p_restaurant, 'personel');
  return jsonb_build_object('tamam', true);
end $$;

create function public.tetra_cihaz_liste(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'ekran', c.ekran, 'ad', c.ad, 'son_gorulme', c.son_gorulme, 'created_at', c.created_at,
            'personel', (select p.ad from private.tetra_personel p where p.id = c.personel_id and c.oturum_bitis > now())) order by c.created_at), '[]'::jsonb)
          from private.tetra_cihaz c where c.restaurant_id = p_restaurant and c.aktif);
end $$;

-- cihaz tanıtma: anahtar yalnızca bu yanıtta bir kez döner, veritabanında özeti saklanır
create function public.tetra_cihaz_ekle(p_restaurant uuid, p_ekran text, p_ad text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare
  v_ad text := regexp_replace(trim(coalesce(p_ad, '')), '\s+', ' ', 'g');
  v_anahtar text := private.tetra_anahtar();
  v_id uuid;
begin
  perform private.tetra_sahip_sart(p_restaurant);
  if p_ekran is null or p_ekran not in ('kasa','mutfak','tv') then return jsonb_build_object('tamam', false, 'hata', 'Geçersiz ekran.'); end if;
  if char_length(v_ad) not between 2 and 40 then return jsonb_build_object('tamam', false, 'hata', 'Cihaz adı 2–40 karakter olmalı.'); end if;
  if (select count(*) from private.tetra_cihaz c where c.restaurant_id = p_restaurant and c.aktif) >= 20 then
    return jsonb_build_object('tamam', false, 'hata', 'En fazla 20 cihaz tanıtılabilir. Kullanılmayan bir cihazı kaldırın.');
  end if;
  insert into private.tetra_cihaz (restaurant_id, ekran, ad, anahtar_ozet, olusturan)
  values (p_restaurant, p_ekran, v_ad, private.tetra_ozet(v_anahtar), (select auth.uid())) returning id into v_id;
  perform private.tetra_kayit('tetra_cihaz_ekle', 'restaurant', p_restaurant::text, v_ad, jsonb_build_object('ekran', p_ekran, 'cihaz', v_id));
  return jsonb_build_object('tamam', true, 'id', v_id, 'anahtar', v_anahtar);
end $$;

create function public.tetra_cihaz_sil(p_restaurant uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare v_ad text;
begin
  perform private.tetra_sahip_sart(p_restaurant);
  delete from private.tetra_cihaz where id = p_id and restaurant_id = p_restaurant returning ad into v_ad;
  if v_ad is not null then perform private.tetra_kayit('tetra_cihaz_sil', 'restaurant', p_restaurant::text, v_ad, jsonb_build_object('cihaz', p_id)); end if;
  return jsonb_build_object('tamam', true);
end $$;

-- paket: yalnızca süper yönetici açar ve kapatır
create function public.tetra_admin_ayarla(p_restaurant uuid, p_aktif boolean) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.require_super();
  if not exists (select 1 from public.restaurants r where r.id = p_restaurant) then
    raise exception 'İşletme bulunamadı.' using errcode = '22023';
  end if;
  insert into private.tetra_isletme as t (restaurant_id, aktif) values (p_restaurant, coalesce(p_aktif, true))
  on conflict (restaurant_id) do update set aktif = excluded.aktif, updated_at = now();
  perform private.tetra_kayit('tetra_paket', 'restaurant', p_restaurant::text, (select r.name from public.restaurants r where r.id = p_restaurant), jsonb_build_object('aktif', coalesce(p_aktif, true)));
  return jsonb_build_object('tamam', true);
end $$;

-- ───────────────────────── cihaz işlevleri (cihaz anahtarıyla) ─────────────────────────
create function public.tetra_cihaz_durum(p_anahtar text, p_oturum text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; p private.tetra_personel;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  p := private.tetra_oturum_bul(c, p_oturum);
  return (select jsonb_build_object(
      'cihaz', jsonb_build_object('id', c.id, 'ekran', c.ekran, 'ad', c.ad),
      'isletme', jsonb_build_object('id', r.id, 'slug', r.slug, 'ad', r.name, 'logo', r.logo),
      'kanal', (select t.kanal from private.tetra_isletme t where t.restaurant_id = c.restaurant_id),
      'personel', case when p.id is not null then jsonb_build_object('id', p.id, 'ad', p.ad) end,
      'personel_tanimli', exists (select 1 from private.tetra_personel x where x.restaurant_id = c.restaurant_id and x.aktif and c.ekran = any (x.yetkiler)))
    from public.restaurants r where r.id = c.restaurant_id);
end $$;

create function public.tetra_pin(p_anahtar text, p_pin text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; p private.tetra_personel; v_k text; v_kalan int; v_oturum text;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  if c.ekran not in ('kasa','mutfak') then return jsonb_build_object('tamam', false, 'hata', 'Bu ekran PIN istemez.'); end if;
  if coalesce(p_pin, '') !~ '^\d{4}$' then return jsonb_build_object('tamam', false, 'hata', 'PIN 4 haneli olmalı.'); end if;
  v_k := 'pin:' || c.id::text;
  v_kalan := private.tetra_kilit_kalan(v_k);
  if v_kalan > 0 then
    return jsonb_build_object('tamam', false, 'kilit', v_kalan, 'hata', format('Çok fazla hatalı deneme. %s saniye sonra tekrar deneyin.', v_kalan));
  end if;
  select * into p from private.tetra_personel x
   where x.restaurant_id = c.restaurant_id and x.aktif and c.ekran = any (x.yetkiler) and x.pin_ozet = private.tetra_pin_ozet(c.restaurant_id, p_pin);
  if p.id is null then
    v_kalan := private.tetra_hata_say(v_k);
    if v_kalan = 0 then
      v_kalan := private.tetra_kilit_kalan(v_k);
      return jsonb_build_object('tamam', false, 'kilit', v_kalan, 'hata', format('Çok fazla hatalı deneme. %s saniye sonra tekrar deneyin.', v_kalan));
    end if;
    return jsonb_build_object('tamam', false, 'hata', format('PIN hatalı. Kalan deneme: %s', v_kalan));
  end if;
  perform private.tetra_deneme_sil(v_k);
  v_oturum := private.tetra_anahtar();
  update private.tetra_cihaz set personel_id = p.id, oturum_ozet = private.tetra_ozet(v_oturum), oturum_bitis = now() + interval '18 hours' where id = c.id;
  return jsonb_build_object('tamam', true, 'oturum', v_oturum, 'personel', jsonb_build_object('id', p.id, 'ad', p.ad));
end $$;

create function public.tetra_kilitle(p_anahtar text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  update private.tetra_cihaz set personel_id = null, oturum_ozet = null, oturum_bitis = null where id = c.id;
  return jsonb_build_object('tamam', true);
end $$;

-- sipariş: fiyat ve tutar sunucuda, menüdeki güncel fiyattan hesaplanır
create function public.tetra_siparis_olustur(p_anahtar text, p_oturum text, p_kalemler jsonb, p_tur text, p_odeme text, p_istek uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare
  c private.tetra_cihaz; p private.tetra_personel; s private.tetra_siparis;
  k jsonb; u public.products; v_kalemler jsonb := '[]'::jsonb; v_toplam bigint := 0; v_adet int; v_not text; v_fiyat int; v_gun date; v_no int;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  if c.ekran <> 'kasa' then raise exception 'Sipariş yalnızca kasa ekranından alınır.' using errcode = '42501'; end if;
  p := private.tetra_oturum_sart(c, p_oturum);
  if p_istek is null then return jsonb_build_object('tamam', false, 'hata', 'İstek kimliği eksik.'); end if;
  -- işletme başına sırayla işlenir: günlük sıra numarası tekil kalır, aynı istek iki kez gelirse ikincisi ilk siparişi bulur
  perform pg_advisory_xact_lock(hashtext('tetra_no'), hashtext(c.restaurant_id::text));
  select * into s from private.tetra_siparis x where x.restaurant_id = c.restaurant_id and x.istek = p_istek;
  if s.id is not null then return jsonb_build_object('tamam', true, 'siparis', private.tetra_siparis_json(s, true)); end if;
  if p_tur is null or p_tur not in ('burada','paket') then return jsonb_build_object('tamam', false, 'hata', 'Sipariş türünü seçin.'); end if;
  if p_odeme is null or p_odeme not in ('nakit','kart') then return jsonb_build_object('tamam', false, 'hata', 'Ödeme türünü seçin.'); end if;
  if p_kalemler is null or jsonb_typeof(p_kalemler) <> 'array' or jsonb_array_length(p_kalemler) = 0 then return jsonb_build_object('tamam', false, 'hata', 'Sepet boş.'); end if;
  if jsonb_array_length(p_kalemler) > 100 then return jsonb_build_object('tamam', false, 'hata', 'Bir siparişte en fazla 100 satır olabilir.'); end if;

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
    v_toplam := v_toplam + v_fiyat::bigint * v_adet;
    v_kalemler := v_kalemler || jsonb_build_object('urun_id', u.id, 'ad', u.name, 'fiyat', v_fiyat, 'adet', v_adet, 'not', v_not);
  end loop;
  if v_toplam > 2000000000 then return jsonb_build_object('tamam', false, 'hata', 'Sipariş tutarı çok yüksek.'); end if;

  v_gun := private.tetra_bugun();
  select coalesce(max(x.no), 0) + 1 into v_no from private.tetra_siparis x where x.restaurant_id = c.restaurant_id and x.gun = v_gun;
  insert into private.tetra_siparis (restaurant_id, no, gun, tur, odeme, toplam, kalemler, personel_id, personel_ad, cihaz_id, takip_kod, istek)
  values (c.restaurant_id, v_no, v_gun, p_tur, p_odeme, v_toplam::int, v_kalemler, p.id, p.ad, c.id, encode(extensions.gen_random_bytes(16), 'hex'), p_istek)
  returning * into s;
  perform private.tetra_duyur(c.restaurant_id, 'siparis');
  return jsonb_build_object('tamam', true, 'siparis', private.tetra_siparis_json(s, true));
end $$;

-- ekranların sipariş listesi: kasa bugünün tümünü, mutfak açık siparişleri, TV yalnızca numaraları görür
create function public.tetra_siparisler(p_anahtar text, p_oturum text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; v_gun date := private.tetra_bugun();
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  if c.ekran = 'tv' then
    return jsonb_build_object('gun', v_gun, 'siparisler', (select coalesce(jsonb_agg(jsonb_build_object('no', s.no, 'durum', s.durum, 'hazir_zaman', s.hazir_zaman) order by s.no), '[]'::jsonb)
      from private.tetra_siparis s where s.restaurant_id = c.restaurant_id and s.durum in ('hazirlaniyor','hazir') and s.zaman > now() - interval '18 hours'));
  end if;
  perform private.tetra_oturum_sart(c, p_oturum);
  if c.ekran = 'mutfak' then
    return jsonb_build_object('gun', v_gun, 'siparisler', (select coalesce(jsonb_agg(private.tetra_siparis_json(s, false) order by s.zaman), '[]'::jsonb)
      from private.tetra_siparis s where s.restaurant_id = c.restaurant_id and s.durum in ('hazirlaniyor','hazir') and s.zaman > now() - interval '18 hours'));
  end if;
  return jsonb_build_object('gun', v_gun, 'siparisler', (select coalesce(jsonb_agg(private.tetra_siparis_json(s, true) order by s.no desc), '[]'::jsonb)
    from private.tetra_siparis s where s.restaurant_id = c.restaurant_id and s.gun = v_gun));
end $$;

create function public.tetra_siparis_durum(p_anahtar text, p_oturum text, p_id uuid, p_durum text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; s private.tetra_siparis; v_izin boolean;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  perform private.tetra_oturum_sart(c, p_oturum);
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
    iptal_zaman = case when p_durum = 'iptal' then now() else iptal_zaman end
  where id = s.id returning * into s;
  perform private.tetra_duyur(c.restaurant_id, 'siparis');
  return jsonb_build_object('tamam', true, 'siparis', private.tetra_siparis_json(s, c.ekran = 'kasa'));
end $$;

-- tükendi: ürünün NearMenu'deki kaydını günceller; QR menüde de aynı anda görünür
create function public.tetra_tukendi(p_anahtar text, p_oturum text, p_urun uuid, p_tukendi boolean) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; v_ad text;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  if c.ekran <> 'kasa' then raise exception 'Tükendi işareti yalnızca kasa ekranından verilir.' using errcode = '42501'; end if;
  perform private.tetra_oturum_sart(c, p_oturum);
  update public.products set sold = coalesce(p_tukendi, false) where id = p_urun and restaurant_id = c.restaurant_id returning name into v_ad;
  if v_ad is null then return jsonb_build_object('tamam', false, 'hata', 'Ürün bulunamadı.'); end if;
  perform private.tetra_duyur(c.restaurant_id, 'menu');
  return jsonb_build_object('tamam', true);
end $$;

-- ───────────────────────── müşteri ─────────────────────────
-- takip kodu 128 bit rastgeledir; yalnızca numara ve durum döner, son 24 saatin siparişleri izlenir
create function public.tetra_takip(p_kod text) returns jsonb
language sql stable security definer set search_path to '' as
$$
  select jsonb_build_object('no', s.no, 'durum', s.durum, 'tur', s.tur, 'isletme', jsonb_build_object('ad', r.name, 'logo', r.logo))
  from private.tetra_siparis s join public.restaurants r on r.id = s.restaurant_id
  where p_kod ~ '^[0-9a-f]{32}$' and s.takip_kod = p_kod and s.zaman > now() - interval '24 hours';
$$;

-- ───────────────────────── yetkiler ─────────────────────────
revoke all on private.tetra_isletme, private.tetra_personel, private.tetra_cihaz, private.tetra_siparis, private.tetra_deneme from public, anon, authenticated;
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as imza, n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.proname like 'tetra\_%' and n.nspname in ('public', 'private') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.imza);
  end loop;
end $$;
grant execute on function public.tetra_baslangic(), public.tetra_personel_liste(uuid), public.tetra_personel_kaydet(uuid, uuid, text, text[], text, boolean),
  public.tetra_personel_sil(uuid, uuid), public.tetra_cihaz_liste(uuid), public.tetra_cihaz_ekle(uuid, text, text), public.tetra_cihaz_sil(uuid, uuid),
  public.tetra_admin_ayarla(uuid, boolean) to authenticated;
grant execute on function public.tetra_cihaz_durum(text, text), public.tetra_pin(text, text), public.tetra_kilitle(text),
  public.tetra_siparis_olustur(text, text, jsonb, text, text, uuid), public.tetra_siparisler(text, text),
  public.tetra_siparis_durum(text, text, uuid, text), public.tetra_tukendi(text, text, uuid, boolean), public.tetra_takip(text) to anon, authenticated;

commit;
