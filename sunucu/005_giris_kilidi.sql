-- Tetra · yönetici girişi kilidi: aynı e-posta için 15 dakikada 5 hatalı deneme → 15 dakika kilit.
-- Sayaç private.tetra_deneme tablosunda 'giris:<e-posta özeti>' anahtarıyla tutulur (e-posta düz yazı saklanmaz).
-- Bu iki işlevi yalnızca "tetra-giris" sunucu işlevi (service_role) çağırabilir.

create or replace function public.tetra_giris_kilit(p_eposta text) returns integer
language plpgsql security definer set search_path to '' as
$$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Bu işlev yalnızca giriş sunucu işlevi tarafından çağrılır.' using errcode = '42501';
  end if;
  return private.tetra_kilit_kalan('giris:' || private.tetra_ozet(lower(trim(coalesce(p_eposta, '')))));
end $$;

create or replace function public.tetra_giris_sonuc(p_eposta text, p_basarili boolean) returns jsonb
language plpgsql security definer set search_path to '' as
$$
declare v_k text := 'giris:' || private.tetra_ozet(lower(trim(coalesce(p_eposta, '')))); n int;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Bu işlev yalnızca giriş sunucu işlevi tarafından çağrılır.' using errcode = '42501';
  end if;
  if p_basarili then
    update private.tetra_deneme set sayi = 0, kilit_bitis = null, ilk = now() where anahtar = v_k;
    return jsonb_build_object('kalan', 5);
  end if;
  insert into private.tetra_deneme as d (anahtar, sayi, ilk) values (v_k, 1, now())
  on conflict (anahtar) do update set
    sayi = case when d.ilk < now() - interval '15 minutes' then 1 else d.sayi + 1 end,
    ilk = case when d.ilk < now() - interval '15 minutes' then now() else d.ilk end
  returning d.sayi into n;
  if n >= 5 then
    update private.tetra_deneme set kilit_bitis = now() + interval '15 minutes', sayi = 0, ilk = now() where anahtar = v_k;
    return jsonb_build_object('kalan', 0, 'kilit', 900);
  end if;
  return jsonb_build_object('kalan', 5 - n);
end $$;

-- İşlevler zaten içeride service_role denetimi yapar; bu satırlar ek kattır.
revoke all on function public.tetra_giris_kilit(text) from public, anon, authenticated;
revoke all on function public.tetra_giris_sonuc(text, boolean) from public, anon, authenticated;
grant execute on function public.tetra_giris_kilit(text) to service_role;
grant execute on function public.tetra_giris_sonuc(text, boolean) to service_role;
