#!/usr/bin/env python3
"""Author the full Mister P / Resources semantic-mask family.

This production helper deliberately writes only factory-local RGB masks and
Traveller mattes.  Runtime publication remains owned by the separate 92/92
promotion gate.  All 24 Resources frames are authored from their immutable
pair bases: no earlier approval output is trusted as an input.  Explicit
per-frame eye owners and scene ownership cuts keep guardian, props and held
objects out of both the semantic channels and the Traveller matte.
"""

from __future__ import annotations

import argparse
from collections import deque
from copy import deepcopy
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from semantic_masks import (
    REPO_ROOT,
    ROOT,
    load_inventory,
    public_asset_path,
    safe_relative,
    validate_mask_set,
)
from build_review import build_review


CAPABILITY = "resources-penguin"


# Two deliberately tight owners per frame.  The pair art is an atomic raster,
# so generic "two largest dark components near the face" is unsafe: a hair
# lock, ear shadow, or scarf fold is often larger than the second eye.  These
# boxes are factory annotations, not runtime coordinates.
EYE_BOXES: dict[str, tuple[tuple[int, int, int, int], tuple[int, int, int, int]]] = {
    "male-v1:resources-penguin:greet-contact": ((930, 683, 962, 731), (986, 668, 1023, 718)),
    "female-f2-v1:resources-penguin:greet-contact": ((956, 691, 989, 744), (1022, 673, 1062, 728)),
    "male-v1:resources-penguin:budget-point": ((909, 664, 945, 714), (974, 647, 1015, 700)),
    "female-f2-v1:resources-penguin:budget-point": ((906, 634, 947, 688), (981, 612, 1026, 670)),
    "male-v1:resources-penguin:budget-reserve": ((910, 667, 946, 715), (975, 650, 1016, 703)),
    "female-f2-v1:resources-penguin:budget-reserve": ((893, 676, 937, 735), (968, 653, 1017, 715)),
    "male-v1:resources-penguin:count-pass": ((942, 690, 974, 748), (989, 712, 1027, 763)),
    "female-f2-v1:resources-penguin:count-pass": ((920, 747, 956, 798), (982, 733, 1024, 788)),
    "male-v1:resources-penguin:count-place": ((937, 718, 968, 766), (983, 728, 1022, 778)),
    "female-f2-v1:resources-penguin:count-place": ((917, 752, 952, 802), (978, 739, 1020, 792)),
    "male-v1:resources-penguin:count-stack": ((907, 788, 943, 831), (958, 777, 1000, 822)),
    "female-f2-v1:resources-penguin:count-stack": ((931, 785, 968, 835), (992, 773, 1035, 825)),
    "male-v1:resources-penguin:reserve-offer": ((959, 672, 993, 720), (1014, 655, 1054, 706)),
    "female-f2-v1:resources-penguin:reserve-offer": ((986, 699, 1024, 754), (1063, 681, 1108, 741)),
    "male-v1:resources-penguin:reserve-accept": ((957, 684, 993, 732), (1013, 666, 1054, 716)),
    "female-f2-v1:resources-penguin:reserve-accept": ((990, 703, 1029, 758), (1069, 685, 1115, 744)),
    "male-v1:resources-penguin:focus-work": ((1015, 688, 1066, 796), (1078, 730, 1121, 784)),
    "female-f2-v1:resources-penguin:focus-work": ((987, 740, 1026, 800), (1062, 729, 1106, 792)),
    "male-v1:resources-penguin:focus-check": ((1020, 758, 1057, 807), (1083, 743, 1126, 795)),
    "female-f2-v1:resources-penguin:focus-check": ((958, 768, 998, 826), (1034, 758, 1078, 818)),
    "male-v1:resources-penguin:focus-nod": ((1048, 725, 1078, 775), (1110, 718, 1146, 770)),
    "female-f2-v1:resources-penguin:focus-nod": ((974, 753, 1015, 812), (1052, 742, 1097, 804)),
    "male-v1:resources-penguin:close-stamp": ((908, 701, 945, 752), (974, 685, 1017, 739)),
    "female-f2-v1:resources-penguin:close-stamp": ((867, 703, 916, 768), (951, 685, 1006, 753)),
}


# The male pack uses a warmer, more saturated chestnut paper in these nine
# poses than in the core identity plate.  The generic hair predicate therefore
# sees only the darkest fibres.  These reviewed boxes sit entirely above the
# face and contain hair only (no scarf, coat, prop or guardian), so they can
# admit the second authored chestnut range without widening any scene-level
# classifier.
MALE_HAIR_COMPLETION_BOXES: dict[str, tuple[int, int, int, int]] = {
    "budget-reserve": (791, 379, 1178, 511),
    "count-pass": (890, 480, 1152, 551),
    "count-place": (859, 489, 1174, 579),
    "count-stack": (814, 527, 1143, 638),
    "reserve-accept": (874, 427, 1200, 527),
    "focus-work": (937, 465, 1257, 549),
    "focus-check": (899, 476, 1276, 604),
    "focus-nod": (942, 457, 1328, 579),
    "close-stamp": (791, 415, 1176, 546),
}


# These exact atomic scenes contain real exposed skin inside a conservative
# prop-exclusion region.  The overlap was reviewed at native resolution: every
# qualifying skin pixel belongs to the Traveller, while the red bag, coins,
# book, table and Penguin glove fail the existing broad-skin predicate.  Keep
# the exception per authored frame instead of weakening prop ownership for the
# whole family.
REVIEWED_SKIN_PROP_OVERLAP: frozenset[tuple[str, str]] = frozenset(
    {
        (variant, frame)
        for variant in ("male-v1", "female-f2-v1")
        for frame in (
            "greet-contact",
            "count-pass",
            "count-place",
            "count-stack",
            "reserve-offer",
            "reserve-accept",
            "close-stamp",
        )
    }
)


