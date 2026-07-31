-- Rollback seguro do lote 1.
-- Não restaura acesso de anon/PUBLIC a funções sensíveis nem ao bucket.
-- Deve ser usado apenas se as políticas por owner interromperem o fluxo autenticado.

begin;

-- Restaura políticas amplas apenas para authenticated, sem reabrir anon.
drop policy if exists "pdf_files_storage_select_own" on storage.objects;
drop policy if exists "pdf_files_storage_insert_own" on storage.objects;
drop policy if exists "pdf_files_storage_update_own" on storage.objects;
drop policy if exists "pdf_files_storage_delete_own" on storage.objects;

drop policy if exists "authenticated_can_upload_pdfs 1nzuh98_0" on storage.objects;
drop policy if exists "authenticated_can_upload_pdfs 1nzuh98_1" on storage.objects;
drop policy if exists "authenticated_can_upload_pdfs 1nzuh98_2" on storage.objects;
drop policy if exists "authenticated_can_upload_pdfs 1nzuh98_3" on storage.objects;

create policy "authenticated_can_upload_pdfs 1nzuh98_0"
on storage.objects for select
to authenticated
using (bucket_id = 'pdf-files');

create policy "authenticated_can_upload_pdfs 1nzuh98_1"
on storage.objects for insert
to authenticated
with check (bucket_id = 'pdf-files');

create policy "authenticated_can_upload_pdfs 1nzuh98_2"
on storage.objects for delete
to authenticated
using (bucket_id = 'pdf-files');

create policy "authenticated_can_upload_pdfs 1nzuh98_3"
on storage.objects for update
to authenticated
using (bucket_id = 'pdf-files')
with check (bucket_id = 'pdf-files');

-- Funções auxiliares continuam disponíveis a authenticated/service_role.
-- Funções internas e administrativas permanecem fechadas por segurança.

commit;
