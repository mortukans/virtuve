-- 07 attendance ("who eats tonight"), shopping trips ("I'm at the shop"), meal requests.

create table public.attendance (
  household_id uuid not null references public.households (id) on delete cascade,
  member_id    uuid not null references public.household_members (id) on delete cascade,
  attend_date  date not null,
  status       text not null default 'home',
  primary key (household_id, member_id, attend_date),
  constraint attendance_status_chk check (status in ('home','away','unknown'))
);

create or replace function public.set_attendance(p_household uuid, p_date date, p_status text, p_member uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare target uuid; tgt_user uuid;
begin
  perform private.require_member(p_household);
  if p_status not in ('home','away','unknown') then raise exception 'status_invalid'; end if;
  if p_member is null then
    select id into target from household_members where household_id = p_household and user_id = auth.uid();
  else
    select id, user_id into target, tgt_user from household_members where id = p_member and household_id = p_household;
    if target is null then raise exception 'not_found'; end if;
    if tgt_user is distinct from auth.uid() then perform private.require_admin(p_household); end if;
  end if;
  if target is null then raise exception 'not_found'; end if;
  insert into attendance (household_id, member_id, attend_date, status)
  values (p_household, target, p_date, p_status)
  on conflict (household_id, member_id, attend_date) do update set status = excluded.status;
end $$;

create or replace function public.get_attendance(p_household uuid, p_date date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'household_id', p_household, 'member_id', m.id, 'member_name', m.display_name, 'date', p_date,
      'status', coalesce(a.status, case when m.eats_by_default then 'home' else 'unknown' end)
    ) order by m.created_at), '[]')
    from household_members m
    left join attendance a on a.member_id = m.id and a.attend_date = p_date
    where m.household_id = p_household
  );
end $$;

-- who's at the shop right now
create table public.shoppers (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);

create or replace function public.start_shopping(p_household uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  insert into shoppers (household_id, user_id) values (p_household, auth.uid())
  on conflict (household_id, user_id) do update set started_at = now();
end $$;

create or replace function public.end_shopping(p_household uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  delete from shoppers where household_id = p_household and user_id = auth.uid();
end $$;

create or replace function public.get_shoppers(p_household uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'household_id', p_household, 'user_id', s.user_id,
      'name', coalesce(m.display_name, pr.display_name, 'Mājinieks'), 'started_at', s.started_at) order by s.started_at), '[]')
    from shoppers s
    left join household_members m on m.household_id = s.household_id and m.user_id = s.user_id
    left join profiles pr on pr.id = s.user_id
    where s.household_id = p_household);
end $$;

-- "ko gribam apēst" wish list
create table public.meal_requests (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  text         text not null,
  created_at   timestamptz not null default now()
);
create index meal_requests_household_idx on public.meal_requests (household_id, created_at desc);

create or replace function public.add_request(p_household uuid, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r meal_requests; v text := nullif(trim(coalesce(p_text,'')), '');
begin
  perform private.require_member(p_household);
  if v is null or char_length(v) > 120 then raise exception 'text_invalid'; end if;
  insert into meal_requests (household_id, user_id, text) values (p_household, auth.uid(), v) returning * into r;
  return to_jsonb(r) || jsonb_build_object('requester_name',
    (select coalesce(m.display_name, pr.display_name, 'Mājinieks') from profiles pr
       left join household_members m on m.household_id = p_household and m.user_id = auth.uid() where pr.id = auth.uid()));
end $$;

create or replace function public.get_requests(p_household uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  return (select coalesce(jsonb_agg(
      to_jsonb(r) || jsonb_build_object('requester_name', coalesce(m.display_name, pr.display_name, 'Mājinieks'))
      order by r.created_at desc), '[]')
    from meal_requests r
    left join household_members m on m.household_id = r.household_id and m.user_id = r.user_id
    left join profiles pr on pr.id = r.user_id
    where r.household_id = p_household);
end $$;

create or replace function public.remove_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r meal_requests;
begin
  select * into r from meal_requests where id = p_request;
  if not found then return; end if;
  if r.user_id is distinct from auth.uid() then perform private.require_admin(r.household_id); end if;
  delete from meal_requests where id = p_request;
end $$;
