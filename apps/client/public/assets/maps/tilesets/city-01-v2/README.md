# City-01 V2 stamp atlas

`city-01-stamps-v2.png` is a runtime/Tiled-ready 16×16 atlas assembled from existing Cesar Edition assets.

- Grid: 16×16 px
- Atlas: 1024×512 px
- Columns: 64
- Rows: 32
- Runtime usage: normal Tiled tile layers (`Buildings` / `AbovePlayer`)
- Source assets: `tilesets/cesar-edition/objects/`

Large buildings and props were normalized with nearest-neighbor scaling, bottom-aligned into 16px-grid slots, then sliced by Tiled as ordinary tiles. The JSON manifest records each stamp slot.
