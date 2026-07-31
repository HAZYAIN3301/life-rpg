# Satoru avatar common rig v1

Status: **QA passed; runtime integration verified on desktop and mobile**.

## Decision

Traveller v1 is the canonical mannequin. Every archetype uses the same 512×768
runtime canvas, composites at `(0,0)`, and keeps the same joints. An archetype
is not a complete character PNG; it is a wardrobe preset selecting compatible
slot assets.

The previous Scholar master is deliberately not split further. It has a taller,
narrower body and therefore cannot share Traveller joints without corrupting
hair, head, sleeves and equipment. Scholar v2 is authored on the Traveller
mannequin instead.

## Stable skeleton

Character-relative `right` is screen-left and character-relative `left` is
screen-right. Runtime pivots are pixels on the 512×768 canvas.

| Joint | Runtime pivot | Primary consumers |
|---|---:|---|
| root | 256,704 | whole actor placement only |
| hips | 256,380 | pelvis and locomotion |
| shoulder-r | 182.5,205 | character-right upper arm / sleeve |
| elbow-r | 157.5,305 | character-right forearm / held item |
| shoulder-l | 329.5,205 | character-left upper arm / sleeve |
| elbow-l | 354.5,305 | character-left forearm / held item |
| neck | 256,175 | scarf, collar, amulet |
| head | 256,152.5 | head rotation |
| face | 256,127.5 | expression states |
| backpack | 302,255 | back-slot equipment |

## Slot contract

- `body/base`: permanent neutral body, head, hands and face.
- `hair/back`, `hair/front`: one shared hair set at a time.
- `outfit/torso`: shirt, vest, coat body and tails.
- `outfit/sleeve-r`, `outfit/sleeve-l`: replaces the matching base upper arm.
- `legs/pants`: optional pants replacement; Traveller pants are the v1 default.
- `feet`: optional footwear replacement; Traveller boots are the v1 default.
- `headwear`: hat/hood/helmet, independent of hair when compatibility allows.
- `eyewear`: glasses/goggles.
- `neck`: scarf, collar or amulet group.
- `back`: backpack and objects behind the body.
- `waist`: pouch, belt kit, holster.
- `hand-r`, `hand-l`: hand-held equipment with front/back occlusion layers.

Every asset declares `replaces`, `requires`, and `conflicts`. UI toggles operate
on slots, never on arbitrary image fragments.

## Motion boundary

CSS may rotate or translate individual rig pieces around declared pivots. It
must not present movement of a complete master PNG as character animation.
Walking, writing, training and sitting need authored pose layers or a future
mesh/skeletal render path.

## Art pipeline

1. Generate an approved full wardrobe master on the canonical mannequin.
2. Remove chroma to real alpha and validate corners/fringe.
3. Use deterministic semantic masks to assign pixels to slots.
4. Normalize every layer to 512×768 and `(0,0)` composition.
5. Build toggle, mixed-preset and motion-pivot previews.
6. Integrate only after canvas, alpha, ownership and visual QA pass.
