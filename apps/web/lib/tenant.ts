// D2: no auth yet (ADR 0006 explicitly excludes multi-tenancy/auth from this
// milestone). Every query still filters on tenantId explicitly — this
// constant is the one place that will change when real auth lands, not a
// pattern to special-case away in the query code itself.
export const DEMO_TENANT_ID = "01930000-0000-7000-8000-000000000001";
