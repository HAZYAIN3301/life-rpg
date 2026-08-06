#!/usr/bin/env python3
"""Build the BODY guardian life-v4 sprites and proportion-correct pair frames.

Generated material is first keyed from a bounded magenta hue range. Geometry is
then normalized onto the runtime canvases; pair fixes scale only Traveller and
keep the authored toad untouched.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


HERE = Path(__file__).resolve().parent
SOURCES = HERE / "sources"
PUBLIC = HERE.parents[1] / "public"
MOTION = PUBLIC / "art/pets/body-toad-v1/motion-v4"
PAIR = PUBLIC / "art/pets/body-toad-v1/pair-v4"
ACTORS = PUBLIC / "art/den/actors"
ROOM_ACTIONS = PUBLIC / "art/avatars/traveller-core-v1/male/room-actions-v4"


def keyed(source: Path) -> Image.Image:
    rgb = Image.open(source).convert("RGB")
    pixels = np.asarray(rgb)
    red = pixels[:, :, 0].astype(np.int16)
    green = pixels[:, :, 1].astype(np.int16)
    blue = pixels[:, :, 2].astype(np.int16)
    magenta = (
        (red >= 170)
        & (blue >= 145)
        & (green <= 110)
        & ((red - blue) >= -45)
        & ((red - blue) <= 100)
        & ((red - green) >= 90)
        & ((blue - green) >= 70)
    )
    background = Image.fromarray((magenta.astype(np.uint8) * 255), "L")
    background = background.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    alpha = Image.eval(background, lambda value: 255 - value)
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("empty alpha")
    return bbox


def fit_sprite(
    image: Image.Image,
    canvas: tuple[int, int],
    max_box: tuple[int, int],
    center_x: int,
    ground_y: int,
) -> Image.Image:
    bbox = alpha_bbox(image)
    subject = image.crop(bbox)
    scale = min(max_box[0] / subject.width, max_box[1] / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    result = Image.new("RGBA", canvas, (0, 0, 0, 0))
    result.alpha_composite(subject, (round(center_x - size[0] / 2), ground_y - size[1]))
    return result


def build_motion() -> None:
    specs = {
        "hop-crouch": ((880, 720), 512, 920),
        "hop-air": ((790, 700), 512, 850),
        "solo-stretch": ((900, 760), 512, 920),
        "bench-sleep": ((900, 650), 512, 920),
    }
    for name, (max_box, center_x, ground_y) in specs.items():
        result = fit_sprite(keyed(SOURCES / f"{name}-source.png"), (1024, 1024), max_box, center_x, ground_y)
        target = MOTION / f"{name}.png"
        result.save(target, optimize=True)
        print(target.relative_to(PUBLIC), alpha_bbox(result))

    # The upright phase keeps the frog's head/body scale from the source. A
    # generic bounding-box fit would shrink him because the raised arms make
    # this pose much taller than the side stretch.
    stretch_up = keyed(SOURCES / "solo-stretch-up-source.png").resize((1024, 1024), Image.Resampling.LANCZOS)
    stretch_subject = stretch_up.crop(alpha_bbox(stretch_up))
    stretch_result = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    stretch_result.alpha_composite(stretch_subject, (round(512 - stretch_subject.width / 2), 920 - stretch_subject.height))
    stretch_result.save(MOTION / "solo-stretch-up.png", optimize=True)
    print("motion-v4/solo-stretch-up.png", alpha_bbox(stretch_result))

    # The restoring state is registered as a dedicated, decoded blink frame.
    blink = Image.open(SOURCES / "restoring-reference.png").convert("RGBA")
    blink.save(MOTION / "idle-blink.png", optimize=True)


def resize_actor_region(
    image: Image.Image,
    split_x: int,
    scale: float,
    center_x: int,
    left_shift: int = 0,
    left_scale: float = 1.0,
) -> Image.Image:
    """Recompose an authored pair while keeping both actors grounded."""
    left = Image.new("RGBA", image.size, (0, 0, 0, 0))
    left_actor = image.crop((0, 0, split_x, image.height))
    if left_scale == 1.0:
        left.alpha_composite(left_actor, (left_shift, 0))
    else:
        left_actor = left_actor.crop(alpha_bbox(left_actor))
        left_size = (round(left_actor.width * left_scale), round(left_actor.height * left_scale))
        left_actor = left_actor.resize(left_size, Image.Resampling.LANCZOS)
        left_x = round(266 - left_size[0] / 2)
        left.alpha_composite(left_actor, (left_x, 1470 - left_size[1]))
    actor = image.crop((split_x, 0, image.width, image.height))
    bbox = alpha_bbox(actor)
    actor = actor.crop(bbox)
    size = (round(actor.width * scale), round(actor.height * scale))
    actor = actor.resize(size, Image.Resampling.LANCZOS)
    x = round(center_x - size[0] / 2)
    y = 1470 - size[1]
    left.alpha_composite(actor, (x, y))
    return left


def build_pairs() -> None:
    fixes = {
        # Keep the BODY guardian at its authored scale and restore the
        # Traveller-to-guardian ratio seen in the standing room scene.
        "train-low": (840, 1.46, 1110, 0, 1.0),
        "train-high": (955, 1.42, 1120, 0, 1.0),
        "pushup-down": (652, 1.42, 962, 0, 0.88),
        "pushup-up": (652, 1.42, 962, 0, 0.88),
    }
    for name, (split, scale, center, left_shift, left_scale) in fixes.items():
        source = Image.open(SOURCES / f"{name}.png").convert("RGBA")
        result = resize_actor_region(source, split, scale, center, left_shift, left_scale)
        result.save(PAIR / f"{name}.png", optimize=True)
        print(f"pair-v4/{name}.png", alpha_bbox(result))

    for name in ("whistle-c", "whistle-d"):
        source = keyed(SOURCES / f"{name}-source.png")
        result = fit_sprite(source, (1536, 1536), (1224, 962), 768, 1470)
        result.save(PAIR / f"{name}.png", optimize=True)
        print(f"pair-v4/{name}.png", alpha_bbox(result))


def build_portal() -> None:
    core = fit_sprite(keyed(SOURCES / "portal-core-source.png"), (542, 768), (390, 650), 271, 714)
    core.save(ACTORS / "prop-portal-core.png", optimize=True)
    arm = fit_sprite(keyed(SOURCES / "traveller-portal-arm-source.png"), (1024, 1024), (900, 470), 512, 745)
    arm.save(ACTORS / "traveller-portal-arm.png", optimize=True)

    # One complete reach pose avoids showing an extra arm over the idle actor.
    idle = Image.open(SOURCES / "traveller-idle-reference.png").convert("RGBA")
    reach = Image.new("RGBA", (900, 900), (0, 0, 0, 0))
    reach.alpha_composite(idle, (100, 0))
    erase = Image.new("RGBA", (145, 330), (0, 0, 0, 0))
    reach.paste(erase, (480, 300))
    arm_subject = arm.crop(alpha_bbox(arm))
    arm_width = 345
    arm_size = (arm_width, round(arm_subject.height * arm_width / arm_subject.width))
    arm_subject = arm_subject.resize(arm_size, Image.Resampling.LANCZOS)
    reach.alpha_composite(arm_subject, (462, 318))
    reach.save(ACTORS / "traveller-portal-reach.png", optimize=True)

    # The portal is opened only after Traveller has sat down. This authored
    # pose shares the exact 640x900 bench-action canvas, so changing from
    # seated-rest to portal-reach cannot teleport or rescale the character.
    seated_reach = fit_sprite(
        keyed(SOURCES / "traveller-seated-portal-reach-source.png"),
        (640, 900),
        (600, 790),
        330,
        860,
    )
    seated_reach.save(ROOM_ACTIONS / "bench-portal-reach.png", optimize=True)
    print(
        "portal core", alpha_bbox(core),
        "arm", alpha_bbox(arm),
        "reach", alpha_bbox(reach),
        "seated reach", alpha_bbox(seated_reach),
    )


if __name__ == "__main__":
    MOTION.mkdir(parents=True, exist_ok=True)
    PAIR.mkdir(parents=True, exist_ok=True)
    ACTORS.mkdir(parents=True, exist_ok=True)
    ROOM_ACTIONS.mkdir(parents=True, exist_ok=True)
    build_motion()
    build_pairs()
    build_portal()