# Only exposed skin is eligible outside the face.  These owners deliberately
# avoid the pale paper sleeves; the same HSV range would otherwise recolour
# their warm shadows.  Coordinates cover gloved fingertips and exposed calves
# but semantic pixels are still constrained by the skin chroma predicate.
SKIN_APPENDAGE_OWNERS: dict[str, tuple[tuple[int, int, int, int], ...]] = {
    "greet-contact": ((735, 965, 925, 1085), (1100, 1090, 1260, 1255), (820, 1190, 1045, 1355), (1240, 1250, 1410, 1425)),
    "budget-point": ((715, 950, 875, 1130), (1065, 1080, 1245, 1260), (880, 1120, 1055, 1335), (1200, 1120, 1410, 1365)),
    "budget-reserve": ((715, 950, 875, 1130), (1065, 1080, 1245, 1260), (880, 1120, 1055, 1335), (1200, 1120, 1410, 1365)),
    "count-pass": ((665, 1040, 1010, 1165), (1090, 1115, 1260, 1285), (850, 1150, 1060, 1395), (1220, 1180, 1415, 1425)),
    "count-place": ((650, 1050, 1010, 1215), (1080, 1115, 1260, 1290), (850, 1160, 1060, 1400), (1220, 1180, 1415, 1425)),
    "count-stack": ((650, 1115, 865, 1315), (1080, 1115, 1260, 1295), (850, 1160, 1060, 1410), (1220, 1180, 1415, 1435)),
    "reserve-offer": ((700, 1005, 1110, 1160), (850, 1120, 1060, 1390), (1210, 1160, 1415, 1425)),
    "reserve-accept": ((700, 1000, 1110, 1160), (850, 1120, 1060, 1390), (1210, 1160, 1415, 1425)),
    "focus-work": ((790, 1070, 1010, 1225), (1060, 1170, 1270, 1345), (900, 1180, 1080, 1430), (1260, 1190, 1460, 1460)),
    "focus-check": ((790, 1080, 1010, 1235), (1060, 1170, 1270, 1345), (900, 1180, 1080, 1430), (1260, 1190, 1460, 1460)),
    "focus-nod": ((790, 1080, 1010, 1235), (1060, 1170, 1270, 1345), (900, 1180, 1080, 1430), (1260, 1190, 1460, 1460)),
    "close-stamp": ((650, 1090, 930, 1245), (1020, 1110, 1235, 1300), (850, 1160, 1070, 1435), (1210, 1170, 1420, 1460)),
}


# Pixel-level exposed-skin owners.  Paper sleeves, the Penguin's white gloves,
# warm book pages and gold coins all overlap the broad skin HSV range, so the
# final skin channel is never inferred from a whole arm/prop rectangle.  The
# face remains discovered dynamically; these boxes cover only reviewed
# fingertips, hands and exposed lower legs for the exact pose.
SKIN_PIXEL_OWNERS: dict[tuple[str, str], tuple[tuple[int, int, int, int], ...]] = {
    ("male-v1", "greet-contact"): ((730, 1015, 810, 1070), (1155, 1110, 1250, 1215), (905, 1245, 1010, 1365), (1285, 1325, 1360, 1410)),
    ("female-f2-v1", "greet-contact"): ((725, 1015, 810, 1070), (1155, 1145, 1245, 1245), (920, 1270, 1005, 1345), (1285, 1335, 1345, 1410)),
    ("male-v1", "budget-point"): ((725, 1045, 825, 1110), (1090, 1125, 1205, 1245), (940, 1150, 1045, 1280)),
    ("female-f2-v1", "budget-point"): ((730, 985, 855, 1095), (1055, 1065, 1145, 1145), (935, 1105, 1010, 1165)),
    ("male-v1", "budget-reserve"): ((725, 1055, 815, 1110), (1090, 1130, 1205, 1245), (945, 1160, 1045, 1280)),
    ("female-f2-v1", "budget-reserve"): ((730, 995, 880, 1110), (1065, 1135, 1170, 1255), (930, 1165, 1025, 1280)),
    ("male-v1", "count-pass"): ((690, 1055, 835, 1155), (1155, 1155, 1250, 1270)),
    ("female-f2-v1", "count-pass"): ((675, 1030, 815, 1145), (1125, 1165, 1220, 1270)),
    ("male-v1", "count-place"): ((795, 1105, 855, 1165), (1150, 1160, 1245, 1270)),
    ("female-f2-v1", "count-place"): ((745, 1135, 810, 1210), (1120, 1165, 1215, 1270)),
    ("male-v1", "count-stack"): ((810, 1215, 870, 1290), (1155, 1165, 1250, 1280)),
    ("female-f2-v1", "count-stack"): ((700, 1170, 875, 1320), (1120, 1170, 1210, 1280)),
    ("male-v1", "reserve-offer"): ((790, 1035, 985, 1145), (960, 985, 1120, 1090), (1315, 1325, 1370, 1380)),
    ("female-f2-v1", "reserve-offer"): ((790, 1040, 985, 1150), (940, 990, 1120, 1130)),
    ("male-v1", "reserve-accept"): ((780, 1060, 985, 1150), (940, 985, 1120, 1085), (1315, 1325, 1370, 1380)),
    ("female-f2-v1", "reserve-accept"): ((865, 1070, 995, 1165), (1000, 985, 1120, 1120)),
    ("male-v1", "focus-work"): ((840, 1130, 975, 1225), (1165, 1215, 1255, 1310)),
    ("female-f2-v1", "focus-work"): ((850, 1145, 930, 1230), (1135, 1235, 1210, 1310)),
    ("male-v1", "focus-check"): ((835, 1135, 975, 1230), (1165, 1215, 1255, 1310)),
    ("female-f2-v1", "focus-check"): ((850, 1150, 935, 1235), (1135, 1235, 1210, 1310)),
    ("male-v1", "focus-nod"): ((835, 1135, 975, 1230), (1165, 1215, 1255, 1310)),
    ("female-f2-v1", "focus-nod"): ((850, 1150, 935, 1235), (1135, 1235, 1210, 1310)),
    ("male-v1", "close-stamp"): ((700, 1140, 875, 1240), (1090, 1160, 1210, 1280)),
    ("female-f2-v1", "close-stamp"): ((680, 1130, 830, 1250), (1035, 1170, 1145, 1290), (1150, 1095, 1240, 1170)),
}


# Props which share the skin palette are forbidden even inside an appendage
# owner.  The final RGB audit asserts a zero intersection with these regions.
SEMANTIC_PROP_FORBIDDEN: dict[str, tuple[tuple[int, int, int, int], ...]] = {
    "greet-contact": (),
    "budget-point": ((695, 1100, 925, 1455), (695, 1360, 1035, 1500)),
    "budget-reserve": ((695, 1100, 925, 1455), (695, 1360, 1035, 1500)),
    "count-pass": ((665, 900, 835, 1045), (595, 1300, 940, 1490)),
    "count-place": ((665, 1025, 825, 1150), (595, 1300, 940, 1490)),
    "count-stack": ((700, 1160, 830, 1340), (585, 1290, 950, 1495)),
    "reserve-offer": ((675, 875, 895, 1060),),
    "reserve-accept": ((675, 890, 892, 1080),),
    "focus-work": ((600, 980, 1050, 1295), (700, 1190, 1120, 1460), (1050, 1170, 1260, 1335)),
    "focus-check": ((600, 980, 1050, 1300), (700, 1190, 1120, 1460), (1050, 1170, 1260, 1335)),
    "focus-nod": ((600, 980, 1050, 1300), (700, 1190, 1120, 1460), (1050, 1170, 1260, 1335)),
    "close-stamp": ((695, 1090, 1050, 1455),),
}


