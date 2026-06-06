DROP POLICY IF EXISTS "studio attachments owner read" ON storage.objects;
DROP POLICY IF EXISTS "studio attachments owner insert" ON storage.objects;
DROP POLICY IF EXISTS "studio attachments owner delete" ON storage.objects;

CREATE POLICY "studio attachments owner read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "studio attachments owner insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "studio attachments owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'studio-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);