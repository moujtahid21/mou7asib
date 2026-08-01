import { NextResponse } from "next/server";
import { prisma } from "@mou7asib/db";
import { DEMO_TENANT_ID } from "@/lib/tenant";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: { id, tenantId: DEMO_TENANT_ID },
    select: { status: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  return NextResponse.json({ status: document.status });
}
