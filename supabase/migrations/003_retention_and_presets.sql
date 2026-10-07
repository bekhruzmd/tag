-- Retention and sizing update. Run once in the Supabase SQL Editor on projects that already
-- ran 001 and 002. Safe to re-run; existing permissions are preserved.
--   * finished rooms are kept for 15 minutes (was 1 hour)
--   * leaving a lobby deletes the player, and the room when it becomes empty
--   * lobbies untouched for 30 minutes are removed by the cleanup job
--   * player-count size presets, applied when the host starts a room set to "auto"
create or replace function private.presets() returns jsonb language sql immutable set search_path='' as $$
 select '[
 {"name":"Small","min":2,"max":4,"settings":{"radius":150,"min_radius":30,"hide_seconds":90,"hunt_seconds":600,"reveal_seconds":90,"shrink_seconds":120}},
 {"name":"Medium","min":5,"max":9,"settings":{"radius":300,"min_radius":50,"hide_seconds":180,"hunt_seconds":1200,"reveal_seconds":180,"shrink_seconds":240}},
 {"name":"Large","min":10,"max":19,"settings":{"radius":450,"min_radius":60,"hide_seconds":300,"hunt_seconds":1800,"reveal_seconds":300,"shrink_seconds":360}},
 {"name":"XL","min":20,"max":30,"settings":{"radius":700,"min_radius":80,"hide_seconds":300,"hunt_seconds":2400,"reveal_seconds":300,"shrink_seconds":420}}
 ]'::jsonb $$;
