-- Supabase 数据库初始表结构与 RLS 策略（在 Supabase SQL Editor 执行）

-- 必需扩展：提供 gen_random_uuid()
create extension if not exists pgcrypto;

-- profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- api_keys（如果选择落库且加密）
create table if not exists public.api_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  aliyun_dashscope_key_enc text,
  amap_web_key_enc text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- trips（行程）
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  destination text,
  start_date date,
  end_date date,
  party_size int,
  budget_total numeric,
  preferences jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- itineraries（按天）
create table if not exists public.itineraries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_index int not null,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- itinerary_items（行程项）
create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  type text,
  name text,
  description text,
  lat numeric,
  lng numeric,
  start_time time,
  end_time time,
  estimated_cost numeric,
  transport_mode text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- budgets
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  amount_total numeric,
  currency text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 确保每个行程仅有一条预算记录（如未创建过则创建唯一索引）
create unique index if not exists budgets_trip_id_key on public.budgets(trip_id);

-- expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  item_id uuid references public.itinerary_items(id) on delete set null,
  category text,
  amount numeric,
  occurred_at timestamptz default now(),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS 策略（按用户隔离）
alter table public.trips enable row level security;
drop policy if exists trips_owner on public.trips;
create policy trips_owner on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.itineraries enable row level security;
drop policy if exists itineraries_owner on public.itineraries;
create policy itineraries_owner on public.itineraries
  for all using (
    exists (select 1 from public.trips t where t.id = itineraries.trip_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips t where t.id = itineraries.trip_id and t.user_id = auth.uid())
  );

alter table public.itinerary_items enable row level security;
drop policy if exists itinerary_items_owner on public.itinerary_items;
create policy itinerary_items_owner on public.itinerary_items
  for all using (
    exists (
      select 1 from public.itineraries i
      join public.trips t on t.id = i.trip_id
      where i.id = itinerary_items.itinerary_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.itineraries i
      join public.trips t on t.id = i.trip_id
      where i.id = itinerary_items.itinerary_id and t.user_id = auth.uid()
    )
  );

alter table public.budgets enable row level security;
drop policy if exists budgets_owner on public.budgets;
create policy budgets_owner on public.budgets
  for all using (
    exists (select 1 from public.trips t where t.id = budgets.trip_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips t where t.id = budgets.trip_id and t.user_id = auth.uid())
  );

alter table public.expenses enable row level security;
drop policy if exists expenses_owner on public.expenses;
create policy expenses_owner on public.expenses
  for all using (
    exists (select 1 from public.trips t where t.id = expenses.trip_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips t where t.id = expenses.trip_id and t.user_id = auth.uid())
  );
