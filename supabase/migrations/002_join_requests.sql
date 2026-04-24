-- supabase/migrations/002_join_requests.sql
create table if not exists public.join_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  requested_role text check (requested_role in ('customer','driver')) not null,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  admin_id uuid references public.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table if exists public.join_requests enable row level security;
create policy "Users can read own requests" on public.join_requests for select using (user_id in (select id from public.users where telegram_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint));
