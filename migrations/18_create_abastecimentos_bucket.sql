-- Create the storage bucket for 'abastecimentos' if it doesn't exist
insert into storage.buckets (id, name, public)
values ('abastecimentos', 'abastecimentos', true)
on conflict (id) do nothing;

-- Remove existing policies to avoid conflicts if re-running
drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Public Access" on storage.objects;

-- Policy to allow authenticated users to upload files to 'abastecimentos' bucket
create policy "Authenticated users can upload images"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'abastecimentos' );

-- Policy to allow everyone (public) to view/download images from 'abastecimentos' bucket
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'abastecimentos' );
