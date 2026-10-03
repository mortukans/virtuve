-- 02 households + members (the central unit) and their RPCs.

create or replace function private.default_settings() returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'priorities', jsonb_build_object('fast',2,'cheap',2,'healthy',1,'high_protein',1,'tasty',2,'low_effort',1,'use_leftovers',2,'reduce_waste',2),
    'cooking_love','fine',
    'equipment', jsonb_build_array('stove','oven','microwave'),
    'weekly_budget', null,
    'tone','friendly'
  )
$$;

create or replace function private.default_prefs() returns jsonb
language sql immutable as $$
  select '{"likes":[],"dislikes":[],"never":[],"allergies":[],"cuisines":[],"diet":[]}'::jsonb
$$;

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  settings    jsonb not null default private.default_settings(),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.household_members (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete cascade, -- null = virtual (child/guest)
  role            text not null default 'member',
  display_name    text not null,
  portion         text not null default 'normal',
  eats_by_default boolean not null default true,
  prefs           jsonb not null default private.default_prefs(),
  created_at      timestamptz not null default now(),
  constraint members_role_chk check (role in ('admin','member','child')),
  constraint members_portion_chk check (portion in ('small','normal','large'))
);
create unique index members_household_user_idx on public.household_members (household_id, user_id) where user_id is not null;
create index members_household_idx on public.household_members (household_id);

-- ─── membership helpers (security definer so policies/RPCs can call safely) ────

create or replace function private.is_member(p_household uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = p_household and user_id = p_uid)
$$;

create or replace function private.is_admin(p_household uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = p_household and user_id = p_uid and role = 'admin')
$$;

create or replace function private.require_member(p_household uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if not private.is_member(p_household, auth.uid()) then raise exception 'not_member'; end if;
end $$;

create or replace function private.require_admin(p_household uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if not private.is_admin(p_household, auth.uid()) then raise exception 'not_admin'; end if;
end $$;

create or replace function private.household_json(p_household uuid, p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', h.id, 'name', h.name, 'invite_code', h.invite_code, 'settings', h.settings,
    'created_by', h.created_by, 'created_at', h.created_at,
    'my_role', (select role from household_members where household_id = h.id and user_id = p_uid),
    'members', (select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb)
                from household_members m where m.household_id = h.id)
  ) from households h where h.id = p_household
$$;

-- ─── RPCs ─────────────────────────────────────────────────────────────────────

create or replace function public.create_household(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h_id uuid; code text; nm text := nullif(trim(coalesce(p_name,'')), ''); dn text;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if nm is null or char_length(nm) > 60 then raise exception 'name_invalid'; end if;
  loop
    code := private.gen_code();
    exit when not exists (select 1 from households where invite_code = code);
  end loop;
  insert into households (name, invite_code, created_by) values (nm, code, auth.uid()) returning id into h_id;
  select coalesce(display_name, 'Es') into dn from profiles where id = auth.uid();
  insert into household_members (household_id, user_id, role, display_name)
  values (h_id, auth.uid(), 'admin', coalesce(dn, 'Es'));
  return private.household_json(h_id, auth.uid());
end $$;

create or replace function public.join_household(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h_id uuid; dn text;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select id into h_id from households where invite_code = upper(trim(coalesce(p_code,'')));
  if h_id is null then raise exception 'code_invalid'; end if;
  if not private.is_member(h_id, auth.uid()) then
    select coalesce(display_name, 'Es') into dn from profiles where id = auth.uid();
    insert into household_members (household_id, user_id, role, display_name)
    values (h_id, auth.uid(), 'member', coalesce(dn, 'Es'));
  end if;
  return private.household_json(h_id, auth.uid());
end $$;

create or replace function public.get_my_households() returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(private.household_json(h.id, auth.uid()) order by h.created_at), '[]'::jsonb)
  from households h
  where exists (select 1 from household_members m where m.household_id = h.id and m.user_id = auth.uid())
$$;

create or replace function public.get_household(p_household uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  return private.household_json(p_household, auth.uid());
end $$;

create or replace function public.update_household(p_household uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_admin(p_household);
  update households set
    name = coalesce(nullif(trim(p_patch ->> 'name'), ''), name),
    settings = coalesce(p_patch -> 'settings', settings)
  where id = p_household;
  return private.household_json(p_household, auth.uid());
end $$;

create or replace function public.leave_household(p_household uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  delete from household_members where household_id = p_household and user_id = auth.uid();
  -- keep at least one admin
  if not exists (select 1 from household_members where household_id = p_household and role = 'admin')
     and exists (select 1 from household_members where household_id = p_household and user_id is not null) then
    update household_members set role = 'admin'
    where id = (select id from household_members where household_id = p_household and user_id is not null order by created_at limit 1);
  end if;
end $$;

create or replace function public.rotate_invite(p_household uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  perform private.require_admin(p_household);
  loop code := private.gen_code(); exit when not exists (select 1 from households where invite_code = code); end loop;
  update households set invite_code = code where id = p_household;
  return jsonb_build_object('invite_code', code);
end $$;

create or replace function public.add_member(p_household uuid, p_name text, p_role text default 'child', p_prefs jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m household_members; nm text := nullif(trim(coalesce(p_name,'')), '');
begin
  perform private.require_admin(p_household);
  if nm is null or char_length(nm) > 40 then raise exception 'name_invalid'; end if;
  if p_role not in ('member','child') then raise exception 'role_invalid'; end if;
  insert into household_members (household_id, user_id, role, display_name, prefs)
  values (p_household, null, p_role, nm, coalesce(p_prefs, private.default_prefs()))
  returning * into m;
  return to_jsonb(m);
end $$;

create or replace function public.update_member(p_member uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m household_members; is_self boolean; is_adm boolean;
begin
  select * into m from household_members where id = p_member;
  if not found then raise exception 'not_found'; end if;
  is_self := m.user_id is not null and m.user_id = auth.uid();
  is_adm := private.is_admin(m.household_id, auth.uid());
  if not (is_self or is_adm) then raise exception 'not_admin'; end if;
  update household_members set
    display_name = coalesce(nullif(trim(p_patch ->> 'display_name'), ''), display_name),
    portion = coalesce(case when p_patch ->> 'portion' in ('small','normal','large') then p_patch ->> 'portion' end, portion),
    eats_by_default = coalesce((p_patch ->> 'eats_by_default')::boolean, eats_by_default),
    prefs = coalesce(p_patch -> 'prefs', prefs),
    role = coalesce(case when is_adm and p_patch ->> 'role' in ('admin','member','child') then p_patch ->> 'role' end, role)
  where id = p_member
  returning * into m;
  return to_jsonb(m);
end $$;

create or replace function public.remove_member(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m household_members;
begin
  select * into m from household_members where id = p_member;
  if not found then return; end if;
  perform private.require_admin(m.household_id);
  delete from household_members where id = p_member;
end $$;
