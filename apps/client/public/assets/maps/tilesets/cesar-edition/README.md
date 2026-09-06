# MMO - Cesar Edition Asset Library

This pack converts the four supplied artwork sheets into an organized production asset library for future Tiled maps.

## Important
The uploaded sheets are 1448x1086 and are **not aligned to a 16x16 tile grid**. They should not be used directly as ordinary Tiled sprite-sheet tilesets. The pack therefore preserves each master and exposes reusable assets as **Tiled image-collection tilesets** (variable-size Tile Objects).

## Generated collections
- Houses: 12 ready-to-place building objects.
- Special buildings: 10 ready-to-place special building objects.
- Outdoor props: 77 extracted object assets.
- Terrain/nature stamps: 21 extracted terrain/nature objects or stamps.
- Modular reference sheets are retained for manual composition.

## Tiled workflow
1. Copy this folder to `apps/client/public/assets/maps/tilesets/cesar-edition/`.
2. In Tiled, add the `.tsx` file from `tiled/` as an **external tileset**.
3. Place entries as **Tile Objects** in an object layer such as `Decorations`, `BuildingsObjects`, or `AbovePlayerObjects`.
4. Add collisions using the normal `Collision` tile layer or collision rectangles.
5. Keep gameplay-critical transitions/spawns in the existing `Objects` layer.

## Runtime workflow
`registry/cesarAssetLibrary.ts` provides a Phaser preload registry for direct image-object rendering if a future object-layer renderer uses `assetKey`. Current maps do not need to preload every asset globally; only load the collections actually used by each map.

## Recommended use
- Houses / Special Buildings: Tiled Tile Objects, bottom-aligned.
- Outdoor Props: Tile Objects; collision only where needed.
- Terrain/Nature stamps: decorative/large stamp objects; keep the existing 16x16 tile layers for collision and fine-grained movement.

## Source masters
The original four PNG files are preserved under `masters/` for future reprocessing.
