-- Separa as conversas individuais do Publ.IA Essencial e Estratégico.
-- Execute no Supabase antes de publicar os arquivos desta etapa.

alter table public.conversations
  add column if not exists product_tier text;

-- Recupera o produto pelo payload das mensagens já existentes.
with latest_product as (
  select distinct on (m.conversation_id)
    m.conversation_id,
    lower(m.payload ->> 'productTier') as product_tier
  from public.messages m
  where lower(m.payload ->> 'productTier') in ('essential', 'strategic')
  order by m.conversation_id, m.created_at desc
)
update public.conversations c
set product_tier = lp.product_tier
from latest_product lp
where c.id = lp.conversation_id
  and c.product_tier is null;

-- Conversas antigas sem metadado permanecem acessíveis no Essencial.
update public.conversations
set product_tier = 'essential'
where product_tier is null;

alter table public.conversations
  alter column product_tier set default 'essential';

alter table public.conversations
  alter column product_tier set not null;

alter table public.conversations
  drop constraint if exists conversations_product_tier_check;

alter table public.conversations
  add constraint conversations_product_tier_check
  check (product_tier in ('essential', 'strategic'));

create index if not exists conversations_user_product_created_idx
  on public.conversations (user_id, product_tier, created_at desc)
  where deleted_at is null;
