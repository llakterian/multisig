# SafeShamba on X Layer: deployment, TapeOut usage and fee model

This document covers the work done for the **OKX X Layer TapeOut Accelerate**
event (Oct 16 to Dec 7, 2026): deploying the escrow contracts on X Layer, hosting
the app permanently on-chain through **DeWEB**, and wiring the escrow phase
notifications through **TapeSend (TAP-10)**.

Everything described here was built and verified by the project author.

---

## 1. Why X Layer

SafeShamba is a notary-mediated escrow for land purchases. The buyers are often
in a different country from the seller and the notary, the notary is the oracle
that decides when money may move, and the whole record has to outlive any single
web host. X Layer gives three things this product needs:

| Need | X Layer / TapeOut answer |
|---|---|
| Cheap, fast settlement in a stablecoin economy | OKB gas, chain 196 |
| An app that cannot be switched off by a host | DeWEB, the frontend's bytes live in the **SiteRegistry** inside a circuit container |
| A verifiable notification trail without a server | **TapeSend / TAP-10**, escrow phase changes published on-chain between container inboxes |

---

## 2. Chain parameters (verified live)

| Item | Value |
|---|---|
| Chain | X Layer mainnet, **chain id 196** (`0xc4`) |
| RPC | `https://rpc.xlayer.tech` |
| Testnet RPC | `https://testrpc.xlayer.tech` (chain id 1952 / `0x7a0`) |
| Explorer | https://www.oklink.com/xlayer |
| Native token | **OKB** (18 decimals), escrow fees are denominated in OKB |
| TapeOut community factory | `0x1f09daefa827f02cbb40967cc91b259763760761` |
| TapeSend hub (DeWEB) | `0xe61A9C7213a6Aa616C246a2B569e555B417b25ee` |

> **Testnet caveat:** the TapeOut stack (factory, containers, SiteRegistry and
> the TapeSend hub) is **mainnet-only**. The hub has no code on chain 1952, so
> the final deployment and the demo must be on chain 196.

### Deploying the contracts

```bash
cd safeshamba-xlayer
printf 'PRIVATE_KEY=0x…\n' > .env.xlayer      # git-ignored (.env.*)
chmod 600 .env.xlayer
./scripts/deploy_xlayer.sh --network xlayer
```

The script checks the balance, compiles, deploys **MultiSigWallet →
NotaryMediatedEscrow → EscrowFactory**, creates a demo escrow, walks the whole
four-phase workflow on-chain, writes the resulting addresses into `app/.env`
(`VITE_FACTORY_ADDRESS`, `VITE_ESCROW_ADDRESS`, `VITE_MULTISIG_ADDRESS`),
builds the frontend and prints the explorer links.

The frontend detects the chain and can add/switch to X Layer by itself
(`wallet_switchEthereumChain` / `wallet_addEthereumChain`), and shows the active
chain and the native symbol (OKB on 196, ETH elsewhere) in the header.

---

## 3. How TapeOut is used

### 3.1 DeWEB hosting: the app lives on-chain

The production frontend is a static Vite build. It is published into the
**SiteRegistry** inside a circuit container on X Layer, which gives the project:

- a **`tape://` address**: the site's real home, not a redirect;
- a **TapeKit gateway link** (`https://…tapekit.org`) for ordinary browsers;
- byte-level verification on read (the registry checks SHA-256 per chunk), so
  visitors can verify they are loading the same bytes the publisher committed.

Publishing is done either through the HashPort console (drag the built `dist/`
folder, two wallet signatures) or with direct `putFile` / `appendChunk` /
`setFallback` calls (24,000-byte chunks, ≤8.4 MB per file, static files only,
relative paths, ASCII filenames).

Consequence for the product: **no server, no domain to expire, no operator who
can take the escrow UI offline.**

### 3.2 ERC-6551 container identity

Opening a container mints an ERC-6551 account whose identity is
`(chainId, circuitsContract, tokenId)`. The frontend reads that identity back
from the chain, `container.token()`. Instead of trusting a build-time
constant, so a container can never be confused with another one:

```js
const { chainId, circuits, tokenId } = await containerIdentity(provider, container)
```

### 3.3 TapeSend (TAP-10): escrow phase notifications

When the escrow changes state (Intake → Discovery/Due-Diligence → Execution →
Settlement), the client publishes a TAP-10 message to each participant's
container inbox through the DeWEB hub.

**Endpoint format (TAP-10 §2.2)**: 32 bytes, globally unique:

```
uint32(0) ‖ uint64(chainId) ‖ address(container)
```

**Message reference** binds a notification to one escrow and one phase:

```js
phaseRef(escrow, phase) = keccak256(abi.encode(address escrow, uint8 phase))
```

**Payload**. A TAP-10 public payload, or a sealed payload (X25519 +
XChaCha20-Poly1305, TAP-10 §5) addressed to the recipient's published key
whenever the hub reports that key as usable. The private key is never stored:
it is re-derived from a wallet signature on demand (TAP-10 §4.2, two-signature
determinism check) and only lives in memory.