# The final matte uses a reviewed scene cut, rather than the broad semantic
# search owner above.  Each polyline is the left edge of the safe right-hand
# actor region from top to bottom.  Hair, face contours and the interacting
# limb are restored separately, so this edge can stay conservative around the
# Penguin and the shared props.
MATTE_RIGHT_BOUNDARIES: dict[tuple[str, str], tuple[tuple[int, int], ...]] = {
    ("male-v1", "greet-contact"): ((800, 300), (800, 850), (835, 930), (835, 1100), (805, 1536)),
    ("female-f2-v1", "greet-contact"): ((805, 300), (805, 850), (845, 930), (845, 1100), (805, 1536)),
    ("male-v1", "budget-point"): ((790, 300), (790, 870), (900, 960), (930, 1100), (930, 1536)),
    ("female-f2-v1", "budget-point"): ((785, 300), (785, 820), (850, 900), (880, 1040), (850, 1536)),
    ("male-v1", "budget-reserve"): ((790, 300), (790, 870), (900, 960), (930, 1100), (930, 1536)),
    ("female-f2-v1", "budget-reserve"): ((785, 300), (785, 820), (850, 900), (880, 1040), (850, 1536)),
    ("male-v1", "count-pass"): ((805, 300), (805, 940), (850, 1120), (900, 1260), (900, 1536)),
    ("female-f2-v1", "count-pass"): ((820, 300), (820, 940), (860, 1120), (910, 1260), (910, 1536)),
    ("male-v1", "count-place"): ((805, 300), (805, 940), (850, 1130), (900, 1260), (900, 1536)),
    ("female-f2-v1", "count-place"): ((820, 300), (820, 940), (860, 1130), (910, 1260), (910, 1536)),
    ("male-v1", "count-stack"): ((805, 300), (805, 1000), (850, 1160), (900, 1300), (900, 1536)),
    ("female-f2-v1", "count-stack"): ((820, 300), (820, 1000), (870, 1160), (920, 1300), (920, 1536)),
    ("male-v1", "reserve-offer"): ((850, 300), (850, 910), (890, 1110), (860, 1536)),
    ("female-f2-v1", "reserve-offer"): ((855, 300), (855, 920), (900, 1130), (870, 1536)),
    ("male-v1", "reserve-accept"): ((850, 300), (850, 920), (890, 1110), (860, 1536)),
    ("female-f2-v1", "reserve-accept"): ((855, 300), (855, 930), (900, 1130), (870, 1536)),
    ("male-v1", "focus-work"): ((900, 300), (900, 1010), (950, 1210), (950, 1536)),
    ("female-f2-v1", "focus-work"): ((880, 300), (880, 1010), (940, 1210), (940, 1536)),
    ("male-v1", "focus-check"): ((900, 300), (900, 1010), (950, 1210), (950, 1536)),
    ("female-f2-v1", "focus-check"): ((880, 300), (880, 1010), (940, 1210), (940, 1536)),
    ("male-v1", "focus-nod"): ((900, 300), (900, 1010), (950, 1210), (950, 1536)),
    ("female-f2-v1", "focus-nod"): ((880, 300), (880, 1010), (940, 1210), (940, 1536)),
    ("male-v1", "close-stamp"): ((875, 300), (875, 1000), (930, 1190), (960, 1536)),
    ("female-f2-v1", "close-stamp"): ((850, 300), (850, 1000), (920, 1190), (950, 1536)),
}


# Tight interaction-limb owners.  They are deliberately applied before prop
# subtraction; only semantic skin is restored after a cut through a physical
# contact.  This prevents a whole book, laptop, money bag or tray from entering
# the Traveller matte merely because a hand touches it.
MATTE_LIMB_POLYGONS: dict[tuple[str, str], tuple[tuple[tuple[int, int], ...], ...]] = {
    ("male-v1", "greet-contact"): (((800, 875), (985, 920), (985, 985), (900, 1035), (825, 1080), (750, 1065), (730, 1005), (775, 950)),),
    ("female-f2-v1", "greet-contact"): (((790, 870), (1005, 915), (995, 985), (905, 1035), (820, 1080), (720, 1060), (705, 1000), (760, 945)),),
    ("male-v1", "budget-point"): (((820, 850), (1010, 900), (1000, 990), (910, 1045), (835, 1130), (720, 1120), (715, 1000), (775, 925)),),
    ("female-f2-v1", "budget-point"): (((750, 810), (980, 850), (980, 955), (900, 1005), (835, 1090), (735, 1080), (725, 920)),),
    ("male-v1", "budget-reserve"): (((820, 850), (1010, 900), (1000, 990), (910, 1045), (835, 1130), (720, 1120), (715, 1000), (775, 925)),),
    ("female-f2-v1", "budget-reserve"): (((750, 810), (980, 850), (980, 955), (900, 1005), (835, 1090), (735, 1080), (725, 920)),),
    ("male-v1", "count-pass"): (((850, 930), (1010, 980), (990, 1060), (900, 1110), (780, 1140), (680, 1125), (665, 1070), (735, 1020)),),
    ("female-f2-v1", "count-pass"): (((845, 930), (1020, 980), (995, 1070), (900, 1120), (770, 1150), (670, 1130), (655, 1070), (730, 1015)),),
    ("male-v1", "count-place"): (((850, 940), (1010, 990), (990, 1080), (900, 1130), (775, 1205), (660, 1190), (650, 1110), (725, 1040)),),
    ("female-f2-v1", "count-place"): (((845, 940), (1020, 990), (995, 1085), (900, 1140), (770, 1215), (650, 1200), (640, 1110), (720, 1040)),),
    ("male-v1", "count-stack"): (((850, 1000), (1010, 1040), (990, 1130), (900, 1180), (825, 1295), (690, 1300), (660, 1210), (730, 1120)),),
    ("female-f2-v1", "count-stack"): (((855, 1000), (1025, 1040), (1000, 1135), (910, 1190), (835, 1305), (690, 1310), (655, 1210), (730, 1120)),),
    ("male-v1", "reserve-offer"): (((900, 870), (1050, 930), (1040, 1050), (980, 1120), (835, 1130), (780, 1080), (790, 990)),),
    ("female-f2-v1", "reserve-offer"): (((900, 890), (1070, 950), (1050, 1070), (990, 1140), (835, 1140), (780, 1090), (790, 1000)),),
    ("male-v1", "reserve-accept"): (((900, 880), (1050, 940), (1040, 1060), (980, 1130), (830, 1140), (775, 1090), (790, 995)),),
    ("female-f2-v1", "reserve-accept"): (((900, 900), (1070, 960), (1050, 1080), (990, 1150), (835, 1150), (780, 1100), (790, 1010)),),
    ("male-v1", "focus-work"): (((920, 960), (1040, 1020), (1010, 1120), (960, 1190), (825, 1210), (785, 1160), (820, 1070)),),
    ("female-f2-v1", "focus-work"): (((900, 970), (1035, 1030), (1010, 1130), (960, 1200), (815, 1220), (775, 1160), (810, 1070)),),
    ("male-v1", "focus-check"): (((920, 970), (1040, 1030), (1010, 1130), (960, 1200), (825, 1220), (785, 1170), (820, 1080)),),
    ("female-f2-v1", "focus-check"): (((900, 980), (1035, 1040), (1010, 1140), (960, 1210), (815, 1230), (775, 1170), (810, 1080)),),
    ("male-v1", "focus-nod"): (((920, 970), (1040, 1030), (1010, 1130), (960, 1200), (825, 1220), (785, 1170), (820, 1080)),),
    ("female-f2-v1", "focus-nod"): (((900, 980), (1035, 1040), (1010, 1140), (960, 1210), (815, 1230), (775, 1170), (810, 1080)),),
    ("male-v1", "close-stamp"): (
        ((830, 940), (940, 980), (900, 1080), (860, 1120), (850, 1180), (820, 1210), (750, 1210), (680, 1180), (650, 1130), (720, 1070)),
        ((1150, 950), (1260, 1010), (1210, 1100), (1180, 1140), (1190, 1200), (1150, 1235), (1080, 1225), (1030, 1190), (1040, 1130), (1080, 1080)),
    ),
    ("female-f2-v1", "close-stamp"): (
        ((810, 940), (940, 980), (900, 1080), (860, 1120), (850, 1185), (815, 1215), (740, 1215), (670, 1180), (645, 1130), (710, 1070)),
        ((1140, 950), (1260, 1010), (1210, 1100), (1180, 1140), (1190, 1205), (1150, 1240), (1070, 1230), (1020, 1190), (1030, 1130), (1070, 1080)),
    ),
}


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


