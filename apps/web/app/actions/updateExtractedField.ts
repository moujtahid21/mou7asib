"use server";

import { revalidatePath } from "next/cache";
import { Prisma, withTenant } from "@mou7asib/db";
import { visibleDocumentWhere } from "@/lib/documents";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";

export type UpdateFieldState = { error: string } | null;

export interface FieldIdentity {
  documentId: string;
  fieldName: string;
  groupName: string | null;
  groupIndex: number | null;
}

// Additive override, never an in-place overwrite of the model's original
// output (valueText/valueDecimal) — that signal ("was the model right on
// this field") is exactly what D1/S1a's accuracy-measurement mission
// depends on. Display/logic rule everywhere: override ?? original. See the
// D2 dashboard-extension plan.
export async function updateExtractedField(
  identity: FieldIdentity,
  _prevState: UpdateFieldState,
  formData: FormData,
): Promise<UpdateFieldState> {
  const session = await requireSession();
  if (!can(session.role, "document:write")) {
    return { error: "Action non autorisée pour ce rôle." };
  }

  const action = formData.get("action");
  const rawValue = formData.get("value");

  const result = await withTenant(session.tenantId, async (tx): Promise<UpdateFieldState> => {
    const document = await tx.document.findFirst({
      where: { id: identity.documentId, ...visibleDocumentWhere(session.tenantId) },
      select: { currentAttemptId: true },
    });
    if (!document || document.currentAttemptId === null) {
      return { error: "Document introuvable ou non extrait." };
    }

    const field = await tx.extractedField.findFirst({
      where: {
        documentId: identity.documentId,
        attemptId: document.currentAttemptId,
        fieldName: identity.fieldName,
        groupName: identity.groupName,
        groupIndex: identity.groupIndex,
      },
      select: { id: true, fieldType: true },
    });
    if (!field) {
      return { error: "Champ introuvable." };
    }

    if (action === "revert") {
      await tx.extractedField.update({
        where: { id: field.id },
        data: { overrideValueText: null, overrideValueDecimal: null, correctedAt: null },
      });
      return null;
    }

    if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
      return { error: "Valeur vide." };
    }
    const trimmedValue = rawValue.trim();

    if (field.fieldType === "decimal") {
      // Never coerce through a JS number first (CLAUDE.md §6) — Prisma.Decimal
      // parses the string directly. Reject rather than silently guess on a
      // malformed amount.
      let parsed: Prisma.Decimal;
      try {
        parsed = new Prisma.Decimal(trimmedValue);
      } catch {
        return { error: "Montant invalide." };
      }
      await tx.extractedField.update({
        where: { id: field.id },
        data: { overrideValueDecimal: parsed, overrideValueText: null, correctedAt: new Date() },
      });
    } else if (field.fieldType === "date") {
      if (Number.isNaN(Date.parse(trimmedValue))) {
        return { error: "Date invalide (AAAA-MM-JJ)." };
      }
      await tx.extractedField.update({
        where: { id: field.id },
        data: { overrideValueText: trimmedValue, overrideValueDecimal: null, correctedAt: new Date() },
      });
    } else {
      await tx.extractedField.update({
        where: { id: field.id },
        data: { overrideValueText: trimmedValue, overrideValueDecimal: null, correctedAt: new Date() },
      });
    }

    return null;
  });

  if (result === null) {
    revalidatePath(`/documents/${identity.documentId}`);
  }
  return result;
}
