-- Fixes "column reference is ambiguous" errors (PL/pgSQL variable vs table alias) that
-- broke creating a room and mid-game reveals. Run once in the Supabase SQL Editor on
-- projects that already ran 001_game.sql. Safe to re-run; grants are preserved.
create or replace function private.advance(rid uuid) returns void language plpgsql set search_path='' as $$
declare r private.rooms; p record; t timestamptz:=clock_timestamp(); due timestamptz; radius_new double precision; new_host uuid; begin
 select * into r from private.rooms where id=rid for update;
 if not found then return; end if;
 if r.phase='lobby' then
 if not exists(select 1 from private.players where id=r.host and status='lobby' and heartbeat>t-interval '60 seconds') then
 select id into new_host from private.players where room=rid and status='lobby' and heartbeat>t-interval '60 seconds' order by joined_at limit 1;
 if new_host is distinct from r.host then update private.rooms set host=new_host where id=rid; perform private.emit(rid,'host','Lobby host updated.'); end if;
 end if; return; end if;
 if r.phase not in ('hiding','hunting') then return; end if;
 if r.phase='hiding' and t>=r.phase_ends then
 update private.rooms set phase='hunting',phase_ends=ends_at where id=rid;
 perform private.emit(rid,'hunt','THE HUNT BEGINS'); r.phase:='hunting';
 end if;
 -- Process deadlines in chronological order, with expiry winning ties.
 loop
 select * into r from private.rooms where id=rid;
 due:=least(r.ends_at,r.next_shrink,r.next_reveal,(select min(gps_deadline) from private.players where room=rid and status='active'));
 exit when due is null or due>t;
 if due=r.ends_at then perform private.finish(rid,'hiders'); return;
 elsif exists(select 1 from private.players where room=rid and status='active' and gps_deadline=due) then
 for p in select id from private.players where room=rid and status='active' and gps_deadline<=due loop perform private.eliminate(p.id,'Location unavailable'); end loop;
 perform private.check_win(rid);
 elsif due=r.next_shrink then
 radius_new:=r.next_radius;
 update private.rooms set radius=radius_new,next_radius=greatest((settings->>'min_radius')::float,radius_new*(settings->>'shrink_factor')::float),
 next_shrink=case when radius_new<=(settings->>'min_radius')::float then null else next_shrink+make_interval(secs=>(settings->>'shrink_seconds')::int) end where id=rid;
 for p in select x.*,l.lat,l.lng,l.accuracy,l.observed_at,l.received_at from private.players x left join private.locations l on l.player=x.id where x.room=rid and x.status='active' and x.role='hider' loop
 if p.received_at is null or p.observed_at<due-interval '20 seconds' or p.accuracy>40 then
 update private.players set gps_deadline=least(coalesce(gps_deadline,due+make_interval(secs=>(r.settings->>'gps_grace')::int)),due+make_interval(secs=>(r.settings->>'gps_grace')::int)) where id=p.id;
 elsif private.distance(p.lat,p.lng,r.lat,r.lng)>radius_new+least(p.accuracy,10) then perform private.eliminate(p.id,'Outside the safe zone'); end if;
 end loop;
 perform private.emit(rid,'zone','ZONE CLOSED · '||round(radius_new)::text||'m'); perform private.check_win(rid);
 elsif due=r.next_reveal then
 delete from private.reveals where room=rid;
 if due+make_interval(secs=>(r.settings->>'reveal_duration')::int)>t then
 insert into private.reveals select rid,pl.id,l.lat,l.lng,l.observed_at,due+make_interval(secs=>(r.settings->>'reveal_duration')::int)
 from private.players pl join private.locations l on pl.id=l.player where pl.room=rid and pl.role='hider' and pl.status='active' and l.observed_at>=due-interval '20 seconds' and l.observed_at<=due and l.accuracy<=40;
 end if;
 update private.rooms set next_reveal=next_reveal+make_interval(secs=>(settings->>'reveal_seconds')::int) where id=rid;
 perform private.emit(rid,'reveal','LOCATION REVEALED');
 end if;
 exit when (select phase from private.rooms where id=rid) not in('hiding','hunting');
 end loop;
 if (select phase from private.rooms where id=rid) not in('hiding','hunting') then return; end if;
 -- A bounded grace applies to missing/poor GPS, regardless of browser heartbeats.
 update private.players pl set gps_deadline=coalesce(pl.gps_deadline,
 coalesce((select observed_at from private.locations where player=pl.id and accuracy<=40),r.created_at)+interval '25 seconds'+make_interval(secs=>(r.settings->>'gps_grace')::int))
 where pl.room=rid and pl.status='active' and pl.gps_deadline is null and not exists(select 1 from private.locations l where l.player=pl.id and l.accuracy<=40 and l.observed_at>t-interval '25 seconds');
 update private.tags set status='expired' where room=rid and status='pending' and expires_at<=t;
 delete from private.reveals where room=rid and expires_at<=t;
