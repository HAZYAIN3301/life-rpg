#!/usr/bin/env python3
"""Author and review the complete 26-frame BODY/Gamabunta semantic pack.

The composite BODY frames contain two actors.  This tool therefore uses an
explicit, frame-specific Traveller owner polygon before any colour selection.
The owner geometry is the authority boundary; colour is used only to choose
skin, hair and eye pixels *inside* that boundary.  No output from this script
is runtime eligible by itself.

Outputs:
  palette-masks-v1/{variant}/body-toad/*.png
  traveller-mattes-v1/{variant}/body-toad/*.png
  previews/semantic-mask-body-toad-full-01/{variant}.png
  qa/body-toad-full-01/qa-report.{json,md}
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from reference_recolor import DIAGNOSTIC_TARGETS, recolor_image
from semantic_masks import (
    ROOT,
    load_inventory,
    public_asset_path,
    safe_relative,
    sha256_file,
    validate_mask_set,
    validate_semantic_mask,
)


BATCH_ID = "semantic-mask-body-toad-full-01"
PREVIEW_ROOT = ROOT / "previews" / BATCH_ID
QA_ROOT = ROOT / "qa" / "body-toad-full-01"
FRAMES = (
    "greet-contact", "train-low", "train-high", "whistle-a", "whistle-b",
    "whistle-c", "whistle-d", "pushup-down", "pushup-up", "stretch-a",
    "stretch-b", "rest-contact", "rest-pet",
)
VARIANTS = ("male-v1", "female-f2-v1")
CANVAS = (1536, 1536)


Point = tuple[int, int]
Box = tuple[int, int, int, int]


@dataclass(frozen=True)
class FrameConfig:
    owner: tuple[tuple[Point, ...], ...]
    hair: tuple[tuple[Point, ...], ...]
    skin: tuple[tuple[Point, ...], ...]
    eyes: tuple[Box, ...]
    skin_keep_seeds: tuple[Box, ...]
    hair_reject_seeds: tuple[Box, ...] = ()
    hair_exclude: tuple[tuple[Point, ...], ...] = ()
    hair_exclude_ellipses: tuple[Box, ...] = ()
    owner_exclude: tuple[tuple[Point, ...], ...] = ()
    reuse_clean_matte: bool = False


def rect(box: Box) -> tuple[Point, ...]:
    left, top, right, bottom = box
    return ((left, top), (right, top), (right, bottom), (left, bottom))


def shapes(*values: Sequence[Point] | Box) -> tuple[tuple[Point, ...], ...]:
    result: list[tuple[Point, ...]] = []
    for value in values:
        if len(value) == 4 and all(isinstance(item, int) for item in value):
            result.append(rect(value))  # type: ignore[arg-type]
        else:
            result.append(tuple(value))  # type: ignore[arg-type]
    return tuple(result)


# Coordinates are authored against the immutable 1536x1536 pair-v4 canvas.
# Multiple owner lobes are intentional: they capture reaching hands without
# widening the BODY boundary over Gamabunta.  Continuity siblings share the
# same cut line wherever their poses permit it.
CONFIGS: dict[str, FrameConfig] = {
    # Male -----------------------------------------------------------------
    "male-v1:greet-contact": FrameConfig(
        owner=shapes(((940, 710), (1190, 710), (1390, 850), (1465, 1478),
                      (900, 1478), (858, 1260), (900, 1170), (835, 1160),
                      (785, 1142), (785, 1070), (850, 1058), (900, 1025),
                      (940, 925))),
        hair=shapes((900, 300, 1328, 1060)),
        skin=shapes((945, 760, 1185, 1050), (785, 1040, 1010, 1170),
                    (1170, 1100, 1325, 1285), (995, 1240, 1140, 1420)),
        eyes=((985, 882, 1028, 950), (1040, 882, 1082, 950)),
        skin_keep_seeds=((975, 800, 1145, 1025), (790, 1060, 925, 1160),
                         (1180, 1110, 1310, 1270), (1000, 1280, 1135, 1410)),
        # The approval matte retained keyed floor-shadow pixels, so the full
        # BODY batch deliberately re-authors this contact frame as well.
        reuse_clean_matte=False,
    ),
    "male-v1:train-low": FrameConfig(
        owner=shapes(((970, 520), (1285, 520), (1390, 820), (1510, 870),
                      (1530, 1035), (1390, 1085), (1495, 1468), (760, 1468),
                      (790, 1325), (800, 1160), (900, 1070), (700, 1035),
                      (695, 900), (860, 865), (900, 720))),
        hair=shapes((975, 510, 1325, 875)),
        skin=shapes((1035, 680, 1230, 880), (690, 860, 850, 1045),
                    (1320, 865, 1515, 1045)),
        eyes=((1068, 724, 1113, 801), (1142, 724, 1187, 801)),
        skin_keep_seeds=((1045, 665, 1220, 865), (700, 875, 840, 1035),
                         (1330, 875, 1505, 1035)),
    ),
    "male-v1:train-high": FrameConfig(
        owner=shapes(((970, 170), (1085, 155), (1180, 250), (1300, 175),
                      (1435, 185), (1420, 470), (1370, 690), (1435, 920),
                      (1530, 1180), (1495, 1470), (820, 1470), (850, 1220),
                      (890, 990), (900, 820), (860, 650), (850, 420))),
        hair=shapes((970, 250, 1315, 610)),
        skin=shapes((1040, 365, 1235, 605), (950, 150, 1095, 335),
                    (1295, 150, 1450, 340), (840, 1180, 1015, 1450),
                    (1275, 1180, 1450, 1455)),
        eyes=((1075, 420, 1122, 500), (1150, 420, 1198, 500)),
        skin_keep_seeds=((1050, 375, 1220, 590), (960, 155, 1090, 330),
                         (1300, 155, 1445, 335), (855, 1270, 1005, 1450),
                         (1280, 1270, 1445, 1455)),
    ),
    "male-v1:whistle-a": FrameConfig(
        owner=shapes(((1020, 500), (1260, 500), (1360, 680), (1390, 980),
                      (1325, 1190), (1390, 1468), (865, 1468), (900, 1230),
                      (875, 1030), (930, 820))),
        hair=shapes((1010, 490, 1280, 850)),
        skin=shapes((1055, 625, 1215, 850), (930, 780, 1045, 915),
                    (1240, 775, 1355, 915)),
        eyes=((1080, 678, 1118, 748), (1147, 678, 1185, 748)),
        skin_keep_seeds=((1060, 630, 1205, 835), (930, 785, 1038, 910),
                         (1240, 780, 1355, 910)),
        hair_reject_seeds=((1220, 820, 1240, 840),),
    ),
    "male-v1:whistle-b": FrameConfig(
        owner=shapes(((1020, 500), (1260, 500), (1360, 680), (1390, 980),
                      (1325, 1190), (1390, 1468), (865, 1468), (900, 1230),
                      (875, 1030), (930, 820))),
        hair=shapes((1010, 490, 1280, 850)),
        skin=shapes((1055, 625, 1215, 850), (930, 780, 1045, 915),
                    (1240, 775, 1355, 915)),
        eyes=((1080, 678, 1118, 748), (1147, 678, 1185, 748)),
        skin_keep_seeds=((1060, 630, 1205, 835), (930, 785, 1038, 910),
                         (1240, 780, 1355, 910)),
        hair_reject_seeds=((1220, 815, 1240, 838),),
    ),
    "male-v1:whistle-c": FrameConfig(
        owner=shapes(((980, 520), (1220, 520), (1320, 700), (1340, 1030),
                      (1280, 1220), (1410, 1468), (810, 1468), (820, 1240),
                      (850, 1030), (920, 820)),
                     ((680, 720), (1010, 675), (1060, 850), (780, 905))),
        hair=shapes((965, 500, 1235, 850)),
        skin=shapes((1000, 625, 1175, 850), (670, 695, 805, 870),
                    (1145, 735, 1275, 900)),
        eyes=((1025, 675, 1065, 748), (1092, 675, 1132, 748)),
        skin_keep_seeds=((1005, 630, 1165, 835), (675, 700, 800, 870),
                         (1145, 740, 1275, 900)),
        hair_reject_seeds=((1160, 805, 1190, 835),),
    ),
    "male-v1:whistle-d": FrameConfig(
        owner=shapes(((950, 560), (1190, 560), (1290, 720), (1310, 1020),
                      (1260, 1200), (1405, 1468), (820, 1468), (850, 1230),
                      (875, 1040), (910, 860)),
                     ((865, 700), (1030, 670), (1060, 855), (880, 900))),
        hair=shapes((935, 540, 1210, 880)),
        skin=shapes((975, 660, 1145, 875), (850, 690, 1015, 875),
                    (1110, 760, 1225, 910)),
        eyes=((1000, 710, 1042, 790), (1067, 710, 1110, 790)),
        skin_keep_seeds=((980, 660, 1138, 865), (850, 690, 1010, 875),
                         (1110, 755, 1225, 910)),
        hair_reject_seeds=((945, 780, 965, 810), (1160, 820, 1190, 850)),
    ),
    "male-v1:pushup-down": FrameConfig(
        owner=shapes(((500, 845), (770, 835), (940, 930), (1260, 1050),
                      (1535, 1120), (1535, 1370), (1320, 1410), (1030, 1380),
                      (940, 1490), (790, 1495), (735, 1430), (620, 1455),
                      (450, 1455), (445, 1330), (500, 1230), (470, 1110)),
                     ((430, 840), (690, 820), (810, 885), (825, 1035),
                      (780, 1140), (700, 1215), (520, 1225), (445, 1160),
                      (410, 1040), (410, 920))),
        hair=shapes((420, 820, 830, 1210)),
        skin=shapes((515, 980, 735, 1215), (430, 1280, 590, 1485),
                    (820, 1280, 1010, 1500)),
        eyes=((555, 1040, 606, 1125), (632, 1040, 683, 1125)),
        skin_keep_seeds=((525, 990, 725, 1205), (430, 1365, 585, 1485),
                         (820, 1365, 1010, 1500)),
        owner_exclude=shapes(((0, 0), (400, 0), (400, 840), (405, 920),
                              (405, 1040), (430, 1120), (500, 1180),
                              (480, 1260), (445, 1340), (380, 1420),
                              (300, 1535), (0, 1535))),
    ),
    "male-v1:pushup-up": FrameConfig(
        owner=shapes(((510, 790), (790, 790), (990, 900), (1240, 1010),
                      (1535, 1090), (1535, 1340), (1320, 1380), (1010, 1345),
                      (930, 1460), (770, 1475), (700, 1400), (580, 1435),
                      (450, 1430), (445, 1270), (500, 1160), (470, 1020)),
                     ((440, 785), (700, 775), (810, 840), (825, 990),
                      (775, 1080), (700, 1150), (520, 1160), (450, 1100),
                      (415, 980), (415, 865))),
        hair=shapes((440, 770, 815, 1140)),
        skin=shapes((525, 925, 720, 1140), (430, 1230, 585, 1465),
                    (800, 1230, 990, 1475)),
        eyes=((560, 980, 610, 1065), (632, 980, 682, 1065)),
        skin_keep_seeds=((535, 925, 715, 1135), (430, 1325, 585, 1465),
                         (800, 1325, 990, 1475)),
        owner_exclude=shapes(((0, 0), (405, 0), (405, 790), (410, 880),
                              (410, 990), (435, 1080), (500, 1140),
                              (480, 1220), (445, 1310), (380, 1400),
                              (300, 1535), (0, 1535))),
    ),
    "male-v1:stretch-a": FrameConfig(
        owner=shapes(((665, 690), (1010, 690), (1170, 820), (1260, 1030),
                      (1300, 1240), (1190, 1390), (970, 1390), (860, 1360),
                      (720, 1450), (600, 1420), (560, 1300), (610, 1190),
                      (640, 1060))),
        hair=shapes((670, 670, 1030, 1060)),
        skin=shapes((735, 820, 930, 1060), (540, 1080, 850, 1290),
                    (625, 1190, 910, 1410)),
        eyes=((770, 875, 818, 955), (850, 875, 898, 955)),
        skin_keep_seeds=((745, 825, 925, 1045), (540, 1175, 735, 1265),
                         (690, 1190, 900, 1300)),
        owner_exclude=shapes(((250, 690), (660, 690), (660, 920), (620, 1030),
                              (520, 1110), (250, 1110))),
    ),
    "male-v1:stretch-b": FrameConfig(
        owner=shapes(((635, 710), (990, 710), (1170, 850), (1250, 1060),
                      (1285, 1260), (1180, 1390), (960, 1390), (850, 1360),
                      (710, 1450), (590, 1410), (545, 1290), (590, 1180),
                      (620, 1040))),
        hair=shapes((635, 720, 1010, 1110)),
        skin=shapes((700, 860, 915, 1080), (530, 1080, 840, 1300),
                    (610, 1200, 900, 1410)),
        eyes=((745, 915, 795, 995), (825, 915, 875, 995)),
        skin_keep_seeds=((710, 865, 910, 1070), (530, 1180, 725, 1275),
                         (680, 1200, 890, 1310)),
        owner_exclude=shapes(((240, 720), (630, 720), (630, 930), (590, 1040),
                              (510, 1110), (240, 1110))),
    ),
    "male-v1:rest-contact": FrameConfig(
        owner=shapes(((900, 620), (1150, 620), (1270, 730), (1395, 1030),
                      (1400, 1260), (1410, 1395), (1080, 1450), (900, 1430),
                      (820, 1280), (830, 1040), (780, 930), (780, 820),
                      (860, 810))),
        hair=shapes((880, 590, 1185, 975)),
        skin=shapes((930, 745, 1115, 960), (755, 770, 900, 930),
                    (1050, 1080, 1210, 1260), (900, 1220, 1110, 1420)),
        eyes=((958, 790, 1003, 870), (1033, 790, 1078, 870)),
        skin_keep_seeds=((940, 750, 1105, 950), (755, 775, 895, 930),
                         (1050, 1080, 1205, 1260), (900, 1270, 1105, 1410)),
    ),
    "male-v1:rest-pet": FrameConfig(
        owner=shapes(((895, 610), (1155, 610), (1280, 730), (1400, 1030),
                      (1400, 1260), (1410, 1395), (1080, 1450), (900, 1430),
                      (820, 1280), (835, 1040), (780, 900), (700, 820),
                      (680, 700), (825, 650))),
        hair=shapes((875, 580, 1190, 980)),
        skin=shapes((925, 740, 1120, 965), (665, 650, 875, 845),
                    (1050, 1080, 1210, 1260), (900, 1220, 1110, 1420)),
        eyes=((955, 790, 1002, 870), (1032, 790, 1079, 870)),
        skin_keep_seeds=((935, 745, 1110, 955), (665, 650, 875, 845),
                         (1050, 1080, 1205, 1260), (900, 1270, 1105, 1410)),
    ),

    # Female ---------------------------------------------------------------
    "female-f2-v1:greet-contact": FrameConfig(
        owner=shapes(((920, 700), (1240, 700), (1425, 850), (1495, 1478),
                      (900, 1478), (858, 1260), (900, 1180), (845, 1160),
                      (785, 1140), (785, 1075), (845, 1055), (900, 1025),
                      (920, 925))),
        hair=shapes((885, 330, 1430, 1080)),
        skin=shapes((975, 750, 1225, 1050), (785, 1035, 1030, 1170),
                    (1180, 1080, 1350, 1275), (980, 1240, 1160, 1425)),
        eyes=((1008, 870, 1078, 958), (1095, 870, 1175, 958)),
        skin_keep_seeds=((990, 770, 1215, 1035), (790, 1050, 1020, 1170),
                         (1180, 1080, 1345, 1270), (990, 1270, 1150, 1415)),
        hair_reject_seeds=((900, 1045, 925, 1070),),
        # The approval matte retained keyed floor-shadow pixels, so the full
        # BODY batch deliberately re-authors this contact frame as well.
        reuse_clean_matte=False,
    ),
    "female-f2-v1:train-low": FrameConfig(
        owner=shapes(((1020, 500), (1390, 500), (1490, 760), (1530, 930),
                      (1510, 1045), (1500, 1110), (1495, 1468), (820, 1468),
                      (850, 1300), (850, 1150), (930, 1070), (805, 1035),
                      (800, 900), (940, 860), (960, 700))),
        hair=shapes((990, 490, 1475, 940)),
        skin=shapes((1045, 660, 1250, 910), (790, 865, 940, 1045),
                    (1300, 865, 1495, 1050)),
        eyes=((1080, 725, 1128, 810), (1160, 725, 1208, 810)),
        skin_keep_seeds=((1050, 670, 1240, 895), (800, 870, 935, 1040),
                         (1305, 870, 1490, 1045)),
    ),
    "female-f2-v1:train-high": FrameConfig(
        owner=shapes(((975, 220), (1090, 190), (1185, 270), (1280, 205),
                      (1425, 215), (1450, 520), (1415, 760), (1420, 930),
                      (1500, 1180), (1470, 1470), (810, 1470), (845, 1220),
                      (880, 1010), (895, 830), (855, 650), (820, 430))),
        hair=shapes(((960, 250), (1300, 250), (1300, 360), (1420, 360),
                     (1420, 760), (1200, 760), (1200, 830), (950, 830),
                     (950, 430))),
        skin=shapes((1010, 360, 1225, 620), (800, 185, 945, 365),
                    (1290, 185, 1445, 370), (820, 1190, 1000, 1455),
                    (1250, 1190, 1435, 1455)),
        eyes=((1045, 420, 1095, 510), (1130, 420, 1180, 510)),
        skin_keep_seeds=((1020, 370, 1215, 610), (805, 190, 940, 360),
                         (1295, 190, 1440, 365), (825, 1260, 995, 1450),
                         (1255, 1260, 1430, 1450)),
        hair_reject_seeds=((1340, 300, 1370, 330),),
        owner_exclude=shapes(((0, 620), (845, 620), (875, 760), (860, 900),
                              (800, 960), (0, 960))),
    ),
    "female-f2-v1:whistle-a": FrameConfig(
        owner=shapes(((990, 490), (1370, 490), (1450, 700), (1440, 990),
                      (1360, 1170), (1390, 1468), (805, 1468), (835, 1240),
                      (810, 1030), (890, 800))),
        hair=shapes((960, 470, 1430, 925)),
        skin=shapes((1020, 625, 1225, 900), (875, 770, 1000, 930),
                    (1230, 770, 1360, 930)),
        eyes=((1050, 690, 1098, 780), (1130, 690, 1178, 780)),
        skin_keep_seeds=((1030, 635, 1215, 885), (880, 775, 995, 925),
                         (1235, 775, 1355, 925)),
        hair_reject_seeds=((975, 880, 995, 900), (1200, 860, 1220, 880),
                           (1080, 1025, 1110, 1050)),
    ),
    "female-f2-v1:whistle-b": FrameConfig(
        owner=shapes(((990, 490), (1370, 490), (1450, 700), (1440, 990),
                      (1360, 1170), (1390, 1468), (805, 1468), (835, 1240),
                      (810, 1030), (890, 800))),
        hair=shapes((960, 470, 1430, 925)),
        skin=shapes((1020, 625, 1225, 900), (875, 770, 1000, 930),
                    (1230, 770, 1360, 930)),
        eyes=((1050, 690, 1098, 780), (1130, 690, 1178, 780)),
        skin_keep_seeds=((1030, 635, 1215, 885), (880, 775, 995, 925),
                         (1235, 775, 1355, 925)),
        hair_reject_seeds=((975, 875, 995, 900), (1195, 855, 1220, 880),
                           (1080, 1025, 1110, 1050)),
    ),
    "female-f2-v1:whistle-c": FrameConfig(
        owner=shapes(((930, 510), (1290, 510), (1380, 720), (1360, 1030),
                      (1290, 1210), (1360, 1468), (790, 1468), (800, 1240),
                      (820, 1040), (870, 820)),
                     ((675, 710), (990, 665), (1050, 880), (770, 920))),
        hair=shapes((900, 480, 1320, 925)),
        skin=shapes((950, 630, 1170, 900), (665, 690, 800, 875),
                    (1130, 745, 1260, 920)),
        eyes=((985, 700, 1033, 790), (1068, 700, 1116, 790)),
        skin_keep_seeds=((960, 640, 1160, 890), (670, 695, 800, 870),
                         (1135, 750, 1255, 915)),
        hair_reject_seeds=((1150, 850, 1175, 875), (1060, 1015, 1090, 1040)),
    ),
    "female-f2-v1:whistle-d": FrameConfig(
        owner=shapes(((930, 550), (1275, 550), (1360, 730), (1350, 1020),
                      (1270, 1190), (1340, 1468), (790, 1468), (810, 1230),
                      (835, 1040), (880, 850)),
                     ((840, 690), (1025, 660), (1070, 880), (850, 920))),
        hair=shapes((900, 520, 1300, 925)),
        skin=shapes((950, 650, 1160, 900), (830, 680, 1005, 895),
                    (1115, 760, 1245, 925)),
        eyes=((980, 715, 1028, 805), (1062, 715, 1110, 805)),
        skin_keep_seeds=((960, 655, 1150, 890), (835, 685, 1000, 890),
                         (1120, 765, 1240, 920)),
        hair_reject_seeds=((940, 815, 965, 845), (1125, 875, 1150, 905),
                           (1045, 1015, 1075, 1038)),
    ),
    "female-f2-v1:pushup-down": FrameConfig(
        owner=shapes(((510, 970), (850, 960), (1030, 1080), (1250, 1180),
                      (1480, 1210), (1480, 1410), (1300, 1440), (1180, 1460),
                      (930, 1485), (790, 1495), (720, 1440), (600, 1470),
                      (480, 1465), (470, 1335), (530, 1240))),
        hair=shapes((480, 940, 925, 1430)),
        skin=shapes((575, 1120, 790, 1395), (460, 1320, 620, 1500),
                    (850, 1330, 1030, 1510)),
        eyes=((625, 1190, 675, 1280), (705, 1190, 755, 1280)),
        skin_keep_seeds=((590, 1125, 780, 1385), (460, 1380, 615, 1495),
                         (850, 1380, 1025, 1505)),
        hair_reject_seeds=((520, 1380, 545, 1405), (910, 1380, 940, 1405)),
        owner_exclude=shapes(((0, 0), (500, 0), (500, 850), (545, 1030),
                              (570, 1120), (580, 1220), (560, 1300),
                              (520, 1380), (460, 1450), (400, 1535),
                              (0, 1535))),
    ),
    "female-f2-v1:pushup-up": FrameConfig(
        owner=shapes(((540, 870), (900, 860), (1080, 980), (1280, 1120),
                      (1480, 1160), (1480, 1380), (1270, 1410), (1010, 1380),
                      (900, 1470), (760, 1480), (690, 1420), (570, 1450),
                      (450, 1445), (450, 1290), (515, 1160))),
        hair=shapes((500, 840, 940, 1320)),
        skin=shapes((590, 1030, 805, 1285), (440, 1260, 605, 1485),
                    (825, 1280, 1020, 1495)),
        eyes=((640, 1100, 690, 1190), (720, 1100, 770, 1190)),
        skin_keep_seeds=((600, 1040, 795, 1275), (440, 1360, 605, 1480),
                         (825, 1360, 1015, 1490)),
        hair_reject_seeds=((520, 1360, 545, 1390), (900, 1380, 930, 1410)),
        owner_exclude=shapes(((0, 0), (500, 0), (500, 820), (545, 980),
                              (575, 1080), (590, 1180), (570, 1270),
                              (530, 1360), (470, 1430), (400, 1535),
                              (0, 1535))),
    ),
    "female-f2-v1:stretch-a": FrameConfig(
        owner=shapes(((810, 680), (1130, 680), (1270, 820), (1320, 1050),
                      (1280, 1250), (1160, 1370), (950, 1380), (850, 1340),
                      (720, 1450), (590, 1420), (550, 1300), (610, 1180),
                      (700, 1030))),
        hair=shapes((780, 650, 1160, 1080)),
        skin=shapes((835, 800, 1040, 1050), (540, 1070, 900, 1300),
                    (625, 1180, 940, 1420)),
        eyes=((875, 865, 925, 950), (955, 865, 1005, 950)),
        skin_keep_seeds=((845, 810, 1030, 1035), (550, 1160, 760, 1260),
                         (700, 1180, 900, 1300)),
        owner_exclude=shapes(((250, 680), (800, 680), (800, 880), (720, 1000),
                              (600, 1100), (250, 1100))),
    ),
    "female-f2-v1:stretch-b": FrameConfig(
        owner=shapes(((810, 710), (1080, 710), (1160, 790), (1230, 940),
                      (1280, 1120),
                      (1250, 1270), (1150, 1380), (950, 1380), (840, 1340),
                      (700, 1450), (580, 1410), (535, 1290), (590, 1170),
                      (680, 1030))),
        # v183 has the rust scarf and gold coat ornament directly touching the
        # long hair.  Use three positive, actor-reviewed lobes instead of one
        # broad rectangle so those garment materials can never join the hair
        # component through anti-aliased contact pixels.
        hair=shapes(
            (780, 760, 1165, 950),
            (805, 880, 875, 1090),
            (950, 875, 1005, 1070),
            (980, 780, 1165, 1130),
        ),
        skin=shapes((805, 915, 1010, 1150), (520, 1080, 880, 1310),
                    (610, 1190, 920, 1420)),
        eyes=((828, 920, 875, 990), (890, 910, 940, 980)),
        skin_keep_seeds=((815, 925, 1000, 1140), (530, 1170, 740, 1270),
                         (680, 1190, 900, 1310)),
        # v183 moved the approved F2 ponytail into the old leather-rejection
        # boxes.  Component ownership already keeps the disconnected glove and
        # belt out, so no negative seed is valid for this authored frame.
        hair_reject_seeds=(),
        hair_exclude=shapes(
            (850, 990, 950, 1120),
            (760, 1030, 815, 1150),
        ),
        hair_exclude_ellipses=((800, 845, 895, 930), (890, 850, 995, 935)),
        owner_exclude=shapes(((230, 720), (760, 720), (760, 920), (690, 1030),
                              (570, 1110), (230, 1110))),
    ),
    "female-f2-v1:rest-contact": FrameConfig(
        owner=shapes(((875, 620), (1160, 620), (1280, 760), (1350, 1040),
                      (1340, 1260), (1260, 1380), (1030, 1435), (850, 1415),
                      (800, 1260), (815, 1040), (760, 920), (760, 800),
                      (850, 800))),
        hair=shapes((840, 590, 1210, 1030)),
        skin=shapes((900, 740, 1100, 990), (735, 760, 880, 930),
                    (1020, 1080, 1185, 1270), (860, 1210, 1080, 1410)),
        eyes=((935, 800, 982, 885), (1012, 800, 1059, 885)),
        skin_keep_seeds=((910, 750, 1090, 980), (735, 765, 875, 925),
                         (1020, 1080, 1180, 1265), (870, 1260, 1070, 1400)),
        hair_reject_seeds=((850, 840, 875, 865),),
    ),
    "female-f2-v1:rest-pet": FrameConfig(
        owner=shapes(((870, 620), (1165, 620), (1280, 760), (1350, 1040),
                      (1340, 1260), (1260, 1380), (1030, 1435), (850, 1415),
                      (800, 1260), (815, 1040), (760, 900), (680, 820),
                      (660, 690), (825, 640))),
        hair=shapes((835, 590, 1210, 1035)),
        skin=shapes((895, 740, 1105, 995), (645, 650, 865, 850),
                    (1020, 1080, 1185, 1270), (860, 1210, 1080, 1410)),
        eyes=((930, 800, 980, 888), (1010, 800, 1060, 888)),
        skin_keep_seeds=((905, 750, 1095, 985), (650, 650, 865, 845),
                         (1020, 1080, 1180, 1265), (870, 1260, 1070, 1400)),
        hair_reject_seeds=((840, 745, 862, 780),),
    ),
}


def polygon_mask(size: tuple[int, int], values: Iterable[Sequence[Point]]) -> np.ndarray:
    image = Image.new("L", size, 0)
    draw = ImageDraw.Draw(image)
    for points in values:
        draw.polygon(list(points), fill=255)
    return np.asarray(image, dtype=np.uint8) > 0


def boxes_mask(size: tuple[int, int], values: Iterable[Box]) -> np.ndarray:
    result = np.zeros((size[1], size[0]), dtype=bool)
    for left, top, right, bottom in values:
        result[max(0, top):min(size[1], bottom), max(0, left):min(size[0], right)] = True
    return result


def ellipses_mask(size: tuple[int, int], values: Iterable[Box]) -> np.ndarray:
    image = Image.new("L", size, 0)
    draw = ImageDraw.Draw(image)
    for left, top, right, bottom in values:
        draw.ellipse((left, top, right, bottom), fill=255)
    return np.asarray(image, dtype=np.uint8) > 0


def remove_seeded_components(mask: np.ndarray, seeds: Iterable[Box]) -> np.ndarray:
    """Remove 8-connected colour candidates rooted inside authored seed boxes.

    Hair and brown leather share pigment in the generated BODY composites.
    Tiny seeds placed wholly inside a glove/belt select only that disconnected
    material component, preserving adjacent hair even when their boxes overlap.
    """
    result = mask.copy()
    height, width = result.shape
    for left, top, right, bottom in seeds:
        region = result[max(0, top):min(height, bottom), max(0, left):min(width, right)]
        seed_y, seed_x = np.nonzero(region)
        stack = [
            (int(y + max(0, top)), int(x + max(0, left)))
            for y, x in zip(seed_y, seed_x)
        ]
        for y, x in stack:
            result[y, x] = False
        while stack:
            y, x = stack.pop()
            for delta_y in (-1, 0, 1):
                for delta_x in (-1, 0, 1):
                    if delta_x == 0 and delta_y == 0:
                        continue
                    next_y, next_x = y + delta_y, x + delta_x
                    if 0 <= next_y < height and 0 <= next_x < width and result[next_y, next_x]:
                        result[next_y, next_x] = False
                        stack.append((next_y, next_x))
    return result


def keep_seeded_components(mask: np.ndarray, seeds: Iterable[Box]) -> np.ndarray:
    """Keep only 8-connected candidates rooted in authored material seeds.

    Cream paper sleeves share portions of the generated skin palette.  A broad
    colour threshold is therefore only a candidate generator; the positive
    seeds are the authority for face, exposed fingers/forearms and ankles.
    """
    result = np.zeros_like(mask)
    height, width = mask.shape
    stack: list[tuple[int, int]] = []
    for left, top, right, bottom in seeds:
        region = mask[max(0, top):min(height, bottom), max(0, left):min(width, right)]
        seed_y, seed_x = np.nonzero(region)
        for y, x in zip(seed_y, seed_x):
            absolute_y = int(y + max(0, top))
            absolute_x = int(x + max(0, left))
            if not result[absolute_y, absolute_x]:
                result[absolute_y, absolute_x] = True
                stack.append((absolute_y, absolute_x))
    while stack:
        y, x = stack.pop()
        for delta_y in (-1, 0, 1):
            for delta_x in (-1, 0, 1):
                if delta_x == 0 and delta_y == 0:
                    continue
                next_y, next_x = y + delta_y, x + delta_x
                if (
                    0 <= next_y < height
                    and 0 <= next_x < width
                    and mask[next_y, next_x]
                    and not result[next_y, next_x]
                ):
                    result[next_y, next_x] = True
                    stack.append((next_y, next_x))
    return result


def keep_components_touching(mask: np.ndarray, seed_mask: np.ndarray) -> np.ndarray:
    """Keep only candidate components connected to at least one seed pixel."""
    result = np.zeros_like(mask)
    seed_y, seed_x = np.nonzero(mask & seed_mask)
    stack = [(int(y), int(x)) for y, x in zip(seed_y, seed_x)]
    for y, x in stack:
        result[y, x] = True
    height, width = mask.shape
    while stack:
        y, x = stack.pop()
        for delta_y in (-1, 0, 1):
            for delta_x in (-1, 0, 1):
                if delta_x == 0 and delta_y == 0:
                    continue
                next_y, next_x = y + delta_y, x + delta_x
                if (
                    0 <= next_y < height
                    and 0 <= next_x < width
                    and mask[next_y, next_x]
                    and not result[next_y, next_x]
                ):
                    result[next_y, next_x] = True
                    stack.append((next_y, next_x))
    return result


def components(mask: np.ndarray) -> list[np.ndarray]:
    """Return 8-connected components as flattened pixel indexes."""
    remaining = mask.copy()
    height, width = mask.shape
    found: list[np.ndarray] = []
    while np.any(remaining):
        start_y, start_x = np.argwhere(remaining)[0]
        remaining[start_y, start_x] = False
        stack = [(int(start_y), int(start_x))]
        indexes: list[int] = []
        while stack:
            y, x = stack.pop()
            indexes.append(y * width + x)
            for delta_y in (-1, 0, 1):
                for delta_x in (-1, 0, 1):
                    if delta_x == 0 and delta_y == 0:
                        continue
                    next_y, next_x = y + delta_y, x + delta_x
                    if 0 <= next_y < height and 0 <= next_x < width and remaining[next_y, next_x]:
                        remaining[next_y, next_x] = False
                        stack.append((next_y, next_x))
        found.append(np.asarray(indexes, dtype=np.int64))
    return found


def component_mask(shape: tuple[int, int], values: Iterable[np.ndarray]) -> np.ndarray:
    result = np.zeros(shape, dtype=bool)
    flattened = result.reshape(-1)
    for value in values:
        flattened[value] = True
    return result


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


def magenta_shadow(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Reject keyed ground-shadow residue without deleting brown leather.

    Opaque leather can also be red/blue dominant, so a pixel is removable only
    when it is either a near-zero-green chroma remnant or a translucent edge.
    """
    red = rgb[..., 0].astype(np.int16)
    green = rgb[..., 1].astype(np.int16)
    blue = rgb[..., 2].astype(np.int16)
    chroma = (
        (red >= 28)
        & (blue >= 18)
        & (red >= green * 2 + 18)
        & (blue >= green * 2 + 12)
    )
    return chroma & ((green <= 12) | (alpha <= 96))


