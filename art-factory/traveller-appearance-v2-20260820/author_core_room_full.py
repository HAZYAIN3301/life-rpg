#!/usr/bin/env python3
"""Author the remaining Traveller core/motion/room semantic masks and mattes.

The batch is deliberately finite: 18 new frames.  The already-reviewed idle
and window-back pairs are read for the final contact sheets and validation but
are never write targets.  All colour selections are clipped to explicit,
frame-owned geometry; the room reading props are removed by explicit polygons.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
from PIL import Image, ImageDraw

from semantic_masks import (
    ROOT,
    Validation,
    load_inventory,
    public_asset_path,
    safe_relative,
    validate_mask_set,
    validate_semantic_mask,
)


PREVIEW_ROOT = ROOT / "previews" / "core-room-full-v1"
CAPABILITIES = frozenset({"core", "motion", "room"})
def _cfg(
    *,
    matte: Sequence[tuple[int, int]],
    hair: Sequence[tuple[int, int]],
    skin: Sequence[Sequence[tuple[int, int]]],
    eyes: Sequence[tuple[int, int, int, int]],
    closed_eyes: bool = False,
    prop_excludes: Sequence[Sequence[tuple[int, int]]] = (),
) -> dict[str, object]:
    return {
        "matte_polygons": [list(matte)],
        "hair_polygons": [list(hair)],
        "skin_polygons": [list(points) for points in skin],
        "eye_boxes": list(eyes),
        "closed_eyes": closed_eyes,
        "prop_exclude_polygons": [list(points) for points in prop_excludes],
    }


# Geometry is in the canonical 640x900 frame.  Matte envelopes deliberately
# cover the complete base-alpha actor.  Semantic owners are substantially
# tighter: face/ears, exposed forearms/hands and exposed calves only.
FRAME_CONFIGS: dict[str, dict[str, object]] = {
    "male-v1:core:idle": _cfg(
        matte=[(0, 0), (639, 0), (639, 899), (0, 899)],
        hair=[(195, 42), (445, 42), (445, 292), (190, 292)],
        skin=[
            [(240, 125), (400, 125), (400, 285), (240, 285)],
            [(150, 350), (240, 350), (240, 565), (150, 565)],
            [(400, 350), (490, 350), (490, 565), (400, 565)],
            [(215, 640), (300, 640), (300, 765), (215, 765)],
            [(340, 640), (425, 640), (425, 765), (340, 765)],
        ],
        eyes=[(288, 172, 307, 202), (334, 172, 354, 202)],
    ),
    "female-f2-v1:core:idle": _cfg(
        matte=[(0, 0), (639, 0), (639, 899), (0, 899)],
        hair=[(185, 35), (482, 35), (482, 438), (185, 438)],
        skin=[
            [(235, 115), (405, 115), (405, 300), (235, 300)],
            [(155, 350), (245, 350), (245, 570), (155, 570)],
            [(395, 350), (485, 350), (485, 570), (395, 570)],
            [(215, 640), (300, 640), (300, 765), (215, 765)],
            [(340, 640), (425, 640), (425, 765), (340, 765)],
        ],
        eyes=[(276, 165, 296, 196), (320, 164, 341, 196)],
    ),
    "male-v1:core:window-back": _cfg(
        matte=[(0, 0), (639, 0), (639, 899), (0, 899)],
        hair=[(195, 35), (445, 35), (445, 300), (195, 300)],
        skin=[
            [(225, 105), (415, 105), (415, 305), (225, 305)],
            [(225, 350), (415, 350), (415, 575), (225, 575)],
            [(215, 640), (300, 640), (300, 765), (215, 765)],
            [(340, 640), (425, 640), (425, 765), (340, 765)],
        ],
        eyes=[],
    ),
    "female-f2-v1:core:window-back": _cfg(
        matte=[(0, 0), (639, 0), (639, 899), (0, 899)],
        hair=[(175, 25), (485, 25), (485, 445), (175, 445)],
        skin=[
            [(215, 95), (425, 95), (425, 335), (215, 335)],
            [(215, 350), (425, 350), (425, 585), (215, 585)],
            [(215, 640), (300, 640), (300, 765), (215, 765)],
            [(340, 640), (425, 640), (425, 765), (340, 765)],
        ],
        eyes=[],
    ),
    "male-v1:core:arms-up": _cfg(
        matte=[(160, 30), (480, 30), (480, 860), (160, 860)],
        hair=[(200, 85), (440, 85), (440, 250), (200, 250)],
        skin=[
            [(255, 140), (390, 140), (390, 260), (255, 260)],
            [(197, 70), (235, 70), (235, 160), (197, 160)],
            [(405, 70), (445, 70), (445, 160), (405, 160)],
            [(230, 680), (286, 680), (286, 745), (230, 745)],
            [(352, 680), (410, 680), (410, 745), (352, 745)],
        ],
        eyes=[(280, 183, 293, 205), (322, 184, 336, 206)],
    ),
    "female-f2-v1:core:arms-up": _cfg(
        matte=[(182, 30), (458, 30), (458, 860), (182, 860)],
        hair=[(190, 45), (475, 45), (475, 350), (195, 350)],
        skin=[
            [(255, 140), (390, 140), (390, 270), (255, 270)],
            [(197, 70), (235, 70), (235, 160), (197, 160)],
            [(405, 70), (445, 70), (445, 160), (405, 160)],
            [(230, 680), (286, 680), (286, 745), (230, 745)],
            [(352, 680), (410, 680), (410, 745), (352, 745)],
        ],
        eyes=[(274, 169, 287, 191), (316, 168, 331, 192)],
    ),
    "male-v1:core:seated": _cfg(
        matte=[(146, 166), (493, 166), (493, 860), (146, 860)],
        hair=[(200, 165), (440, 165), (440, 355), (200, 355)],
        skin=[
            [(255, 230), (390, 230), (390, 350), (255, 350)],
            [(200, 405), (285, 405), (285, 550), (200, 550)],
            [(355, 405), (440, 405), (440, 550), (355, 550)],
            [(210, 650), (280, 650), (280, 735), (210, 735)],
            [(350, 650), (420, 650), (420, 735), (350, 735)],
        ],
        eyes=[(290, 274, 304, 297), (333, 273, 347, 297)],
    ),
    "female-f2-v1:core:seated": _cfg(
        matte=[(149, 166), (490, 166), (490, 860), (149, 860)],
        hair=[(190, 155), (480, 155), (480, 405), (190, 405)],
        skin=[
            [(255, 230), (390, 230), (390, 360), (255, 360)],
            [(200, 405), (285, 405), (285, 550), (200, 550)],
            [(355, 405), (440, 405), (440, 550), (355, 550)],
            [(210, 650), (280, 650), (280, 735), (210, 735)],
            [(350, 650), (420, 650), (420, 735), (350, 735)],
        ],
        eyes=[(294, 273, 312, 298), (320, 269, 333, 294)],
    ),
    "male-v1:motion:idle-blink": _cfg(
        matte=[(154, 63), (486, 63), (486, 861), (154, 861)],
        hair=[(195, 45), (445, 45), (445, 285), (195, 285)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(190, 385), (230, 385), (215, 475), (180, 475)],
            [(157, 505), (193, 505), (193, 555), (157, 555)],
            [(410, 385), (450, 385), (460, 475), (425, 475)],
            [(447, 505), (483, 505), (483, 555), (447, 555)],
            [(230, 660), (288, 660), (288, 742), (230, 742)],
            [(352, 660), (410, 660), (410, 742), (352, 742)],
        ],
        eyes=[(287, 184, 309, 195), (332, 184, 354, 195)],
        closed_eyes=True,
    ),
    "female-f2-v1:motion:idle-blink": _cfg(
        matte=[(187, 63), (452, 63), (452, 861), (187, 861)],
        hair=[(185, 42), (480, 42), (480, 430), (185, 430)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(195, 380), (230, 380), (220, 475), (185, 475)],
            [(188, 475), (220, 475), (220, 535), (188, 535)],
            [(410, 380), (445, 380), (455, 475), (420, 475)],
            [(420, 475), (452, 475), (452, 535), (420, 535)],
            [(230, 660), (288, 660), (288, 742), (230, 742)],
            [(352, 660), (410, 660), (410, 742), (352, 742)],
        ],
        eyes=[(277, 178, 296, 190), (322, 177, 340, 190)],
        closed_eyes=True,
    ),
    "male-v1:motion:walk-a": _cfg(
        matte=[(181, 63), (459, 63), (459, 861), (181, 861)],
        hair=[(195, 45), (445, 45), (445, 285), (195, 285)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(195, 350), (248, 350), (260, 430), (210, 430)],
            [(405, 365), (450, 365), (460, 510), (420, 510)],
            [(215, 650), (285, 650), (285, 730), (215, 730)],
            [(350, 670), (420, 670), (420, 755), (350, 755)],
        ],
        eyes=[(300, 168, 314, 193), (340, 168, 354, 192)],
    ),
    "female-f2-v1:motion:walk-a": _cfg(
        matte=[(162, 63), (477, 63), (477, 861), (162, 861)],
        hair=[(180, 42), (485, 42), (485, 430), (180, 430)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(185, 350), (240, 350), (255, 435), (200, 435)],
            [(405, 365), (455, 365), (468, 515), (420, 515)],
            [(215, 650), (292, 650), (292, 745), (215, 745)],
            [(350, 665), (425, 665), (425, 755), (350, 755)],
        ],
        eyes=[(281, 177, 294, 201), (324, 177, 339, 201)],
    ),
    "male-v1:motion:walk-b": _cfg(
        matte=[(149, 63), (491, 63), (491, 861), (149, 861)],
        hair=[(195, 45), (445, 45), (445, 285), (195, 285)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(185, 365), (235, 365), (220, 515), (170, 515)],
            [(392, 350), (447, 350), (440, 435), (385, 435)],
            [(215, 665), (292, 665), (292, 755), (215, 755)],
            [(350, 650), (425, 650), (425, 740), (350, 740)],
        ],
        eyes=[(304, 175, 319, 201), (348, 175, 361, 200)],
    ),
    "female-f2-v1:motion:walk-b": _cfg(
        matte=[(164, 63), (475, 63), (475, 861), (164, 861)],
        hair=[(175, 42), (485, 42), (485, 430), (175, 430)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(180, 365), (235, 365), (220, 515), (170, 515)],
            [(392, 350), (452, 350), (440, 440), (385, 440)],
            [(215, 665), (292, 665), (292, 755), (215, 755)],
            [(350, 650), (425, 650), (425, 740), (350, 740)],
        ],
        eyes=[(311, 171, 325, 196), (354, 171, 367, 196)],
    ),
    "male-v1:room:bench-rest": _cfg(
        matte=[(103, 69), (536, 69), (536, 861), (103, 861)],
        hair=[(195, 50), (445, 50), (445, 285), (195, 285)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(190, 385), (285, 385), (285, 535), (190, 535)],
            [(355, 385), (450, 385), (450, 535), (355, 535)],
            [(190, 635), (280, 635), (280, 735), (190, 735)],
            [(350, 635), (430, 635), (430, 735), (350, 735)],
        ],
        eyes=[(361, 180, 376, 206)],
    ),
    "female-f2-v1:room:bench-rest": _cfg(
        matte=[(109, 69), (531, 69), (531, 861), (109, 861)],
        hair=[(180, 45), (485, 45), (485, 425), (180, 425)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(190, 385), (285, 385), (285, 535), (190, 535)],
            [(355, 385), (450, 385), (450, 535), (355, 535)],
            [(190, 635), (280, 635), (280, 735), (190, 735)],
            [(350, 635), (430, 635), (430, 735), (350, 735)],
        ],
        eyes=[(339, 188, 354, 214), (382, 186, 400, 215)],
    ),
    "male-v1:room:bench-read-a": _cfg(
        matte=[(102, 69), (537, 69), (537, 861), (102, 861)],
        hair=[(195, 50), (445, 50), (445, 285), (195, 285)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(254, 368), (286, 368), (289, 385), (277, 389), (255, 384)],
            [(261, 383), (296, 383), (298, 399), (286, 402), (262, 398)],
            [(266, 397), (291, 397), (293, 411), (282, 414), (268, 410)],
            [(272, 407), (292, 407), (292, 420), (283, 422), (274, 418)],
            [(370, 365), (412, 365), (418, 382), (405, 386), (370, 382)],
            [(368, 380), (415, 380), (420, 399), (405, 402), (368, 397)],
            [(370, 396), (417, 396), (418, 414), (402, 417), (371, 411)],
            [(375, 409), (412, 409), (412, 425), (395, 428), (376, 421)],
            [(190, 635), (280, 635), (280, 735), (190, 735)],
            [(350, 635), (430, 635), (430, 735), (350, 735)],
        ],
        eyes=[(352, 198, 367, 221)],
        prop_excludes=[
            [(192, 304), (307, 333), (337, 359), (336, 452), (275, 457), (236, 423), (213, 375)],
            [(294, 333), (419, 317), (431, 429), (347, 458), (306, 447)],
        ],
    ),
    "female-f2-v1:room:bench-read-a": _cfg(
        matte=[(106, 69), (533, 69), (533, 861), (106, 861)],
        hair=[(180, 45), (485, 45), (485, 425), (180, 425)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(239, 382), (273, 382), (276, 399), (263, 402), (240, 397)],
            [(246, 396), (279, 396), (281, 413), (267, 416), (247, 411)],
            [(251, 409), (276, 409), (278, 424), (266, 427), (253, 422)],
            [(257, 419), (274, 419), (275, 430), (267, 433), (259, 429)],
            [(365, 378), (408, 378), (414, 395), (402, 399), (365, 394)],
            [(362, 393), (412, 393), (416, 411), (401, 414), (363, 409)],
            [(364, 408), (413, 408), (414, 425), (398, 428), (365, 423)],
            [(369, 421), (409, 421), (408, 437), (391, 440), (370, 433)],
            [(190, 635), (280, 635), (280, 735), (190, 735)],
            [(350, 635), (430, 635), (430, 735), (350, 735)],
        ],
        eyes=[(340, 201, 356, 224), (382, 196, 400, 224)],
        prop_excludes=[
            [(191, 320), (309, 346), (338, 373), (336, 457), (272, 461), (233, 430), (210, 382)],
            [(292, 346), (421, 331), (432, 439), (344, 465), (304, 454)],
        ],
    ),
    "male-v1:room:bench-read-b": _cfg(
        matte=[(102, 69), (537, 69), (537, 861), (102, 861)],
        hair=[(195, 50), (445, 50), (445, 285), (195, 285)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(224, 278), (274, 278), (283, 292), (279, 312), (224, 307)],
            [(220, 294), (281, 294), (286, 312), (278, 325), (221, 319)],
            [(220, 310), (281, 310), (283, 329), (270, 339), (222, 333)],
            [(224, 326), (275, 326), (276, 343), (260, 349), (228, 340)],
            [(370, 365), (412, 365), (418, 382), (405, 386), (370, 382)],
            [(368, 380), (415, 380), (420, 399), (405, 402), (368, 397)],
            [(370, 396), (417, 396), (418, 414), (402, 417), (371, 411)],
            [(375, 409), (412, 409), (412, 425), (395, 428), (376, 421)],
            [(190, 635), (280, 635), (280, 735), (190, 735)],
            [(350, 635), (430, 635), (430, 735), (350, 735)],
        ],
        eyes=[(350, 208, 370, 221)],
        closed_eyes=True,
        prop_excludes=[
            [(185, 328), (309, 332), (338, 359), (336, 453), (270, 457), (224, 430), (184, 386)],
            [(294, 333), (419, 317), (431, 429), (347, 458), (306, 447)],
        ],
    ),
    "female-f2-v1:room:bench-read-b": _cfg(
        matte=[(109, 69), (530, 69), (530, 861), (109, 861)],
        hair=[(180, 45), (485, 45), (485, 425), (180, 425)],
        skin=[
            [(250, 135), (395, 135), (395, 275), (250, 275)],
            [(210, 311), (255, 311), (264, 326), (253, 331), (210, 326)],
            [(207, 325), (260, 325), (265, 342), (251, 346), (208, 340)],
            [(209, 339), (262, 339), (265, 356), (249, 360), (211, 354)],
            [(214, 352), (259, 352), (261, 369), (244, 373), (216, 366)],
            [(350, 312), (395, 312), (402, 328), (390, 332), (350, 327)],
            [(347, 326), (400, 326), (405, 344), (390, 347), (348, 342)],
            [(349, 341), (402, 341), (403, 358), (387, 361), (350, 356)],
            [(354, 354), (399, 354), (398, 371), (381, 374), (355, 367)],
            [(190, 635), (280, 635), (280, 735), (190, 735)],
            [(350, 635), (430, 635), (430, 735), (350, 735)],
        ],
        eyes=[(339, 205, 355, 229), (381, 201, 400, 225)],
        prop_excludes=[
            [(186, 263), (314, 300), (340, 333), (337, 417), (267, 420), (224, 392), (197, 337)],
            [(291, 296), (424, 266), (440, 385), (347, 421), (303, 409)],
        ],
    ),
    "male-v1:room:bench-portal-reach": _cfg(
        matte=[(29, 76), (630, 76), (630, 861), (29, 861)],
        hair=[(195, 55), (445, 55), (445, 290), (195, 290)],
        skin=[
            [(250, 140), (395, 140), (395, 280), (250, 280)],
            [(185, 390), (285, 390), (285, 530), (185, 530)],
            [(395, 275), (535, 275), (535, 390), (395, 390)],
            [(515, 215), (630, 215), (630, 340), (515, 340)],
            [(190, 635), (280, 635), (280, 735), (190, 735)],
            [(350, 635), (430, 635), (430, 735), (350, 735)],
        ],
        eyes=[(299, 183, 314, 208), (344, 178, 358, 204)],
    ),
    "female-f2-v1:room:bench-portal-reach": _cfg(
        matte=[(69, 176), (571, 176), (571, 861), (69, 861)],
        hair=[(190, 165), (470, 165), (470, 410), (190, 410)],
        skin=[
            [(250, 235), (395, 235), (395, 375), (250, 375)],
            [(205, 450), (300, 450), (300, 565), (205, 565)],
            [(390, 350), (505, 350), (505, 465), (390, 465)],
            [(485, 285), (575, 285), (575, 405), (485, 405)],
            [(190, 635), (280, 635), (280, 735), (190, 735)],
            [(350, 635), (430, 635), (430, 735), (350, 735)],
        ],
        eyes=[(308, 275, 321, 297), (347, 271, 359, 293)],
    ),
}


TARGET_IDS = frozenset(FRAME_CONFIGS)


def rgb_to_hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    normalized = rgb.astype(np.float32) / 255.0
    maximum = normalized.max(axis=2)
    minimum = normalized.min(axis=2)
    delta = maximum - minimum
    hue = np.zeros_like(maximum)
    nonzero = delta > 1e-6
    red, green, blue = normalized[..., 0], normalized[..., 1], normalized[..., 2]
    selected = nonzero & (maximum == red)
    hue[selected] = ((green[selected] - blue[selected]) / delta[selected]) % 6
    selected = nonzero & (maximum == green)
    hue[selected] = ((blue[selected] - red[selected]) / delta[selected]) + 2
    selected = nonzero & (maximum == blue)
    hue[selected] = ((red[selected] - green[selected]) / delta[selected]) + 4
    hue /= 6.0
    saturation = np.where(maximum > 1e-6, delta / np.maximum(maximum, 1e-6), 0)
    return hue, saturation, maximum


def polygons(size: tuple[int, int], values: Iterable[Iterable[tuple[int, int]]]) -> np.ndarray:
    image = Image.new("L", size, 0)
    draw = ImageDraw.Draw(image)
    for points in values:
        draw.polygon(list(points), fill=255)
    return np.asarray(image, dtype=np.uint8) > 0


def rectangles(size: tuple[int, int], values: Iterable[tuple[int, int, int, int]]) -> np.ndarray:
    image = Image.new("L", size, 0)
    draw = ImageDraw.Draw(image)
    for box in values:
        draw.rectangle(box, fill=255)
    return np.asarray(image, dtype=np.uint8) > 0


def keep_components_touching(mask: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    """Keep original candidate pixels belonging to an 8-connected seeded component."""

    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for y, x in zip(*np.where(mask & seeds)):
        visited[y, x] = True
        queue.append((int(y), int(x)))
    while queue:
        y, x = queue.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not (dx or dy):
                    continue
                ny, nx = y + dy, x + dx
                if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((ny, nx))
    return visited


def author(base: Image.Image, config: dict[str, object]) -> tuple[Image.Image, Image.Image]:
    rgba = np.asarray(base.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]
    hue, saturation, value = rgb_to_hsv(rgb)
    red = rgb[..., 0].astype(np.float32)
    green = rgb[..., 1].astype(np.float32)
    blue = rgb[..., 2].astype(np.float32)
    size = base.size
    # Matte ownership includes every non-zero antialiased edge pixel.  The
    # generated motion/room plates contain alpha values down to one, so using
    # a visual-opacity threshold here would silently trim the silhouette.
    visible = alpha > 0

    matte_owner = polygons(size, config["matte_polygons"])
    prop = polygons(size, config.get("prop_exclude_polygons", ()))
    matte_membership = visible & matte_owner & ~prop

    skin_owner = polygons(size, config["skin_polygons"])
    skin = (
        visible
        & skin_owner
        & (hue >= 0.045)
        & (hue <= 0.098)
        & (saturation >= 0.37)
        & (saturation <= 0.72)
        & (value >= 0.52)
        & (red >= green * 1.13)
        & (green >= blue * 1.18)
    )
    # Visible skin painted over a held prop is actor-owned and must survive the
    # prop subtraction.  Nothing else is restored inside the prop polygons.
    matte_membership |= skin

    hair_owner = polygons(size, config["hair_polygons"])
    hair_candidates = (
        visible
        & hair_owner
        & matte_membership
        & (hue >= 0.055)
        & (hue <= 0.16)
        & (saturation >= 0.25)
        & (value >= 0.055)
        & (value <= 0.62)
        & (red >= green * 1.02)
        & (green >= blue * 1.02)
    )

    # Hair ownership is geometric, not chromatic. Gloves, belts and leather
    # props use the same brown paper, so only components rooted in the inner
    # crown may grow into locks or the F2 ponytail. Edge-raised hands are never
    # hair seeds. Brows are admitted separately around the exact eye boxes.
    ys, xs = np.where(hair_owner)
    hair_seeds = np.zeros_like(visible)
    if xs.size:
        left, right = int(xs.min()), int(xs.max()) + 1
        top, bottom = int(ys.min()), int(ys.max()) + 1
        inset = max(6, int((right - left) * 0.15))
        seed_bottom = min(bottom, top + max(24, int((bottom - top) * 0.48)))
        hair_seeds[top:seed_bottom, left + inset:right - inset] = True
    hair = keep_components_touching(hair_candidates, hair_seeds)
    brow_owner = np.zeros_like(visible)
    for left, top, right, _bottom in config["eye_boxes"]:
        brow_owner[max(0, top - 18):top + 3, max(0, left - 6):min(size[0], right + 6)] = True
    hair |= hair_candidates & brow_owner

    eyes = np.zeros_like(visible)
    closed = bool(config.get("closed_eyes"))
    for box in (() if closed else config["eye_boxes"]):
        owner = rectangles(size, [box])
        eyes |= (
            visible
            & owner
            & matte_membership
            & (value <= 0.34)
            & (saturation <= 0.92)
        )

    hair &= ~eyes
    skin &= ~(hair | eyes)
    packed = np.zeros_like(rgb)
    packed[..., 0] = np.where(skin, alpha, 0).astype(np.uint8)
    packed[..., 1] = np.where(hair, alpha, 0).astype(np.uint8)
    packed[..., 2] = np.where(eyes, alpha, 0).astype(np.uint8)
    matte = np.where(matte_membership, alpha, 0).astype(np.uint8)
    if np.any(packed.astype(np.uint16).sum(axis=2) > 255):
        raise ValueError("packed semantic channels overlap")
    if np.any(packed.max(axis=2) > matte):
        raise ValueError("semantic annotation escapes Traveller matte")
    return Image.fromarray(packed, "RGB"), Image.fromarray(matte, "L")


def write_png(path: Path, image: Image.Image, *, overwrite_owned: bool) -> None:
    if path.exists() and not overwrite_owned:
        raise FileExistsError(f"refusing to overwrite authored target: {path.relative_to(ROOT)}")
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def checkerboard(size: tuple[int, int], cell: int = 24) -> Image.Image:
    width, height = size
    yy, xx = np.indices((height, width))
    selected = ((xx // cell) + (yy // cell)) % 2
    values = np.where(selected, 226, 244).astype(np.uint8)
    rgb = np.repeat(values[..., None], 3, axis=2)
    return Image.fromarray(rgb, "RGB").convert("RGBA")


def preview_panel(base: Image.Image, mask: Image.Image, matte: Image.Image) -> list[Image.Image]:
    base = base.convert("RGBA")
    mask_data = np.asarray(mask.convert("RGB"), dtype=np.uint8)
    matte_data = np.asarray(matte.convert("L"), dtype=np.uint8)
    base_data = np.asarray(base, dtype=np.uint8).copy()
    base_data[..., 3] = np.minimum(base_data[..., 3], matte_data)
    cutout = checkerboard(base.size)
    cutout.alpha_composite(Image.fromarray(base_data, "RGBA"))
    panels = [checkerboard(base.size), cutout]
    panels[0].alpha_composite(base)
    colours = ((255, 70, 70), (60, 235, 105), (65, 130, 255))
    for channel, colour in enumerate(colours):
        panel = checkerboard(base.size)
        panel.alpha_composite(base)
        overlay = np.zeros((*matte_data.shape, 4), dtype=np.uint8)
        overlay[..., :3] = colour
        overlay[..., 3] = np.rint(mask_data[..., channel].astype(np.float32) * 0.76).astype(np.uint8)
        panel.alpha_composite(Image.fromarray(overlay, "RGBA"))
        panels.append(panel)
    return panels


def write_contact_sheet(
    variant: str,
    assets: Sequence[dict[str, object]],
    results: dict[str, Validation],
) -> Path:
    panel_width, panel_height = 128, 180
    label_height = 32
    columns = 5
    sheet = Image.new("RGB", (panel_width * columns, (panel_height + label_height) * len(assets)), (20, 22, 27))
    draw = ImageDraw.Draw(sheet)
    for row, asset in enumerate(assets):
        base_path = public_asset_path(ROOT.parents[1], asset["baseRoute"])
        mask_path = safe_relative(ROOT, asset["maskFile"])
        matte_path = safe_relative(ROOT, asset["matteFile"])
        with Image.open(base_path) as opened:
            base = opened.convert("RGBA")
        with Image.open(mask_path) as opened:
            mask = opened.convert("RGB")
        with Image.open(matte_path) as opened:
            matte = opened.convert("L")
        for column, panel in enumerate(preview_panel(base, mask, matte)):
            panel.thumbnail((panel_width, panel_height), Image.Resampling.LANCZOS)
            x = column * panel_width + (panel_width - panel.width) // 2
            y = row * (panel_height + label_height)
            sheet.paste(panel.convert("RGB"), (x, y))
        result = results[str(asset["id"])]
        state = "PASS" if result.passed else "FAIL"
        draw.text((5, row * (panel_height + label_height) + panel_height + 2), f"{state}  {asset['capability']}/{asset['frame']}", fill=(220, 245, 230) if result.passed else (255, 120, 120))
    draw.text((5, 4), "base", fill="white")
    draw.text((panel_width + 5, 4), "Traveller matte", fill="white")
    draw.text((panel_width * 2 + 5, 4), "skin / R", fill="white")
    draw.text((panel_width * 3 + 5, 4), "hair / G", fill="white")
    draw.text((panel_width * 4 + 5, 4), "eyes / B", fill="white")
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    output = PREVIEW_ROOT / f"{variant}-core-motion-room-contact-sheet.png"
    sheet.save(output, "PNG", optimize=True)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="write the exact 22-frame batch and review sheets")
    parser.add_argument("--overwrite-owned", action="store_true", help="replace only the 22 files owned by this authoring batch")
    args = parser.parse_args()

    inventory = load_inventory()
    scoped = [
        asset for asset in inventory["assets"]
        if asset["capability"] in CAPABILITIES
    ]
    if len(scoped) != 22 or len(TARGET_IDS) != 22:
        raise SystemExit("core/motion/room inventory or target count drifted")
    by_id = {str(asset["id"]): asset for asset in scoped}
    if set(by_id) != TARGET_IDS:
        raise SystemExit("authoring batch does not match exact 22-frame scope")

    authored: list[tuple[dict[str, object], Image.Image, Image.Image]] = []
    for asset_id in sorted(TARGET_IDS):
        asset = by_id[asset_id]
        base_path = public_asset_path(ROOT.parents[1], asset["baseRoute"])
        with Image.open(base_path) as opened:
            opened.load()
            semantic, matte = author(opened.convert("RGBA"), FRAME_CONFIGS[asset_id])
        authored.append((asset, semantic, matte))
    print(f"preflight: PASS ({len(authored)} masks + {len(authored)} mattes; exactScope=22)")
    if not args.write:
        print("factoryWrites: false; publicArtWrites: false")
        return

    for asset, semantic, matte in authored:
        write_png(safe_relative(ROOT, asset["maskFile"]), semantic, overwrite_owned=args.overwrite_owned)
        write_png(safe_relative(ROOT, asset["matteFile"]), matte, overwrite_owned=args.overwrite_owned)

    measured = [validate_semantic_mask(asset) for asset in scoped]
    validation = validate_mask_set(scoped, results=measured)
    result_map = {str(result.facts["asset"]): result for result in measured}
    sheets = []
    for variant in ("male-v1", "female-f2-v1"):
        ordered = [asset for asset in scoped if asset["variant"] == variant]
        sheets.append(write_contact_sheet(variant, ordered, result_map))
    print(f"validation: {'PASS' if validation.passed else 'FAIL'} ({validation.facts['passed']}/{validation.facts['required']})")
    for result in measured:
        facts = result.facts
        channels = facts.get("channelPixels", {})
        print(
            f"{result.facts.get('asset')}: {'PASS' if result.passed else 'FAIL'} "
            f"traveller={facts.get('travellerPixels')} semantic={facts.get('semanticPixels')} channels={channels}"
        )
        for error in result.errors:
            print(f"  ERROR: {error}")
    for sheet in sheets:
        print(f"preview: {sheet.relative_to(ROOT)}")
    if not validation.passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
