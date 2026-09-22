create table if not exists jg_auth_deleted (
  key text primary key,
  deleted_at timestamptz not null default now()
);