end $$;

create or replace function public.game_command(p_action text,p_room uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.rooms; me private.players; target private.players; s jsonb; rid uuid; pid uuid; c text; n int; t timestamptz:=clock_timestamp();
 tag private.tags; loc private.locations; other private.locations; lat float; lng float; acc float; observed timestamptz; begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 -- Serializes one identity creating/joining multiple rooms concurrently.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if p_action in ('create','join') then
 perform private.rate(p_action,12,60);
 if exists(select 1 from private.players p join private.rooms rm on rm.id=p.room where p.uid=auth.uid() and p.status in('lobby','active','eliminated') and rm.phase in('lobby','hiding','hunting')) then raise exception 'Leave your current room before joining another.'; end if;
 if length(trim(coalesce(p_data->>'name',''))) not between 1 and 24 then raise exception 'Choose a name between 1 and 24 characters.'; end if;
 if p_action='create' then
 s:='{"hide_seconds":300,"hunt_seconds":1800,"reveal_seconds":300,"reveal_duration":5,"shrink_seconds":360,"radius":400,"min_radius":60,"shrink_factor":0.7,"seekers_per":5,"tag_distance":20,"gps_grace":90}'::jsonb;
 lat:=(p_data->>'lat')::float; lng:=(p_data->>'lng')::float;
 if lat is null or lng is null or not(lat between -85 and 85 and lng between -180 and 180) then raise exception 'Choose a valid play area.'; end if;
 loop
 c:=upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,6));
 begin insert into private.rooms(code,settings,lat,lng,radius,next_radius) values(c,s,lat,lng,400,280) returning id into rid; exit; exception when unique_violation then null; end;
 end loop;
 insert into private.players(room,uid,name) values(rid,auth.uid(),trim(p_data->>'name')) returning id into pid;
 update private.rooms set host=pid where id=rid;
 insert into public.room_signals(room) values(rid);
 else
 select * into r from private.rooms where code=upper(trim(p_data->>'code')) for update;
 if not found or r.phase<>'lobby' or r.expires_at<=clock_timestamp() then return jsonb_build_object('error','Room not found or game already started.'); end if;
 rid:=r.id;
 if (select count(*) from private.players where room=rid and status<>'left')>=30 then raise exception 'This room is full.'; end if;
 insert into private.players(room,uid,name) values(rid,auth.uid(),trim(p_data->>'name')) on conflict(room,uid) do update set name=excluded.name,status='lobby',ready=false,heartbeat=t returning id into pid;
 perform private.emit(rid,'joined',trim(p_data->>'name')||' joined.');
 end if;
 return jsonb_build_object('room',rid,'code',c);
 end if;
 select * into r from private.rooms where id=p_room for update;
 if not found or r.expires_at<=clock_timestamp() then raise exception 'Room expired or not found.'; end if;
 select * into me from private.players where room=p_room and uid=auth.uid() and status<>'left';
 if not found then raise exception 'You are not a member of this room.'; end if;
 perform private.advance(p_room);
 select * into r from private.rooms where id=p_room;
 t:=clock_timestamp();
 select * into me from private.players where id=me.id;
 if p_action='heartbeat' then update private.players set heartbeat=t where id=me.id; return '{}'::jsonb; end if;
 if p_action='leave' then
 update private.players set status='left',reason='Left the game' where id=me.id;
 delete from private.locations where player=me.id; delete from private.reveals where player=me.id; delete from private.challenges where player=me.id;
 update private.tags set status='expired' where (hider=me.id or seeker=me.id) and status='pending';
 perform private.emit(p_room,'left',me.name||' left.');
 if r.phase in('hiding','hunting') then perform private.check_win(p_room); end if;
 if r.phase='lobby' and r.host=me.id then update private.rooms set host=(select id from private.players where room=p_room and status='lobby' order by joined_at limit 1) where id=p_room; end if;
 return '{}'::jsonb;
 end if;
 if p_action in('settings','start') and r.host is distinct from me.id then raise exception 'Only the host can do that.'; end if;
 if p_action in('ready','settings','start') and r.phase<>'lobby' then raise exception 'The lobby is locked.'; end if;
 if p_action='ready' then update private.players set ready=coalesce((p_data->>'ready')::boolean,false),heartbeat=t where id=me.id;
 elsif p_action='settings' then
 s:=r.settings||p_data;
 if not ((s->>'hide_seconds')::int between 15 and 600 and (s->>'hunt_seconds')::int between 60 and 7200 and (s->>'reveal_seconds')::int between 20 and 900 and (s->>'reveal_duration')::int between 1 and 10 and (s->>'shrink_seconds')::int between 30 and 900 and (s->>'radius')::float between 50 and 2000 and (s->>'min_radius')::float between 20 and (s->>'radius')::float and (s->>'shrink_factor')::float between .4 and .9 and (s->>'seekers_per')::int between 2 and 15 and (s->>'tag_distance')::int between 5 and 50 and (s->>'gps_grace')::int between 30 and 180) or s is null then raise exception 'Settings are outside allowed limits.'; end if;
 -- Remove arbitrary keys; every setting must exist and be non-null.
 if exists(select 1 from jsonb_each(r.settings) e where s->e.key is null or s->e.key='null'::jsonb) then raise exception 'Missing setting.'; end if;
 select jsonb_object_agg(e.key,s->e.key) into s from jsonb_each(r.settings) e;
 update private.rooms set settings=s,radius=(s->>'radius')::float,next_radius=greatest((s->>'min_radius')::float,(s->>'radius')::float*(s->>'shrink_factor')::float) where id=p_room;
 update private.players set ready=false where room=p_room and status='lobby';
 elsif p_action='start' then
 select count(*) into n from private.players where room=p_room and status='lobby';
 if n<2 then raise exception 'At least two players are needed.'; end if;
 if exists(select 1 from private.players where room=p_room and status='lobby' and (not ready or heartbeat<t-interval '45 seconds')) then raise exception 'Everyone must be ready and connected.'; end if;
 update private.players set status='active',role='hider',gps_deadline=t+make_interval(secs=>(r.settings->>'gps_grace')::int) where room=p_room and status='lobby';
 update private.players set role='seeker' where id in(select id from private.players where room=p_room and status='active' order by extensions.gen_random_bytes(16) limit least(n-1,ceil(n::numeric/(r.settings->>'seekers_per')::int)::int));
 update private.rooms set phase='hiding',phase_ends=t+make_interval(secs=>(settings->>'hide_seconds')::int),ends_at=t+make_interval(secs=>(settings->>'hide_seconds')::int+(settings->>'hunt_seconds')::int),
 next_reveal=t+make_interval(secs=>(settings->>'hide_seconds')::int+(settings->>'reveal_seconds')::int),next_shrink=t+make_interval(secs=>(settings->>'hide_seconds')::int+(settings->>'shrink_seconds')::int),created_at=t where id=p_room;
 perform private.emit(p_room,'hiding','HIDING PHASE');
 elsif p_action='location' then
 if r.phase not in('hiding','hunting') or me.status<>'active' then raise exception 'Location sharing is not active.'; end if;
 perform private.rate('location',30,60);
 lat:=(p_data->>'lat')::float;lng:=(p_data->>'lng')::float;acc:=(p_data->>'accuracy')::float;observed:=(p_data->>'observed_at')::timestamptz;
 if lat is null or lng is null or acc is null or observed is null or not(lat between -90 and 90 and lng between -180 and 180 and acc between 0 and 10000) or observed<t-interval '20 seconds' or observed>t+interval '5 seconds' then raise exception 'Invalid or stale location reading.'; end if;
 if exists(select 1 from private.locations where player=me.id and observed_at>=observed) then return '{}'::jsonb; end if;
 insert into private.locations values(me.id,lat,lng,acc,observed,t) on conflict(player) do update set lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,observed_at=excluded.observed_at,received_at=excluded.received_at where private.locations.observed_at<excluded.observed_at;
 update private.players set heartbeat=t where id=me.id;
 if acc<=40 then
 if me.role='hider' and r.phase='hunting' and r.radius<(r.settings->>'radius')::float and private.distance(lat,lng,r.lat,r.lng)>r.radius+least(acc,10) then
 perform private.eliminate(me.id,'Outside the safe zone'); perform private.check_win(p_room);
 else update private.players set gps_deadline=null where id=me.id; end if;
 end if;
 return '{}'::jsonb;
 elsif p_action='challenge' then
 if r.phase<>'hunting' or me.role<>'hider' or me.status<>'active' then raise exception 'Only active hiders can show a tag code during the hunt.'; end if;
 perform private.rate('challenge',6,60);
 c:=upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,6));
 insert into private.challenges values(me.id,c,t+interval '60 seconds') on conflict(player) do update set code=excluded.code,expires_at=excluded.expires_at;
 return jsonb_build_object('code',c,'expires',t+interval '60 seconds');
 elsif p_action='tag' then
 if r.phase<>'hunting' or me.role<>'seeker' or me.status<>'active' then raise exception 'Only active seekers can tag during the hunt.'; end if;
 perform private.rate('tag',6,60);
 select p.* into target from private.challenges c join private.players p on p.id=c.player where p.room=p_room and p.role='hider' and p.status='active' and c.code=upper(trim(p_data->>'code')) and c.expires_at>t;
 if not found then return jsonb_build_object('error','Tag unavailable. Ask the hider for a fresh code.'); end if;
 select * into loc from private.locations where player=me.id;
 select * into other from private.locations where player=target.id;
 if loc.player is null or other.player is null or loc.observed_at<t-interval '15 seconds' or other.observed_at<t-interval '15 seconds' or loc.accuracy>40 or other.accuracy>40 or private.distance(loc.lat,loc.lng,other.lat,other.lng)>(r.settings->>'tag_distance')::float then return jsonb_build_object('error','Tag unavailable. Both players need fresh, accurate GPS within tagging range.'); end if;
 insert into private.tags(room,seeker,hider,expires_at) values(p_room,me.id,target.id,t+interval '30 seconds') on conflict(hider) where status='pending' do nothing;
 delete from private.challenges where player=target.id;
 elsif p_action in('confirm','reject') then
 select * into tag from private.tags where id=(p_data->>'id')::uuid and room=p_room and hider=me.id and status='pending' and expires_at>t for update;
 if not found then raise exception 'Tag request expired or already handled.'; end if;
 if p_action='reject' then update private.tags set status='rejected' where id=tag.id;
 else
 if r.phase<>'hunting' or me.status<>'active' or not exists(select 1 from private.players where id=tag.seeker and status='active' and role='seeker') then raise exception 'Tag is no longer valid.'; end if;
 select * into loc from private.locations where player=me.id; select * into other from private.locations where player=tag.seeker;
 if loc.player is null or other.player is null or loc.observed_at<t-interval '15 seconds' or other.observed_at<t-interval '15 seconds' or loc.accuracy>40 or other.accuracy>40 or private.distance(loc.lat,loc.lng,other.lat,other.lng)>(r.settings->>'tag_distance')::float then raise exception 'Stay together and wait for fresh GPS, then confirm again.'; end if;
 update private.tags set status='confirmed' where id=tag.id;
 perform private.eliminate(me.id,'Tagged'); perform private.check_win(p_room);
 end if;
 else raise exception 'Unknown action.';
 end if;
 perform private.emit(p_room,p_action,case when p_action='ready' then me.name||case when (p_data->>'ready')::boolean then ' is ready.' else ' is not ready.' end when p_action='settings' then 'Game settings updated.' when p_action='tag' then 'A tag was requested.' else 'Game updated.' end);
 return '{}'::jsonb;
end $$;
