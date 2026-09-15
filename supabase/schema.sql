-- IRONMAN COMMAND CENTER — schema do Supabase
-- Rode este arquivo inteiro em: Supabase Dashboard > SQL Editor > New query > Run

create table if not exists sessions (
  instance_id  text primary key,
  template_id  text,
  date         date not null,
  day          int not null,
  time         text not null,
  discipline   text not null,
  duration_min int,
  distance_km  numeric,
  zone         text,
  description  text,
  status       text not null default 'planned',
  actual       jsonb,
  missed_reason text,
  missed_note  text,
  updated_at   timestamptz default now()
);

create table if not exists recovery_logs (
  date          date primary key,
  sleep_hours   numeric,
  sleep_quality int,
  energy        int,
  fatigue       int,
  mood          int,
  soreness      int,
  notes         text,
  is_demo       boolean default false,
  updated_at    timestamptz default now()
);

create table if not exists photos (
  id         text primary key,
  url        text not null,
  category   text,
  created_at date default current_date
);

alter table sessions       enable row level security;
alter table recovery_logs  enable row level security;
alter table photos         enable row level security;

-- Qualquer usuário autenticado (ou seja, só vocês dois, depois de logados)
-- pode ler e escrever — não é uma app multiusuário, é um plano compartilhado.
create policy "authenticated full access sessions" on sessions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access recovery" on recovery_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access photos" on photos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Depois de rodar este SQL, crie o bucket de Storage manualmente:
-- Dashboard > Storage > New bucket > nome exatamente "photos" > Public bucket: ON
-- Isso permite que as fotos enviadas fiquem acessíveis por URL pública (só
-- quem tem o link vê a foto; ninguém consegue listar ou enviar sem estar logado).
