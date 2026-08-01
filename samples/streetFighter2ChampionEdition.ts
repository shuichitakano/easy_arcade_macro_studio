import { buildProfileFromRecipe } from "../app/profileRecipe.ts";
import type { LogicalButtonName, OutputName, ProfileRecipe } from "../app/profileRecipe.ts";

type Direction = OutputName[];
type Move = ProfileRecipe["macros"][number];

const N: Direction = [];
const U: Direction = ["UP"];
const D: Direction = ["DOWN"];
const B: Direction = ["LEFT"];
const F: Direction = ["RIGHT"];
const UB: Direction = ["UP", "LEFT"];
const UF: Direction = ["UP", "RIGHT"];
const DB: Direction = ["DOWN", "LEFT"];
const DF: Direction = ["DOWN", "RIGHT"];
const MP: OutputName = "B";
const HP: OutputName = "C";
const MK: OutputName = "E";
const HK: OutputName = "F";

function step(outputs: OutputName[], frames: number) { return { outputs, frames }; }
function motion(key: string, name: string, directions: Direction[], attack: OutputName): Move {
  return { key, name, steps: [...directions.slice(0, -1).map((outputs) => step(outputs, 2)), step([...directions.at(-1)!, attack], 2), step(N, 1)] };
}
function charge(key: string, name: string, held: Direction, finish: Direction, attack: OutputName): Move {
  return { key, name, steps: [step(held, 60), step([...finish, attack], 3), step(N, 1)] };
}
function mash(key: string, name: string, attack: OutputName): Move {
  return { key, name, steps: Array.from({ length: 6 }, () => [step([attack], 1), step(N, 1)]).flat() };
}
function simple(key: string, name: string, steps: Move["steps"]): Move { return { key, name, steps }; }

const macros: Move[] = [
  motion("shoto.hadoken", "Ryu / Ken: Hadoken", [D, DF, F], MP),
  motion("shoto.shoryuken", "Ryu / Ken: Shoryuken", [F, D, DF], MP),
  motion("shoto.tatsumaki", "Ryu / Ken: Tatsumaki", [D, DB, B], MK),

  charge("chunli.spinning-bird", "Chun-Li: Spinning Bird Kick", D, U, MK),
  mash("chunli.lightning-leg", "Chun-Li: Lightning Leg", MK),
  simple("chunli.heel-stomp", "Chun-Li: Heel Stomp", [step(UF, 7), step(D, 2), step(["DOWN", MK], 2), step(N, 1)]),
  simple("chunli.backflip-kick", "Chun-Li: Backflip Kick", [step([...F, MK], 2), step(N, 1)]),
  simple("chunli.neck-breaker", "Chun-Li: Neck Breaker", [step([...F, HK], 2), step(N, 1)]),

  charge("honda.sumo-torpedo", "E. Honda: Sumo Torpedo", B, F, MP),
  mash("honda.hundred-hand", "E. Honda: Hundred Hand Slap", MP),
  charge("blanka.rolling", "Blanka: Rolling Attack", B, F, MP),
  mash("blanka.electric", "Blanka: Electric Thunder", MP),
  charge("guile.sonic-boom", "Guile: Sonic Boom", B, F, MP),
  charge("guile.flash-kick", "Guile: Flash Kick", D, U, MK),

  simple("zangief.lariat", "Zangief: Spinning Clothesline", [step(["A", "B", "C"], 3), step(N, 1)]),
  motion("zangief.spd", "Zangief: Spinning Piledriver", [F, DF, D, DB, B, UB], MP),

  motion("dhalsim.yoga-fire", "Dhalsim: Yoga Fire", [D, DF, F], MP),
  motion("dhalsim.yoga-flame", "Dhalsim: Yoga Flame", [B, DB, D, DF, F], MP),
  simple("dhalsim.drill-kick", "Dhalsim: Drill Kick", [step(UF, 7), step(["DOWN", HK], 2), step(N, 1)]),
  simple("dhalsim.yoga-mummy", "Dhalsim: Yoga Mummy", [step(UF, 7), step(["DOWN", HP], 2), step(N, 1)]),
  simple("dhalsim.slide", "Dhalsim: Slide", [step(["DOWN", HK], 2), step(N, 1)]),

  charge("balrog.dash-straight", "Balrog: Dash Straight", B, F, MP),
  charge("balrog.dash-upper", "Balrog: Dash Upper", B, F, MK),
  simple("balrog.turn-punch", "Balrog: Turn Punch (2 sec)", [step(["A", "B", "C"], 120), step(N, 2)]),

  charge("vega.tumbling-claw", "Vega: Tumbling Claw", B, F, MP),
  simple("vega.backflip", "Vega: Double Backflip", [step(B, 2), step(N, 1), step(B, 2), step(N, 1)]),
  simple("vega.wall-spring", "Vega: Wall Spring", [step(D, 60), step([...UF, MK], 3), step(N, 1)]),
  simple("vega.screaming-eagle", "Vega: Screaming Eagle", [step(D, 60), step([...UF, MP, MK], 3), step(N, 1)]),
  simple("vega.slide", "Vega: Slide", [step(["DOWN", HK], 2), step(N, 1)]),

  motion("sagat.tiger-shot", "Sagat: Tiger Shot", [D, DF, F], MP),
  motion("sagat.ground-tiger", "Sagat: Ground Tiger Shot", [D, DF, F], MK),
  motion("sagat.tiger-crush", "Sagat: Tiger Crush", [D, DF, F, UF], MK),
  motion("sagat.tiger-uppercut", "Sagat: Tiger Uppercut", [F, D, DF], MP),

  charge("bison.psycho-crusher", "M. Bison: Psycho Crusher", B, F, MP),
  charge("bison.double-knee", "M. Bison: Double Knee Press", B, F, MK),
  charge("bison.head-stomp", "M. Bison: Head Stomp", D, U, MK),
  simple("bison.slide", "M. Bison: Slide", [step(["DOWN", HK], 2), step(N, 1)]),
];

