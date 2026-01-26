-- 007_storage_policies_pdf_files.sql
-- Policies para o bucket 'pdf-files'
-- Regra simples: usuário autenticado só acessa objetos em que ele é owner.

alter table storage.objects enable row level security;

drop policy if exists "pdf_files_storage_select_own" on storage.objects;
create policy "pdf_files_storage_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
);

drop policy if exists "pdf_files_storage_insert_own" on storage.objects;
create policy "pdf_files_storage_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
);

drop policy if exists "pdf_files_storage_delete_own" on storage.objects;
create policy "pdf_files_storage_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pdf-files'
  and owner = auth.uid()
);
