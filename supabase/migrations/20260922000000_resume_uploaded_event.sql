-- Record successful primary-resume attachments in application timelines.
alter type public.application_event_type
add value if not exists 'RESUME_UPLOADED';