def polygon(size: tuple[int, int], points: list[tuple[int, int]]) -> np.ndarray:
    image = Image.new("L", size, 0)
    ImageDraw.Draw(image).polygon(points, fill=255)
    return np.asarray(image, dtype=np.uint8) > 0


def rectangles(size: tuple[int, int], values: tuple[tuple[int, int, int, int], ...]) -> np.ndarray:
    result = np.zeros((size[1], size[0]), dtype=bool)
    for left, top, right, bottom in values:
        result[max(0, top):min(size[1], bottom), max(0, left):min(size[0], right)] = True
    return result


def right_of_boundary(size: tuple[int, int], boundary: tuple[tuple[int, int], ...]) -> np.ndarray:
    """Return the region to the right of a reviewed top-to-bottom cut."""

    if len(boundary) < 2:
        raise ValueError("matte boundary needs at least two points")
    points = list(boundary)
    points.extend(((size[0], boundary[-1][1]), (size[0], boundary[0][1])))
    return polygon(size, points)


def polygon_union(
    size: tuple[int, int],
    values: tuple[tuple[tuple[int, int], ...], ...],
) -> np.ndarray:
    result = np.zeros((size[1], size[0]), dtype=bool)
    for points in values:
        result |= polygon(size, list(points))
    return result


def male_hair_owner(
    size: tuple[int, int],
    face_left: int,
    face_top: int,
    face_right: int,
) -> np.ndarray:
    """Return the reviewed crown/fringe geometry without the scarf zone."""

    return polygon_union(
        size,
        (
            (
                (face_left - 210, face_top - 285),
                (face_right + 114, face_top - 285),
                (face_right + 114, face_top + 35),
                (face_left - 210, face_top + 35),
            ),
            (
                (face_left - 130, face_top - 85),
                (face_right + 50, face_top - 85),
                (face_right + 35, face_top + 120),
                (face_left - 100, face_top + 120),
            ),
            (
                (face_left - 190, face_top - 80),
                (face_left + 25, face_top - 80),
                (face_left + 25, face_top + 120),
                (face_left - 175, face_top + 120),
            ),
            (
                (face_right - 30, face_top - 90),
                (face_right + 114, face_top - 90),
                (face_right + 114, face_top + 85),
                (face_right - 30, face_top + 85),
            ),
        ),
    )


def exclusion_stroke(
    size: tuple[int, int],
    start: tuple[int, int],
    end: tuple[int, int],
    width: int,
) -> np.ndarray:
    image = Image.new("L", size, 0)
    ImageDraw.Draw(image).line((*start, *end), fill=255, width=width)
    return np.asarray(image, dtype=np.uint8) > 0


def dilate(mask: np.ndarray, size: int) -> np.ndarray:
    """Expand a boolean mask by an odd square kernel."""

    if size < 1 or size % 2 == 0:
        raise ValueError("dilation size must be a positive odd integer")
    return np.asarray(
        Image.fromarray(np.where(mask, 255, 0).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(size)),
        dtype=np.uint8,
    ) > 0


def actor_glove_restore(
    base: Image.Image,
    key: tuple[str, str],
    visible: np.ndarray,
    hue: np.ndarray,
    saturation: np.ndarray,
    value: np.ndarray,
    skin: np.ndarray,
) -> np.ndarray:
    """Recover only brown Traveller gloves linked to exposed actor skin.

    Props in this family deliberately touch the hands.  A broad brown box is
    therefore unsafe (it previously reopened the close-stamp table).  The
    retained component must be both inside the authored interaction limb and
    connected to an exposed Traveller skin seed through brown glove material.
    """

    limb_owner = polygon_union(base.size, MATTE_LIMB_POLYGONS[key])
    brown_core = (
        visible
        & limb_owner
        & (hue >= 0.060)
        & (hue <= 0.165)
        & (saturation >= 0.18)
        & (saturation <= 0.88)
        & (value >= 0.045)
        & (value <= 0.58)
    )
    # The paper-cut glove texture is separated by narrow black seams.  A
    # seven-pixel support bridges those seams while staying far smaller than
    # any shared prop face.
    support = dilate(brown_core, 7) & visible & limb_owner
    skin_seed = dilate(skin & limb_owner, 35)
    selected: list[np.ndarray] = []
    flattened_seed = skin_seed.reshape(-1)
    for item in components(support):
        if item.size >= 24 and np.any(flattened_seed[item]):
            selected.append(item)
    return component_mask(value.shape, selected)


