# BURSAR

Autonomous finance desk for Web3 teams on 0G Aristotle **16661**.

Your agent handles the finance work. Your policy controls the money. The agent never owns the treasury. The vault is the final authority.

## Product

Each user gets a workspace: owner wallet → `BursarFactory` → isolated `BursarVault` → policy → vendor allowlist → scoped agent session → **payable** (PDF, API, MCP, or Telegram) → USDC.e pay or block → `/verify`.

The PDF is one input adapter. The product object is the payable.

The labeled **DEMO** vault is a judge door. It is not the default workspace.

Console: Workspace, Inbox, Review, Payments, Vendors, Policy, Agent, Proof, Settings.

Owner wallet (Privy) is for create, bind, session, vendors, pause, fund, and owner pay. Band-0 session pay, analysis, queue, and `/verify` do not open MetaMask.

## Proven path

Real invoice PDF → encrypted 0G Storage → Go merkle proof → Direct TeeML vision (`0gm-1.0-35b-a3b`) → recovered TEE signer → screening → `BursarVault` USDC.e `transfer` → ChainScan → `/verify`.

Binding inference is **Direct TeeML only**. `processResponse === true` is not a hardware quote. TypeScript Storage `proof: true` is not proof. Settlement is **not** Payment Layer, 0G Pay, or Agentic ID.

## Live contracts

| What | Address |
| --- | --- |
| Factory | [`0xEc0aEcF6C778f44AeA12ee17aFB38f4e0Af0A2A4`](https://chainscan.0g.ai/address/0xEc0aEcF6C778f44AeA12ee17aFB38f4e0Af0A2A4) |
| DEMO vault | [`0xd572896BE92CDdb5cA1BeA7679eE2b995194710E`](https://chainscan.0g.ai/address/0xd572896BE92CDdb5cA1BeA7679eE2b995194710E) |
| USDC.e | `0x1f3AA82227281cA364bFb3d253B0f1af1Da6473E` |
| TEE signer | `0x8561E0a9dA3C8d6591A2E756a91334f1a3E537e0` |

Band 0 (session): $200. Band 1 (owner): $10,000.

## Verified explorer proofs

- Recovery Band-0: [`0x4bb6eafa…`](https://chainscan.0g.ai/tx/0x4bb6eafa4aa3d39efc9ab4e5cb4b920e304b7004c1621785756140156d85fd34)
- Chrome Band-0: [`0x817ff501…`](https://chainscan.0g.ai/tx/0x817ff5010e0cb04293b2c0241e15e635cf5a2cc0e8e2511379c4ad0fef262e2b)
- API Band-0: [`0x6e3cff64…`](https://chainscan.0g.ai/tx/0x6e3cff64939839eacf888ec92acef3a61825ed0ae624e09e77a9ca910d1de70b)
- Owner-workspace Band-0: [`0x0290bcb0…`](https://chainscan.0g.ai/tx/0x0290bcb024eeba773d9f97c493e8e6abb0da4191606feec9e8cf0ffff7919f49)
- Factory deploy: [`0x3ff08a8b…`](https://chainscan.0g.ai/tx/0x3ff08a8b4d1756439c80a8cfe5d3e47eb2fd81b12d0d9f13ec0278624667bac8)
- DEMO vault deploy: [`0x9cd27adb…`](https://chainscan.0g.ai/tx/0x9cd27adb5b8ff8920048cb75649f82d199f59b9cd9cd3e707f29ad8cc613fa21)

`/verify` returns **VERIFIED** only when Paid + USDC.e Transfer + Go log `Succeeded to validate the downloaded file` reconstruct.

## Production

- API: [`https://bursar-api.onrender.com`](https://bursar-api.onrender.com/health)
- Console: [`https://bursarx.vercel.app`](https://bursarx.vercel.app). If Root Directory is `apps/web`, do not set Install to `cd apps/web && npm ci`. Use `sh scripts/vercel-install.sh` (works at repo root or inside `apps/web`).

## Local run

1. Copy `.env.example` to `.env`. Never commit `.env`. Never load another project's env.
2. API: `cd backend && npm install && npx tsx src/index.ts` (8787)
3. UI: `cd apps/web && npm install && npm run dev` (5173)
4. MCP: `node packages/mcp/src/server.mjs`
5. Foundry: `cd contracts && forge install foundry-rs/forge-std@v1.9.6 && forge test`

## Tests

- `forge test` — vault + factory + invariants
- `cd backend && npx tsx --test --test-concurrency=1 test/attestor.test.ts test/sdk.test.ts test/isolation.test.ts test/http-isolation.test.ts`
- MCP `setVendor` / `withdraw` / `ownerPay` return `{error:"forbidden"}`

User A must never read or pay User B. Isolation is a new vault per workspace **and** a scoped bearer token.

## Honest limitations

- TEE `verifyService` / dstack quote is not on the payment hot path
- Direct TLS is public Let's Encrypt, not RA-TLS
- Set `BURSAR_DATABASE_URL` for production Postgres (Render). Local default is PGlite
- Privacy claim: sensitive invoices use Direct TeeML. Not “0G cannot see your data.”
