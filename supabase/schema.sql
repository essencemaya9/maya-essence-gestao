-- Maya Essence – Gestão
-- Execute este script no SQL Editor do Supabase (projeto tgptccjncrpfopvmyowp)

-- ========== EXTENSÕES ==========
create extension if not exists "pgcrypto";

-- ========== TABELA: clientes ==========
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  email text,
  essencia_favorita text,
  observacoes text,
  data_ultima_compra date,
  data_ultimo_contato date,
  created_at timestamptz not null default now()
);

-- ========== TABELA: categorias ==========
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categorias_nome_tipo_key'
  ) then
    alter table public.categorias add constraint categorias_nome_tipo_key unique (nome, tipo);
  end if;
end $$;

-- ========== TABELA: transacoes ==========
create table if not exists public.transacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada', 'saida')),
  valor numeric(12, 2) not null check (valor > 0),
  descricao text,
  categoria_id uuid references public.categorias(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  data date not null default current_date,
  created_at timestamptz not null default now()
);

-- ========== TABELA: contatos_recompra ==========
create table if not exists public.contatos_recompra (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  data_contato date not null default current_date,
  created_at timestamptz not null default now()
);

-- ========== ÍNDICES ==========
create index if not exists idx_transacoes_data on public.transacoes(data);
create index if not exists idx_transacoes_categoria on public.transacoes(categoria_id);
create index if not exists idx_transacoes_cliente on public.transacoes(cliente_id);
create index if not exists idx_clientes_ultima_compra on public.clientes(data_ultima_compra);
create index if not exists idx_contatos_cliente on public.contatos_recompra(cliente_id);

-- ========== REALTIME ==========
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clientes'
  ) then
    alter publication supabase_realtime add table public.clientes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contatos_recompra'
  ) then
    alter publication supabase_realtime add table public.contatos_recompra;
  end if;
end $$;

-- ========== RLS ==========
-- App usa a chave anônima (publishable) sem autenticação de usuário.
-- As políticas abaixo liberam acesso total via anon key. Se adicionar login
-- de usuários no futuro, restrinja estas políticas por auth.uid().
alter table public.clientes enable row level security;
alter table public.categorias enable row level security;
alter table public.transacoes enable row level security;
alter table public.contatos_recompra enable row level security;

drop policy if exists "clientes_all" on public.clientes;
create policy "clientes_all" on public.clientes for all using (true) with check (true);

drop policy if exists "categorias_all" on public.categorias;
create policy "categorias_all" on public.categorias for all using (true) with check (true);

drop policy if exists "transacoes_all" on public.transacoes;
create policy "transacoes_all" on public.transacoes for all using (true) with check (true);

drop policy if exists "contatos_recompra_all" on public.contatos_recompra;
create policy "contatos_recompra_all" on public.contatos_recompra for all using (true) with check (true);

-- ========== CATEGORIAS PADRÃO ==========
insert into public.categorias (nome, tipo) values
  ('Venda de essências', 'entrada'),
  ('Venda de difusores', 'entrada'),
  ('Outras vendas', 'entrada'),
  ('Compra de matéria-prima', 'saida'),
  ('Embalagens', 'saida'),
  ('Marketing e anúncios', 'saida'),
  ('Frete e entregas', 'saida'),
  ('Outras despesas', 'saida')
on conflict (nome, tipo) do nothing;
