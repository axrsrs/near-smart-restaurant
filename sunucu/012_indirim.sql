-- Tetra · indirim, ikram ve personel yemeği
-- Kasada siparişe % ya da ₺ indirim, ikram (tamamı) ya da personel yemeği uygulanır. Yalnızca "indirim yetkisi" olan personel yapabilir.
-- Siparişte brüt tutar, indirim türü/değeri/tutarı, gerekçe ve yapan kişi tutulur. İndirim kalemlere oransal dağıtılır (kalem "net"):
-- KDV kırılımı ve ürün cirosu net tutardan hesaplanır. Gün sonu raporu ve Raporlar indirim toplamını gösterir.
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run.

begin;

-- ───────── personel yetkisi ─────────
alter table private.tetra_personel add column if not exists indirim_yetkisi boolean not null default false;

drop function if exists public.tetra_personel_kaydet(uuid, uuid, text, text[], text, boolean);
create or replace function public.tetra_personel_kaydet(p_restaurant uuid, p_id uuid, p_ad text, p_yetkiler text[], p_pin text, p_aktif boolean, p_indirim boolean default null) returns jsonb
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
      insert into private.tetra_personel (restaurant_id, ad, yetkiler, pin_ozet, aktif, indirim_yetkisi) values (p_restaurant, v_ad, v_yetki, v_ozet, coalesce(p_aktif, true), coalesce(p_indirim, false));
    else
      update private.tetra_personel set ad = v_ad, yetkiler = v_yetki, pin_ozet = v_ozet, aktif = coalesce(p_aktif, true),
        indirim_yetkisi = coalesce(p_indirim, indirim_yetkisi), updated_at = now() where id = p_id;
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

create or replace function public.tetra_personel_liste(p_restaurant uuid) returns jsonb
language plpgsql stable security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'ad', p.ad, 'yetkiler', p.yetkiler, 'aktif', p.aktif, 'indirim', p.indirim_yetkisi) order by lower(p.ad)), '[]'::jsonb)
          from private.tetra_personel p where p.restaurant_id = p_restaurant);
end $$;

-- cihaz durumu: personelin indirim yetkisi eklendi
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
      'personel', case when p.id is not null then jsonb_build_object('id', p.id, 'ad', p.ad, 'indirim', p.indirim_yetkisi) end,
      'personel_tanimli', exists (select 1 from private.tetra_personel x where x.restaurant_id = c.restaurant_id and x.aktif and c.ekran = any (x.yetkiler)))
    from public.restaurants r join private.tetra_isletme t on t.restaurant_id = r.id where r.id = c.restaurant_id);
end $$;

-- ───────── sipariş ─────────
alter table private.tetra_siparis add column if not exists brut_toplam integer;
alter table private.tetra_siparis add column if not exists indirim_tur text;
alter table private.tetra_siparis add column if not exists indirim_deger integer;
alter table private.tetra_siparis add column if not exists indirim_tutar integer not null default 0;
alter table private.tetra_siparis add column if not exists indirim_aciklama text;
alter table private.tetra_siparis add column if not exists indirim_kisi text;
do $$ begin
  alter table private.tetra_siparis add constraint tetra_siparis_indirim_kontrol check (
    (indirim_tur is null and indirim_tutar = 0) or (indirim_tur in ('yuzde', 'tutar', 'ikram', 'personel') and indirim_tutar >= 0));
exception when duplicate_object then null; end $$;
alter table private.tetra_gun_ozet add column if not exists indirim bigint not null default 0;

create or replace function private.tetra_siparis_json(s private.tetra_siparis, p_tam boolean) returns jsonb
language sql stable set search_path to '' as
$$
  select jsonb_build_object('id', s.id, 'no', s.no, 'gun', s.gun, 'zaman', s.zaman, 'tur', s.tur, 'durum', s.durum,
           'kalemler', s.kalemler, 'personel_ad', s.personel_ad, 'hazir_zaman', s.hazir_zaman,
           'ikram', s.indirim_tur in ('ikram', 'personel'))
      || case when p_tam then jsonb_build_object('odeme', s.odeme, 'toplam', s.toplam, 'takip_kod', s.takip_kod,
           'mali', case when s.mali_durum is not null then jsonb_build_object('durum', s.mali_durum, 'fis_no', s.mali_fis_no, 'zaman', s.mali_zaman, 'kisi', s.mali_kisi) end,
           'indirim', case when s.indirim_tur is not null then jsonb_build_object('tur', s.indirim_tur, 'deger', s.indirim_deger, 'tutar', s.indirim_tutar,
             'brut', s.brut_toplam, 'aciklama', coalesce(s.indirim_aciklama, ''), 'kisi', coalesce(s.indirim_kisi, '')) end)
         else '{}'::jsonb end;
