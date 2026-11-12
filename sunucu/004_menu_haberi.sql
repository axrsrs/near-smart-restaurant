-- Tetra · menü değişikliğinin cihazlara anında haber verilmesi
-- Yönetim › Menü'den yapılan değişiklikten sonra çağrılır; kasa menüyü hemen yeniler (beklemeden).
-- Yalnızca işletme sahibi (ya da süper yönetici) çağırabilir. NearMenu tabloları değişmez.
-- UYGULAMA: Supabase → SQL Editor → tamamını yapıştır → Run.

begin;

create or replace function public.tetra_menu_duyur(p_restaurant uuid) returns jsonb
language plpgsql security definer set search_path to '' as
$$
begin
  perform private.tetra_sahip_sart(p_restaurant);
  perform private.tetra_duyur(p_restaurant, 'menu');
  return jsonb_build_object('tamam', true);
end $$;

revoke all on function public.tetra_menu_duyur(uuid) from public, anon, authenticated;
grant execute on function public.tetra_menu_duyur(uuid) to authenticated;

commit;
