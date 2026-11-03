-- Lets the Budget Tracker website read and add expenses, and view and upload receipts.
-- Run this once in Supabase → SQL Editor.
-- Anyone who has the website can do these things, so keep real private data out of it.

create policy "Website can read expenses"
  on public.expenses for select to anon using (true);

create policy "Website can add expenses"
  on public.expenses for insert to anon with check (true);

create policy "Website can view receipts"
  on storage.objects for select to anon using (bucket_id = 'receipts');

create policy "Website can upload receipts"
  on storage.objects for insert to anon with check (bucket_id = 'receipts');
