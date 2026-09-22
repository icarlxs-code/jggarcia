-- Permanent backups of the company snapshot. Never drop.

create table if not exists jg_store_revisions (
  id bigserial primary key,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists jg_store_revisions_created_idx on jg_store_revisions (created_at desc);
