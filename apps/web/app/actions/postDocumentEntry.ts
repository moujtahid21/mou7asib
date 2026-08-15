"use server";

import { redirect } from "next/navigation";
import { withTenant, Prisma } from "@mou7asib/db";
import {
  assertValidEntry,
  Decimal as AccountingDecimal,
  InvalidLineError,
  UnbalancedEntryError,
  type JournalLineInput,
} from "@mou7asib/accounting";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/policy";
import { findOrCreatePeriod, MAX_ENTRY_LINES } from "@/lib/ledger";

export type PostDocumentEntryState = { error: string } | null;

interface RawLine {
  accountCode: string;
  debit: string;
  credit: string;
  label: string | undefined;
}

function parseLines(formData: FormData): RawLine[] {
  const lines: RawLine[] = [];
  for (let i = 0; i < MAX_ENTRY_LINES; i++) {
    const accountCodeField = formData.get(`accountCode_${i}`);
    const accountCode = typeof accountCodeField === "string" ? accountCodeField.trim() : "";
    if (accountCode.length === 0) {
      continue;
    }
    const debitField = formData.get(`debit_${i}`);
    const creditField = formData.get(`credit_${i}`);
    const labelField = formData.get(`label_${i}`);
    const debit = typeof debitField === "string" && debitField.trim().length > 0 ? debitField.trim() : "0";
    const credit = typeof creditField === "string" && creditField.trim().length > 0 ? creditField.trim() : "0";
    const label = typeof labelField === "string" && labelField.trim().length > 0 ? labelField.trim() : undefined;
    lines.push({ accountCode, debit, credit, label });
  }
  return lines;
}

class UnknownAccountError extends Error {}
class AlreadyPostedError extends Error {}

// Posts a document's review straight to the ledger — this is manual entry with the
// account codes always chosen (or confirmed) by a human (CLAUDE.md §5 rule 5: the AI
// never writes to the ledger). lib/postingSuggestion.ts may pre-fill the account-code
// inputs from the tenant's own posting history (S6), but the suggestion never posts
// itself — it only ships two hidden fields (suggestedAccountCode_0/1) so this action can
// tell, after the fact, whether what was actually submitted matched what was suggested.
// That comparison is S6's required acceptance-rate metric, recorded via AuditLog below.
export async function postDocumentEntry(
  documentId: string,
  _prevState: PostDocumentEntryState,
  formData: FormData,
): Promise<PostDocumentEntryState> {
  const session = await requireSession();
  if (!can(session.role, "ledger:write")) {
    return { error: "Action non autorisée pour ce rôle." };
  }

  const dateField = formData.get("date");
  const journalCodeField = formData.get("journalCode");
  const labelField = formData.get("label");
  if (typeof dateField !== "string" || Number.isNaN(Date.parse(dateField))) {
    return { error: "Date invalide." };
  }
  if (typeof journalCodeField !== "string" || journalCodeField.trim().length === 0) {
    return { error: "Code journal requis." };
  }
  if (typeof labelField !== "string" || labelField.trim().length === 0) {
    return { error: "Libellé requis." };
  }
  const date = new Date(dateField);
  const journalCode = journalCodeField.trim();
  const entryLabel = labelField.trim();

  const rawLines = parseLines(formData);
  if (rawLines.length === 0) {
    return { error: "Au moins une ligne requise." };
  }

  const suggestedDebitCode = formData.get("suggestedAccountCode_0");
  const suggestedCreditCode = formData.get("suggestedAccountCode_1");
  const hadSuggestion = typeof suggestedDebitCode === "string" && typeof suggestedCreditCode === "string";

  let lines: JournalLineInput[];
  try {
    lines = rawLines.map((line) => ({
      accountCode: line.accountCode,
      debit: new AccountingDecimal(line.debit),
      credit: new AccountingDecimal(line.credit),
      label: line.label,
    }));
    assertValidEntry({ date, journalCode, label: entryLabel, lines });
  } catch (error) {
    if (error instanceof InvalidLineError || error instanceof UnbalancedEntryError) {
      return { error: error.message };
    }
    return { error: "Montant invalide — utilisez un nombre, ex. 1234.50." };
  }

  try {
    await withTenant(session.tenantId, async (tx) => {
      const document = await tx.document.findFirst({
        where: { id: documentId, tenantId: session.tenantId, deletedAt: null },
        select: { id: true, postedJournalEntry: { select: { id: true } } },
      });
      if (document === null) {
        throw new UnknownAccountError("Document introuvable.");
      }
      if (document.postedJournalEntry !== null) {
        throw new AlreadyPostedError();
      }

      const accounts = await tx.account.findMany({
        where: { tenantId: session.tenantId, code: { in: lines.map((line) => line.accountCode) } },
        select: { id: true, code: true },
      });
      const accountIdByCode = new Map(accounts.map((account) => [account.code, account.id]));
      const resolvedLines = lines.map((line) => {
        const accountId = accountIdByCode.get(line.accountCode);
        if (accountId === undefined) {
          throw new UnknownAccountError(`Compte inconnu : ${line.accountCode}`);
        }
        return { ...line, accountId };
      });

      // draft -> lines -> posted: journal_lines' immutability trigger fires on INSERT
      // too, so lines can only be added while the entry is still a draft (same lesson as
      // lib/journalImport.ts's confirmJournalImport).
      const entry = await tx.journalEntry.create({
        data: {
          tenantId: session.tenantId,
          date,
          journalCode,
          label: entryLabel,
          status: "draft",
          sourceDocumentId: documentId,
        },
      });

      let lineOrder = 0;
      for (const line of resolvedLines) {
        await tx.journalLine.create({
          data: {
            tenantId: session.tenantId,
            entryId: entry.id,
            accountId: line.accountId,
            debit: new Prisma.Decimal(line.debit.toString()),
            credit: new Prisma.Decimal(line.credit.toString()),
            label: line.label ?? null,
            lineOrder,
          },
        });
        lineOrder += 1;
      }

      if (hadSuggestion) {
        const submittedDebitCode = rawLines[0]?.accountCode ?? null;
        const submittedCreditCode = rawLines[1]?.accountCode ?? null;
        const accepted = submittedDebitCode === suggestedDebitCode && submittedCreditCode === suggestedCreditCode;
        await tx.auditLog.create({
          data: {
            tenantId: session.tenantId,
            userId: session.userId,
            action: "posting_suggestion_outcome",
            targetType: "JournalEntry",
            targetId: entry.id,
            before: { suggestedDebitCode, suggestedCreditCode },
            after: { submittedDebitCode, submittedCreditCode, outcome: accepted ? "accepted" : "edited" },
          },
        });
      }

      const period = await findOrCreatePeriod(tx, session.tenantId, date);
      if (period.status === "locked") {
        // Left as a draft, linked to the document via sourceDocumentId — nothing lost,
        // same "locked period" behavior as postJournalEntry.ts.
        return;
      }
      await tx.journalEntry.update({
        where: { id: entry.id },
        data: { status: "posted", periodId: period.id, postedAt: new Date() },
      });
    });
  } catch (error) {
    if (error instanceof UnknownAccountError) {
      return { error: error.message };
    }
    if (error instanceof AlreadyPostedError) {
      return { error: "Ce document est déjà lié à une écriture — impossible d'en créer une seconde." };
    }
    throw error;
  }

  redirect(`/documents/${documentId}`);
}
