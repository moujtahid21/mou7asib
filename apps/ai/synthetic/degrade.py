"""Degrades a subset of the clean synthetic corpus to simulate phone photos:
rotate, blur, underexpose, JPEG re-compress. Reuses the same ground truth
(degradation doesn't change the true field values).

Not simulated (explicit limitation, see apps/ai/README.md): physical
crumpling and real phone-camera capture (moire, perspective distortion,
uneven real-world lighting) — that's what S1b's real documents are for.

Run: uv run --project apps/ai python synthetic/degrade.py
"""

from __future__ import annotations

import random
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from extraction_harness.routing import rasterize_first_page

CORPUS_DIR = Path(__file__).resolve().parent / "corpus"
OUTPUT_DIR = Path(__file__).resolve().parent / "corpus_degraded"

# Every other invoice, deliberately varied degradation combos so the corpus
# exercises rotate/blur/underexpose/JPEG-compress both individually and combined.
DEGRADATION_PLAN: dict[str, dict[str, float]] = {
    "invoice_01_single_rate_clean": {"rotate": 6.0},
    "invoice_03_mixed_rate_20_14": {"blur": 2.0},
    "invoice_05_single_rate_10_dashed_ice": {"brightness": 0.55},
    "invoice_07_mixed_rate_bilingual_header": {"rotate": -10.0, "blur": 1.5},
    "invoice_09_individual_customer_no_ice": {"brightness": 0.6, "jpeg_quality": 25},
    "invoice_11_single_rate_no_due_date": {"rotate": 12.0, "brightness": 0.5, "jpeg_quality": 20},
}


def degrade_image(image: Image.Image, plan: dict[str, float]) -> Image.Image:
    result = image.convert("RGB")
    if "rotate" in plan:
        result = result.rotate(plan["rotate"], expand=True, fillcolor="white")
    if "blur" in plan:
        result = result.filter(ImageFilter.GaussianBlur(radius=plan["blur"]))
    if "brightness" in plan:
        result = ImageEnhance.Brightness(result).enhance(plan["brightness"])
    return result


def main() -> None:
    if not CORPUS_DIR.exists():
        raise SystemExit(f"{CORPUS_DIR} does not exist — run generate_invoices.py first")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    random.seed(42)  # reproducible corpus

    for name, plan in DEGRADATION_PLAN.items():
        pdf_path = CORPUS_DIR / f"{name}.pdf"
        ground_truth_path = CORPUS_DIR / f"{name}.ground_truth.json"
        if not pdf_path.exists() or not ground_truth_path.exists():
            raise SystemExit(f"Missing source pair for {name} in {CORPUS_DIR}")

        rasterized_path = OUTPUT_DIR / f"{name}_clean.png"
        rasterize_first_page(pdf_path, rasterized_path, zoom=2.0)

        image = Image.open(rasterized_path)
        degraded = degrade_image(image, plan)

        jpeg_quality = int(plan.get("jpeg_quality", 60))
        output_image_path = OUTPUT_DIR / f"{name}_degraded.jpg"
        degraded.save(output_image_path, "JPEG", quality=jpeg_quality)
        rasterized_path.unlink()

        output_ground_truth_path = OUTPUT_DIR / f"{name}_degraded.ground_truth.json"
        shutil.copy(ground_truth_path, output_ground_truth_path)

        print(f"wrote {output_image_path.name} (plan={plan})")

    print(f"\n{len(DEGRADATION_PLAN)} degraded documents written to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
