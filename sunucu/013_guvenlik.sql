-- Tetra · güvenlik sıkılaştırmaları
-- 1) PIN denemesi: kilit süreleri büyür (5 hatada 1 dk, 10'da 10 dk, 15 ve sonrası her 5 hatada 60 dk); sayaç 6 saatte sıfırlanır.
-- 2) Cihaz silinince işletmenin canlı bildirim kanalı değişir: silinen cihaz eski kanalı dinlemeye devam edemez.
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run.

begin;

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
