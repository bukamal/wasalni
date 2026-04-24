-- Enable RLS
alter table if exists public.users enable row level security;
alter table if exists public.drivers enable row level security;
alter table if exists public.rides enable row level security;

-- Users table
create table if not exists public.users (
  id uuid default gen_random_uuid() primary key,
  telegram_id bigint unique not null,
  chat_id bigint unique not null,
  full_name text,
  phone text,
  role text check (role in ('customer','driver','admin')) default 'customer',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Drivers profile
create table if not exists public.drivers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  car_model text,
  car_plate text,
  status text check (status in ('online','offline','busy')) default 'offline',
  current_lat double precision,
  current_lng double precision,
  rating numeric(2,1) default 5.0,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Rides
create table if not exists public.rides (
  id uuid default gen_random_uuid primary key,
  customer_id uuid references public.users(id),
  driver_id uuid references public.drivers(id),
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  pickup_address text,
  dropoff_address text,
  status text check (status in ('pending','accepted','picked_up','completed','cancelled')) default 'pending',
  price numeric(10,2),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now)
);

-- Admin whitelist
create table if not exists public.admin_whitelist (
  chat_id bigint primary key
);

-- RLS Policies
create policy "Users can read own data" on public.users for select using (telegram_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint);
create policy "Drivers can update own status" on public.drivers for update using (user_id in (select id from public.users where telegram_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint));
create policy "Rides visible to participants" on public.rides for select using (
  customer_id in (select id from public.users where telegram_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint)
  or driver_id in (select id from public.drivers where user_id in (select id from public.users where telegram_id = (current_setting('request.jwt.claims', true)::json->>'sub')::bigint))
);

-- Function to check admin
create or replace function public.is_admin(p_chat_id bigint)
returns boolean as $$
begin
  return exists (select 1 from public.admin_whitelist where chat_id = p_chat_id);
end;
$$ language plpgsql security definer;
