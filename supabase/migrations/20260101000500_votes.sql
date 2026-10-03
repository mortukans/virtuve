-- 05 "Dinner Match" — household meal voting with match detection.

create table public.vote_sessions (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  created_by        uuid references auth.users (id) on delete set null,
  status            text not null default 'open',
  deadline          timestamptz,
  recipe_ids        uuid[] not null default '{}',
  matched_recipe_id uuid references public.recipes (id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint vote_status_chk check (status in ('open','matched','closed'))
);
create index vote_sessions_household_idx on public.vote_sessions (household_id, created_at desc);

create table public.vote_choices (
  session_id uuid not null references public.vote_sessions (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  recipe_id  uuid not null,
  choice     text not null,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, recipe_id),
  constraint vote_choice_chk check (choice in ('want','ok','no'))
);

create or replace function private.vote_json(p_session uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when s.id is null then null else jsonb_build_object(
    'id', s.id, 'household_id', s.household_id, 'created_by', s.created_by, 'status', s.status,
    'deadline', s.deadline, 'recipe_ids', to_jsonb(s.recipe_ids),
    'matched_recipe_id', s.matched_recipe_id, 'created_at', s.created_at,
    'recipes', (select coalesce(jsonb_agg(to_jsonb(r) order by array_position(s.recipe_ids, r.id)), '[]')
                from recipes r where r.id = any (s.recipe_ids)),
    'votes', (select coalesce(jsonb_agg(jsonb_build_object(
                  'voter', c.user_id,
                  'voter_name', coalesce(m.display_name, pr.display_name, 'Mājinieks'),
                  'recipe_id', c.recipe_id, 'choice', c.choice)), '[]')
              from vote_choices c
              left join household_members m on m.household_id = s.household_id and m.user_id = c.user_id
              left join profiles pr on pr.id = c.user_id
              where c.session_id = s.id)
  ) end
  from vote_sessions s where s.id = p_session
$$;

create or replace function private.recompute_match(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare voters int; humans int; win uuid; hid uuid;
begin
  select household_id into hid from vote_sessions where id = p_session;
  select count(distinct user_id) into voters from vote_choices where session_id = p_session;
  select count(*) into humans from household_members where household_id = hid and user_id is not null;
  select recipe_id into win from vote_choices
    where session_id = p_session and choice = 'want'
    group by recipe_id having count(*) = voters
    order by count(*) desc limit 1;
  if win is not null and voters >= (case when humans <= 1 then 1 else 2 end) then
    update vote_sessions set status = 'matched', matched_recipe_id = win where id = p_session and status = 'open';
  end if;
end $$;

create or replace function public.start_vote(p_household uuid, p_recipe_ids uuid[], p_deadline timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  perform private.require_member(p_household);
  if coalesce(array_length(p_recipe_ids, 1), 0) = 0 then raise exception 'no_recipes'; end if;
  insert into vote_sessions (household_id, created_by, deadline, recipe_ids)
  values (p_household, auth.uid(), p_deadline, p_recipe_ids) returning id into sid;
  return private.vote_json(sid);
end $$;

create or replace function public.cast_vote(p_session uuid, p_recipe uuid, p_choice text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s vote_sessions;
begin
  select * into s from vote_sessions where id = p_session;
  if not found then raise exception 'not_found'; end if;
  perform private.require_member(s.household_id);
  if not (p_recipe = any (s.recipe_ids)) then raise exception 'recipe_not_in_vote'; end if;
  if p_choice not in ('want','ok','no') then raise exception 'choice_invalid'; end if;
  insert into vote_choices (session_id, user_id, recipe_id, choice)
  values (p_session, auth.uid(), p_recipe, p_choice)
  on conflict (session_id, user_id, recipe_id) do update set choice = excluded.choice, created_at = now();
  perform private.recompute_match(p_session);
  return private.vote_json(p_session);
end $$;

create or replace function public.get_vote(p_session uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select household_id into hid from vote_sessions where id = p_session;
  if hid is null then raise exception 'not_found'; end if;
  perform private.require_member(hid);
  return private.vote_json(p_session);
end $$;

create or replace function public.get_active_vote(p_household uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  perform private.require_member(p_household);
  select id into sid from vote_sessions
   where household_id = p_household and status = 'open' and (deadline is null or deadline > now())
   order by created_at desc limit 1;
  if sid is null then return null; end if;
  return private.vote_json(sid);
end $$;

create or replace function public.close_vote(p_session uuid, p_recipe uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s vote_sessions;
begin
  select * into s from vote_sessions where id = p_session;
  if not found then raise exception 'not_found'; end if;
  perform private.require_member(s.household_id);
  update vote_sessions set status = 'closed',
    matched_recipe_id = coalesce(p_recipe, matched_recipe_id)
  where id = p_session;
  return private.vote_json(p_session);
end $$;