def author_semantics(
    base: Image.Image,
    config: FrameConfig,
    *,
    existing_matte: Image.Image | None = None,
) -> tuple[Image.Image, Image.Image, dict[str, int]]:
    rgba = np.asarray(base.convert("RGBA"), dtype=np.uint8)
    rgb = rgba[..., :3]
    alpha = rgba[..., 3]
    hue, saturation, value = rgb_to_hsv(rgb)
    red = rgb[..., 0].astype(np.float32)
    green = rgb[..., 1].astype(np.float32)
    blue = rgb[..., 2].astype(np.float32)
    visible = alpha > 0
    size = base.size

    if existing_matte is not None:
        matte = np.asarray(existing_matte.convert("L"), dtype=np.uint8).copy()
        if matte.shape != alpha.shape or not np.any(matte):
            raise ValueError("reused greet-contact matte is absent or malformed")
        if np.any(matte > alpha):
            raise ValueError("reused greet-contact matte exceeds current base alpha")
    else:
        owner = polygon_mask(size, config.owner)
        if config.owner_exclude:
            owner &= ~polygon_mask(size, config.owner_exclude)
        shadow = magenta_shadow(rgb, alpha)
        matte = np.where(visible & owner & ~shadow, alpha, 0).astype(np.uint8)

    # BODY composites can leave a detached Gamabunta hand/sleeve fragment just
    # inside a manually authored cut line.  Every Traveller silhouette touches
    # its unique teal coat, while Gamabunta never does, so disconnected matte
    # islands are deterministically rejected from that positive material seed.
    teal = (
        visible
        & (alpha > 64)
        & (hue >= 0.46)
        & (hue <= 0.54)
        & (saturation >= 0.42)
        & (value >= 0.18)
    )
    matte_component = keep_components_touching(matte > 0, teal)
    matte = np.where(matte_component, matte, 0).astype(np.uint8)

    traveller = matte > 0
    hair_zone = polygon_mask(size, config.hair)
    skin_zone = polygon_mask(size, config.skin)
    eye_zone = boxes_mask(size, config.eyes)

    eyes = (
        traveller
        & eye_zone
        & (value <= 0.34)
        & ((saturation <= 0.95) | (value <= 0.16))
    )
    hair = (
        traveller
        & hair_zone
        & (hue >= 0.015)
        & (hue <= 0.165)
        & (saturation >= 0.28)
        & (value >= 0.045)
        & (value <= 0.78)
        & (red >= green * 1.015)
        & (green >= blue * 0.98)
        & ~((hue < 0.085) & (saturation >= 0.95) & (value >= 0.45))
    )
    # Brown leather, the rust scarf and the Traveller's hair deliberately
    # share a paper palette.  Colour alone therefore cannot establish hair
    # ownership.  Keep only the dominant connected hair mass inside the
    # authored head zone, then restore tiny brows in tight boxes above the
    # reviewed eyes.  This prevents gloves, belts and sleeve ornaments from
    # becoming hair while retaining side locks and the F2 ponytail.
    hair_components = sorted(components(hair), key=lambda item: item.size, reverse=True)
    if not hair_components:
        raise ValueError("authored hair component is empty")
    dominant = hair_components[0]
    dominant_rows, dominant_columns = np.divmod(dominant, hair.shape[1])
    selected_hair = [dominant]
    for item in hair_components[1:]:
        item_rows, item_columns = np.divmod(item, hair.shape[1])
        horizontal_gap = max(
            0,
            int(dominant_columns.min()) - int(item_columns.max()),
            int(item_columns.min()) - int(dominant_columns.max()),
        )
        vertical_gap = max(
            0,
            int(dominant_rows.min()) - int(item_rows.max()),
            int(item_rows.min()) - int(dominant_rows.max()),
        )
        if item.size >= 120 and horizontal_gap <= 24 and vertical_gap <= 24:
            selected_hair.append(item)
    hair = component_mask(hair.shape, selected_hair)
    brow_boxes = tuple((left - 12, top - 28, right + 12, top + 5) for left, top, right, _ in config.eyes)
    hair |= (
        traveller
        & boxes_mask(size, brow_boxes)
        & (value <= 0.48)
        & ~eyes
    )
    if config.hair_exclude:
        hair &= ~polygon_mask(size, config.hair_exclude)
    if config.hair_exclude_ellipses:
        hair &= ~ellipses_mask(size, config.hair_exclude_ellipses)
    hair = remove_seeded_components(hair, config.hair_reject_seeds)
    hair &= ~eyes
    skin = (
        traveller
        & skin_zone
        & (hue >= 0.045)
        & (hue <= 0.098)
        & (saturation >= 0.37)
        & (saturation <= 0.72)
        & (value >= 0.52)
        & (red >= green * 1.13)
        & (green >= blue * 1.18)
    )
    skin = keep_seeded_components(skin, config.skin_keep_seeds)
    skin &= ~(hair | eyes)

    packed = np.zeros_like(rgb)
    packed[..., 0] = np.where(skin, alpha, 0).astype(np.uint8)
    packed[..., 1] = np.where(hair, alpha, 0).astype(np.uint8)
    packed[..., 2] = np.where(eyes, alpha, 0).astype(np.uint8)
    union = packed.max(axis=2)
    if np.any(union > matte):
        raise ValueError("semantic selection escapes Traveller matte")

    # Teal is unique to the Traveller coat in this pair family.  This
    # high-confidence check makes a clipped coat edge a hard factory failure
    # while remaining independent of the semantic channel selection.
    teal_outside = teal & ~traveller
    facts = {
        "travellerPixels": int(np.count_nonzero(matte)),
        "skinPixels": int(np.count_nonzero(packed[..., 0])),
        "hairPixels": int(np.count_nonzero(packed[..., 1])),
        "eyePixels": int(np.count_nonzero(packed[..., 2])),
        "tealOutsideMattePixels": int(np.count_nonzero(teal_outside)),
        "shadowLikeMattePixels": int(np.count_nonzero(traveller & magenta_shadow(rgb, alpha))),
    }
    if any(facts[key] == 0 for key in ("travellerPixels", "skinPixels", "hairPixels", "eyePixels")):
        raise ValueError(f"required authored channel is empty: {facts}")
    if facts["shadowLikeMattePixels"]:
        raise ValueError(f"Traveller matte retains magenta shadow residue: {facts}")
    if facts["tealOutsideMattePixels"]:
        raise ValueError(f"Traveller matte clips teal coat pixels: {facts}")
    return Image.fromarray(packed, "RGB"), Image.fromarray(matte, "L"), facts


