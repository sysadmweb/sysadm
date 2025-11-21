-- Tabela de junção entre usuários e unidades
create table if not exists user_units (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  unit_id bigint not null references units(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint user_units_user_unit_unique unique (user_id, unit_id)
);

-- Trigger opcional para updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_units_updated_at on user_units;
create trigger trg_user_units_updated_at
before update on user_units
for each row execute function set_updated_at();

-- Remover o vínculo direto da tabela users
-- 1) Tornar a coluna unit_id opcional (se ainda não for):
alter table users alter column unit_id drop not null;

-- 2) Migrar os vínculos existentes (opcional, se quiser preservar relacionamentos atuais):
insert into user_units (user_id, unit_id)
select id as user_id, unit_id
from users
where unit_id is not null
on conflict (user_id, unit_id) do nothing;

-- 3) Remover a coluna unit_id de users (após migrar e validar):
alter table users drop column unit_id;