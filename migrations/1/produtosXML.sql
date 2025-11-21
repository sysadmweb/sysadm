-- Products Table
create table if not exists products (
  id bigint primary key generated always as identity,
  code text not null unique,
  name text not null,
  quantity numeric not null default 0,
  unit_value numeric not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Invoices Table
create table if not exists invoices (
  id bigint primary key generated always as identity,
  number text not null,
  series text,
  issuer_name text not null,
  issuer_tax_id text not null, -- CNPJ
  issue_date timestamp with time zone,
  access_key text unique, -- Chave de acesso
  xml_content text, -- Optional: store raw XML
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Invoice Items Table
create table if not exists invoice_items (
  id bigint primary key generated always as identity,
  invoice_id bigint references invoices(id) on delete cascade,
  product_id bigint references products(id),
  product_code text not null, -- Snapshot of code in invoice
  product_name text not null, -- Snapshot of name in invoice
  quantity numeric not null,
  unit_value numeric not null,
  total_value numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add new columns to invoices table
alter table invoices add column if not exists code text; -- cNF
alter table invoices add column if not exists total_value numeric default 0; -- vNF