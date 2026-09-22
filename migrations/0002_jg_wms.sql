-- JG Garcia WMS — persistent company data. Never drop these tables.

create table if not exists jg_auth_users (
  id text primary key,
  nome text not null,
  email text not null,
  senha text not null default '',
  nivel_acesso text not null default 'operador',
  status boolean not null default true,
  created_at text not null
);
create unique index if not exists jg_auth_users_email_idx on jg_auth_users (lower(email));

create table if not exists jg_auth_devices (
  id text primary key,
  user_id text not null,
  secret text not null,
  label text not null default 'Celular',
  created_at text not null,
  last_ip text not null default '',
  ips jsonb not null default '[]'::jsonb,
  last_seen text not null default '',
  user_agent text not null default '',
  print text not null default ''
);

create table if not exists jg_auth_stations (
  id text primary key,
  user_id text not null,
  secret text not null,
  ip text not null default '',
  last_seen text not null default ''
);

create table if not exists jg_auth_tickets (
  id text primary key,
  secret text not null,
  expires_at bigint not null,
  status text not null default 'pending',
  user_id text,
  fails int not null default 0
);

create table if not exists jg_auth_pairings (
  token text primary key,
  user_id text not null,
  expires_at bigint not null
);

create table if not exists jg_store (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