$$;

-- p_indirim: {"tur": "yuzde"|"tutar"|"ikram"|"personel", "deger": sayı (yüzde ya da kuruş), "aciklama": metin}
drop function if exists public.tetra_siparis_olustur(text, text, jsonb, text, text, uuid);
create or replace function public.tetra_siparis_olustur(p_anahtar text, p_oturum text, p_kalemler jsonb, p_tur text, p_odeme text, p_istek uuid, p_indirim jsonb default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare
  c private.tetra_cihaz; p private.tetra_personel; s private.tetra_siparis; t private.tetra_isletme;
  k jsonb; u public.products; v_kalemler jsonb := '[]'::jsonb; v_toplam bigint := 0; v_adet int; v_not text; v_fiyat int; v_gun date; v_no int; v_kdv int;
  v_itur text; v_ideger int; v_itutar bigint := 0; v_iacik text; v_net jsonb := '[]'::jsonb; v_kalan bigint; v_pay bigint; i int; n int;
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

  -- indirim / ikram
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
    -- indirim kalemlere oransal dağıtılır; yuvarlama farkı son kaleme eklenir
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

revoke all on function public.tetra_personel_kaydet(uuid, uuid, text, text[], text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.tetra_personel_kaydet(uuid, uuid, text, text[], text, boolean, boolean) to authenticated;
revoke all on function public.tetra_siparis_olustur(text, text, jsonb, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.tetra_siparis_olustur(text, text, jsonb, text, text, uuid, jsonb) to anon, authenticated;

-- ───────── raporlar: ürün cirosu ve KDV net tutardan; indirim toplamı ─────────
-- (var olan işlevlerin tanımı yerinde güncellenir; beklenen metin bulunamazsa işlem durur)
do $$
declare d text; y text;
  eski constant text := '(k->>''adet'')::int * (k->>''fiyat'')::bigint';
  yeni constant text := 'coalesce((k->>''net'')::bigint, (k->>''adet'')::int * (k->>''fiyat'')::bigint)';
begin
  -- rapor
  d := pg_get_functiondef('public.tetra_rapor(uuid,date,date)'::regprocedure);
  y := replace(d, eski, yeni);
  y := replace(y, '''paket'', coalesce(sum(g.paket), 0))',
    '''paket'', coalesce(sum(g.paket), 0), ''indirim'', (select coalesce(sum(x.indirim_tutar), 0) from private.tetra_siparis x where x.restaurant_id = p_restaurant and x.gun between p_bas and p_bit and x.durum <> ''iptal'') + (select coalesce(sum(o.indirim), 0) from private.tetra_gun_ozet o where o.restaurant_id = p_restaurant and o.gun between p_bas and p_bit))');
  if y = d or position('''indirim''' in y) = 0 or position('''net''' in y) = 0 then raise exception 'tetra_rapor güncellenemedi'; end if;
  execute y;
  -- 90 günlük özet
  d := pg_get_functiondef('private.tetra_ozetle(uuid)'::regprocedure);
  y := replace(d, eski, yeni);
  y := replace(y, 'urunler, kdv)', 'urunler, kdv, indirim)');
  y := replace(y, '  from (select s.gun,', '  , (select coalesce(sum(s4.indirim_tutar), 0) from private.tetra_siparis s4 where s4.restaurant_id = rid and s4.gun = g.gun and s4.durum <> ''iptal'')' || chr(10) || '  from (select s.gun,');
  if y = d or position('kdv, indirim)' in y) = 0 or position('s4.indirim_tutar' in y) = 0 then raise exception 'tetra_ozetle güncellenemedi'; end if;
  execute y;
  -- gün sonu özeti
  d := pg_get_functiondef('private.tetra_gun_ozeti(uuid,date)'::regprocedure);
  y := replace(d, eski, yeni);
  y := replace(y, '''mali'', jsonb_build_object(',
    '''indirim'', jsonb_build_object(''adet'', (select count(*) from g where indirim_tur is not null), ''tutar'', (select coalesce(sum(indirim_tutar), 0) from g),'
    || ' ''liste'', (select coalesce(jsonb_agg(jsonb_build_object(''no'', no, ''tur'', indirim_tur, ''tutar'', indirim_tutar, ''aciklama'', coalesce(indirim_aciklama, ''''), ''kisi'', coalesce(indirim_kisi, '''')) order by no), ''[]''::jsonb) from g where indirim_tur is not null)),'
    || chr(10) || '    ''mali'', jsonb_build_object(');
  if y = d or position('''indirim''' in y) = 0 then raise exception 'tetra_gun_ozeti güncellenemedi'; end if;
  execute y;
end $$;

commit;
