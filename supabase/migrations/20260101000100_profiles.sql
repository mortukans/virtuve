-- 01 profiles (on auth.users), sign-up trigger, push tokens, account lifecycle.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  lang         text not null default 'lv',
  created_at   timestamptz not null default now()
);

-- Every device is an anonymous Supabase user; the trigger seeds a profile row.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.get_my_profile() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  select * into p from profiles where id = auth.uid();
  if not found then
    insert into profiles (id) values (auth.uid()) returning * into p;
  end if;
  return p;
end $$;

create or replace function public.set_display_name(p_name text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare p public.profiles; v text := nullif(trim(coalesce(p_name, '')), '');
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if v is null or char_length(v) > 40 then raise exception 'name_invalid'; end if;
  update profiles set display_name = v where id = auth.uid() returning * into p;
  return p;
end $$;

-- push tokens (one row per device)
create table public.push_tokens (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text primary key,
  platform   text not null default 'ios',
  updated_at timestamptz not null default now(),
  constraint push_tokens_platform_chk check (platform in ('ios','android'))
);
create index push_tokens_user_idx on public.push_tokens (user_id);

create or replace function public.register_push_token(p_token text, p_platform text default 'ios')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'bad_token'; end if;
  if p_platform not in ('ios','android') then raise exception 'bad_platform'; end if;
  insert into push_tokens (user_id, token, platform, updated_at)
  values (auth.uid(), p_token, p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

-- Upgrade anonymous -> Apple: move the previous anonymous user's profile data and
-- household memberships to the current (Apple) user, then delete the old user.
-- Only allowed when the previous user is anonymous and has no identities.
create or replace function public.claim_merge(p_prev_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare prev_anon boolean;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  if p_prev_user is null or p_prev_user = auth.uid() then return; end if;
  select coalesce((raw_app_meta_data ->> 'provider') = 'anonymous', is_anonymous, false)
    into prev_anon from auth.users where id = p_prev_user;
  if not coalesce(prev_anon, false) then raise exception 'prev_not_anonymous'; end if;

  -- carry the display name over if the Apple user has none
  update profiles cur set display_name = coalesce(cur.display_name, prev.display_name)
    from profiles prev where cur.id = auth.uid() and prev.id = p_prev_user;

  -- move memberships (skip households where the Apple user is already a member)
  update household_members m set user_id = auth.uid()
   where m.user_id = p_prev_user
     and not exists (select 1 from household_members x where x.household_id = m.household_id and x.user_id = auth.uid());
  delete from household_members m
   where m.user_id = p_prev_user
     and exists (select 1 from household_members x where x.household_id = m.household_id and x.user_id = auth.uid());

  -- reassign authored rows that track a user
  update inventory_items set added_by = auth.uid() where added_by = p_prev_user;
  update shopping_items set added_by = auth.uid() where added_by = p_prev_user;

  delete from auth.users where id = p_prev_user;
end $$;

-- Delete the caller's account and all data owned solely by them.
create or replace function public.delete_me() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  -- households where the caller is the only member are removed entirely (cascade);
  -- otherwise just drop their membership.
  delete from households h
   where exists (select 1 from household_members m where m.household_id = h.id and m.user_id = auth.uid())
     and (select count(*) from household_members m where m.household_id = h.id and m.user_id is not null) = 1;
  delete from household_members where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;
