# BURSAR

[![test](https://github.com/james32135/BURSAR/actions/workflows/test.yml/badge.svg)](https://github.com/james32135/BURSAR/actions/workflows/test.yml)

Invoice in. Fake blocked. USDC paid.

The accounts-payable clerk for crypto companies on 0G Aristotle **16661**. The agent reads invoices. Policy controls money. The agent never owns the treasury.

## Product

Owner wallet → `BursarFactory` → isolated `BursarVault` → vendor allowlist → scoped session → payable (PDF, API, MCP, SDK, Telegram) → USDC.e pay or on-chain revert → [`/verify`](https://bursarx.vercel.app/verify).

Attention is the clerk desk. The PDF is one adapter. Email intake is not live.

## Proven path

Real invoice PDF → encrypted 0G Storage → Go merkle proof → Direct TeeML vision (`0gm-1.0-35b-a3b`) → recovered TEE signer → screen → `BursarVault` USDC.e `transfer` → ChainScan → `/verify`.

`processResponse === true` is EIP-191 recovery, not a hardware quote. TypeScript Storage `proof: true` is not proof. Settlement is **not** Payment Layer, 0G Pay, or Agentic ID. Agentic ID is clerk identity only.

## Live contracts

| What | Address |
| --- | --- |
| Factory | [`0xEc0aEcF6C778f44AeA12ee17aFB38f4e0Af0A2A4`](https://chainscan.0g.ai/address/0xEc0aEcF6C778f44AeA12ee17aFB38f4e0Af0A2A4) |
| Owner vault | [`0x8d9229d70Bef34D2C573ecf45dc984eA0a07c3De`](https://chainscan.0g.ai/address/0x8d9229d70Bef34D2C573ecf45dc984eA0a07c3De) |
| DEMO vault | [`0xd572896BE92CDdb5cA1BeA7679eE2b995194710E`](https://chainscan.0g.ai/address/0xd572896BE92CDdb5cA1BeA7679eE2b995194710E) |
| USDC.e | `0x1f3AA82227281cA364bFb3d253B0f1af1Da6473E` |
| TEE signer | `0x8561E0a9dA3C8d6591A2E756a91334f1a3E537e0` |
| BursarAgentID | [`0x67b6FF6808dc7bB2a999809416113816d9f4707B`](https://chainscan.0g.ai/address/0x67b6FF6808dc7bB2a999809416113816d9f4707B) |

Band 0 (session): $200. Band 1 (owner): $10,000.

## Verified explorer proofs

- Owner Contoso Band-0: [`0x28b11d3a…`](https://chainscan.0g.ai/tx/0x28b11d3a45b362a90d3d951b7865e9648b83fc3786cb395c20be491958967e49)
- Owner Northwind Band-0: [`0x91007ec4…`](https://chainscan.0g.ai/tx/0x91007ec49c0f757cb2a20a9f5d58396a3d79cef62c91c60500409242751d7f63)
- Telegram Contoso Band-0: [`0x4f055211…`](https://chainscan.0g.ai/tx/0x4f055211a54c593c783d340d06a8bb9bd2cb0fc52d811f1856914208c981687b)
- Chrome Band-0: [`0x817ff501…`](https://chainscan.0g.ai/tx/0x817ff5010e0cb04293b2c0241e15e635cf5a2cc0e8e2511379c4ad0fef262e2b)
- Wave 3 Contoso Band-0: [`0xb289dc1f…`](https://chainscan.0g.ai/tx/0xb289dc1f51d6974d8872e0b31a80ce1dd4d15aaf05dcc8fd2c8740f5d9ebdf3e)
- Factory deploy: [`0x3ff08a8b…`](https://chainscan.0g.ai/tx/0x3ff08a8b4d1756439c80a8cfe5d3e47eb2fd81b12d0d9f13ec0278624667bac8)

`/verify` is **VERIFIED** only when Paid + USDC.e Transfer + Go log `Succeeded to validate the downloaded file` reconstruct. Public page: [bursarx.vercel.app/verify](https://bursarx.vercel.app/verify).

## What's new this Wave

- Attention home, Telegram `@BURSARxbot`, vendor memory, obligation range (match ≠ pay)
- Fail-closed `pay-allowed` (empty vault → `insufficient-vault-balance`, pipeline stays ready)
- Isolation: one vault per workspace + scoped bearer. MCP `withdraw` / `ownerPay` / `setVendor` return forbidden
- Production ERC-7857 clerk iNFT (`supportsInterface` `0x2afbede9` / `0xdf597d99` / `0x74f8628b`). `transferFrom` reverts. `iTransferFrom` reverts until a mainnet TEE attestor exists
- Splice block: same invoice number, different amount → blocked before money moves
- GitHub Actions: `forge test` + backend unit tests

## Production

- API: [`https://bursar-api.onrender.com`](https://bursar-api.onrender.com/health)
- Console: [`https://bursarx.vercel.app`](https://bursarx.vercel.app)
- Verify: [`https://bursarx.vercel.app/verify`](https://bursarx.vercel.app/verify)
- Telegram: [`@BURSARxbot`](https://t.me/BURSARxbot)

Vercel Root Directory must be `apps/web`. Install is `npm install`. Build is `npm run build`. Output is `dist`.

## Local run

1. Copy `.env.example` to `.env`. Never commit `.env`.
2. API: `cd backend && npm install && npx tsx src/index.ts` (8787)
3. UI: `cd apps/web && npm install && npm run dev` (5173)
4. MCP: `node packages/mcp/src/server.mjs`
5. Foundry: `cd contracts && forge install foundry-rs/forge-std@v1.9.6 && forge test`

## Tests

- `forge test` — vault, factory, invariants, BursarAgentID
- `cd backend && npx tsx --test --test-concurrency=1 test/attestor.test.ts test/identity.test.ts test/payable.test.ts test/rails.test.ts test/obligations.test.ts test/mcp-tools.test.ts test/pay-gates.test.ts`
- MCP treasury tools return `{error:"forbidden"}`

## Honest limitations

- TEE `verifyService` / dstack quote is not on the payment hot path
- Direct TLS is public Let's Encrypt, not RA-TLS
- 0G Pay docs 404. Payment Layer is inference 0G only
- Agentic ID is clerk identity, not vendor settlement
- Email mailbox is not live
- User B HTTP isolation is unit/HTTP tested, not a second live human
