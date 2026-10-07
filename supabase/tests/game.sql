-- Run on an isolated Supabase development project: all data rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(v boolean,message text) returns void language plpgsql as $$ begin if v is distinct from true then raise exception 'ASSERTION FAILED: %',message; end if; end $$;
insert into auth.users(id,is_anonymous) select ('00000000-0000-0000-0000-00000000000'||i)::uuid,true from generate_series(1,6)i;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.game_command('create',null,'{"name":"Host","lat":40.73,"lng":-74}') as result \gset
select (:'result'::jsonb->>'room') as room \gset
select code from private.rooms where id=:'room'::uuid \gset
select public.game_command('ready',:'room','{"ready":true}');
do $$ begin
 for i in 2..5 loop
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000'||i,true);
 perform public.game_command('join',null,jsonb_build_object('name','Player '||i,'code',(select code from private.rooms where host=(select id from private.players where uid='00000000-0000-0000-0000-000000000001'))));
 perform public.game_command('ready',(select room from private.players where uid=auth.uid()),'{"ready":true}');
 end loop;
end $$;
-- Non-host start must fail.
do $$ begin
 begin perform public.game_command('start',(select room from private.players where uid=auth.uid())); raise exception 'Non-host start accepted'; exception when raise_exception then if sqlerrm='Non-host start accepted' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.game_command('start',:'room');
select pg_temp.assert_true((select count(*)=1 from private.players where room=:'room' and role='seeker'),'5 players get 1 seeker');
select pg_temp.assert_true((select count(*)=4 from private.players where room=:'room' and role='hider'),'5 players get 4 hiders');
select pg_temp.assert_true((public.get_game(:'room')->>'phase')='hiding','match starts hiding');
-- Auto preset: five players get the Medium tier, and the zone starts at its radius.
select pg_temp.assert_true((select (settings->>'radius')::int=300 and (settings->>'hide_seconds')::int=180 and (settings->>'shrink_seconds')::int=240 and radius=300 and next_radius=210 from private.rooms where id=:'room'),'auto preset applies the Medium tier at start');
-- Authenticated users cannot SELECT locations or mutate signals.
set local role authenticated;
do $$ begin
 begin perform * from private.locations; raise exception 'Location table exposed'; exception when insufficient_privilege then null; end;
 begin update public.room_signals set version=99; raise exception 'Client can mutate signal'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
do $$ begin
 begin perform public.get_game((select id from private.rooms limit 1)); raise exception 'Nonmember read accepted'; exception when raise_exception then if sqlerrm='Nonmember read accepted' then raise; end if; end;
