-- Tetra · deneme işletmesi (testler bu işletmede koşar; demo işletmeye dokunulmaz)
-- Demo menünün kopyasıyla "tetra-test" işletmesini ve sahibini açar, Tetra paketini etkinleştirir.
-- Sonuçta dönen geçici şifre yalnızca bir kez görünür; testlerde TETRA_TEST_SIFRE olarak verilir, repoya yazılmaz.
create temp table _tetra_sonuc (bilgi jsonb);
do $$
declare rid uuid; src public.restaurants; sahip jsonb; n int;
begin
  if exists (select 1 from public.restaurants where slug = 'tetra-test') then raise exception 'tetra-test zaten var'; end if;
  select * into src from public.restaurants where slug = 'nearmenu-demo';
  insert into public.restaurants (slug, name, subtitle, subtitles, phone, whatsapp, hours, settings, status, plan)
  values ('tetra-test', 'Tetra Deneme', coalesce(src.subtitle, ''), coalesce(src.subtitles, '{}'::jsonb), '', '', coalesce(src.hours, ''), coalesce(src.settings, '{}'::jsonb) - 'lastBulk', 'active', 'basic')
  returning id into rid;
  n := private.clone_menu(src.id, rid);
  sahip := private.ensure_user('tetra-test@neardiji.com', false);
  insert into public.members (restaurant_id, user_id, role) values (rid, (sahip->>'user_id')::uuid, 'owner') on conflict do nothing;
  insert into private.tetra_isletme (restaurant_id) values (rid) on conflict do nothing;
  insert into _tetra_sonuc values (jsonb_build_object('isletme', rid, 'urun', n, 'eposta', sahip->>'email', 'gecici_sifre', sahip->>'temp_password'));
end $$;
select bilgi from _tetra_sonuc;
