-- Maya Essence – Gestão
-- Aba Estoque: produtos e movimentações
-- Execute no SQL Editor do Supabase (projeto tgptccjncrpfopvmyowp)

create extension if not exists "pgcrypto";

-- ========== TABELA: produtos ==========
create table if not exists produtos (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  descricao text,
  quantidade_atual numeric(10,2) not null default 0,
  quantidade_minima numeric(10,2) not null default 5,
  unidade text default 'unidade',
  preco_custo numeric(10,2) default 0,
  preco_venda numeric(10,2) default 0,
  categoria text,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== TABELA: movimentacoes_estoque ==========
create table if not exists movimentacoes_estoque (
  id uuid default gen_random_uuid() primary key,
  produto_id uuid references produtos(id) not null,
  tipo text check (tipo in ('entrada', 'saida', 'ajuste')) not null,
  quantidade numeric(10,2) not null,
  motivo text,
  transacao_id uuid references transacoes(id),
  data date not null default current_date,
  created_at timestamptz default now()
);

-- ========== ÍNDICES ==========
create index if not exists idx_movimentacoes_produto on movimentacoes_estoque(produto_id);
create index if not exists idx_movimentacoes_data on movimentacoes_estoque(data);
create index if not exists idx_movimentacoes_transacao on movimentacoes_estoque(transacao_id);
create index if not exists idx_produtos_categoria on produtos(categoria);

-- ========== updated_at automático ==========
create or replace function set_produtos_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_produtos_updated_at on produtos;
create trigger trg_produtos_updated_at
  before update on produtos
  for each row execute function set_produtos_updated_at();

-- ========== REALTIME ==========
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'produtos'
  ) then
    alter publication supabase_realtime add table produtos;
  end if;
end $$;

-- ========== RLS ==========
-- Segue o mesmo padrão do restante do app: acesso liberado via anon key,
-- sem autenticação de usuário. Restrinja por auth.uid() se adicionar login.
alter table produtos enable row level security;
alter table movimentacoes_estoque enable row level security;

drop policy if exists "produtos_all" on produtos;
create policy "produtos_all" on produtos for all using (true) with check (true);

drop policy if exists "movimentacoes_estoque_all" on movimentacoes_estoque;
create policy "movimentacoes_estoque_all" on movimentacoes_estoque for all using (true) with check (true);
