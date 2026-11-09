# Security Audit Report (working)

**Scope:** `contracts/MultiSigWallet.sol`, `contracts/EscrowFactory.sol`, `contracts/NotaryMediatedEscrow.sol` (Solidity 0.8.19, OZ 4.9.x).  
**Date:** 2026-11-09. **Status:** fixes applied; residual items remain (see below).

## Remediated in this pass
- **Factory escrow initialization (critical):** `EscrowFactory.createEscrow` now deploys with `factory` address and calls `NotaryMediatedEscrow.initializeEscrow(client,seller,notary,totalAmount)`. Escrows are initialized atomically with explicit parties (no ambiguous `msg.sender` intake on factory-created instances).
- **Timelock broken/unexecutable (high):** Replaced timestamp-salted action IDs and mismatched execute hash (`uint256(0)`) with deterministic IDs (`actionType + payloadHash + factory`), stored payload hash, `readyAt`, and `cancelAction`. `schedule*/execute*` for notary and treasury verify payload and delay.
- **Trusted-caller bypass:** not present in current `MultiSigWallet`; `submitTransaction` is `onlyOwner` with zero-destination check.
- **Dead/template code removed:** Foundry `src/script/test` Counter templates deleted; build artifacts ignored.
- **Toolchain stabilized:** `remappings.txt`, `foundry.toml` (via_ir, oz remap), local OZ 4.9.5 contracts; `forge test` **9 passed** (multisig + timelock + end-to-end workflow).

## Findings / residual risk (requires decision + follow-up)
1. **Fund release is not executed on-chain (high, design):** `fundEscrow` forwards ETH to `MultiSigWallet`, but completion/milestones no longer queue/transfer escrow proceeds to seller/treasury/client via an authorized path. The multisig holds funds; releasing them requires multisig-owner transactions. **Action:** define the release model (escrow submits typed release txs authorized by workflow state; multisig executes), or implement pull-payments with strict role checks and tests. Do not deploy to mainnet/value until release semantics are explicit and tested.
2. **`receive()` on escrow:** accepts ETH (no forwarding). Document intended behavior; consider restricting or forwarding.
3. **`EscrowFactory.createEscrow` is permissionless:** anyone can create escrows (counts toward user mappings). Acceptable for open use, but consider rate/abuse implications for UI/indexing.
4. **Document/signing flow simplified:** draft upload/sign/both-signed/notarize helpers from the prior version are not fully present in the hardened minimal flow; reintroduce with tests if required by product scope.
5. **Solhint (104 warnings):** NatSpec, custom errors, `uint256` style — non-blocking; address incrementally.
6. **Static analyzers:** Slither/Mythril not executed in this environment. Run before any value deployment: `slither .` (with remaps) and Mythril on each contract; triage all medium+.
7. **Frontend auth/roles:** UI is read/progress-oriented; write actions must enforce role and show clear transaction intent. Never expose secrets/keys.

## Tests
`forge test` — 9/9 passing (`SecurityAuditTest`, `WorkflowTest`).

## Fund-release design (implemented)
**Pattern:** state-gated multisig release submissions (authorization + consume, not raw pull). Custody remains in `MultiSigWallet` (no direct escrow payout). `NotaryMediatedEscrow` implements `IReleaseAuthorizer`:
- `releaseAuthorized(escrowId,to,amount,purpose)` — pure/state view; checks escrow state, recipient, amount, and that the slot isn’t consumed.
- `consumeRelease(...)` — **only** callable by the escrow’s `MultiSigWallet`; marks `releaseConsumed[id][purpose]`, records amount, increments `releasedAmount`. Reverts if not authorized.
- Purposes: `P_DD_FEE` (treasury, `dueDiligenceFee`, after funding, pre-cancel), `P_FACILITATION` (treasury, `facilitationFee`, **Completed**), `P_REFUND` (client, ≤ deposited-released, **Cancelled** pre-execution), `P_SELLER_PROCEEDS` reserved (tighten amount/state before enabling for real disbursement).

`MultiSigWallet.submitAuthorizedRelease(escrow,escrowId,to,value,purpose)` (owner-only): verifies via escrow, consumes slot, submits a value-transfer tx, auto-confirms submitter. Execution follows normal confirmations/threshold (auto-exec at threshold=1). **Properties:** no duplicate release submission (slot consumed), no release when state disallows, multisig owners retain execution control.

**Residual:** Seller proceeds need a finalized disbursement policy (who receives fiat vs on-chain remainder, exact cap). Refund is allowed only in early states (`<= DueDiligencePending`) — extend policy explicitly if post-DD refunds are required. Direct `receive()` on escrow reverts (`Use fundEscrow`).
