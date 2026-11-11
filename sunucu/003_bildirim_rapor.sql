-- Tetra · müşteri bildirimi, anlık takip, raporlar, 90 günlük özet
-- 001'in üstüne eklenir. NearMenu tabloları değişmez.
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run. Tek işlemde çalışır; hata olursa hiçbir şey değişmez.

begin;

-- ───────── tablolar ─────────
create table if not exists private.tetra_bildirim (
  id uuid primary key default gen_random_uuid(),
  siparis_id uuid not null references private.tetra_siparis(id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  created_at timestamptz not null default now(),
  unique (siparis_id, endpoint)
);
create table if not exists private.tetra_gun_ozet (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  gun date not null,
  siparis integer not null default 0,
  iptal integer not null default 0,
  ciro bigint not null default 0,
  nakit bigint not null default 0,
  kart bigint not null default 0,
  burada integer not null default 0,
  paket integer not null default 0,
  urunler jsonb not null default '[]'::jsonb,
  primary key (restaurant_id, gun)
);
alter table private.tetra_bildirim enable row level security;
alter table private.tetra_gun_ozet enable row level security;
revoke all on private.tetra_bildirim, private.tetra_gun_ozet from public, anon, authenticated;

-- ───────── anlık takip: sipariş durumu değişince o siparişin kanalına haber ─────────
create or replace function private.tetra_takip_duyur(p_kod text) returns void
language plpgsql security definer set search_path to '' as
$$
begin
  perform realtime.send(jsonb_build_object('konu', 'durum'), 'degisti', 'tetra-takip:' || p_kod, false);
exception when others then
  null;
end $$;

create or replace function public.tetra_siparis_durum(p_anahtar text, p_oturum text, p_id uuid, p_durum text) returns jsonb
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
  perform private.tetra_takip_duyur(s.takip_kod);
  return jsonb_build_object('tamam', true, 'siparis', private.tetra_siparis_json(s, c.ekran = 'kasa'), 'bildirim', (p_durum = 'hazir' and exists (select 1 from private.tetra_bildirim b where b.siparis_id = s.id)));
end $$;

-- ───────── müşteri: bildirim aboneliği (takip koduyla, girişsiz) ─────────
create or replace function public.tetra_takip_abone(p_kod text, p_endpoint text, p_p256dh text, p_auth text) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare s private.tetra_siparis;
begin
  if coalesce(p_kod, '') !~ '^[0-9a-f]{32}$' then return jsonb_build_object('tamam', false, 'hata', 'Sipariş bulunamadı.'); end if;
  select * into s from private.tetra_siparis x where x.takip_kod = p_kod and x.zaman > now() - interval '24 hours';
  if s.id is null then return jsonb_build_object('tamam', false, 'hata', 'Sipariş bulunamadı.'); end if;
  if s.durum <> 'hazirlaniyor' then return jsonb_build_object('tamam', false, 'hata', 'Bu sipariş için bildirim gerekmiyor.'); end if;
  if coalesce(p_endpoint, '') !~ '^https://[a-z0-9.-]+/' or char_length(p_endpoint) > 1000
     or coalesce(char_length(p_p256dh), 0) not between 20 and 200 or coalesce(char_length(p_auth), 0) not between 8 and 100 then
    return jsonb_build_object('tamam', false, 'hata', 'Bildirim kaydı geçersiz.');
  end if;
  if (select count(*) from private.tetra_bildirim b where b.siparis_id = s.id) >= 3 then
    return jsonb_build_object('tamam', true); -- bir sipariş için en fazla 3 telefon
  end if;
  insert into private.tetra_bildirim (siparis_id, endpoint, p256dh, auth) values (s.id, p_endpoint, p_p256dh, p_auth)
  on conflict (siparis_id, endpoint) do nothing;
  return jsonb_build_object('tamam', true);
end $$;

-- bildirimi gönderecek sunucu işlevi (Edge Function) için: hazır olan siparişin aboneliklerini bir kez verir ve siler
create or replace function public.tetra_bildirim_al(p_anahtar text, p_siparis uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; s private.tetra_siparis; v jsonb;
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  select * into s from private.tetra_siparis x where x.id = p_siparis and x.restaurant_id = c.restaurant_id and x.durum = 'hazir';
  if s.id is null then return jsonb_build_object('abonelikler', '[]'::jsonb); end if;
  with silinen as (delete from private.tetra_bildirim b where b.siparis_id = s.id returning b.endpoint, b.p256dh, b.auth)
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb) into v from silinen;
  return jsonb_build_object('abonelikler', v, 'no', s.no, 'kod', s.takip_kod, 'isletme', (select r.name from public.restaurants r where r.id = s.restaurant_id));
end $$;

-- ───────── 90 günden eski siparişler günlük özete dönüşür ─────────
create or replace function private.tetra_ozetle(rid uuid) returns void
language plpgsql security definer set search_path to '' as
$$
declare v_sinir date := private.tetra_bugun() - 90;
begin
  insert into private.tetra_gun_ozet (restaurant_id, gun, siparis, iptal, ciro, nakit, kart, burada, paket, urunler)
  select rid, g.gun, g.siparis, g.iptal, g.ciro, g.nakit, g.kart, g.burada, g.paket,
         coalesce((select jsonb_agg(jsonb_build_object('ad', u.ad, 'adet', u.adet, 'ciro', u.ciro) order by u.ciro desc)
           from (select k->>'ad' as ad, sum((k->>'adet')::int) as adet, sum((k->>'adet')::int * (k->>'fiyat')::bigint) as ciro
                 from private.tetra_siparis s2, jsonb_array_elements(s2.kalemler) k
                 where s2.restaurant_id = rid and s2.gun = g.gun and s2.durum <> 'iptal' group by 1) u), '[]'::jsonb)
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

-- ───────── rapor (işletme sahibi): tarih aralığında özet, günlük döküm, en çok satanlar ─────────
create or replace function public.tetra_rapor(p_restaurant uuid, p_bas date, p_bit date) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare v_gunler jsonb; v_urunler jsonb; v_ozet jsonb;
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
  return jsonb_build_object('ozet', v_ozet, 'gunler', v_gunler, 'urunler', v_urunler);
end $$;

-- ───────── yetkiler ─────────
revoke all on function private.tetra_takip_duyur(text), private.tetra_ozetle(uuid) from public, anon, authenticated;
revoke all on function public.tetra_takip_abone(text, text, text, text), public.tetra_bildirim_al(text, uuid), public.tetra_rapor(uuid, date, date) from public, anon, authenticated;
grant execute on function public.tetra_takip_abone(text, text, text, text) to anon, authenticated;
grant execute on function public.tetra_rapor(uuid, date, date) to authenticated;
grant execute on function public.tetra_bildirim_al(text, uuid) to service_role; -- yalnızca bildirim gönderen sunucu işlevi çağırır

commit;
