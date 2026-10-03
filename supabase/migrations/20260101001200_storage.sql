-- 12 storage buckets: AI recipe previews and user "how it turned out" photos.
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true), ('user-photos', 'user-photos', true)
on conflict (id) do nothing;
