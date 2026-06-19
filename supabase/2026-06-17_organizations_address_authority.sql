-- Adiciona dados institucionais complementares em organizations
-- Execute uma única vez no SQL Editor do Supabase antes de subir os arquivos.

alter table public.organizations
  add column if not exists address_logradouro text,
  add column if not exists address_bairro text,
  add column if not exists address_cep text,
  add column if not exists authority_name text,
  add column if not exists authority_position text;

comment on column public.organizations.address_logradouro is 'Logradouro/endereço principal da organização.';
comment on column public.organizations.address_bairro is 'Bairro da organização.';
comment on column public.organizations.address_cep is 'CEP da organização, preferencialmente somente números.';
comment on column public.organizations.authority_name is 'Nome da autoridade responsável. Ex.: João da Silva.';
comment on column public.organizations.authority_position is 'Cargo da autoridade. Ex.: Prefeito.';
