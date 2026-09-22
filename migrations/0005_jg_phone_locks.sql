create table if not exists jg_auth_phone_locks (
  user_id text primary key,
  device_id text not null,
  ip text,
  last_seen bigint not null
);
