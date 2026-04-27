-- consult-files 버킷 (상담 채팅 첨부파일)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consult-files',
  'consult-files',
  true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/gif','image/webp','application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- anon: 업로드 허용
create policy "anon_consult_files_insert" on storage.objects
  for insert to anon
  with check (bucket_id = 'consult-files');

-- 전체 공개 읽기
create policy "public_consult_files_select" on storage.objects
  for select to public
  using (bucket_id = 'consult-files');

-- service_role: 전체 관리
create policy "service_consult_files_all" on storage.objects
  for all to service_role
  using (bucket_id = 'consult-files')
  with check (bucket_id = 'consult-files');