def semantic_prop_exclusion(
    frame: str,
    variant: str,
    hue: np.ndarray,
    saturation: np.ndarray,
    value: np.ndarray,
) -> np.ndarray:
    """Return colour-qualified shared-object pixels inside reviewed regions."""

    rows, columns = np.indices(value.shape)
    near_white = (value >= 0.52) & (saturation <= 0.38)
    gold = (hue >= 0.065) & (hue <= 0.18) & (saturation >= 0.34) & (value >= 0.42)
    burgundy = ((hue <= 0.052) | (hue >= 0.975)) & (saturation >= 0.32) & (value >= 0.15)
    forbidden = np.zeros_like(value, dtype=bool)
    if frame == "greet-contact":
        forbidden |= (columns < 735) & (rows >= 980) & (rows <= 1080) & near_white
    elif frame.startswith("budget-"):
        forbidden |= (
            (columns >= 560)
            & (columns <= 950)
            & (rows >= 1020)
            & (rows <= 1260)
            & near_white
        )
        forbidden |= (columns < 1040) & (rows >= 1340) & gold
    elif frame.startswith("count-"):
        forbidden |= (
            (columns >= 600)
            & (columns <= 920)
            & (rows >= 930)
            & (rows <= 1380)
            & gold
        )
        guardian_limit = 700 if variant == "female-f2-v1" else 680
        forbidden |= (columns < guardian_limit) & (rows >= 920) & (rows <= 1140) & near_white
    elif frame.startswith("reserve-"):
        forbidden |= (
            (columns >= 670)
            & (columns <= 1030)
            & (rows >= 930)
            & (rows <= 1130)
            & (burgundy | gold)
        )
        guardian_limit = 850 if variant == "female-f2-v1" else 780
        forbidden |= (columns < guardian_limit) & (rows >= 930) & (rows <= 1140) & near_white
    elif frame.startswith("focus-"):
        forbidden |= (
            (columns >= 1030)
            & (columns <= 1280)
            & (rows >= 1140)
            & (rows <= 1360)
            & near_white
        )
    elif frame == "close-stamp":
        forbidden |= (columns < 1050) & (rows >= 1110) & (burgundy | gold)
    return forbidden


def final_traveller_matte(
    base: Image.Image,
    variant: str,
    asset_id: str,
    frame: str,
    visible: np.ndarray,
    hue: np.ndarray,
    saturation: np.ndarray,
    value: np.ndarray,
    skin: np.ndarray,
    hair: np.ndarray,
    eyes: np.ndarray,
    head_owner: np.ndarray,
) -> np.ndarray:
    """Build a conservative actor-only matte from reviewed scene ownership."""

    key = (variant, frame)
    if key not in MATTE_RIGHT_BOUNDARIES or key not in MATTE_LIMB_POLYGONS:
        raise ValueError(f"missing Resources matte annotation: {key}")
    owner = right_of_boundary(base.size, MATTE_RIGHT_BOUNDARIES[key])
    owner |= polygon_union(base.size, MATTE_LIMB_POLYGONS[key])

    # Restore the face/hair silhouette and goggles around the semantic core.
    # This is head-local: a hand touching a prop never expands into that prop.
    semantic = skin | hair | eyes
    head_seed = semantic & head_owner
    head_neighbourhood = np.asarray(
        Image.fromarray(np.where(head_seed, 255, 0).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(31)),
        dtype=np.uint8,
    ) > 0
    owner |= head_neighbourhood
    matte = visible & owner

    rows, columns = np.indices(value.shape)
    near_white = (value >= 0.58) & (saturation <= 0.34)
    # The Penguin's paper-white gloves retain medium-value grey texture in
    # their folds.  A strict "near white" predicate leaves those shadows in
    # the Traveller matte, so contact scenes use this broader, spatially
    # constrained material predicate instead.
    penguin_white = (value >= 0.36) & (saturation <= 0.48)
    gold = (hue >= 0.065) & (hue <= 0.18) & (saturation >= 0.34) & (value >= 0.42)
    burgundy = ((hue <= 0.058) | (hue >= 0.97)) & (saturation >= 0.30) & (value >= 0.15)
    teal = (hue >= 0.37) & (hue <= 0.57) & (saturation >= 0.18) & (value >= 0.08)
    glove_restore = actor_glove_restore(
        base,
        key,
        visible,
        hue,
        saturation,
        value,
        skin,
    )
    final_prop_cut = np.zeros_like(visible)

    if frame == "greet-contact":
        # The Penguin's white glove is physically tangent to the Traveller's
        # fingertips.  Remove its pale left-side pixels, then restore only the
        # reviewed actor semantic pixels at the contact.
        matte &= ~((columns < 850) & (rows >= 930) & (rows <= 1110) & penguin_white)
        matte &= ~((columns < 755) & (rows >= 930) & (rows <= 1110))
    elif frame.startswith("budget-"):
        paper = (
            (columns >= 560)
            & (columns <= 950)
            & (rows >= 1030)
            & (rows <= 1260)
            & (value >= 0.48)
            & (saturation <= 0.42)
        )
        matte &= ~paper
        matte &= ~((columns < 930) & (rows >= 1230))
        matte &= ~((columns < 1040) & (rows >= 1360))
        if variant == "female-f2-v1":
            final_prop_cut |= exclusion_stroke(base.size, (779, 865), (775, 1080), 31)
        else:
            final_prop_cut |= exclusion_stroke(base.size, (795, 935), (790, 1200), 31)
    elif frame.startswith("count-"):
        contact = (columns >= 620) & (columns <= 900) & (rows >= 880) & (rows <= 1360)
        matte &= ~(contact & gold)
        matte &= ~((columns < 900) & (rows >= 1290))
        guardian_limit = 700 if variant == "female-f2-v1" else 680
        matte &= ~((columns < guardian_limit) & (rows >= 900) & (rows <= 1140))
        matte &= ~((columns < 850) & (rows >= 860) & (rows <= 1140) & penguin_white)
        # Coins have a high-value gold core unlike the Traveller's brown
        # fingerless gloves.  Expand that core just enough to absorb their
        # dark engraved outline, then restore exposed skin after the cut.
        coin_core = (
            contact
            & (hue >= 0.065)
            & (hue <= 0.18)
            & (saturation >= 0.42)
            & (value >= 0.58)
        )
        final_prop_cut |= dilate(coin_core, 7) & contact
    elif frame.startswith("reserve-"):
        bag = (columns >= 740) & (columns <= 1100) & (rows >= 845) & (rows <= 1180)
        bag_red = (
            ((hue <= 0.070) | (hue >= 0.97))
            & (saturation >= 0.22)
            & (value >= 0.06)
        )
        matte &= ~(bag & (bag_red | gold))
        guardian_limit = 850 if variant == "female-f2-v1" else 780
        matte &= ~((columns < guardian_limit) & (rows >= 900) & (rows <= 1140))
        matte &= ~((columns < guardian_limit + 80) & (rows >= 900) & (rows <= 1150) & penguin_white)
        # The bag itself is red/gold.  Its black paper outline is only a few
        # pixels wide, so a tight dilation removes the complete prop without
        # reopening it through the brown-glove recovery pass below.
        final_prop_cut |= dilate(bag & (bag_red | gold), 7) & bag
    elif frame.startswith("focus-"):
        laptop = (columns >= 450) & (columns <= 970) & (rows >= 970) & (rows <= 1310)
        page = (columns >= 1040) & (columns <= 1280) & (rows >= 1140) & (rows <= 1360)
        matte &= ~(laptop & teal)
        matte &= ~(page & near_white)
        matte &= ~((columns < 950) & (rows >= 1240))
        # Include the gold/black paper rims around the teal laptop and pale
        # notebook.  Hands are recovered from actor-linked glove components;
        # the shared objects remain excluded.
        laptop_core = laptop & (teal | gold)
        page_core = page & (near_white | gold)
        final_prop_cut |= dilate(laptop_core, 31) & laptop
        final_prop_cut |= dilate(page_core, 25) & page
    elif frame == "close-stamp":
        table = (columns < 1050) & (rows >= 1120)
        matte &= ~(table & (burgundy | gold))
        # The foreground table touches the Traveller's resting left glove.
        # Fail closed below the tabletop edge, then restore only the reviewed
        # brown glove pixels in a hand-local owner.  The final semantic union
        # restores the exposed fingertips without reopening the table.
        matte &= ~((columns < 1050) & (rows >= 1140) & (rows <= 1300))
        matte &= ~((columns < 900) & (rows > 1300))
        # No rectangular brown-material restore here: the foreground table
        # shares that palette.  actor_glove_restore() is skin-seeded and keeps
        # the visible glove while leaving the table closed.

    # Fail closed around shared objects, but never discard an explicitly
    # authored semantic actor pixel.  The RGB audit below guarantees these
    # restored pixels do not belong to a guardian, prop or accessory.
    matte &= ~final_prop_cut
    # Actor-linked glove components are foreground ownership evidence.  Add
    # them after shared-object cuts so a nearby teal/gold/red dilation cannot
    # punch texture holes through the visible hand; the seed/material test
    # cannot select the Penguin's white gloves or the red/teal props.
    matte |= glove_restore | semantic
    return matte


