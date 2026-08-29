# Pokémon Icons — Project Ready

This package is organized for MMO - Cesar Edition.

## Runtime layout

- `party/current/`: canonical Party UI icons for species #001-493 and their available forms.
- `party/future/`: species > #493, preserved for future generations but outside the current game scope.
- `party/right/`: alternate right-facing icon variants when supplied by the source pack. Not required for current Party UI.
- `party/female/`: sex-specific icon variants when supplied by the source pack. Current #001-493 set has none in this source.
- `legacy/old-32/`: older 32x32 source icons, archived and excluded from the runtime contract.
- `sprite-manifest.json`: parsed metadata and runtime paths.

## Current Party UI convention

Use the canonical flat runtime path:

```text
/assets/pokemon/icons/party/current/<spriteKey>.png
```

Examples:

```text
/assets/pokemon/icons/party/current/25.png
/assets/pokemon/icons/party/current/6-mega-x.png
/assets/pokemon/icons/party/current/386-attack.png
/assets/pokemon/icons/party/current/479-wash.png
/assets/pokemon/icons/party/current/487-origin.png
/assets/pokemon/icons/party/current/493-fire.png
```

Default forms and alternate forms remain in one flat folder intentionally. The client registry resolves a `spriteKey`; the filesystem does not need to know whether that key is a default or alternate form.

## Important

The current project supports Pokémon species #001-493. Assets above #493 are preserved under `future/` but should not be registered or preloaded yet.

The legacy 32x32 set is preserved only as source material and should not be used by the current Party UI unless there is a specific visual reason.
