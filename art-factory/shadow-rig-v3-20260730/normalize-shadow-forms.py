#!/usr/bin/env python3
"""Normalize approved Shadow evolution posters onto one 1024×1024 runtime canvas."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent
CANVAS = (1024, 1024)
FORMS = {
    "spark": {
        "source": ROOT / "outputs" / "shadow-spark-v3.png",
        "target": (362, 320, 662, 750),
    },
    "spirit": {
        "source": ROOT / "references" / "shadow-spirit-approved.png",
        "target": (350, 250, 673, 820),
    },
    "guardian": {
        "source": ROOT / "outputs" / "shadow-guardian-v3.png",
        "target": (272, 140, 752, 900),
    },
    "keeper": {
        "source": ROOT / "outputs" / "shadow-keeper-v3.png",
        "target": (202, 70, 822, 950),
    },
}


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("Source image has no visible pixels")
    return bbox


def normalize(source: Path, target: tuple[int, int, int, int]) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    subject = image.crop(alpha_bbox(image))
    left, top, right, bottom = target
    max_width = right - left
    max_height = bottom - top
    scale = min(max_width / subject.width, max_height / subject.height)
    size = (
        max(1, round(subject.width * scale)),
        max(1, round(subject.height * scale)),
    )
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    x = left + (max_width - size[0]) // 2
    y = top + (max_height - size[1]) // 2
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(subject, (x, y))
    return canvas


def build_contact_sheet(images: dict[str, Image.Image], out: Path) -> None:
    tile = 420
    margin = 28
    sheet = Image.new("RGB", (tile * 4, tile), "#0b1020")
    for index, (name, image) in enumerate(images.items()):
        preview = image.copy()
        preview.thumbnail((tile - margin * 2, tile - margin * 2), Image.Resampling.LANCZOS)
        x = index * tile + (tile - preview.width) // 2
        y = (tile - preview.height) // 2
        sheet.paste(preview, (x, y), preview)
    sheet.save(out, quality=94)


def main() -> None:
    runtime = ROOT / "runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    normalized: dict[str, Image.Image] = {}
    for name, config in FORMS.items():
        image = normalize(config["source"], config["target"])
        image.save(runtime / f"shadow-{name}-calm.png", optimize=True)
        normalized[name] = image
    build_contact_sheet(normalized, ROOT / "shadow-evolution-v3-contact-sheet.jpg")
    print(f"Built {len(normalized)} normalized forms and contact sheet.")


if __name__ == "__main__":
    main()