def goggle_exclusion(
    size: tuple[int, int],
    visible: np.ndarray,
    hue: np.ndarray,
    saturation: np.ndarray,
    value: np.ndarray,
    head_owner: np.ndarray,
    face_top: int,
) -> np.ndarray:
    """Build an accessory-only owner from the two teal lens components."""

    lens_candidate = (
        visible
        & head_owner
        & (np.indices(value.shape)[0] <= face_top + 105)
        & (hue >= 0.35)
        & (hue <= 0.58)
        & (saturation >= 0.22)
        & (value >= 0.12)
        & (value <= 0.9)
    )
    connected_lens_candidate = np.asarray(
        Image.fromarray(np.where(lens_candidate, 255, 0).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(7)),
        dtype=np.uint8,
    ) > 0
    lenses = []
    for item in components(connected_lens_candidate):
        if item.size < 300:
            continue
        rows, _ = np.divmod(item, value.shape[1])
        if float(rows.mean()) > face_top + 55:
            continue
        lenses.append(item)
    if len(lenses) < 2:
        raise ValueError(f"expected two goggle lenses, found {len(lenses)}")
    lenses = sorted(lenses, key=lambda item: item.size, reverse=True)[:2]
    boxes: list[tuple[int, int, int, int]] = []
    centers: list[tuple[int, int]] = []
    drawing = Image.new("L", size, 0)
    draw = ImageDraw.Draw(drawing)
    for item in lenses:
        rows, columns = np.divmod(item, value.shape[1])
        left = int(columns.min()) - 24
        right = int(columns.max()) + 25
        top = int(rows.min()) - 24
        bottom = int(rows.max()) + 25
        boxes.append((left, top, right, bottom))
        centers.append(((left + right) // 2, (top + bottom) // 2))
        draw.ellipse((left, top, right, bottom), fill=255)
    centers.sort()
    (left_center_x, left_center_y), (right_center_x, right_center_y) = centers
    draw.line(
        (
            left_center_x - 58,
            left_center_y,
            right_center_x + 70,
            right_center_y,
        ),
        fill=255,
        width=19,
    )
    return np.asarray(drawing, dtype=np.uint8) > 0


def components(mask: np.ndarray) -> list[np.ndarray]:
    """Return exact 8-connected components for a sparse semantic candidate."""

    width = mask.shape[1]
    remaining = set(int(value) for value in np.flatnonzero(mask))
    result: list[np.ndarray] = []
    offsets = (-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1)
    while remaining:
        start = remaining.pop()
        queue: deque[int] = deque([start])
        current = [start]
        while queue:
            index = queue.popleft()
            row, column = divmod(index, width)
            for offset in offsets:
                candidate = index + offset
                if candidate not in remaining:
                    continue
                next_row, next_column = divmod(candidate, width)
                if abs(next_row - row) > 1 or abs(next_column - column) > 1:
                    continue
                remaining.remove(candidate)
                queue.append(candidate)
                current.append(candidate)
        result.append(np.asarray(current, dtype=np.int64))
    return result


def component_mask(shape: tuple[int, int], indices: list[np.ndarray]) -> np.ndarray:
    output = np.zeros(shape[0] * shape[1], dtype=bool)
    for values in indices:
        output[values] = True
    return output.reshape(shape)


def explicit_eyes(base: Image.Image, asset_id: str) -> np.ndarray:
    """Return exactly one dark connected component from each reviewed box."""

    boxes = EYE_BOXES.get(asset_id)
    if boxes is None:
        raise ValueError(f"missing explicit eye annotation: {asset_id}")
    rgba = np.asarray(base.convert("RGBA"), dtype=np.uint8)
    _, saturation, value = rgb_to_hsv(rgba[..., :3])
    visible = rgba[..., 3] > 12
    result = np.zeros(value.shape, dtype=bool)
    selected: list[np.ndarray] = []
    for left, top, right, bottom in boxes:
        owner = np.zeros(value.shape, dtype=bool)
        owner[max(0, top):min(value.shape[0], bottom), max(0, left):min(value.shape[1], right)] = True
        candidates = [
            item
            for item in components(visible & owner & (value <= 0.42) & (saturation <= 0.92))
            if item.size >= 80
        ]
        if not candidates:
            raise ValueError(f"{asset_id}: no eye component in reviewed box {(left, top, right, bottom)}")
        chosen = max(candidates, key=lambda item: item.size)
        selected.append(chosen)
        result |= component_mask(value.shape, [chosen])
    if np.any(component_mask(value.shape, [selected[0]]) & component_mask(value.shape, [selected[1]])):
        raise ValueError(f"{asset_id}: explicit eye owners overlap")
    return result


def replace_eye_channel(base: Image.Image, mask: Image.Image, asset_id: str) -> Image.Image:
    packed = np.asarray(mask.convert("RGB"), dtype=np.uint8).copy()
    alpha = np.asarray(base.convert("RGBA"), dtype=np.uint8)[..., 3]
    eyes = explicit_eyes(base, asset_id)
    packed[..., 2] = np.where(eyes, alpha, 0).astype(np.uint8)
    packed[..., 0] = np.where(eyes, 0, packed[..., 0]).astype(np.uint8)
    packed[..., 1] = np.where(eyes, 0, packed[..., 1]).astype(np.uint8)
    return Image.fromarray(packed, "RGB")


def traveller_owner(size: tuple[int, int], variant: str) -> np.ndarray:
    if variant == "female-f2-v1":
        points = [(760, 300), (1536, 300), (1536, 1536), (760, 1536), (695, 1360), (695, 1000), (740, 860), (760, 600)]
    else:
        points = [(760, 300), (1536, 300), (1536, 1536), (760, 1536), (700, 1360), (700, 1000), (745, 860), (760, 600)]
    return polygon(size, points)


def author(base: Image.Image, variant: str, asset_id: str, frame: str) -> tuple[Image.Image, Image.Image]:
    rgba = np.asarray(base.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]
    hue, saturation, value = rgb_to_hsv(rgb)
    red = rgb[..., 0].astype(np.float32)
    green = rgb[..., 1].astype(np.float32)
    blue = rgb[..., 2].astype(np.float32)
    visible = alpha > 12
    owner = traveller_owner(base.size, variant)
    matte_bool = visible & owner

    broad_skin = (
        matte_bool
        & (hue >= 0.045)
        & (hue <= 0.098)
        & (saturation >= 0.37)
        & (saturation <= 0.72)
        & (value >= 0.52)
        & (red >= green * 1.13)
        & (green >= blue * 1.18)
    )

    rows = np.indices(value.shape)[0]
    columns = np.indices(value.shape)[1]
    face_components = [item for item in components(broad_skin & (rows < 950)) if item.size >= 300]
    if not face_components:
        raise ValueError("face skin component not found")
    face = max(face_components, key=lambda item: item.size)
    face_rows, face_columns = np.divmod(face, value.shape[1])
    face_left = max(0, int(face_columns.min()) - 22)
    face_right = min(value.shape[1], int(face_columns.max()) + 23)
    face_top = max(0, int(face_rows.min()) - 18)
    face_bottom = min(value.shape[0], int(face_rows.max()) + 32)

    face_owner = np.zeros_like(visible)
    face_owner[face_top:face_bottom, face_left:face_right] = True
    skin_owner = rectangles(base.size, SKIN_PIXEL_OWNERS[(variant, frame)])
    semantic_prop_forbidden = semantic_prop_exclusion(frame, variant, hue, saturation, value)
    reviewed_skin_overlap = np.zeros_like(visible)
    if (variant, frame) in REVIEWED_SKIN_PROP_OVERLAP:
        reviewed_skin_overlap = broad_skin & skin_owner & semantic_prop_forbidden
    skin = (broad_skin & (face_owner | skin_owner) & ~semantic_prop_forbidden) | reviewed_skin_overlap

    if variant == "female-f2-v1":
        face_min_x = int(face_columns.min())
        face_max_x = int(face_columns.max())
        face_min_y = int(face_rows.min())
        face_max_y = int(face_rows.max())
        # Female hair has three authored masses: crown/bob, the narrow left
        # lock, and the long right ponytail.  A single enclosing rectangle
        # also contains the scarf, coat and gold sleeve trim, all of which
        # overlap the brown-hair HSV range.  The notched owner preserves the
        # full silhouette while excluding the central torso below the chin.
        head_owner = polygon_union(
            base.size,
            (
                (
                    (face_min_x - 185, face_min_y - 350),
                    (face_max_x + 235, face_min_y - 350),
                    (face_max_x + 235, face_max_y + 45),
                    (face_max_x + 95, face_max_y + 80),
                    (face_min_x - 115, face_max_y + 100),
                    (face_min_x - 185, face_max_y + 45),
                ),
                (
                    (face_min_x - 175, face_min_y - 100),
                    (face_min_x + 60, face_min_y - 95),
                    (face_min_x + 85, face_max_y + 75),
                    (face_min_x + 35, face_max_y + 190),
                    (face_min_x - 120, face_max_y + 185),
                    (face_min_x - 185, face_max_y + 70),
                ),
                (
                    (face_max_x - 10, face_min_y - 235),
                    (face_max_x + 360, face_min_y - 175),
                    (face_max_x + 435, face_max_y + 45),
                    (face_max_x + 355, face_max_y + 205),
                    (face_max_x + 135, face_max_y + 190),
                    (face_max_x + 65, face_max_y + 70),
                ),
            ),
        )
    else:
        head_left = max(0, int(face_columns.min()) - 210)
        head_right = min(value.shape[1], int(face_columns.max()) + 115)
        head_top = max(0, int(face_rows.min()) - 285)
        head_bottom = min(value.shape[0], int(face_rows.max()) + 45)
        head_owner = np.zeros_like(visible)
        head_owner[head_top:head_bottom, head_left:head_right] = True
    accessories = goggle_exclusion(
        base.size,
        visible,
        hue,
        saturation,
        value,
        head_owner,
        int(face_rows.min()),
    )
    hair_candidate = (
        matte_bool
        & head_owner
        & ~accessories
        & (hue >= 0.055)
        & (hue <= 0.16)
        & (saturation >= 0.25)
        & (value >= 0.055)
        & (value <= 0.62)
        & (red >= green * 1.02)
        & (green >= blue * 1.02)
    )
    seed_limit = int(face_rows.min()) + 32
    support = np.asarray(
        Image.fromarray(np.where(hair_candidate, 255, 0).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(17)),
        dtype=np.uint8,
    ) > 0
    selected_support: list[np.ndarray] = []
    for item in components(support):
        item_rows, _ = np.divmod(item, value.shape[1])
        if item.size >= 100 and int(item_rows.min()) <= seed_limit:
            selected_support.append(item)
    if not selected_support:
        raise ValueError("hair support component not found")
    reconstructed_owner = component_mask(value.shape, selected_support)
    hair = hair_candidate & reconstructed_owner

    if variant == "male-v1":
        # Pair generations use a wider chestnut ramp than the core plate.  A
        # colour threshold broad enough to cover it globally also catches the
        # rust scarf.  Restrict the wider ramp to four reviewed head polygons,
        # stop the rear lock above the scarf, and keep a safety ring around
        # skin and goggles.  Dark outlines remain untouched paper shadows.
        reviewed_hair_owner = male_hair_owner(
            base.size,
            int(face_columns.min()),
            int(face_rows.min()),
            int(face_columns.max()),
        )
        hair = (
            visible
            & reviewed_hair_owner
            & ~dilate(accessories, 21)
            & (hue >= 0.015)
            & (hue <= 0.13)
            & (saturation >= 0.35)
            & (value >= 0.04)
            & (value <= 0.78)
            & (red >= green * 1.01)
            & (green >= blue * 1.01)
        )
        goggle_gold = (
            reviewed_hair_owner
            & (hue >= 0.075)
            & (hue <= 0.18)
            & (saturation >= 0.35)
            & (value >= 0.58)
        )
        hair &= ~goggle_gold
        hair &= ~dilate(skin & face_owner, 5)
        brow_boxes = tuple(
            (left - 20, top - 55, right + 20, top + 8)
            for left, top, right, _ in EYE_BOXES[asset_id]
        )
        hair |= (
            visible
            & rectangles(base.size, brow_boxes)
            & ~dilate(accessories, 9)
            & (value <= 0.48)
        )
        if frame in MALE_HAIR_COMPLETION_BOXES:
            completion_owner = rectangles(base.size, (MALE_HAIR_COMPLETION_BOXES[frame],))
            if int(np.count_nonzero(hair & completion_owner)) < 1000:
                raise ValueError(f"{asset_id}: reviewed male hair completion is unexpectedly empty")

    if variant == "female-f2-v1":
        # The ponytail/crown is always the dominant component.  The long left
        # face-framing lock is either joined to it or is a second large mass
        # whose left edge starts before the crown.  Gold coat trim, scarf
        # texture and the leather goggle strap share the brown HSV range but
        # are smaller detached components.  Eyebrows are restored only inside
        # tight owners derived from the two reviewed eye annotations.
        female_hair_components = sorted(components(hair), key=lambda item: item.size, reverse=True)
        if not female_hair_components or female_hair_components[0].size < 50000:
            raise ValueError(f"{asset_id}: incomplete female crown ownership")
        main_hair = female_hair_components[0]
        _, main_columns = np.divmod(main_hair, value.shape[1])
        selected_hair = [main_hair]
        for item in female_hair_components[1:]:
            _, item_columns = np.divmod(item, value.shape[1])
            if item.size >= 5000 and int(item_columns.min()) < int(main_columns.min()):
                selected_hair.append(item)
        hair = component_mask(value.shape, selected_hair)
        brow_boxes = tuple(
            (left - 24, top - 55, right + 24, top + 8)
            for left, top, right, _ in EYE_BOXES[asset_id]
        )
        hair |= hair_candidate & rectangles(base.size, brow_boxes)

    eyes = explicit_eyes(base, asset_id)

    hair &= ~eyes
    skin &= ~(hair | eyes)
    # Every semantic channel must stay outside colour-qualified shared props.
    # Unlike the old broad rectangles, this precise exclusion does not reject
    # a real hand merely because it overlaps a laptop or money-bag box.
    semantic = skin | hair | eyes
    forbidden_hit = semantic & semantic_prop_forbidden & ~reviewed_skin_overlap
    if np.any(forbidden_hit):
        hit_rows, hit_columns = np.nonzero(forbidden_hit)
        hit_box = (
            int(hit_columns.min()),
            int(hit_rows.min()),
            int(hit_columns.max()),
            int(hit_rows.max()),
        )
        raise ValueError(
            f"{asset_id}: {int(np.count_nonzero(forbidden_hit))} semantic pixels "
            f"entered reviewed prop exclusion at {hit_box}"
        )
    if np.any(hair & accessories):
        raise ValueError(f"{asset_id}: hair channel entered goggle exclusion")
    if np.any(skin & ~(face_owner | skin_owner)):
        raise ValueError(f"{asset_id}: skin channel escaped reviewed actor owners")
    escaped_hair = hair & ~head_owner
    if np.any(escaped_hair):
        escaped_rows, escaped_columns = np.nonzero(escaped_hair)
        escaped_box = (
            int(escaped_columns.min()),
            int(escaped_rows.min()),
            int(escaped_columns.max()) + 1,
            int(escaped_rows.max()) + 1,
        )
        raise ValueError(
            f"{asset_id}: {int(np.count_nonzero(escaped_hair))} hair pixels escaped "
            f"reviewed head owner at {escaped_box}"
        )
    packed = np.zeros_like(rgb)
    packed[..., 0] = np.where(skin, alpha, 0).astype(np.uint8)
    packed[..., 1] = np.where(hair, alpha, 0).astype(np.uint8)
    packed[..., 2] = np.where(eyes, alpha, 0).astype(np.uint8)
    matte_bool = final_traveller_matte(
        base,
        variant,
        asset_id,
        frame,
        visible,
        hue,
        saturation,
        value,
        skin,
        hair,
        eyes,
        head_owner,
    )
    matte = np.where(matte_bool, alpha, 0).astype(np.uint8)
    escaped = packed.max(axis=2) > matte
    if np.any(escaped):
        raise ValueError(f"semantic mask escaped Traveller owner: {int(np.count_nonzero(escaped))}")
    return Image.fromarray(packed, "RGB"), Image.fromarray(matte, "L")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--review", action="store_true")
    args = parser.parse_args()

    inventory = load_inventory(ROOT / "inventory.json")
    assets = [item for item in inventory["assets"] if item["capability"] == CAPABILITY]
    if set(EYE_BOXES) != {str(item["id"]) for item in assets}:
        raise ValueError("Resources eye annotations do not match the exact family inventory")
    pending: list[tuple[Path, Image.Image, Path, Image.Image]] = []
    for asset in assets:
        base_path = public_asset_path(REPO_ROOT, asset["baseRoute"])
        mask_path = safe_relative(ROOT, asset["maskFile"])
        matte_path = safe_relative(ROOT, asset["matteFile"])
        if not args.overwrite and (mask_path.exists() or matte_path.exists()):
            raise ValueError(f"refusing to overwrite existing output: {asset['id']}")
        with Image.open(base_path) as opened:
            base = opened.convert("RGBA")
            mask, matte = author(base, str(asset["variant"]), str(asset["id"]), str(asset["frame"]))
        pending.append((mask_path, mask, matte_path, matte))

    print(f"preflight: PASS ({len(pending)} masks + {len(pending)} mattes; 0 retained outputs)")
    if not args.write:
        print("factoryWrites: false; publicArtWrites: false")
        return
    for mask_path, mask, matte_path, matte in pending:
        mask_path.parent.mkdir(parents=True, exist_ok=True)
        matte_path.parent.mkdir(parents=True, exist_ok=True)
        mask.save(mask_path, "PNG", optimize=True)
        matte.save(matte_path, "PNG", optimize=True)
    gate = validate_mask_set(assets, repo_root=REPO_ROOT, factory_root=ROOT)
    if not gate.passed:
        raise ValueError("Resources family validation failed: " + "; ".join(gate.errors))
    print(f"familyGate: PASS ({len(assets)}/{len(assets)})")
    if args.review:
        review_inventory = deepcopy(inventory)
        review_inventory["approvalBatch"]["assetVariantIds"] = [item["id"] for item in assets]
        review_path = ROOT / "previews/resources-full/contact-sheet.png"
        build_review("approval", review_path, inventory=review_inventory)
        print(f"review: {review_path.relative_to(ROOT)}")
    print(f"factoryWrites: {len(pending) * 2}; publicArtWrites: false")


if __name__ == "__main__":
    main()
