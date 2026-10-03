-- 06 shared shopping list.

create table public.shopping_items (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  name           text not null,
  category       text not null default 'other',
  qty_text       text,
  status         text not null default 'todo',
  claimed_by     uuid references auth.users (id) on delete set null,
  added_by       uuid references auth.users (id) on delete set null,
  from_recipe_id uuid references public.recipes (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint shop_status_chk check (status in ('todo','claimed','bought','unavailable')),
  constraint shop_category_chk check (category in ('produce','meat','fish','dairy','bakery','pantry_dry','frozen','drinks','condiments','snacks','leftovers','other'))
);
create index shopping_household_idx on public.shopping_items (household_id);

create or replace function private.shopping_json(p_household uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
      to_jsonb(s) || jsonb_build_object('claimed_by_name', coalesce(m.display_name, pr.display_name))
      order by (s.status = 'bought'), s.category, s.created_at
    ), '[]'::jsonb)
  from shopping_items s
  left join household_members m on m.household_id = s.household_id and m.user_id = s.claimed_by
  left join profiles pr on pr.id = s.claimed_by
  where s.household_id = p_household
$$;

create or replace function public.get_shopping_list(p_household uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  return private.shopping_json(p_household);
end $$;

create or replace function public.add_shopping_items(p_household uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  insert into shopping_items (household_id, name, category, qty_text, from_recipe_id, added_by)
  select p_household, left(trim(x.name), 80),
    case when x.category in ('produce','meat','fish','dairy','bakery','pantry_dry','frozen','drinks','condiments','snacks','leftovers','other') then x.category else 'other' end,
    nullif(trim(coalesce(x.qty_text,'')), ''), x.from_recipe_id, auth.uid()
  from jsonb_to_recordset(p_items) as x(name text, category text, qty_text text, from_recipe_id uuid)
  where coalesce(nullif(trim(x.name), ''), '') <> '';
  return private.shopping_json(p_household);
end $$;

create or replace function public.update_shopping_item(p_item uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it shopping_items;
begin
  select * into it from shopping_items where id = p_item;
  if not found then raise exception 'not_found'; end if;
  perform private.require_member(it.household_id);
  if p_patch ? 'claim' then
    if (p_patch ->> 'claim')::boolean then
      update shopping_items set status = 'claimed', claimed_by = auth.uid() where id = p_item;
    else
      update shopping_items set status = 'todo', claimed_by = null where id = p_item;
    end if;
  end if;
  update shopping_items set
    status = coalesce(case when p_patch ->> 'status' in ('todo','claimed','bought','unavailable') then p_patch ->> 'status' end, status),
    qty_text = case when p_patch ? 'qty_text' then nullif(trim(p_patch ->> 'qty_text'), '') else qty_text end,
    name = coalesce(nullif(trim(p_patch ->> 'name'), ''), name)
  where id = p_item returning * into it;
  return (to_jsonb(it) || jsonb_build_object('claimed_by_name',
    (select coalesce(m.display_name, pr.display_name) from profiles pr
       left join household_members m on m.household_id = it.household_id and m.user_id = it.claimed_by
       where pr.id = it.claimed_by)));
end $$;

create or replace function public.remove_shopping_item(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select household_id into hid from shopping_items where id = p_item;
  if hid is null then return; end if;
  perform private.require_member(hid);
  delete from shopping_items where id = p_item;
end $$;

create or replace function public.add_missing_from_recipe(p_household uuid, p_recipe uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  insert into shopping_items (household_id, name, category, qty_text, from_recipe_id, added_by)
  select p_household, left(trim(x.name), 80),
    case when x.category in ('produce','meat','fish','dairy','bakery','pantry_dry','frozen','drinks','condiments','snacks','leftovers','other') then x.category else 'other' end,
    nullif(trim(coalesce(x.qty,'')), ''), p_recipe, auth.uid()
  from recipes r, jsonb_to_recordset(r.missing) as x(name text, qty text, category text)
  where r.id = p_recipe and coalesce(nullif(trim(x.name), ''), '') <> ''
    and not exists (
      select 1 from shopping_items si
      where si.household_id = p_household and si.status <> 'bought' and lower(si.name) = lower(trim(x.name)));
  return private.shopping_json(p_household);
end $$;

create or replace function public.clear_bought(p_household uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  delete from shopping_items where household_id = p_household and status = 'bought';
end $$;

create or replace function public.stock_bought(p_household uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  insert into inventory_items (household_id, name, category, location, amount, source, added_by)
  select household_id, name, category, 'fridge', 'some', 'shopping', auth.uid()
  from shopping_items where household_id = p_household and status = 'bought';
  delete from shopping_items where household_id = p_household and status = 'bought';
  return private.inventory_json(p_household);
end $$;
