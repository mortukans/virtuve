-- 03 kitchen inventory (the shared virtual fridge/freezer/pantry/staples).

create table public.inventory_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  category     text not null default 'other',
  location     text not null default 'fridge',
  amount       text not null default 'some',
  qty_text     text,
  freshness    text not null default 'fresh',
  expires_on   date,
  state        text not null default 'sealed',
  source       text not null default 'manual',
  portions     int,
  added_by     uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint inv_category_chk check (category in ('produce','meat','fish','dairy','bakery','pantry_dry','frozen','drinks','condiments','snacks','leftovers','other')),
  constraint inv_location_chk check (location in ('fridge','freezer','pantry','staple')),
  constraint inv_amount_chk check (amount in ('little','some','lot','unknown')),
  constraint inv_freshness_chk check (freshness in ('fresh','use_soon','use_today','expired','unknown')),
  constraint inv_state_chk check (state in ('sealed','opened','cooked','frozen')),
  constraint inv_source_chk check (source in ('photo','manual','barcode','receipt','shopping'))
);
create index inventory_household_idx on public.inventory_items (household_id);

-- effective freshness: derived from expires_on when it's set, else the stored label
create or replace function private.eff_freshness(p_expires date, p_stored text) returns text
language sql immutable as $$
  select case
    when p_expires is null then p_stored
    when p_expires < current_date then 'expired'
    when p_expires <= current_date + 1 then 'use_today'
    when p_expires <= current_date + 3 then 'use_soon'
    else 'fresh' end
$$;

-- urgency rank for ordering (0 = most urgent)
create or replace function private.freshness_rank(f text) returns int
language sql immutable as $$
  select case f when 'expired' then 0 when 'use_today' then 1 when 'use_soon' then 2 when 'fresh' then 3 else 4 end
$$;

create or replace function private.inventory_json(p_household uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
      to_jsonb(i) || jsonb_build_object('freshness', private.eff_freshness(i.expires_on, i.freshness))
      order by private.freshness_rank(private.eff_freshness(i.expires_on, i.freshness)), i.location, i.name
    ), '[]'::jsonb)
  from inventory_items i where i.household_id = p_household
$$;

create or replace function public.get_inventory(p_household uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  return private.inventory_json(p_household);
end $$;

create or replace function public.add_inventory_items(p_household uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  insert into inventory_items (household_id, name, category, location, amount, qty_text, freshness, expires_on, state, source, portions, added_by)
  select p_household,
    left(trim(x.name), 80),
    case when x.category in ('produce','meat','fish','dairy','bakery','pantry_dry','frozen','drinks','condiments','snacks','leftovers','other') then x.category else 'other' end,
    case when x.location in ('fridge','freezer','pantry','staple') then x.location else 'fridge' end,
    case when x.amount in ('little','some','lot','unknown') then x.amount else 'some' end,
    nullif(trim(coalesce(x.qty_text,'')), ''),
    case when x.freshness in ('fresh','use_soon','use_today','expired','unknown') then x.freshness else 'fresh' end,
    x.expires_on,
    case when x.state in ('sealed','opened','cooked','frozen') then x.state else 'sealed' end,
    case when x.source in ('photo','manual','barcode','receipt','shopping') then x.source else 'manual' end,
    x.portions,
    auth.uid()
  from jsonb_to_recordset(p_items) as x(
    name text, category text, location text, amount text, qty_text text,
    freshness text, expires_on date, state text, source text, portions int)
  where coalesce(nullif(trim(x.name), ''), '') <> '';
  return private.inventory_json(p_household);
end $$;

create or replace function public.update_inventory_item(p_item uuid, p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it inventory_items;
begin
  select * into it from inventory_items where id = p_item;
  if not found then raise exception 'not_found'; end if;
  perform private.require_member(it.household_id);
  update inventory_items set
    name = coalesce(nullif(trim(p_patch ->> 'name'), ''), name),
    category = coalesce(case when p_patch ->> 'category' in ('produce','meat','fish','dairy','bakery','pantry_dry','frozen','drinks','condiments','snacks','leftovers','other') then p_patch ->> 'category' end, category),
    location = coalesce(case when p_patch ->> 'location' in ('fridge','freezer','pantry','staple') then p_patch ->> 'location' end, location),
    amount = coalesce(case when p_patch ->> 'amount' in ('little','some','lot','unknown') then p_patch ->> 'amount' end, amount),
    qty_text = case when p_patch ? 'qty_text' then nullif(trim(p_patch ->> 'qty_text'), '') else qty_text end,
    freshness = coalesce(case when p_patch ->> 'freshness' in ('fresh','use_soon','use_today','expired','unknown') then p_patch ->> 'freshness' end, freshness),
    expires_on = case when p_patch ? 'expires_on' then (p_patch ->> 'expires_on')::date else expires_on end,
    state = coalesce(case when p_patch ->> 'state' in ('sealed','opened','cooked','frozen') then p_patch ->> 'state' end, state),
    portions = case when p_patch ? 'portions' then (p_patch ->> 'portions')::int else portions end,
    updated_at = now()
  where id = p_item
  returning * into it;
  return to_jsonb(it) || jsonb_build_object('freshness', private.eff_freshness(it.expires_on, it.freshness));
end $$;

create or replace function public.remove_inventory_item(p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  select household_id into hid from inventory_items where id = p_item;
  if hid is null then return; end if;
  perform private.require_member(hid);
  delete from inventory_items where id = p_item;
end $$;

create or replace function public.mark_used(p_item uuid, p_amount text default 'all') returns jsonb
language plpgsql security definer set search_path = public as $$
declare it inventory_items;
begin
  select * into it from inventory_items where id = p_item;
  if not found then raise exception 'not_found'; end if;
  perform private.require_member(it.household_id);
  if p_amount = 'all' then
    delete from inventory_items where id = p_item;
    return null;
  end if;
  update inventory_items set amount = case amount when 'lot' then 'some' when 'some' then 'little' else 'little' end, updated_at = now()
  where id = p_item returning * into it;
  return to_jsonb(it) || jsonb_build_object('freshness', private.eff_freshness(it.expires_on, it.freshness));
end $$;

create or replace function public.set_staples(p_household uuid, p_names text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform private.require_member(p_household);
  delete from inventory_items where household_id = p_household and location = 'staple';
  insert into inventory_items (household_id, name, category, location, amount, source, added_by)
  select p_household, left(trim(n), 80), 'other', 'staple', 'lot', 'manual', auth.uid()
  from unnest(coalesce(p_names, '{}')) as n
  where coalesce(nullif(trim(n), ''), '') <> '';
  return private.inventory_json(p_household);
end $$;
