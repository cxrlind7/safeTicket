-- Create table for Perfiles (Profiles) linked to Auth
create table perfiles (
  id uuid references auth.users not null primary key, -- Linked to auth.users
  nombre text,
  es_admin boolean default false
);

-- Create table for Ventas
create table ventas (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  dia integer,
  zona text,
  precio numeric,
  tel text
);

-- Create table for Cambios
create table cambios (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  busca text,
  dia_busca integer,
  ofrece text,
  dia_ofrece integer,
  tel text
);

-- Create table for Horarios
create table horarios (
  id uuid default gen_random_uuid() primary key,
  hora text,
  disponible boolean default false,
  usuario_id uuid references perfiles(id) -- Linked to public.perfiles
);

-- Create table for Info Dinámica
create table info_dinamica (
  id uuid default gen_random_uuid() primary key,
  titulo text,
  admin_nombre text,
  mensaje text,
  reglas text[] -- Array of strings
);

-- Enable RLS
alter table perfiles enable row level security;
alter table ventas enable row level security;
alter table cambios enable row level security;
alter table horarios enable row level security;
alter table info_dinamica enable row level security;

-- Policies (Simplified for ease of use)
-- READ: Public
create policy "Public read perfiles" on perfiles for select using (true);
create policy "Public read ventas" on ventas for select using (true);
create policy "Public read cambios" on cambios for select using (true);
create policy "Public read horarios" on horarios for select using (true);
create policy "Public read info_dinamica" on info_dinamica for select using (true);

-- WRITE: Authenticated (Admins)
create policy "Auth insert ventas" on ventas for insert with check (auth.role() = 'authenticated');
create policy "Auth update ventas" on ventas for update using (auth.role() = 'authenticated');
create policy "Auth delete ventas" on ventas for delete using (auth.role() = 'authenticated');

create policy "Auth insert cambios" on cambios for insert with check (auth.role() = 'authenticated');
create policy "Auth update cambios" on cambios for update using (auth.role() = 'authenticated');
create policy "Auth delete cambios" on cambios for delete using (auth.role() = 'authenticated');

-- Horarios: Users can only update their own? Or admins update any? Let's say admins update any for now, or just theirs.
-- Let's allow authenticated to update their own.
create policy "Users update own schedule" on horarios for update using (auth.uid() = usuario_id);
create policy "Users insert own schedule" on horarios for insert with check (auth.uid() = usuario_id);
-- Also allow insert if no user assigned yet? Or assume created by user.

-- Trigger to create profile on signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.perfiles (id, nombre, es_admin)
  values (new.id, new.raw_user_meta_data->>'full_name', false);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
