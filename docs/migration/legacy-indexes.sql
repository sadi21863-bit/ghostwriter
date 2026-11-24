-- Observed production indexes, classified. Generated 2026-10-03T19:58:18.947Z
-- v4 §6.3: scripts/add-indexes.js is best-effort and silently no-ops on an
-- unknown table; these statements are now owned by the baseline instead.

CREATE UNIQUE INDEX creator_bibles_project_id_unique ON public.creator_bibles USING btree (project_id);
CREATE UNIQUE INDEX email_verification_tokens_token_unique ON public.email_verification_tokens USING btree (token);
CREATE UNIQUE INDEX password_reset_tokens_token_unique ON public.password_reset_tokens USING btree (token);
CREATE UNIQUE INDEX reader_sessions_token_unique ON public.reader_sessions USING btree (token);
CREATE UNIQUE INDEX sessions_session_token_unique ON public.sessions USING btree (session_token);
CREATE UNIQUE INDEX showcases_project_id_unique ON public.showcases USING btree (project_id);
CREATE UNIQUE INDEX showcases_slug_unique ON public.showcases USING btree (slug);
CREATE UNIQUE INDEX subscriptions_user_id_unique ON public.subscriptions USING btree (user_id);
CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email);
