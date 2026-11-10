# Sandevistan HUD design criteria

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

## Selected direction

The first prototype uses `selected-peripheral-focus.png` as its visual reference.

- The central field of view is mostly empty.
- Place the time and place in the upper left corner.
- Place the direction at the top center.
- Place the minimap at the bottom left.
- Stack audio and acceleration on the right.
- Place STT at the bottom center. Place current quests and news at the bottom right.

## Differences tailored to the actual G2

The generated draft shows the intended layout. The following constraints describe the
prototype assumptions at this checkpoint:

- The logical screen is 576 x 288.
- Black pixels are off. The wearer sees the real environment through those areas.
- The glasses accept Text, List, and Image containers.
- One page can contain up to 8 Text/List, up to 4 Images, and up to 12 total.
- Native Text containers do not provide custom fonts, font size, thickness, or
  alignment.
- Images can be up to 288 x 144. This prototype treats frequent image updates as
  unsuitable. That design assumption is not a measured hardware limit.

## Prototype scope

This version evaluates only the density and shape of the HUD. The time, map, location,
dB, STT, direction, acceleration, quest, and news use static mockup data.
