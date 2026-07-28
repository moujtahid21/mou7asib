# Version verification report — CLAUDE.md §4 / PROJECT_BRIEF.md §7

- **Date:** 2026-07-27
- **Method:** live registry queries (`npm view`, PyPI JSON API, nodejs.org dist index,
  endoflife.date), plus a local install of TypeScript 7.0.2 and a real strict compile.
  No version below was taken from memory or from the brief.

## Summary

**Every npm version targeted in CLAUDE.md §4 and PROJECT_BRIEF.md §7 exists, is stable, and
is the current `latest`.** The exact pins in the brief's `package.json` block are all real
and mutually compatible on peer dependencies. That is an unusually clean result.

Three real problems, none of them about the packages the brief names:

1. **Node 20 is end-of-life** (2026-04-30). CLAUDE.md §4 says "Node.js 20+".
2. **The Node floor is wrong.** Prisma 7.9.0 requires `^20.19 || ^22.12 || >=24.0`, which is
   stricter than "20+". **The machine this repo sits on runs Node 22.11.0, which does not
   satisfy it.**
3. **`@types/node: "20.x"`** in the brief pins the type definitions to an EOL runtime.

Plus one factual correction to the brief's reasoning, and one thing registry data cannot
settle.

---

## 1. npm packages — all confirmed

| Package | Brief pin | Registry `latest` | Exists & stable | Note |
|---|---|---|---|---|
| `next` | 16.2.12 | **16.2.12** | ✅ | 16.2.0–16.2.12 all published stable; 16.3.x is canary/preview only |
| `react` | 19.2.8 | **19.2.8** | ✅ | |
| `react-dom` | 19.2.8 | **19.2.8** | ✅ | peers `react: ^19.2.8` — must be pinned identical to `react` |
| `typescript` | 7.0.2 | **7.0.2** | ✅ | the **only** stable 7.x; `next` tag is 7.1.0-dev |
| `tailwindcss` | 4.3.3 | **4.3.3** | ✅ | no `engines` or `peerDependencies` declared |
| `prisma` | 7.9.0 | **7.9.0** | ✅ | |
| `@prisma/client` | 7.9.0 | **7.9.0** | ✅ | peers `prisma: *`, `typescript: >=5.4.0` |

Adjacent tooling, current `latest` (for when it gets added): `@tailwindcss/postcss` 4.3.3
(matches), `eslint-config-next` 16.2.12 (matches), `@types/react` 19.2.17, `@types/react-dom`
19.2.3, `zod` 4.4.3, `vitest` 4.1.10.

### Peer dependency check

`next@16.2.12` declares:

```
react:     ^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0    → 19.2.8 ✅
react-dom: ^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0    → 19.2.8 ✅
engines.node: >=20.9.0
```

`prisma@7.9.0` and `@prisma/client@7.9.0` declare `typescript: >=5.4.0` → 7.0.2 ✅.

No peer conflict anywhere in the set.

---

## 2. Node.js — the actual problem

CLAUDE.md §4 says "Node.js 20+ (Next.js 16 requires it)". That is too loose in two ways.

**The real intersection of engine constraints:**

| Package | `engines.node` |
|---|---|
| `next@16.2.12` | `>=20.9.0` |
| `prisma@7.9.0` | `^20.19 \|\| ^22.12 \|\| >=24.0` |
| `@prisma/client@7.9.0` | `^20.19 \|\| ^22.12 \|\| >=24.0` |

⇒ **`>=20.19.0` (within 20.x), or `>=22.12.0` (within 22.x), or `>=24.0.0`.**

**Release status:**

| Line | Latest | Support ended | EOL |
|---|---|---|---|
| Node 20 "Iron" | 20.20.2 | 2024-10-22 | **2026-04-30 — already EOL** |
| Node 22 "Jod" | 22.23.1 | 2025-10-21 | 2027-04-30 |
| Node 24 "Krypton" | 24.18.0 | 2026-10-20 | 2028-04-30 |

Node 20 stopped receiving security patches roughly three months ago. Targeting it on a
product that holds financial and personal data is not defensible.

**On this machine:** `node -v` → **v22.11.0**. That is below Prisma's `^22.12` floor.
`npm install` will emit an `EBADENGINE` warning and Prisma's behaviour on an unsupported
runtime is not something to find out during a ledger migration. This needs fixing before S0.

**Recommendation — for your acceptance, not applied:** change CLAUDE.md §4 from
`Node.js 20+` to **Node.js 24.x (Krypton, active LTS)**, and set `engines.node: ">=24.0.0"`
plus an `.nvmrc`. Node 22.23.1 is the conservative alternative if something else in the
toolchain forces it. Confirm the target against Vercel's currently offered Node runtimes
before pinning — that is a platform constraint I have not verified here.

