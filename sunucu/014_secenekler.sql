-- Tetra · ürün seçenekleri: boy, ekstralar, çıkarılacaklar
-- İşletme sahibi seçenek grupları tanımlar (tek ya da çoklu seçim, zorunlu, en fazla seçim) ve grupları ürünlere bağlar.
-- Kasada seçilen seçenekler sunucuda doğrulanır ve fiyatlanır: birim fiyat = ürün fiyatı + seçenek farkları.
-- NearMenu tabloları değişmez; seçenekler Tetra'nın kendi tablolarında tutulur.
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run.

begin;

-- ───────── tablolar ─────────
create table if not exists private.tetra_secenek_grup (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  ad text not null check (char_length(ad) between 1 and 40),
  tur text not null check (tur in ('tek', 'coklu')),
  zorunlu boolean not null default false,
  en_fazla smallint check (en_fazla is null or en_fazla between 1 and 30),
  sira integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tetra_secenek_grup_isletme on private.tetra_secenek_grup (restaurant_id);

create table if not exists private.tetra_secenek (
  id uuid primary key default gen_random_uuid(),
  grup_id uuid not null references private.tetra_secenek_grup(id) on delete cascade,
  ad text not null check (char_length(ad) between 1 and 40),
  fiyat integer not null default 0 check (fiyat between 0 and 100000000),   -- kuruş, ürün fiyatına eklenir
  varsayilan boolean not null default false,
  aktif boolean not null default true,                                       -- kapalıysa kasada seçilemez (tükendi)
  sira integer not null default 0
);
create index if not exists tetra_secenek_grup_idx on private.tetra_secenek (grup_id);

create table if not exists private.tetra_urun_grup (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  urun_id uuid not null references public.products(id) on delete cascade,
  grup_id uuid not null references private.tetra_secenek_grup(id) on delete cascade,
  sira integer not null default 0,
  primary key (urun_id, grup_id)
);
create index if not exists tetra_urun_grup_isletme on private.tetra_urun_grup (restaurant_id);

alter table private.tetra_secenek_grup enable row level security;
alter table private.tetra_secenek enable row level security;
alter table private.tetra_urun_grup enable row level security;
revoke all on private.tetra_secenek_grup, private.tetra_secenek, private.tetra_urun_grup from public, anon, authenticated;

-- ───────── okuma: gruplar, seçenekler ve ürün bağlantıları ─────────
create or replace function private.tetra_secenek_veri(rid uuid, p_yalniz_aktif boolean) returns jsonb
language sql stable security definer set search_path to '' as
$$
  select jsonb_build_object(
    'gruplar', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'ad', g.ad, 'tur', g.tur, 'zorunlu', g.zorunlu, 'en_fazla', g.en_fazla,
        'secenekler', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'ad', s.ad, 'fiyat', s.fiyat, 'varsayilan', s.varsayilan, 'aktif', s.aktif) order by s.sira, s.ad)
                                from private.tetra_secenek s where s.grup_id = g.id and (not p_yalniz_aktif or s.aktif)), '[]'::jsonb))
      order by g.sira, g.ad) from private.tetra_secenek_grup g where g.restaurant_id = rid), '[]'::jsonb),
    'urunler', coalesce((select jsonb_object_agg(x.urun_id::text, x.gruplar) from (
        select ug.urun_id, jsonb_agg(ug.grup_id order by ug.sira) as gruplar from private.tetra_urun_grup ug where ug.restaurant_id = rid group by ug.urun_id) x), '{}'::jsonb));
$$;

