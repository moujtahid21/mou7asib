import { describe, expect, it } from "vitest";
import { Decimal } from "./money.ts";
import { renderPlaceholderAttestation, ATTESTATION_VERSION } from "./rasAttestation.ts";

describe("renderPlaceholderAttestation", () => {
  it("always states it is not an official attestation", () => {
    const output = renderPlaceholderAttestation({
      tenantName: "Test SARL",
      payeeName: "Consultant X",
      paymentNature: "Honoraires",
      paymentDate: new Date("2026-02-01"),
      baseAmount: new Decimal(1000),
      rate: new Decimal(0.1),
      rasAmount: new Decimal(100),
      netPayable: new Decimal(900),
    });
    expect(output).toContain("NON OFFICIEL");
    expect(output).toContain("L-45");
    expect(output).toContain(ATTESTATION_VERSION);
  });

  it("includes the payee, nature, and computed amounts", () => {
    const output = renderPlaceholderAttestation({
      tenantName: "Test SARL",
      payeeName: "Consultant X",
      paymentNature: "Honoraires",
      paymentDate: new Date("2026-02-01"),
      baseAmount: new Decimal(1000),
      rate: new Decimal(0.1),
      rasAmount: new Decimal(100),
      netPayable: new Decimal(900),
    });
    expect(output).toContain("Consultant X");
    expect(output).toContain("Honoraires");
    expect(output).toContain("1000.00");
    expect(output).toContain("10.00 %");
    expect(output).toContain("100.00");
    expect(output).toContain("900.00");
  });
});