end $$;
-- Advance into hunt. Supply private fixtures with a pre-deadline sample.
update private.rooms set phase_ends=clock_timestamp()-interval '1 second' where id=:'room';
insert into private.locations select id,40.73,-74,5,clock_timestamp()-interval '2 seconds',clock_timestamp()-interval '2 seconds' from private.players where room=:'room';
update private.players set gps_deadline=null where room=:'room';
update private.rooms set next_reveal=clock_timestamp()-interval '1 second' where id=:'room';
select private.advance(:'room');
select set_config('request.jwt.claim.sub',(select uid::text from private.players where room=:'room' and role='seeker'),true);
select pg_temp.assert_true(jsonb_array_length(public.get_game(:'room')->'reveals')=4,'seeker receives eligible snapshot');
update private.locations set lng=-73.99999 where player in(select id from private.players where room=:'room' and role='hider');
select pg_temp.assert_true((select bool_and(lng=-74) from private.reveals where room=:'room'),'snapshot does not follow new coordinates');
update private.reveals set expires_at=clock_timestamp()-interval '1 second' where room=:'room';
select pg_temp.assert_true(jsonb_array_length(public.get_game(:'room')->'reveals')=0,'expired snapshot cannot be read');
-- Mutual tag challenge, fresh nearby GPS, one elimination.
select id as target,uid as target_uid from private.players where room=:'room' and role='hider' limit 1 \gset
select id as seeker,uid as seeker_uid from private.players where room=:'room' and role='seeker' \gset
select set_config('request.jwt.claim.sub',:'target_uid',true);
select pg_temp.assert_true(jsonb_array_length(public.get_game(:'room')->'reveals')=0,'hider receives no other locations');
select public.game_command('challenge',:'room') as challenge \gset
select set_config('request.jwt.claim.sub',:'seeker_uid',true);
select public.game_command('tag',:'room',jsonb_build_object('code',:'challenge'::jsonb->>'code'));
select id as tag from private.tags where hider=:'target' and status='pending' \gset
select set_config('request.jwt.claim.sub',:'target_uid',true);
select public.game_command('confirm',:'room',jsonb_build_object('id',:'tag'));
select pg_temp.assert_true((select status='eliminated' from private.players where id=:'target'),'confirmation eliminates hider');
select pg_temp.assert_true(not exists(select 1 from private.locations where player=:'target'),'elimination deletes location');
-- Shrink eliminates a clearly out-of-zone hider, then expiry awards survivors.
select id as outside from private.players where room=:'room' and role='hider' and status='active' limit 1 \gset
update private.locations set lat=40.75,observed_at=clock_timestamp()-interval '2 seconds' where player=:'outside';
update private.rooms set next_shrink=clock_timestamp()-interval '1 second' where id=:'room';
select private.advance(:'room');
select pg_temp.assert_true((select status='eliminated' from private.players where id=:'outside'),'outside hider eliminated');
update private.rooms set ends_at=clock_timestamp()-interval '1 second' where id=:'room';
select private.advance(:'room');
select pg_temp.assert_true((select winner='hiders' from private.rooms where id=:'room'),'survivors win at expiry');
select pg_temp.assert_true(not exists(select 1 from private.locations where player in(select id from private.players where room=:'room')),'finish purges coordinates');
select pg_temp.assert_true((select expires_at between clock_timestamp()+interval '14 minutes' and clock_timestamp()+interval '15 minutes' from private.rooms where id=:'room'),'finished rooms are kept for 15 minutes');
-- Every preset stays inside the limits the settings action enforces.
select pg_temp.assert_true((select bool_and(((e->'settings'->>'radius')::float between 50 and 2000) and ((e->'settings'->>'min_radius')::float between 20 and (e->'settings'->>'radius')::float) and ((e->'settings'->>'hide_seconds')::int between 15 and 600) and ((e->'settings'->>'hunt_seconds')::int between 60 and 7200) and ((e->'settings'->>'reveal_seconds')::int between 20 and 900) and ((e->'settings'->>'shrink_seconds')::int between 30 and 900)) from jsonb_array_elements(private.presets()) e),'presets respect the settings limits');
select pg_temp.assert_true((select count(*)=4 and min((e->>'min')::int)=2 and max((e->>'max')::int)=30 from jsonb_array_elements(private.presets()) e),'presets cover 2 to 30 players');
-- Lobby retention: leaving deletes the player, hands over host, and removes an emptied room.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
select public.game_command('create',null,'{"name":"Solo","lat":40.73,"lng":-74}')->>'room' as lobby \gset
select code as lobby_code from private.rooms where id=:'lobby' \gset
select pg_temp.assert_true((select settings->>'preset'='auto' from private.rooms where id=:'lobby'),'new rooms default to auto sizing');
select pg_temp.assert_true(jsonb_array_length(public.get_game(:'lobby')->'presets')=4,'lobby snapshot carries the presets');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.game_command('join',null,jsonb_build_object('name','Guest','code',:'lobby_code'));
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
select public.game_command('leave',:'lobby');
select pg_temp.assert_true(not exists(select 1 from private.players where room=:'lobby' and uid='00000000-0000-0000-0000-000000000006'),'leaving a lobby deletes the player');
select pg_temp.assert_true((select host=(select id from private.players where room=:'lobby') from private.rooms where id=:'lobby'),'host passes to the remaining player');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.game_command('leave',:'lobby');
select pg_temp.assert_true(not exists(select 1 from private.rooms where id=:'lobby'),'an emptied lobby is deleted');
-- Cleanup removes lobbies nobody has touched for 30 minutes, but keeps fresh ones.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
select public.game_command('create',null,'{"name":"Idle","lat":40.73,"lng":-74}')->>'room' as idle \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.game_command('create',null,'{"name":"Fresh","lat":40.73,"lng":-74}')->>'room' as fresh \gset
update private.rooms set created_at=clock_timestamp()-interval '31 minutes' where id in(:'idle'::uuid,:'fresh'::uuid);
update private.players set heartbeat=clock_timestamp()-interval '31 minutes' where room=:'idle';
select private.cleanup();
select pg_temp.assert_true(not exists(select 1 from private.rooms where id=:'idle'),'abandoned lobby is removed');
select pg_temp.assert_true(exists(select 1 from private.rooms where id=:'fresh'),'a lobby with a live player is kept');
rollback;
\echo 'TAG database tests passed'
