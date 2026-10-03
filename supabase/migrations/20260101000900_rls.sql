-- 09 Row Level Security. All writes go through security-definer RPCs (owned by a
-- BYPASSRLS role), so we only need member-scoped SELECT policies — these govern
-- both direct reads and Realtime. No write policies ⇒ direct client writes denied.

alter table public.profiles            enable row level security;
alter table public.push_tokens         enable row level security;
alter table public.households          enable row level security;
alter table public.household_members   enable row level security;
alter table public.inventory_items     enable row level security;
alter table public.recipes             enable row level security;
alter table public.recipe_saves        enable row level security;
alter table public.meal_history        enable row level security;
alter table public.vote_sessions       enable row level security;
alter table public.vote_choices        enable row level security;
alter table public.shopping_items      enable row level security;
alter table public.attendance          enable row level security;
alter table public.shoppers            enable row level security;
alter table public.meal_requests       enable row level security;
alter table public.plan_entries        enable row level security;

create policy p_profiles_self on public.profiles for select using (id = auth.uid());
create policy p_push_self on public.push_tokens for select using (user_id = auth.uid());

create policy p_households_member on public.households
  for select using (private.is_member(id, auth.uid()));
create policy p_members_member on public.household_members
  for select using (private.is_member(household_id, auth.uid()));
create policy p_inventory_member on public.inventory_items
  for select using (private.is_member(household_id, auth.uid()));
create policy p_recipes_member on public.recipes
  for select using (household_id is null or private.is_member(household_id, auth.uid()));
create policy p_saves_self on public.recipe_saves
  for select using (user_id = auth.uid());
create policy p_history_member on public.meal_history
  for select using (private.is_member(household_id, auth.uid()));
create policy p_votes_member on public.vote_sessions
  for select using (private.is_member(household_id, auth.uid()));
create policy p_choices_member on public.vote_choices
  for select using (exists (select 1 from public.vote_sessions s where s.id = session_id and private.is_member(s.household_id, auth.uid())));
create policy p_shopping_member on public.shopping_items
  for select using (private.is_member(household_id, auth.uid()));
create policy p_attendance_member on public.attendance
  for select using (private.is_member(household_id, auth.uid()));
create policy p_shoppers_member on public.shoppers
  for select using (private.is_member(household_id, auth.uid()));
create policy p_requests_member on public.meal_requests
  for select using (private.is_member(household_id, auth.uid()));
create policy p_plan_member on public.plan_entries
  for select using (private.is_member(household_id, auth.uid()));
