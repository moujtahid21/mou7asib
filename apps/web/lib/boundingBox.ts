import { z } from "zod";

// ExtractedField.boundingBox was written by a separate process (the Python
// worker), not Prisma itself — validate its shape before trusting it
// client-side, per CLAUDE.md §8.3's boundary-validation spirit.
export const boundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export type BoundingBox = z.infer<typeof boundingBoxSchema>;

export function parseBoundingBox(value: unknown): BoundingBox | null {
  if (value === null || value === undefined) {
    return null;
  }
  const result = boundingBoxSchema.safeParse(value);
  return result.success ? result.data : null;
}
