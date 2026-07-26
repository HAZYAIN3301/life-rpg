# Fortune Cat v2 factory QA

- Assets: 24
- Passed: 24
- Failed: 0
- Contract: 1024×1024 RGBA, transparent corners, non-empty alpha, no material chroma fringe.
- Recolored skin/state layers additionally require pixel-identical approved alpha geometry.

| asset | bbox | coverage | chroma fringe | geometry | result |
|---|---:|---:|---:|---:|---:|
| outputs/props/prop-counting-coins.png | 390, 850, 620, 925 | 0.009883 | 0 | n/a | PASS |
| outputs/props/prop-ledger-glasses.png | 400, 314, 650, 758 | 0.031051 | 0 | n/a | PASS |
| outputs/props/prop-stash-bag.png | 155, 660, 350, 870 | 0.030294 | 0 | n/a | PASS |
| outputs/shadow/shadow-spirit-calm.png | 350, 250, 673, 820 | 0.103367 | 122 | n/a | PASS |
| outputs/skins/ivory-vermilion/pet-body.png | 205, 433, 825, 932 | 0.242849 | 38 | exact-alpha | PASS |
| outputs/skins/ivory-vermilion/pet-collar.png | 255, 465, 775, 641 | 0.044284 | 165 | exact-alpha | PASS |
| outputs/skins/ivory-vermilion/pet-ear-l.png | 584, 74, 764, 320 | 0.03282 | 4 | exact-alpha | PASS |
| outputs/skins/ivory-vermilion/pet-ear-r.png | 300, 77, 480, 316 | 0.029732 | 18 | exact-alpha | PASS |
| outputs/skins/ivory-vermilion/pet-head-base.png | 303, 142, 721, 522 | 0.123238 | 13 | exact-alpha | PASS |
| outputs/skins/ivory-vermilion/pet-head-patch-l.png | 581, 144, 692, 228 | 0.005502 | 61 | exact-alpha | PASS |
| outputs/skins/ivory-vermilion/pet-head-patch-r.png | 510, 150, 593, 216 | 0.003229 | 19 | exact-alpha | PASS |
| outputs/skins/ivory-vermilion/pet-paw-holding-arm.png | 642, 455, 768, 835 | 0.0356 | 13 | exact-alpha | PASS |
| outputs/skins/ivory-vermilion/pet-paw-holding.png | 628, 531, 804, 686 | 0.021152 | 9 | exact-alpha | PASS |
| outputs/skins/ivory-vermilion/pet-paw-raised.png | 197, 245, 369, 700 | 0.061001 | 14 | exact-alpha | PASS |
| outputs/skins/ivory-vermilion/pet-tail.png | 118, 535, 361, 810 | 0.036895 | 49 | exact-alpha | PASS |
| outputs/states/pet-face-full.png | 341, 271, 683, 434 | 0.00776 | 0 | exact-master-bbox | PASS |
| outputs/states/pet-face-hungry.png | 341, 271, 683, 434 | 0.009481 | 0 | exact-master-bbox | PASS |
| outputs/states/pet-face-overfed.png | 341, 271, 683, 434 | 0.00841 | 0 | exact-master-bbox | PASS |
| outputs/wearables/back/back-festival-cloak.png | 183, 330, 897, 930 | 0.278342 | 336 | n/a | PASS |
| outputs/wearables/back/back-merchant-scroll.png | 773, 340, 937, 680 | 0.03161 | 28 | n/a | PASS |
| outputs/wearables/head/head-accountant-glasses.png | 395, 322, 630, 408 | 0.006812 | 1 | n/a | PASS |
| outputs/wearables/head/head-luck-crown.png | 420, 126, 605, 254 | 0.016714 | 42 | n/a | PASS |
| outputs/wearables/neck/neck-ceremonial-bow.png | 417, 515, 608, 680 | 0.021372 | 38 | n/a | PASS |
| outputs/wearables/neck/neck-jade-amulet.png | 478, 540, 546, 690 | 0.006314 | 3 | n/a | PASS |