-- yönetim (işletme sahibi)
create or replace function public.tetra_secenek_liste(p_restaurant uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  return private.tetra_secenek_veri(p_restaurant, false);
end $$;

-- kasa (cihaz + personel oturumu): yalnızca açık seçenekler
create or replace function public.tetra_kasa_secenekler(p_anahtar text, p_oturum text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  if c.ekran <> 'kasa' then raise exception 'Seçenekler yalnızca kasa ekranında kullanılır.' using errcode = '42501'; end if;
  perform private.tetra_oturum_sart(c, p_oturum);
  return private.tetra_secenek_veri(c.restaurant_id, true);
end $$;

-- ───────── grup kaydet: grup bilgisi + seçenek listesi + bağlı ürünler (hepsi birlikte) ─────────
-- p_grup: {"id": uuid|null, "ad", "tur": "tek"|"coklu", "zorunlu": bool, "en_fazla": int|null,
--          "secenekler": [{"id": uuid|null, "ad", "fiyat": kuruş, "varsayilan": bool, "aktif": bool}], "urunler": [uuid, ...]}
create or replace function public.tetra_secenek_grup_kaydet(p_restaurant uuid, p_grup jsonb) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare
  v_id uuid; v_ad text; v_tur text; v_zorunlu boolean; v_en_fazla int; s jsonb; v_sad text; v_fiyat bigint; v_sid uuid;
  v_tutulan uuid[] := '{}'; v_urunler uuid[]; v_sira int := 0; v_varsayilan int := 0; u uuid;
begin
  perform private.tetra_sahip_sart(p_restaurant);
  if p_grup is null or jsonb_typeof(p_grup) <> 'object' then return jsonb_build_object('tamam', false, 'hata', 'Geçersiz istek.'); end if;
  v_ad := regexp_replace(trim(coalesce(p_grup->>'ad', '')), '\s+', ' ', 'g');
  v_tur := p_grup->>'tur';
  v_zorunlu := coalesce((p_grup->>'zorunlu')::boolean, false);
  if char_length(v_ad) not between 1 and 40 then return jsonb_build_object('tamam', false, 'hata', 'Grup adı 1–40 karakter olmalı.'); end if;
  if v_tur is null or v_tur not in ('tek', 'coklu') then return jsonb_build_object('tamam', false, 'hata', 'Seçim türü geçersiz.'); end if;
  if coalesce(p_grup->>'en_fazla', '') <> '' then
    if (p_grup->>'en_fazla') !~ '^\d{1,2}$' or (p_grup->>'en_fazla')::int not between 1 and 30 then return jsonb_build_object('tamam', false, 'hata', 'En fazla seçim 1–30 arasında olmalı.'); end if;
    v_en_fazla := (p_grup->>'en_fazla')::int;
  end if;
  if v_tur = 'tek' then v_en_fazla := null; end if;
  if jsonb_typeof(p_grup->'secenekler') <> 'array' or jsonb_array_length(p_grup->'secenekler') = 0 then return jsonb_build_object('tamam', false, 'hata', 'En az bir seçenek ekleyin.'); end if;
  if jsonb_array_length(p_grup->'secenekler') > 40 then return jsonb_build_object('tamam', false, 'hata', 'Bir grupta en fazla 40 seçenek olabilir.'); end if;
  if coalesce(jsonb_typeof(p_grup->'urunler'), 'array') <> 'array' then return jsonb_build_object('tamam', false, 'hata', 'Ürün listesi geçersiz.'); end if;

  if coalesce(p_grup->>'id', '') <> '' then
    select g.id into v_id from private.tetra_secenek_grup g where g.id = (p_grup->>'id')::uuid and g.restaurant_id = p_restaurant;
    if v_id is null then return jsonb_build_object('tamam', false, 'hata', 'Grup bulunamadı.'); end if;
    update private.tetra_secenek_grup set ad = v_ad, tur = v_tur, zorunlu = v_zorunlu, en_fazla = v_en_fazla where id = v_id;
  else
    if (select count(*) from private.tetra_secenek_grup g where g.restaurant_id = p_restaurant) >= 100 then
      return jsonb_build_object('tamam', false, 'hata', 'En fazla 100 seçenek grubu tanımlanabilir.');
    end if;
    insert into private.tetra_secenek_grup (restaurant_id, ad, tur, zorunlu, en_fazla, sira)
    values (p_restaurant, v_ad, v_tur, v_zorunlu, v_en_fazla, (select coalesce(max(g.sira), 0) + 1 from private.tetra_secenek_grup g where g.restaurant_id = p_restaurant))
    returning id into v_id;
  end if;

  for s in select * from jsonb_array_elements(p_grup->'secenekler') loop
    v_sad := regexp_replace(trim(coalesce(s->>'ad', '')), '\s+', ' ', 'g');
    if char_length(v_sad) not between 1 and 40 then raise exception 'Seçenek adı 1–40 karakter olmalı.' using errcode = '22023'; end if;
    if coalesce(s->>'fiyat', '0') !~ '^\d{1,9}$' then raise exception '"%" için fiyat geçersiz.', v_sad using errcode = '22023'; end if;
    v_fiyat := coalesce(nullif(s->>'fiyat', ''), '0')::bigint;
    if v_fiyat > 100000000 then raise exception '"%" için fiyat çok yüksek.', v_sad using errcode = '22023'; end if;
    if coalesce((s->>'varsayilan')::boolean, false) then v_varsayilan := v_varsayilan + 1; end if;
    v_sid := null;
    if coalesce(s->>'id', '') <> '' then
      update private.tetra_secenek x set ad = v_sad, fiyat = v_fiyat, varsayilan = coalesce((s->>'varsayilan')::boolean, false),
        aktif = coalesce((s->>'aktif')::boolean, true), sira = v_sira
      where x.id = (s->>'id')::uuid and x.grup_id = v_id returning x.id into v_sid;
    end if;
    if v_sid is null then
      insert into private.tetra_secenek (grup_id, ad, fiyat, varsayilan, aktif, sira)
      values (v_id, v_sad, v_fiyat, coalesce((s->>'varsayilan')::boolean, false), coalesce((s->>'aktif')::boolean, true), v_sira) returning id into v_sid;
    end if;
    v_tutulan := v_tutulan || v_sid;
    v_sira := v_sira + 1;
  end loop;
  if v_tur = 'tek' and v_varsayilan > 1 then raise exception 'Tek seçimli grupta en fazla bir varsayılan seçenek olabilir.' using errcode = '22023'; end if;
  delete from private.tetra_secenek x where x.grup_id = v_id and not (x.id = any (v_tutulan));

  -- bağlı ürünler: verilen liste aynen uygulanır (yalnızca bu işletmenin ürünleri)
  if p_grup ? 'urunler' then
    v_urunler := array(select (e #>> '{}')::uuid from jsonb_array_elements(p_grup->'urunler') e
                       where (e #>> '{}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
    delete from private.tetra_urun_grup ug where ug.grup_id = v_id and not (ug.urun_id = any (v_urunler));
    foreach u in array v_urunler loop
      insert into private.tetra_urun_grup (restaurant_id, urun_id, grup_id, sira)
      select p_restaurant, x.id, v_id, (select g.sira from private.tetra_secenek_grup g where g.id = v_id)
      from public.products x where x.id = u and x.restaurant_id = p_restaurant
      on conflict (urun_id, grup_id) do nothing;
    end loop;
  end if;

  perform private.tetra_duyur(p_restaurant, 'menu');
  return jsonb_build_object('tamam', true, 'id', v_id);
exception when sqlstate '22023' then
  return jsonb_build_object('tamam', false, 'hata', sqlerrm);
end $$;

create or replace function public.tetra_secenek_grup_sil(p_restaurant uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  delete from private.tetra_secenek_grup g where g.id = p_id and g.restaurant_id = p_restaurant;
  perform private.tetra_duyur(p_restaurant, 'menu');
  return jsonb_build_object('tamam', true);
end $$;

-- ───────── sipariş: kalemde seçenekler doğrulanır ve fiyatlanır ─────────
-- kalem: {"urun_id", "adet", "not", "secenekler": [secenek_id, ...]}
-- kaydedilen kalem: fiyat = birim fiyat (ürün + seçenekler), taban = ürün fiyatı, secenekler = [{"grup","ad","fiyat"}]
create or replace function public.tetra_siparis_olustur(p_anahtar text, p_oturum text, p_kalemler jsonb, p_tur text, p_odeme text, p_istek uuid, p_indirim jsonb default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare
  c private.tetra_cihaz; p private.tetra_personel; s private.tetra_siparis; t private.tetra_isletme;
  k jsonb; u public.products; v_kalemler jsonb := '[]'::jsonb; v_toplam bigint := 0; v_adet int; v_not text; v_fiyat int; v_gun date; v_no int; v_kdv int;
  v_itur text; v_ideger int; v_itutar bigint := 0; v_iacik text; v_net jsonb := '[]'::jsonb; v_kalan bigint; v_pay bigint; i int; n int;
  v_secilen uuid[]; v_sec_json jsonb; v_ek bigint; g record; v_say int;
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

    -- seçenekler: yalnızca bu ürüne bağlı gruplardan, açık seçenekler; grup kuralları denetlenir
    if coalesce(jsonb_typeof(k->'secenekler'), 'array') <> 'array' or jsonb_array_length(coalesce(k->'secenekler', '[]'::jsonb)) > 60 then
      return jsonb_build_object('tamam', false, 'hata', 'Sepette geçersiz seçenek var.');
    end if;
    v_secilen := array(select distinct (e #>> '{}')::uuid from jsonb_array_elements(coalesce(k->'secenekler', '[]'::jsonb)) e
                       where (e #>> '{}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
    if cardinality(v_secilen) <> jsonb_array_length(coalesce(k->'secenekler', '[]'::jsonb)) then
      return jsonb_build_object('tamam', false, 'hata', 'Sepette geçersiz seçenek var.');
    end if;
    if exists (select 1 from unnest(v_secilen) sid where not exists (
        select 1 from private.tetra_secenek x join private.tetra_urun_grup ug on ug.grup_id = x.grup_id and ug.urun_id = u.id
        where x.id = sid and x.aktif)) then
      return jsonb_build_object('tamam', false, 'hata', format('"%s" için seçilen bir seçenek artık yok ya da kapalı. Ürünü sepetten çıkarıp yeniden ekleyin.', u.name), 'tukenen', u.id);
    end if;
    for g in select sg.id, sg.ad, sg.tur, sg.zorunlu, sg.en_fazla from private.tetra_secenek_grup sg
             join private.tetra_urun_grup ug on ug.grup_id = sg.id and ug.urun_id = u.id loop
      select count(*) into v_say from private.tetra_secenek x where x.grup_id = g.id and x.id = any (v_secilen);
      if g.zorunlu and v_say = 0 then return jsonb_build_object('tamam', false, 'hata', format('"%s" için %s seçin.', u.name, g.ad)); end if;
      if g.tur = 'tek' and v_say > 1 then return jsonb_build_object('tamam', false, 'hata', format('"%s" için %s grubundan yalnızca bir seçenek seçilebilir.', u.name, g.ad)); end if;
      if g.en_fazla is not null and v_say > g.en_fazla then return jsonb_build_object('tamam', false, 'hata', format('"%s" için %s grubundan en fazla %s seçenek seçilebilir.', u.name, g.ad, g.en_fazla)); end if;
    end loop;
    select coalesce(sum(x.fiyat), 0),
           coalesce(jsonb_agg(jsonb_build_object('grup', sg.ad, 'ad', x.ad, 'fiyat', x.fiyat) order by sg.sira, sg.ad, x.sira, x.ad), '[]'::jsonb)
      into v_ek, v_sec_json
    from private.tetra_secenek x join private.tetra_secenek_grup sg on sg.id = x.grup_id where x.id = any (v_secilen);

    v_kdv := coalesce((select d.oran from private.tetra_kdv d where d.restaurant_id = c.restaurant_id and d.urun_id = u.id), t.kdv_varsayilan, 10);
    v_toplam := v_toplam + (v_fiyat + v_ek) * v_adet;
    v_kalemler := v_kalemler || (jsonb_build_object('urun_id', u.id, 'ad', u.name, 'fiyat', v_fiyat + v_ek, 'adet', v_adet, 'not', v_not, 'kdv', v_kdv)
      || case when cardinality(v_secilen) > 0 then jsonb_build_object('taban', v_fiyat, 'secenekler', v_sec_json) else '{}'::jsonb end);
  end loop;
  if v_toplam > 2000000000 then return jsonb_build_object('tamam', false, 'hata', 'Sipariş tutarı çok yüksek.'); end if;

  if p_indirim is not null and jsonb_typeof(p_indirim) = 'object' then
    if not p.indirim_yetkisi then return jsonb_build_object('tamam', false, 'hata', 'İndirim ve ikram için yetkin yok. İşletme sahibinden yetki iste.'); end if;
    v_itur := p_indirim->>'tur';
    v_iacik := nullif(left(regexp_replace(trim(coalesce(p_indirim->>'aciklama', '')), '\s+', ' ', 'g'), 80), '');
    if coalesce(p_indirim->>'deger', '') <> '' and (p_indirim->>'deger') !~ '^\d{1,9}$' then return jsonb_build_object('tamam', false, 'hata', 'İndirim değeri geçersiz.'); end if;
    v_ideger := nullif(p_indirim->>'deger', '')::int;
    if v_itur = 'yuzde' then
      if v_ideger is null or v_ideger not between 1 and 100 then return jsonb_build_object('tamam', false, 'hata', 'İndirim yüzdesi 1 ile 100 arasında olmalı.'); end if;
      v_itutar := round(v_toplam * v_ideger / 100.0);
    elsif v_itur = 'tutar' then
      if v_ideger is null or v_ideger < 1 or v_ideger > v_toplam then return jsonb_build_object('tamam', false, 'hata', 'İndirim tutarı sipariş tutarından büyük olamaz.'); end if;
      v_itutar := v_ideger;
    elsif v_itur = 'ikram' then
      v_ideger := 100; v_itutar := v_toplam;
    elsif v_itur = 'personel' then
      v_ideger := coalesce(v_ideger, 100);
      if v_ideger not between 1 and 100 then return jsonb_build_object('tamam', false, 'hata', 'Personel indirimi 1 ile 100 arasında olmalı.'); end if;
      v_itutar := round(v_toplam * v_ideger / 100.0);
    else
      return jsonb_build_object('tamam', false, 'hata', 'İndirim türü geçersiz.');
    end if;
    if v_itur in ('ikram', 'personel') and (v_iacik is null or char_length(v_iacik) < 2) then
      return jsonb_build_object('tamam', false, 'hata', case when v_itur = 'ikram' then 'İkram için kime ya da neden yazın.' else 'Personel yemeği için personelin adını yazın.' end);
    end if;
    n := jsonb_array_length(v_kalemler); v_kalan := v_itutar;
    for i in 0 .. n - 1 loop
      k := v_kalemler->i;
      v_pay := case when i = n - 1 then v_kalan else floor(((k->>'fiyat')::bigint * (k->>'adet')::int) * v_itutar / greatest(v_toplam, 1)::numeric) end;
      v_kalan := v_kalan - v_pay;
      v_net := v_net || (k || jsonb_build_object('net', (k->>'fiyat')::bigint * (k->>'adet')::int - v_pay));
    end loop;
    v_kalemler := v_net;
  end if;

  v_gun := private.tetra_bugun();
  select coalesce(max(x.no), 0) + 1 into v_no from private.tetra_siparis x where x.restaurant_id = c.restaurant_id and x.gun = v_gun;
  insert into private.tetra_siparis (restaurant_id, no, gun, tur, odeme, toplam, kalemler, personel_id, personel_ad, cihaz_id, takip_kod, istek, mali_durum,
                                     brut_toplam, indirim_tur, indirim_deger, indirim_tutar, indirim_aciklama, indirim_kisi)
  values (c.restaurant_id, v_no, v_gun, p_tur, p_odeme, (v_toplam - v_itutar)::int, v_kalemler, p.id, p.ad, c.id, encode(extensions.gen_random_bytes(16), 'hex'), p_istek,
          case when coalesce(t.mali_takip, true) and v_toplam - v_itutar > 0 then 'bekliyor' end,
          v_toplam::int, v_itur, v_ideger, v_itutar::int, v_iacik, case when v_itur is not null then p.ad end)
  returning * into s;
  perform private.tetra_duyur(c.restaurant_id, 'siparis');
  return jsonb_build_object('tamam', true, 'siparis', private.tetra_siparis_json(s, true));
end $$;

-- ───────── yetkiler ─────────
revoke all on function private.tetra_secenek_veri(uuid, boolean) from public, anon, authenticated;
revoke all on function public.tetra_secenek_liste(uuid), public.tetra_secenek_grup_kaydet(uuid, jsonb), public.tetra_secenek_grup_sil(uuid, uuid),
  public.tetra_kasa_secenekler(text, text) from public, anon, authenticated;
grant execute on function public.tetra_secenek_liste(uuid), public.tetra_secenek_grup_kaydet(uuid, jsonb), public.tetra_secenek_grup_sil(uuid, uuid) to authenticated;
grant execute on function public.tetra_kasa_secenekler(text, text) to anon, authenticated;

commit;
