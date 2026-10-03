-- 11 Execute grants. The app always has an (anonymous or Apple) session → role
-- 'authenticated'. RPCs enforce membership themselves; direct table writes stay
-- blocked by RLS.
grant usage on schema public to anon, authenticated;
grant execute on all functions in schema public to authenticated;

-- The sign-up trigger function must not be callable directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
