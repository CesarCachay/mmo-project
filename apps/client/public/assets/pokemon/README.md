# Pokemon assets — MMO Cesar Edition

This folder is designed to be copied directly into:

    apps/client/public/assets/

After copying, the final project layout must be:

    apps/client/public/assets/pokemon/
      starters/
      icons/
      overworld/

## Runtime paths currently used

Starter selection:
    /assets/pokemon/starters/001.png
    /assets/pokemon/starters/158.png

Party UI:
    /assets/pokemon/icons/party/current/158.png
    /assets/pokemon/icons/party/current/6-mega-x.png

Follower / overworld:
    /assets/pokemon/overworld/normal/down/frame-1/158.png
    /assets/pokemon/overworld/normal/down/frame-2/158.png
    /assets/pokemon/overworld/normal/left/frame-1/158.png
    /assets/pokemon/overworld/normal/left/frame-2/158.png
    /assets/pokemon/overworld/normal/right/frame-1/158.png
    /assets/pokemon/overworld/normal/right/frame-2/158.png
    /assets/pokemon/overworld/normal/up/frame-1/158.png
    /assets/pokemon/overworld/normal/up/frame-2/158.png

## Folder responsibilities

- starters/: 12 starter-selection assets, using 3-digit filenames.
- icons/party/current/: Party/menu icons for species 001-493 and supported variants.
- icons/party/future/: assets beyond the current 493-species scope.
- icons/party/right/: preserved right-facing icon variants.
- icons/party/female/: preserved female icon variants.
- icons/legacy/old-32/: original legacy icon set, not intended for current runtime.
- overworld/normal/: normal-color directional follower sprites.
- overworld/shiny/: shiny directional follower sprites.
- overworld/female/: female overrides where the original pack provides them.

The original overworld pack used:
    overworld/down/<key>.png
    overworld/down/frame2/<key>.png

This package remaps that structure to the project convention:
    overworld/normal/down/frame-1/<key>.png
    overworld/normal/down/frame-2/<key>.png

Do not add an extra pokemon/ level. Extract/copy this package's `pokemon` directory directly under `apps/client/public/assets/`.
