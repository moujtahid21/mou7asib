import { NextResponse } from "next/server";
import { withTenant } from "@mou7asib/db";
import { visibleDocumentWhere } from "@/lib/documents";
import { requireSession } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireSession();
  const { id } = await params;

  const document = await withTenant(session.tenantId, (tx) =>
    tx.document.findFirst({
      where: { id, ...visibleDocumentWhere(session.tenantId) },
      select: { status: true },
    }),
  );

  if (!document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  return NextResponse.json({ status: document.status });
}