Consequence: `@types/node` should then track the runtime (`24.x`), **not** the `20.x` in
PROJECT_BRIEF.md §7. Current `latest` is 26.1.1.

---

## 3. TypeScript 7.0.2 — verified working, one residual unknown

TypeScript 7.0.2 is the native compiler port, and it is the only stable 7.x release. I
installed it and checked rather than assuming:

- ✅ `tsc --version` → 7.0.2 (installs a platform-specific native binary as a second package)
- ✅ Supports every flag CLAUDE.md §10 mandates: `--strict`, `--noUncheckedIndexedAccess`,
  `--exactOptionalPropertyTypes`, `--noImplicitOverride`
- ✅ Compiles clean under all four flags with `--module nodenext`
- ✅ Passes Next.js's version gate — `next@16.2.12` rejects TypeScript below `5.1.0`
  (`semver.lt(typescriptVersion, "5.1.0")` in `verify-typescript-setup`); 7.0.2 clears it

**What I could not verify from registry metadata:** whether Next 16.2's TypeScript plugin
and type-checking path, and Prisma 7.9's generated client types, behave identically under
the *native* compiler as under the JS one. A satisfied semver gate is not a behavioural
guarantee. This is precisely what slice S0 in `docs/build-order.md` exists to settle, and
it is why S0 is a 1-day timebox rather than an afterthought.

---

## 4. Python 3.14 — real, but the brief's reasoning is wrong

**Python 3.14.6** is current stable (3.14 released 2025-10-07, EOL 2030-10-31). Targeting
3.14.x is sound.

PROJECT_BRIEF.md §7 justifies 3.14 as "la version stable la plus récente offrant le
meilleur support pour les bibliothèques d'IA (TensorFlow, PyTorch, scikit-learn)". That is
not accurate for TensorFlow:

| Package | Latest | cp314 wheels | Declares 3.14 support |
|---|---|---|---|
| `fastapi` | 0.140.0 | pure-python | ✅ |
| `pydantic` | 2.13.4 | pure-python | ✅ |
| `pydantic-core` | 2.47.0 | ✅ (incl. win_amd64, and 3.14t free-threaded) | ✅ |
| `uvicorn` | 0.51.0 | pure-python | ✅ |
| `mypy` | 2.3.0 | ✅ | ✅ (through 3.15) |
| `numpy` | 2.5.1 | ✅ | ✅ |
| `pillow` | 12.3.0 | ✅ | ✅ |
| `scikit-learn` | 1.9.0 | ✅ | ✅ |
| `torch` | 2.13.0 | ✅ | ✅ |
| **`tensorflow`** | **2.21.0** | **❌ none** | **❌ classifiers stop at 3.13** |

Everything CLAUDE.md §11 actually requires — FastAPI, Pydantic v2, mypy strict — works on
3.14 today. **TensorFlow does not.** Since nothing in either document requires TensorFlow,
the practical impact is nil, but the stated justification should be corrected so nobody
later adds TensorFlow expecting it to install.

Also worth flagging: `mypy` is now on **2.x** (2.3.0), not 1.x. Pin deliberately; a 1.x→2.x
jump under `--strict` will surface new errors.

Local machine has Python 3.11/3.12/3.13; **3.14 is not installed.**

---

## 5. Minor inconsistency in the brief

PROJECT_BRIEF.md §7's `package.json` block uses ranges for `"@types/react": "19.2.x"` and
`"@types/node": "20.x"`, while CLAUDE.md §4 requires **exact pins, no `^`, no `~`**. The
`x` ranges violate that rule. Concrete pins today would be `@types/react` 19.2.17 and
`@types/react-dom` 19.2.3, with `@types/node` following whichever Node line you choose in §2.

---

## Proposed corrections to CLAUDE.md §4

None applied — listed for your acceptance or rejection:

| # | Current | Proposed | Reason |
|---|---|---|---|
| 1 | `Node.js 20+` | `Node.js 24.x (active LTS)`, `engines: ">=24.0.0"` | Node 20 is EOL; Prisma needs ≥20.19/≥22.12/≥24 |
| 2 | — | Add a note that this machine's Node 22.11.0 is below Prisma's floor | Blocks S0 today |
| 3 | `@types/node: 20.x` (brief) | match the chosen Node line, exact pin | EOL runtime types |
| 4 | `@types/react: 19.2.x` (brief) | `19.2.17` exact | CLAUDE.md §4 forbids ranges |
| 5 | brief's TensorFlow justification | remove or correct | TensorFlow 2.21.0 has no 3.14 support |
| 6 | — | Note `mypy` is 2.x | avoid an accidental major bump under `--strict` |

Everything else in §4 stands exactly as written.
