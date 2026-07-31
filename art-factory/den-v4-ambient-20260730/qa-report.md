# Den v4 ambient QA

Status: **PASS**

- Four visual runtime assets have real RGBA alpha.
- Runtime dimensions are bounded to 512 px and preserve source aspect ratio.
- No visual asset is positioned with viewport-specific coordinates.
- Rain is clipped to the arched window glass.
- The robin is anchored to the documented window perch.
- Headphones are anchored to the Traveller head rather than shown as an icon.
- Fireplace grate and logs remain visible while the flame is a separate state.
- Fireplace and lantern each have a dedicated practical-light layer.
- Natural rain, fire and bird recordings replace procedural imitations.
- Ambient playback persists across in-app renders; volume changes do not restart it.
- The procedural generator remains only for the explicit soft-noise mode.

Known scope boundary: bird beak/wing animation and fully deformable headphone
wearing require a future character-grade sprite/rig pass. The current v4 uses
small, bounded paper motion and does not pretend that a whole-PNG wobble is a
full animation.