const triggerPairs: Array<[LogicalButtonName, LogicalButtonName]> = [["G", "H"], ["I", "J"], ["K", "L"]];
function bindings(moveKeys: string[]) {
  return moveKeys.slice(0, 3).flatMap((macro, index) => {
    const [rightFacing, leftFacing] = triggerPairs[index];
    return [
      { trigger: rightFacing, macro, transform: "none" as const },
      { trigger: leftFacing, macro, transform: "flipHorizontal" as const },
    ];
  });
}

export const streetFighter2ChampionEditionRecipe: ProfileRecipe = {
  name: "SFII' Champion Edition",
  description: "Unofficial arcade command sample. A-F = LP/MP/HP/LK/MK/HK. G/I/K are right-facing macros; H/J/L are their mirrored left-facing versions. Charge and mash timings require hardware testing.",
  frameStep: 1,
  macros,
  sets: [
    { name: "Ryu", bindings: bindings(["shoto.hadoken", "shoto.shoryuken", "shoto.tatsumaki"]) },
    { name: "E. Honda", bindings: bindings(["honda.sumo-torpedo", "honda.hundred-hand"]) },
    { name: "Blanka", bindings: bindings(["blanka.rolling", "blanka.electric"]) },
    { name: "Guile", bindings: bindings(["guile.sonic-boom", "guile.flash-kick"]) },
    { name: "Ken", bindings: bindings(["shoto.hadoken", "shoto.shoryuken", "shoto.tatsumaki"]) },
    { name: "Chun-Li", bindings: bindings(["chunli.spinning-bird", "chunli.lightning-leg", "chunli.heel-stomp"]) },
    { name: "Zangief", bindings: bindings(["zangief.spd", "zangief.lariat"]) },
    { name: "Dhalsim", bindings: bindings(["dhalsim.yoga-fire", "dhalsim.yoga-flame", "dhalsim.drill-kick"]) },
    { name: "Balrog", bindings: bindings(["balrog.dash-straight", "balrog.dash-upper", "balrog.turn-punch"]) },
    { name: "Vega", bindings: bindings(["vega.tumbling-claw", "vega.wall-spring", "vega.screaming-eagle"]) },
    { name: "Sagat", bindings: bindings(["sagat.tiger-shot", "sagat.ground-tiger", "sagat.tiger-uppercut"]) },
    { name: "M. Bison", bindings: bindings(["bison.psycho-crusher", "bison.double-knee", "bison.head-stomp"]) },
  ],
};

export function createStreetFighter2ChampionEditionProfile() {
  return buildProfileFromRecipe(streetFighter2ChampionEditionRecipe);
}
