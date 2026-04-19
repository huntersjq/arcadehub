# `@arcadehub/holdem-engine`

Zero-dependency, pure-ESM No-Limit Texas Hold'em engine.

- ✅ Full hand state machine (preflop → flop → turn → river → showdown → hand_over → game_over)
- ✅ 7-choose-5 best-hand evaluator (royal flush, wheel A-2-3-4-5, full house, flush, straight, …)
- ✅ Side-pot calculator (any number of all-ins, any number of folded contributors)
- ✅ Deterministic Fisher-Yates shuffle (mulberry32 seeded — for replays / multiplayer sync)
- ✅ Action-timeout deadline carried on `action_required` events (UI-controlled auto-fold)
- ✅ Snapshot serializer that hides hole cards (for client mirrors)
- ✅ 73 unit tests covering rank edges, side-pot layering, full-hand smoke, illegal actions

> Currently scoped to the arcadehub monorepo (`"private": true`).
> Future: extract to a public npm package without code changes.

---

## Quick example

```js
import { Game, STAGE, bestOfSeven, HAND_NAME_CN } from "@arcadehub/holdem-engine";

const g = new Game({
  players: [
    { id: "alice", name: "Alice", stack: 1000, isHuman: true },
    { id: "bob",   name: "Bob",   stack: 1000, isHuman: false },
  ],
  smallBlind: 25,
  bigBlind: 50,
  actionTimeoutMs: 15_000,
});

g.startHand(/* seed = */ 42);

// Drain events for UI / network broadcast
for (const ev of g.drainEvents()) {
  console.log(ev.type, ev);
}

// Player acts when they receive action_required
g.applyAction("alice", { type: "call" });
g.applyAction("bob",   { type: "raise", amount: 200 });
g.applyAction("alice", { type: "fold" });

// Hand resolved: alice folded, bob wins uncontested
console.log(g.stage); // "hand_over"

// Evaluate any 7 cards directly
const r = bestOfSeven(["As", "Ks", "Qs", "Js", "Ts", "2c", "3d"]);
console.log(r.rank, HAND_NAME_CN[r.rank]); // 9 "皇家同花顺"
```

---

## API

### `new Game(config)`

| field            | type                                      | default       | notes                                  |
|------------------|-------------------------------------------|---------------|----------------------------------------|
| `players`        | `[{id, name, stack, isHuman, aiLevel?}]`  | (required)    | seat order = array order               |
| `smallBlind`     | number                                    | 50            |                                        |
| `bigBlind`       | number                                    | 100           |                                        |
| `blindsMode`     | `"fixed" \| "tourney"`                    | `"fixed"`     | tourney increases blinds per N hands   |
| `handsPerLevel`  | number                                    | 6             | only when `blindsMode: "tourney"`      |
| `actionTimeoutMs`| number                                    | 15000         | 0 = no timeout                         |

### Methods

- `startHand(seed?)` — deal a new hand. Pass an integer seed for deterministic shuffle.
- `applyAction(playerId, { type, amount? })` — `type` ∈ `fold | check | call | raise | allin`.
- `snapshot()` — returns a state object **without** hole cards (`holeCardCount` only). For client mirrors.
- `drainEvents()` — returns all queued events since last drain. Idempotent: subsequent calls return `[]`.

### Event types

| `type`             | payload                                                                                  |
|--------------------|------------------------------------------------------------------------------------------|
| `hand_start`       | `{ handNumber, dealerIndex, smallBlind, bigBlind }`                                      |
| `blind`            | `{ playerId, amount, label: "sb"\|"bb" }`                                                |
| `deal_hole`        | `{ playerId, cards: ["As","Kh"] }`                                                       |
| `stage`            | `{ stage, community? }`                                                                  |
| `action_required`  | `{ playerId, toCall, minRaise, maxRaise, currentBet, bigBlind, pot, legalActions, timeoutMs, deadline }` |
| `action`           | `{ playerId, action, amount?, totalBet? }`                                               |
| `showdown`         | `{ community, hands: [{ id, name, cards, holeCards }] }`                                 |
| `award`            | `{ winners: [{ id, amount, rank, cards, reason? }] }`                                    |
| `hand_over`        | `{}`                                                                                     |
| `game_over`        | `{ winner }` (the last player with chips)                                                |

### Deck / hand helpers

```js
import {
  buildDeck, shuffle, makePRNG, randomSeed,
  bestOfSeven, compareHands, quickHandStrength,
  buildPots, splitPot,
  RANKS, SUITS, RANK_VALUE, SUIT_SYMBOL, isRed,
} from "@arcadehub/holdem-engine";
```

---

## Design choices

- **Authoritative + event-driven.** The engine never touches the DOM or the network. It produces a queue of events; consumers (UI, network broadcaster) drain and project them.
- **Immutable-ish.** `snapshot()` returns a fresh deep-ish copy each call so mirrors can render safely.
- **Hole cards never in `snapshot()`.** Forces consumers to deliver hole cards out-of-band (point-to-point in the multiplayer case).
- **Deterministic shuffle.** `seed` is required for reproducibility (replays, regression tests, P2P sync).
- **No real-money / "insurance" features.** Out of scope by design — see `../OPTIMIZATION_PLAN.md` §3.

---

## Tests

```bash
# from arcadehub repo root
pnpm test            # one-shot
pnpm test:watch      # watch mode
```

Test files live in `engine/__tests__/` and `ai/__tests__/`. Currently 84 tests, runs in <250ms.

## License

MIT, but distributed only inside the arcadehub monorepo until the engine
is officially extracted (`"private": true` in `package.json`).
