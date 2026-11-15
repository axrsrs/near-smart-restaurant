-- Tetra · dünden kalan siparişler
-- "Hazırlanıyor" ya da "Hazır" durumunda 6 saatten uzun bekleyen sipariş kendiliğinden "Teslim edildi" olur (otomatik_kapanis = true).
-- Takvim günü yerine süre kullanılır: gece yarısını geçen işletmede 23:50 siparişi 00:05'te kapanmaz.
-- Kasa listesi bugünün siparişlerine ek olarak henüz kapanmamış önceki gün siparişlerini de gösterir.
-- Kapanış, cihazların zaten düzenli yaptığı sipariş okumasında yapılır (ayrı zamanlanmış görev yok).
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run.

begin;

alter table private.tetra_siparis add column if not exists otomatik_kapanis boolean not null default false;

create or replace function private.tetra_eskileri_kapat(rid uuid) returns void
language plpgsql security definer set search_path to '' as
$$
declare n int;
begin
  update private.tetra_siparis set durum = 'teslim', teslim_zaman = now(), otomatik_kapanis = true,
    hazir_zaman = coalesce(hazir_zaman, now())
  where restaurant_id = rid and durum in ('hazirlaniyor', 'hazir') and zaman < now() - interval '6 hours';
  get diagnostics n = row_count;
  if n > 0 then perform private.tetra_duyur(rid, 'siparis'); end if;
end $$;

create or replace function public.tetra_siparisler(p_anahtar text, p_oturum text default null) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare c private.tetra_cihaz; v_gun date := private.tetra_bugun();
begin
  c := private.tetra_cihaz_bul(p_anahtar);
  perform private.tetra_eskileri_kapat(c.restaurant_id);
  if c.ekran = 'tv' then
    return jsonb_build_object('gun', v_gun, 'siparisler', (select coalesce(jsonb_agg(jsonb_build_object('no', s.no, 'durum', s.durum, 'hazir_zaman', s.hazir_zaman) order by s.no), '[]'::jsonb)
      from private.tetra_siparis s where s.restaurant_id = c.restaurant_id and s.durum in ('hazirlaniyor','hazir') and s.zaman > now() - interval '18 hours'));
  end if;
  perform private.tetra_oturum_sart(c, p_oturum);
  if c.ekran = 'mutfak' then
    return jsonb_build_object('gun', v_gun, 'siparisler', (select coalesce(jsonb_agg(private.tetra_siparis_json(s, false) order by s.zaman), '[]'::jsonb)
      from private.tetra_siparis s where s.restaurant_id = c.restaurant_id and s.durum in ('hazirlaniyor','hazir') and s.zaman > now() - interval '18 hours'));
  end if;
  -- kasa: bugünün bütün siparişleri + önceki günden kalan açık siparişler
  return jsonb_build_object('gun', v_gun, 'siparisler', (select coalesce(jsonb_agg(private.tetra_siparis_json(s, true) order by s.zaman desc), '[]'::jsonb)
    from private.tetra_siparis s where s.restaurant_id = c.restaurant_id
      and (s.gun = v_gun or (s.durum in ('hazirlaniyor','hazir') and s.zaman > now() - interval '18 hours'))));
end $$;

revoke all on function private.tetra_eskileri_kapat(uuid) from public, anon, authenticated;

commit;
