-- The access rules that are live in the Supabase project (applied as the
-- migration "per_user_ownership_and_rls"). Kept here so the rules are readable
-- in the repo. Do not run it again: the rules already exist.

-- Every expense belongs to the logged-in user who created it.
-- Older rows keep user_id = null: they are kept but no website user can see them.
alter table public.expenses
  add column user_id uuid references auth.users(id) default auth.uid();
create index expenses_user_id_idx on public.expenses (user_id);

-- Expenses: logged-in users can only see and change their own rows.
create policy "Users read own expenses" on public.expenses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add own expenses" on public.expenses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own expenses" on public.expenses
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own expenses" on public.expenses
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Receipts (private bucket): each user has a folder named after their user id.
create policy "Users read own receipts" on storage.objects
  for select to authenticated using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own receipts" on storage.objects
  for insert to authenticated with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update own receipts" on storage.objects
  for update to authenticated using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own receipts" on storage.objects
  for delete to authenticated using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
