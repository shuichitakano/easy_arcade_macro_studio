import { mkdir, writeFile } from "node:fs/promises";
import { compileProfile, parseProfile } from "../app/profile.ts";
import { createStreetFighter2ChampionEditionProfile } from "../samples/streetFighter2ChampionEdition.ts";

const outputDirectory = new URL("../samples/generated/", import.meta.url);
const profile = createStreetFighter2ChampionEditionProfile();
const bytes = compileProfile(profile);
parseProfile(bytes);
await mkdir(outputDirectory, { recursive: true });
await writeFile(new URL("street-fighter-ii-champion-edition.eamacro", outputDirectory), bytes);
console.log(`Generated SFII' Champion Edition sample (${bytes.length} bytes, ${profile.sequences.length} macros, ${profile.macroSets.names.length} sets)`);