**Verification**. The hub stores `keccak256(ref ‖ keccak256(payload))` for every
message. The client recomputes that digest from the event payload and compares
it with the value the hub reports in `inboxPage()`, so a message is only shown as
delivered when its bytes hash to the stored digest:

```js
const digest = keccak256(concat([ref, keccak256(payload)]))
verified = digest === entry.digest
```

This gives an escrow a **notification trail that no party, including us, can
rewrite**, without running a server.

#### Implementation files

| File | Purpose |
|---|---|
| `app/src/lib/tap10/` | Vendored TAP-10 reference crypto (MIT, TapeOutProtocol/TapeKit `send/module`): key derivation, sealing, content encoding |
| `app/src/lib/tapesend.js` | Chain layer: hub ABI, endpoints, `hubStatus()`, `containerIdentity()`, `publishKey()`, `sendPhase()`, `readInbox()` |
| `app/src/App.jsx` | Escrow UI + the TapeSend card (trail + live hub trust state) |
| `verify_tapesend.mjs` | Live verification of the whole client against chain 196 |

#### Live verification

```bash
cd safeshamba-xlayer
node verify_tapesend.mjs
```

27 checks run against X Layer mainnet: hub trust reads, endpoint encoding vs.
`hub.endpointOf()`, the `keyFor` KeyView decode, `keyOf`, inbox reads, digest
re-computation vs. `hub.digestOf()`, container identity resolution and the
processor-index lookup. All of them pass against the live chain.

---

## 4. The hub's trust state: stated, not hidden

The TapeSend hub at `0xe61A9C7213a6Aa616C246a2B569e555B417b25ee` is the same
proxy address on every chain. Read live on 2026-11-23:

| Chain | Implementation in the ERC-1967 slot | In TapeKit's published audited list | `isSealed()` | Owner |
|---|---|---|---|---|
| BNB (56) | `0x80aFE7B77F2dFD08e9feab7675780baC34a7EE85` | yes | false | `0x571d447f…f15` |
| Base (8453) | `0x38A2d320b8984Bbac9b0a2691B6c0FD829A23867` | yes | false | `0x571d447f…f15` |
| **X Layer (196)** | `0xf6b86f44bD039bACc8D3670971D556202d579261` | **no** | false | `0x571d447f…f15` |

What that means, in plain terms:

1. **The hub is not sealed.** Until `seal()` is called, its owner can replace the
   implementation, i.e. The rules of the message layer can still change.
2. **On X Layer the running implementation is not the one TapeKit publishes as
   audited for chain 196** (`0xdcc57797089ebd9f26e686379a4323f353a3f9c6`). Both
   expose the same TAP-10 function selectors, but the live one predates the
   `circuitCodehash()` build.
3. Therefore a message published today is **verifiable** (its digest is
   committed on-chain) but not yet **final** (the code that interprets the
   inbox can still be swapped).

SafeShamba does not paper over this: the app reads the implementation slot, the
seal flag and the owner from the chain on every load and shows them in the
TapeSend card. A client that trusts a hub blindly would have to be told; a
client that shows its trust state does not.

---

## 5. Fee model on X Layer

Unchanged mechanics, new denomination: the escrow's native token on chain 196 is
**OKB**.

| Component | Value | Who authorises it |
|---|---|---|
| Due-diligence fee | `0.05` native token (0.05 OKB) | fixed at intake, paid from the escrow |
| Facilitation fee | **200 bp (2%)** default of the budget, notary may set up to **500 bp (5%)** | notary sets the rate at the due-diligence phase |
| Deposit | **1000 bp (10%)** of the budget | set with the rates |
| Multisig custody | buyer's funds held in a 2-of-3 `MultiSigWallet` | release requires a state-gated authorisation **and** multisig confirmation |
| Refund | full remainder back to the client after a pre-execution cancel | state-gated |

Every release is bound to a purpose constant (`P_DD_FEE`, `P_FACILITATION`,
`P_REFUND`, seller proceeds) and each purpose slot can only be consumed once,
so a release cannot be replayed or over-claimed.

---

## 6. New development during the event (Oct 16 to Dec 7, 2026)

1. **Contracts redeployed to X Layer**: fresh addresses on chain 196, OKB gas,
   verified on the OKLink explorer.
2. **DeWEB hosting**: the frontend published into a circuit container, giving a
   permanent `tape://` address and a byte-verified gateway link.
3. **TapeSend (TAP-10) integration**: the escrow phase trail, with hub trust
   reads, digest verification and a live check script (27/27 against chain 196).
4. **X Layer documentation**: this file, plus the deployment runbook and the
   frontend's chain-switching/fee-token handling.
5. **Demo video** (≤3 minutes) recorded against the live X Layer build.

---

## 7. License

The escrow contracts and frontend remain under this repository's license.
`app/src/lib/tap10/` is vendored from TapeOutProtocol/TapeKit (`send/module`,
MIT) and keeps its upstream header notices.
