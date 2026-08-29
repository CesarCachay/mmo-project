import { getPokemonFormsBySpecies, type PokemonForm } from "@cesar-mmo/shared";

import { getPokemonSpriteAsset } from "./pokemon-sprite.registry";

interface SmokeCase {
  label: string;
  speciesId: number;
  formName?: string;
  expectedPath: string;
}

const SMOKE_CASES: SmokeCase[] = [
  {
    label: "Pikachu default",
    speciesId: 25,
    expectedPath: "/assets/pokemon/icons/party/current/25.png",
  },
  {
    label: "Mega Charizard X",
    speciesId: 6,
    formName: "mega-x",
    expectedPath: "/assets/pokemon/icons/party/current/6-mega-x.png",
  },
  {
    label: "Deoxys Attack",
    speciesId: 386,
    formName: "attack",
    expectedPath: "/assets/pokemon/icons/party/current/386-attack.png",
  },
  {
    label: "Rotom Wash",
    speciesId: 479,
    formName: "wash",
    expectedPath: "/assets/pokemon/icons/party/current/479-wash.png",
  },
  {
    label: "Giratina Origin",
    speciesId: 487,
    formName: "origin",
    expectedPath: "/assets/pokemon/icons/party/current/487-origin.png",
  },
  {
    label: "Unown A",
    speciesId: 201,
    formName: "a",
    expectedPath: "/assets/pokemon/icons/party/current/201-a.png",
  },
];

function resolveSmokeForm(testCase: SmokeCase): PokemonForm {
  const forms = getPokemonFormsBySpecies(testCase.speciesId);

  const form = testCase.formName
    ? forms.find((candidate) => candidate.formName === testCase.formName)
    : forms.find((candidate) => candidate.isDefault);

  if (!form) {
    throw new Error(`[PokemonSpriteRegistry] Form not found: ${testCase.label}`);
  }

  return form;
}

export async function runPokemonSpriteRegistrySmokeTest(): Promise<void> {
  console.group("🧪 PokemonSpriteRegistry smoke test");

  try {
    for (const testCase of SMOKE_CASES) {
      const form = resolveSmokeForm(testCase);

      const asset = getPokemonSpriteAsset(testCase.speciesId, form.formId);

      if (asset.path !== testCase.expectedPath) {
        throw new Error(
          [
            `[${testCase.label}] Unexpected sprite path.`,
            `Expected: ${testCase.expectedPath}`,
            `Received: ${asset.path}`,
          ].join("\n")
        );
      }

      const response = await fetch(asset.path, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `[${testCase.label}] Asset not found: ${asset.path} (${response.status})`
        );
      }

      console.log("✅", testCase.label, {
        speciesId: testCase.speciesId,
        formId: form.formId,
        formName: form.formName,
        textureKey: asset.textureKey,
        path: asset.path,
      });
    }

    console.log("✅ PokemonSpriteRegistry smoke test passed");
  } finally {
    console.groupEnd();
  }
}