create or replace function private.finish(r uuid,w text) returns void language plpgsql set search_path='' as $$ begin
 update private.rooms set phase='finished',winner=w,phase_ends=null,next_reveal=null,next_shrink=null,expires_at=clock_timestamp()+interval '15 minutes' where id=r;
 delete from private.locations where player in(select id from private.players where room=r);
 delete from private.reveals where room=r;
 delete from private.challenges where player in(select id from private.players where room=r);
 update private.tags set status='expired' where room=r and status='pending';
 perform private.emit(r,'finished',upper(w)||' WIN');
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
 s:='{"hide_seconds":300,"hunt_seconds":1800,"reveal_seconds":300,"reveal_duration":5,"shrink_seconds":360,"radius":400,"min_radius":60,"shrink_factor":0.7,"seekers_per":5,"tag_distance":20,"gps_grace":90,"preset":"auto"}'::jsonb;
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
 if p_action='leave' and r.phase='lobby' then
 perform private.emit(p_room,'left',me.name||' left.');
 if r.host=me.id then update private.rooms set host=(select id from private.players where room=p_room and status='lobby' and id<>me.id order by joined_at limit 1) where id=p_room; end if;
 delete from private.players where id=me.id;
 if not exists(select 1 from private.players where room=p_room) then delete from private.rooms where id=p_room; end if;
 return '{}'::jsonb;
 end if;
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
 if not ((s->>'hide_seconds')::int between 15 and 600 and (s->>'hunt_seconds')::int between 60 and 7200 and (s->>'reveal_seconds')::int between 20 and 900 and (s->>'reveal_duration')::int between 1 and 10 and (s->>'shrink_seconds')::int between 30 and 900 and (s->>'radius')::float between 50 and 2000 and (s->>'min_radius')::float between 20 and (s->>'radius')::float and (s->>'shrink_factor')::float between .4 and .9 and (s->>'seekers_per')::int between 2 and 15 and (s->>'tag_distance')::int between 5 and 50 and (s->>'gps_grace')::int between 30 and 180 and coalesce(s->>'preset','custom') in('auto','custom')) or s is null then raise exception 'Settings are outside allowed limits.'; end if;
 -- Remove arbitrary keys; every setting must exist and be non-null.
 if exists(select 1 from jsonb_each(r.settings) e where s->e.key is null or s->e.key='null'::jsonb) then raise exception 'Missing setting.'; end if;
 select jsonb_object_agg(e.key,s->e.key) into s from jsonb_each(r.settings) e;
 update private.rooms set settings=s,radius=(s->>'radius')::float,next_radius=greatest((s->>'min_radius')::float,(s->>'radius')::float*(s->>'shrink_factor')::float) where id=p_room;
 update private.players set ready=false where room=p_room and status='lobby';
 elsif p_action='start' then
 select count(*) into n from private.players where room=p_room and status='lobby';
 if n<2 then raise exception 'At least two players are needed.'; end if;
 if exists(select 1 from private.players where room=p_room and status='lobby' and (not ready or heartbeat<t-interval '45 seconds')) then raise exception 'Everyone must be ready and connected.'; end if;
 if r.settings->>'preset'='auto' then
 select e->'settings' into s from jsonb_array_elements(private.presets()) e where n between (e->>'min')::int and (e->>'max')::int limit 1;
 if s is not null then
 r.settings:=r.settings||s;
 update private.rooms set settings=r.settings,radius=(r.settings->>'radius')::float,next_radius=greatest((r.settings->>'min_radius')::float,(r.settings->>'radius')::float*(r.settings->>'shrink_factor')::float) where id=p_room;
 end if;
 end if;
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
create or replace function public.get_game(p_room uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.rooms; me private.players; result jsonb; t timestamptz:=clock_timestamp(); begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 select * into r from private.rooms where id=p_room for share;
 if not found or r.expires_at<=clock_timestamp() then raise exception 'Room expired.'; end if;
 select * into me from private.players where room=p_room and uid=auth.uid() and status<>'left';
 if not found then raise exception 'Room membership not found.'; end if;
 t:=clock_timestamp();
 select jsonb_build_object('id',r.id,'code',r.code,'me',me.id,'host',r.host,'phase',r.phase,'settings',r.settings,'center',jsonb_build_object('lat',r.lat,'lng',r.lng),
 'radius',r.radius,'next_radius',r.next_radius,'phase_ends',r.phase_ends,'ends_at',r.ends_at,'next_reveal',r.next_reveal,'next_shrink',r.next_shrink,'winner',r.winner,'version',r.version,'server_time',t,'gps_deadline',me.gps_deadline,
 'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',p.role,'status',p.status,'ready',p.ready,'connected',p.heartbeat>t-interval '45 seconds','reason',p.reason) order by p.joined_at) from private.players p where p.room=p_room and p.status<>'left'),'[]'::jsonb),
 'presets',case when r.phase='lobby' then private.presets() else null end,
 'reveals',case when r.phase='hunting' and me.role='seeker' and me.status='active' then coalesce((select jsonb_agg(jsonb_build_object('id',v.player,'lat',v.lat,'lng',v.lng,'at',v.sampled_at)) from private.reveals v where v.room=p_room and v.expires_at>t),'[]'::jsonb) else '[]'::jsonb end,
 'reveal_expires',case when r.phase='hunting' and me.role='seeker' and me.status='active' then(select max(expires_at) from private.reveals where room=p_room and expires_at>t) else null end,
 'tags',coalesce((select jsonb_agg(jsonb_build_object('id',id,'seeker',seeker,'hider',hider,'expires',expires_at)) from private.tags where room=p_room and status='pending' and expires_at>t and (seeker=me.id or hider=me.id)),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(e order by e.id desc) from(select id,kind,message,at from private.events where room=p_room order by id desc limit 8)e),'[]'::jsonb)) into result;
 return result;
end $$;
create or replace function private.cleanup() returns void language plpgsql security definer set search_path='' as $$ begin
 delete from private.reveals where expires_at<now();
 delete from private.challenges where expires_at<now();
 delete from private.rooms where expires_at<now();
 -- Lobbies nobody has touched for 30 minutes (empty, or everyone's browser is gone).
 delete from private.rooms rm where rm.phase='lobby' and rm.created_at<now()-interval '30 minutes' and not exists(select 1 from private.players pl where pl.room=rm.id and pl.status<>'left' and pl.heartbeat>now()-interval '30 minutes');
 delete from private.limits where bucket<now()-interval '1 day';
 delete from auth.users u where u.is_anonymous and u.created_at<now()-interval '1 day' and not exists(select 1 from private.players where uid=u.id);
 delete from cron.job_run_details where end_time<now()-interval '1 hour';
end $$;
revoke all on function private.presets() from public, anon, authenticated;
