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
import { MAX_ENTRY_LINES } from "@/lib/ledger";

export type CreateEntryState = { error: string } | null;

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

export async function createJournalEntry(
  _prevState: CreateEntryState,
  formData: FormData,
): Promise<CreateEntryState> {
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

  let entryId: string;
  try {
    entryId = await withTenant(session.tenantId, async (tx) => {
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

      const entry = await tx.journalEntry.create({
        data: { tenantId: session.tenantId, date, journalCode, label: entryLabel, status: "draft" },
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

      return entry.id;
    });
  } catch (error) {
    if (error instanceof UnknownAccountError) {
      return { error: error.message };
    }
    throw error;
  }

  redirect(`/tva?entry=${entryId}`);
}
