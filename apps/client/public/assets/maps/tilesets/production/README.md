# Production map tilesets V1

This folder contains the normalized asset foundation for City-01 V2 → Route-03 → City-02 → Gym-02.

## Runtime strategy
All runtime scenery is paintable as normal 16×16 Tiled tile layers. Large approved artwork is exposed as **multi-tile stamp atlases**, not Image Collection objects, because the current Phaser `MapManager` creates tile layers from sprite-sheet tilesets.

## Assets
- `city-ds-v1/city-ds-terrain-v1.png/.tsx`: exact 16×16 repeated terrain.
- `city-ds-v1/city-ds-stamps-v1.png/.tsx`: approved seaside/city artwork padded to 16px grid, 1:1 pixels.
- `water-gym-v1/water-gym-terrain-v1.png/.tsx`: exact 16×16 gym surfaces.
- `water-gym-v1/water-gym-stamps-v1.png/.tsx`: approved water-gym artwork padded to 16px grid, 1:1 pixels.
- `production-collision.png/.tsx`: explicit collision authoring tile.

The approved master images are retained next to their normalized sheets.
