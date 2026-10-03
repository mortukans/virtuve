-- 08 weekly meal plan.

create table public.plan_entries (
  household_id uuid not null references public.households (id) on delete cascade,
  plan_date    date not null,
  recipe_id    uuid references public.recipes (id) on delete set null,
  status       text not null default 'planned',
  who_eats     uuid[] not null default '{}',
  note         text,
  primary key (household_id, plan_date),
  constraint plan_status_chk check (status in ('planned','none','eating_out','not_cooking'))
);

create or replace function private.plan_json(p_household uuid, p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'household_id', e.household_id, 'plan_date', e.plan_date, 'recipe_id', e.recipe_id,
      'recipe_title', r.title, 'status', e.status, 'who_eats', to_jsonb(e.who_eats), 'note', e.note
    ) order by e.plan_date), '[]'::jsonb)
  from plan_entries e left join recipes r on r.id = e.recipe_id
  where e.household_id = p_household and e.plan_date between p_from and p_to
$$;

create or replace function public.get_meal_plan(p_household uuid, p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  return private.plan_json(p_household, p_from, p_to);
end $$;

create or replace function public.set_plan_entry(p_household uuid, p_date date, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare who uuid[];
begin
  perform private.require_member(p_household);
  if p_patch ? 'who_eats' then
    select coalesce(array_agg((e)::uuid), '{}') into who from jsonb_array_elements_text(p_patch -> 'who_eats') e;
  end if;
  insert into plan_entries (household_id, plan_date, recipe_id, status, who_eats, note)
  values (
    p_household, p_date,
    nullif(p_patch ->> 'recipe_id', '')::uuid,
    coalesce(case when p_patch ->> 'status' in ('planned','none','eating_out','not_cooking') then p_patch ->> 'status' end, 'planned'),
    coalesce(who, '{}'), nullif(trim(p_patch ->> 'note'), ''))
  on conflict (household_id, plan_date) do update set
    recipe_id = case when p_patch ? 'recipe_id' then nullif(p_patch ->> 'recipe_id', '')::uuid else plan_entries.recipe_id end,
    status = coalesce(case when p_patch ->> 'status' in ('planned','none','eating_out','not_cooking') then p_patch ->> 'status' end, plan_entries.status),
    who_eats = case when p_patch ? 'who_eats' then coalesce(who, '{}') else plan_entries.who_eats end,
    note = case when p_patch ? 'note' then nullif(trim(p_patch ->> 'note'), '') else plan_entries.note end;
  return (private.plan_json(p_household, p_date, p_date) -> 0);
end $$;
