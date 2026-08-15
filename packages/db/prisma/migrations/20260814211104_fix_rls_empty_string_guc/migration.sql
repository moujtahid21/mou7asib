-- Fixes a real bug the tenant-isolation test (packages/db/src/withTenant.test.ts) caught:
-- once a custom GUC like app.tenant_id has been touched by SET LOCAL/set_config in a
-- session, Postgres does not necessarily go back to reporting it as "missing" —
-- current_setting('app.tenant_id', true) can return '' (empty string) rather than NULL on
-- a later, unrelated transaction over a pooled/reused connection. The previous policies
-- cast that value straight to ::uuid, which throws on '' instead of failing the row match
-- — still fail-closed in effect (no rows leak), but as a query error rather than a clean
-- empty result, which is a reliability problem the app shouldn't have to work around.
--
-- NULLIF(..., '') turns the empty-string case into a real NULL first, so the comparison
-- is `tenant_id = NULL`, which is simply never true — no rows, no error, either way.

DROP POLICY "tenant_isolation" ON "documents";
CREATE POLICY "tenant_isolation" ON "documents"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY "tenant_isolation" ON "extraction_jobs";
CREATE POLICY "tenant_isolation" ON "extraction_jobs"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY "tenant_isolation" ON "extraction_attempts";
CREATE POLICY "tenant_isolation" ON "extraction_attempts"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY "tenant_isolation" ON "extracted_fields";
CREATE POLICY "tenant_isolation" ON "extracted_fields"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY "tenant_isolation" ON "audit_logs";
CREATE POLICY "tenant_isolation" ON "audit_logs"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