def body_assets(inventory: dict[str, object]) -> list[dict[str, object]]:
    assets = [
        item for item in inventory.get("assets", [])
        if isinstance(item, dict) and item.get("capability") == "body-toad"
    ]
    expected = {f"{variant}:body-toad:{frame}" for frame in FRAMES for variant in VARIANTS}
    actual = {str(asset.get("id")) for asset in assets}
    if len(assets) != 26 or actual != expected:
        raise ValueError("BODY authoring set must match the exact 26-frame inventory")
    if set(CONFIGS) != {f"{variant}:{frame}" for frame in FRAMES for variant in VARIANTS}:
        raise ValueError("BODY owner annotations do not match the exact 26-frame inventory")
    return assets


def write_png(path: Path, image: Image.Image, *, overwrite: bool) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(f"refusing to overwrite immutable factory input: {path.relative_to(ROOT)}")
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def darkened(base: Image.Image) -> Image.Image:
    rgba = np.asarray(base.convert("RGBA"), dtype=np.uint8).copy()
    rgba[..., :3] = np.floor(rgba[..., :3].astype(np.float32) * 0.30).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def composite_on_paper(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    paper = Image.new("RGBA", image.size, (244, 240, 230, 255))
    paper.alpha_composite(image.convert("RGBA"))
    paper.thumbnail(size, Image.Resampling.LANCZOS)
    return paper.convert("RGB")


def review_sheet(
    variant: str,
    authored: Sequence[tuple[dict[str, object], Image.Image, Image.Image, Image.Image]],
) -> Image.Image:
    cell = 300
    label_height = 28
    header = 48
    sheet = Image.new("RGB", (cell * 4, header + len(authored) * (cell + label_height)), (25, 27, 32))
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 14), f"BODY / Gamabunta semantic review — {variant}", fill=(242, 244, 248))
    headings = ("BASE", "TRAVELLER MATTE", "RGB: SKIN / HAIR / EYES", "DIAGNOSTIC RECOLOUR")
    for index, heading in enumerate(headings):
        draw.text((index * cell + 8, 31), heading, fill=(116, 211, 234))
    for row, (asset, base, semantic, matte) in enumerate(authored):
        y = header + row * (cell + label_height)
        dim = darkened(base)
        matte_rgba = np.zeros((CANVAS[1], CANVAS[0], 4), dtype=np.uint8)
        matte_values = np.asarray(matte, dtype=np.uint8)
        matte_rgba[..., 1] = 235
        matte_rgba[..., 2] = 255
        matte_rgba[..., 3] = np.floor(matte_values.astype(np.float32) * 0.76).astype(np.uint8)
        matte_panel = Image.alpha_composite(dim, Image.fromarray(matte_rgba, "RGBA"))
        semantic_values = np.asarray(semantic, dtype=np.uint8)
        semantic_rgba = np.zeros((CANVAS[1], CANVAS[0], 4), dtype=np.uint8)
        semantic_rgba[..., :3] = semantic_values
        semantic_rgba[..., 3] = semantic_values.max(axis=2)
        semantic_panel = Image.alpha_composite(dim, Image.fromarray(semantic_rgba, "RGBA"))
        diagnostic = recolor_image(base, semantic, DIAGNOSTIC_TARGETS)
        for column, panel in enumerate((base, matte_panel, semantic_panel, diagnostic)):
            thumbnail = composite_on_paper(panel, (cell, cell))
            sheet.paste(thumbnail, (column * cell + (cell - thumbnail.width) // 2, y + (cell - thumbnail.height) // 2))
        draw.text((8, y + cell + 6), str(asset["frame"]), fill=(230, 232, 238))
    return sheet


def write_qa_report(
    assets: Sequence[dict[str, object]],
    facts_by_id: dict[str, dict[str, int]],
) -> dict[str, object]:
    results = [validate_semantic_mask(asset) for asset in assets]
    aggregate = validate_mask_set(assets, results=results)
    payload: dict[str, object] = {
        "schema": "satoru.traveller-semantic-mask-body-toad-qa/1",
        "batch": BATCH_ID,
        "status": "pass" if aggregate.passed else "fail",
        "required": 26,
        "passed": aggregate.facts.get("passed"),
        "errors": list(aggregate.errors),
        "manualReview": "required",
        "ownerGeometry": "explicit-per-frame",
        "frames": [
            {
                "id": asset["id"],
                "authoring": facts_by_id[str(asset["id"])],
                "validator": result.payload(),
            }
            for asset, result in zip(assets, results)
        ],
    }
    QA_ROOT.mkdir(parents=True, exist_ok=True)
    (QA_ROOT / "qa-report.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# BODY / Gamabunta semantic-mask QA",
        "",
        f"- Batch: `{BATCH_ID}`",
        f"- Automated status: **{str(payload['status']).upper()}**",
        f"- Exact validators: `{payload['passed']}/26`",
        "- Owner geometry: explicit per frame and continuity group",
        "- Manual cyan/RGB/diagnostic review: **required before promotion**",
        "",
        "| Asset | Traveller px | Skin | Hair | Eyes | Exact QA |",
        "|---|---:|---:|---:|---:|---|",
    ]
    for asset, result in zip(assets, results):
        facts = facts_by_id[str(asset["id"])]
        lines.append(
            f"| `{asset['id']}` | {facts['travellerPixels']} | {facts['skinPixels']} | "
            f"{facts['hairPixels']} | {facts['eyePixels']} | {'PASS' if result.passed else 'FAIL'} |"
        )
    if aggregate.errors:
        lines.extend(("", "## Errors", ""))
        lines.extend(f"- {error}" for error in aggregate.errors)
    (QA_ROOT / "qa-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="write 26 masks and any new mattes")
    parser.add_argument("--overwrite", action="store_true", help="replace BODY masks/mattes during author review")
    args = parser.parse_args()

    inventory = load_inventory()
    assets = body_assets(inventory)
    authored_by_variant: dict[str, list[tuple[dict[str, object], Image.Image, Image.Image, Image.Image]]] = {
        variant: [] for variant in VARIANTS
    }
    facts_by_id: dict[str, dict[str, int]] = {}
    for asset in assets:
        asset_id = str(asset["id"])
        if tuple(asset.get("canvas", ())) != CANVAS:
            raise SystemExit(f"{asset_id}: unexpected canvas")
        base_path = public_asset_path(ROOT.parents[1], asset["baseRoute"])
        if sha256_file(base_path) != asset.get("baseSha256"):
            raise SystemExit(f"{asset_id}: pinned base SHA mismatch")
        with Image.open(base_path) as opened:
            opened.load()
            if opened.mode != "RGBA" or opened.format != "PNG":
                raise SystemExit(f"{asset_id}: immutable base must be PNG RGBA")
            base = opened.copy()
        config = CONFIGS[f"{asset['variant']}:{asset['frame']}"]
        existing_matte = None
        matte_path = safe_relative(ROOT, asset["matteFile"])
        if config.reuse_clean_matte and matte_path.is_file():
            with Image.open(matte_path) as opened:
                opened.load()
                existing_matte = opened.copy()
        try:
            semantic, matte, facts = author_semantics(base, config, existing_matte=existing_matte)
        except ValueError as error:
            raise SystemExit(f"{asset_id}: {error}") from error
        authored_by_variant[str(asset["variant"])].append((asset, base, semantic, matte))
        facts_by_id[asset_id] = facts

    for variant in VARIANTS:
        authored_by_variant[variant].sort(key=lambda item: FRAMES.index(str(item[0]["frame"])))
        if len(authored_by_variant[variant]) != 13:
            raise SystemExit(f"{variant}: expected 13 BODY frames")
    print("preflight: PASS (26 semantic masks + 26 Traveller mattes in memory)")
    if not args.write:
        print("factoryWrites: false; publicArtWrites: false")
        return

    for variant in VARIANTS:
        for asset, _base, semantic, matte in authored_by_variant[variant]:
            write_png(safe_relative(ROOT, asset["maskFile"]), semantic, overwrite=args.overwrite)
            config = CONFIGS[f"{asset['variant']}:{asset['frame']}"]
            matte_path = safe_relative(ROOT, asset["matteFile"])
            if not (config.reuse_clean_matte and matte_path.is_file()):
                write_png(matte_path, matte, overwrite=args.overwrite)

    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    for variant in VARIANTS:
        review_sheet(variant, authored_by_variant[variant]).save(
            PREVIEW_ROOT / f"{variant}.png", "PNG", optimize=True
        )
    ordered_assets = [item[0] for variant in VARIANTS for item in authored_by_variant[variant]]
    payload = write_qa_report(ordered_assets, facts_by_id)
    if payload["status"] != "pass":
        raise SystemExit("BODY semantic QA failed; inspect qa/body-toad-full-01/qa-report.md")
    print("factoryWrites: 26 masks + 26 Traveller mattes")
    print("exactValidators: 26/26 PASS")
    print(f"review: {PREVIEW_ROOT.relative_to(ROOT)}")
    print(f"qa: {QA_ROOT.relative_to(ROOT)}")
    print("publicArtWrites: false; runtimeEligible: false; manualReview: required")


if __name__ == "__main__":
    main()
