// TAP-10 / TapeSend integration for SafeShamba on X Layer (TapeOut Accelerate)
//
// Vendored reference crypto lives in ./tap10 (MIT, from TapeOutProtocol/TapeKit,
// send/module, key derivation, sealing, content encoding). Chain reads/writes go
// through ethers against the DeWEB hub; the hub proxy address is deterministic and
// identical on every chain (same on BNB, Base and X Layer, verified live on 196).
//
// ── Live hub facts, re-verified on X Layer mainnet 2026-11-23 ─────────────────
//   proxy 0xe61A9C7213a6Aa616C246a2B569e555B417b25ee has code; the hub was
//   deployed on X Layer at block 71,019,448 (2026-09-19).
//   * The proxy is NOT sealed: owner 0x571d447f…f15 can still replace the
//     implementation, so the implementation address must be checked at runtime.
//   * The live implementation is 0xf6b86f44bD039bACc8D3670971D556202d579261.
//     TapeKit's published allow-list for chain 196 names 0xdcc57797… instead.
//     Both implementations expose the same TAP-10 function selectors, but the
//     live one does NOT expose circuitCodehash(). hubStatus() below reports
//     this honestly instead of hiding it.
//   * keyFor(circuits, tokenId) returns a 10-field KeyView struct: NOT bytes32.
//     The earlier bytes32 ABI was wrong and would have reverted on decode.
//   * keyOf(container) returns the raw 7-field KeyRecord.
//   * inboxPage(to, start, n) returns Entry[] = (from, blockNumber, timestamp,
//     digest); the payload itself only exists in the Sent event log.
//   * The public X Layer RPCs reject eth_getLogs over a 100-block range, so the
//     Sent-event scan is windowed (see SENT_SCAN_WINDOW).
//   * No Sent events exist on X Layer yet. The hub is live but unused there.
//
// TAP-10 §2.2 endpoint: uint32(0) ‖ uint64(chainId) ‖ container: 32 bytes.
import { ethers } from 'ethers'
import {
  keyDerivationText, isDeterministic, deriveKeyPair,
  seal, openPayload, encodePublic, encodeContent, decodeContent, displayText,
} from './tap10/index.js'

export const HUB = '0xe61A9C7213a6Aa616C246a2B569e555B417b25ee'
export const SUITE_X25519 = 1

/** ERC-1967 implementation slot, where the hub proxy keeps its logic address. */
export const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'

/**
 * TapeKit's published audited implementations per chain (send/module/src/chain.js).
 * On X Layer the live proxy points at a different address than the one published
 * there. We surface that as `expectedImplementation: false` rather than hiding it.
 */
export const AUDITED_HUB_IMPLEMENTATIONS = {
  56: ['0x80afe7b77f2dfd08e9feab7675780bac34a7ee85'],
  8453: ['0x38a2d320b8984bbac9b0a2691b6c0fd829a23867'],
  196: ['0xdcc57797089ebd9f26e686379a4323f353a3f9c6'],
}

/** The public X Layer RPCs cap eth_getLogs at a 100-block range. */
export const SENT_SCAN_WINDOW = 100

const HUB_ABI = [
  'function send(address circuits, uint256 tokenId, bytes32 to, bytes32 ref, bytes payload) returns (uint256)',
  'function publishKey(address circuits, uint256 tokenId, uint8 suite, uint16 keyIndex, bytes32 key, uint64 chains)',
  'function revokeKey(address circuits, uint256 tokenId)',
  'function keyFor(address circuits, uint256 tokenId) view returns (tuple(address container, bytes32 endpoint, bool opened, address current, uint8 suite, uint16 keyIndex, bytes32 key, bool usable, uint32 version, uint64 chains))',
  'function keyOf(address container) view returns (tuple(bytes32 key, address holder, uint40 publishedAt, uint8 suite, uint16 keyIndex, uint32 version, uint64 chains))',
  'function accountOf(address circuits, uint256 tokenId) view returns (address)',
  'function inboxCount(bytes32 to) view returns (uint256)',
  'function inboxAt(bytes32 to, uint256 i) view returns (tuple(address from, uint56 blockNumber, uint40 timestamp, bytes32 digest))',
  'function inboxPage(bytes32 to, uint256 start, uint256 n) view returns (tuple(address from, uint56 blockNumber, uint40 timestamp, bytes32 digest)[])',
  'function outboxCount(address from) view returns (uint256)',
  'function endpointOf(address container) view returns (bytes32)',
  'function digestOf(bytes32 ref, bytes payload) view returns (bytes32)',
  'function isSealed() view returns (bool)',
  'function owner() view returns (address)',
  'event Sent(bytes32 indexed to, address indexed from, bytes32 indexed ref, uint256 inboxIndex, uint256 outboxIndex, bytes payload)',
]

/** TAP-10 §2.2 endpoint: uint32(0) ‖ uint64(chainId) ‖ container: 32 bytes, globally unique. */
export function endpointOf(chainId, container) {
  return ethers.utils.hexConcat([
    '0x00000000',
    ethers.utils.hexZeroPad(ethers.BigNumber.from(chainId).toHexString(), 8),
    ethers.utils.getAddress(container),
  ])
}

/**
 * The identity a TapeOut container was minted with.
 *
 * The hub's send()/keyFor() take `circuits` = the *processor* (CPU) address the
 * container belongs to, plus the container's token id: NOT the factory address.
 * Reading it back from the container is the authoritative way to get both
 * (verified live on X Layer: container.token() → (196, 0x839bdd…574e, 1)).
 */
export async function containerIdentity(provider, container) {
  const c = new ethers.Contract(
    container,
    ['function token() view returns (uint256 chainId, address circuits, uint256 tokenId)'],
    provider,
  )
  const t = await c.token()
  return { chainId: Number(t.chainId), circuits: t.circuits, tokenId: t.tokenId.toString() }
}

export function hubContract(runner) {
  return new ethers.Contract(HUB, HUB_ABI, runner)
}

/**
 * Read the ERC-1967 implementation slot from the hub proxy.
 * ethers v5 exposes getStorageAt(); v6 exposes getStorage(), support both.
 */
export async function readImplSlot(provider) {
  if (typeof provider.getStorageAt === 'function') return provider.getStorageAt(HUB, IMPL_SLOT)
  if (typeof provider.getStorage === 'function') return provider.getStorage(HUB, IMPL_SLOT)
  return provider.send('eth_getStorageAt', [HUB, IMPL_SLOT, 'latest'])
}

/**
 * Read the hub's trust state: which implementation the proxy currently runs,
 * whether it is sealed, who can still upgrade it, and whether the running
 * implementation is one TapeKit has published as audited for this chain.
 *
 * This is the check the TAP-10 client is required to surface: before seal(),
 * the owner can swap the implementation and rewrite the identity logic.
 */
export async function hubStatus(provider, chainId = 196) {
  const hub = hubContract(provider)
  const [sealed, owner, slot] = await Promise.all([
    hub.isSealed().catch(() => false),
    hub.owner().catch(() => ethers.constants.AddressZero),
    readImplSlot(provider).catch(() => '0x'),
  ])
  const implementation = slot && slot !== '0x' ? ethers.utils.getAddress('0x' + slot.slice(-40)) : ''
  const audited = AUDITED_HUB_IMPLEMENTATIONS[chainId] || []
  const expectedImplementation = audited.some((a) => a.toLowerCase() === implementation.toLowerCase())
  return {
    sealed,
    owner,
    implementation,
    auditedImplementations: audited,
    expectedImplementation,
    // Full trust needs all three: sealed (no further upgrades), the running
    // implementation is the audited one, and ownership has been dropped.
    inEffect: sealed && expectedImplementation && owner === ethers.constants.AddressZero,
  }
}

/**
 * Derive this container's TAP-10 key pair from two wallet signatures.
 * Private key never lands on disk: it is re-derived from the same signature each time.
 * The two-signature check rejects non-deterministic wallets (TAP-10 §4.2).
 */
export async function deriveKeys({ signer, holder, tokenId, cpuIndex, container, chainId, keyIndex = 0 }) {
  const text = keyDerivationText({ tokenId, cpuIndex, container, holder, hub: HUB, chainId, keyIndex })
  const s1 = await signer.signMessage(text)
  const s2 = await signer.signMessage(text)
  if (!isDeterministic(s1, s2)) throw new Error('wallet is not deterministic, refusing to derive a TapeSend key')
  return deriveKeyPair({ signature: s1, holder, tokenId, cpuIndex, container, hub: HUB, chainId, keyIndex })
}

/**
 * Find a processor's index in the community factory's processor table.
 * The key-derivation text (TAP-10 §4.2) binds the processor index, so a client
 * that only knows the circuits contract address has to look the index up.
 * Returns -1 when the address is not in the table.
 */
export async function processorIndex(provider, factory, circuits, max = 1024) {
  const f = new ethers.Contract(
    factory,
    ['function cpuCount() view returns (uint256)', 'function cpuAt(uint256) view returns (address)'],
    provider,
  )
  const total = Math.min((await f.cpuCount()).toNumber(), max)
  const want = String(circuits).toLowerCase()
  const BATCH = 32
  for (let start = 0; start < total; start += BATCH) {
    const idx = []
    for (let i = start; i < Math.min(start + BATCH, total); i++) idx.push(i)
    const addrs = await Promise.all(idx.map((i) => f.cpuAt(i).catch(() => ethers.constants.AddressZero)))
    for (let j = 0; j < idx.length; j++) {
      if (String(addrs[j]).toLowerCase() === want) return idx[j]
    }
  }
  return -1
}

/**
 * Publish this container's public key to the hub.
 * The private key is re-derived from a wallet signature on demand and never
 * leaves the browser.
 */
export async function publishContainerKey({ signer, provider, factory, container, chains = 1, cpuIndex = null }) {
  const ident = await containerIdentity(provider, container)
  const cpu = cpuIndex === null ? await processorIndex(provider, factory, ident.circuits) : cpuIndex
  if (cpu < 0) throw new Error('processor index for this circuit contract was not found in the factory table')
  const holder = await signer.getAddress()
  const keys = await deriveKeys({
    signer, holder, tokenId: ident.tokenId, cpuIndex: cpu, container, chainId: ident.chainId,
  })
  const rc = await publishKey({
    signer, circuits: ident.circuits, tokenId: ident.tokenId, publicKey: keys.publicKey, chains,
  })
  return { hash: rc.hash, cpuIndex: cpu, chainId: ident.chainId, circuits: ident.circuits, tokenId: ident.tokenId, publicKey: keys.publicKey }
}

/** Publish this container's public key to the hub (one tx per key version). */
export async function publishKey({ signer, circuits, tokenId, publicKey, keyIndex = 0, chains }) {
  const hub = hubContract(signer)
  const tx = await hub.publishKey(circuits, tokenId, SUITE_X25519, keyIndex, ethers.utils.hexlify(publicKey), chains)
  return tx.wait()
}

/**
 * The recipient's published key, as the hub reports it.
 * `usable` is the hub's own verdict: it is true only when the circuit is intact,
 * the public key exists, and the publisher is still the current holder.
 * We never encrypt to a key the hub reports as unusable.
 */
export async function recipientKey(provider, circuits, tokenId) {
  const v = await hubContract(provider).keyFor(circuits, tokenId)
  return {
    // the raw record's key is a bytes32 X25519 public key, not an address
    key: v.key,
    publicKey: v.usable ? v.key : null,
    publicKeyHex: v.usable ? v.key : null,
    usable: v.usable,
    suite: Number(v.suite),
    keyIndex: Number(v.keyIndex),
    version: Number(v.version),
    chains: Number(v.chains),
    container: v.container,
    holder: v.current,
    opened: v.opened,
  }
}

/**
 * Send an escrow phase notification from our container to a participant endpoint.
 * - Sealed to the recipient's published key when the hub reports it usable;
 *   otherwise sent as a TAP-10 public payload (phase metadata is on-chain public
 *   anyway, and we never seal to a key the hub says is stale).
 * - `ref` binds the message to (escrow, phase) and is what the hub stores the digest over.
 */
export async function sendPhase({ signer, circuits, tokenId, cpuIndex, container, holder, chainId, to, subject, body, ref, recipientPublicKey = null }) {
  const from = endpointOf(chainId, container)
  const content = encodeContent({ subject, body })
  let payload
  let sealedTo = null
  if (recipientPublicKey) {
    const keys = await deriveKeys({ signer, holder, tokenId, cpuIndex, container, chainId })
    payload = seal({ content, recipients: [recipientPublicKey, keys.publicKey], to, from, hub: HUB, ref, chainId })
    sealedTo = true
  } else {
    payload = encodePublic(content)
  }
  const hub = hubContract(signer)
  const tx = await hub.send(circuits, tokenId, to, ref, payload)
  const rc = await tx.wait()
  const ev = rc.events?.find((e) => e.event === 'Sent')
  return { hash: rc.hash, inboxIndex: ev ? ev.args.inboxIndex.toString() : null, sealedTo }
}

/**
 * Read an inbox page: metadata from inboxPage, payloads from the Sent events,
 * each verified against the hub digest (keccak256(ref ‖ keccak256(payload))).
 *
 * The payload lives only in the event log, and the public X Layer RPCs cap
 * eth_getLogs at 100 blocks. So the scan is windowed backwards from the head
 * and the window size is configurable.
 */
export async function readInbox(provider, { endpoint, start = 0, limit = 20, fromBlock = 0, secretKey = null, chainId = 196, scanWindow = SENT_SCAN_WINDOW }) {
  const hub = hubContract(provider)
  const total = (await hub.inboxCount(endpoint)).toNumber()
  const n = Math.max(0, Math.min(limit, total - start))
  const page = n > 0 ? await hub.inboxPage(endpoint, start, n) : []
  const events = n > 0 ? await scanSentEvents(provider, endpoint, fromBlock, scanWindow) : []
  const byIndex = new Map(events.map((e) => [e.args.inboxIndex.toString(), e]))
  const items = []
  for (let i = 0; i < page.length; i++) {
    const entry = page[i]
    const idx = String(start + i)
    const ev = byIndex.get(idx)
    let payload = null, verified = false, message = null, openError = null
    if (ev) {
      payload = ev.args.payload
      const digest = ethers.utils.keccak256(ethers.utils.concat([ev.args.ref, ethers.utils.keccak256(payload)]))
      verified = digest.toLowerCase() === entry.digest.toLowerCase()
      if (verified) {
        try {
          const opened = openPayload({
            payload: ethers.utils.arrayify(payload),
            secretKey: secretKey || undefined,
            to: endpoint,
            from: endpointOf(chainId, entry.from),
            hub: HUB,
            ref: ev.args.ref,
            chainId,
          })
          message = decodeContent(opened.content)
        } catch (e) { openError = e.code || e.message }
      }
    }
    items.push({
      index: idx,
      from: entry.from,
      timestamp: Number(entry.timestamp),
      blockNumber: Number(entry.blockNumber),
      digestOk: verified,
      ref: ev ? ev.args.ref : null,
      subject: message ? message.subject : null,
      body: message ? displayText(message.body) : null,
      openError,
    })
  }
  return { total, items }
}

/**
 * Collect Sent events for one endpoint.
 *
 * The RPCs reject a wide eth_getLogs range, so we walk backwards from the head
 * in `window`-sized slices, stopping once we have enough events or run out of
 * history. `fromBlock` (if > 0) is the lower bound.
 */
async function scanSentEvents(provider, endpoint, fromBlock = 0, window = SENT_SCAN_WINDOW) {
  const hub = hubContract(provider)
  const head = await provider.getBlockNumber()
  const floor = Math.max(0, fromBlock || 0)
  const found = []
  const maxSlices = 50 // ≤ 5,000 blocks of history per read, enough for a demo, bounded for the browser
  let to = head
  for (let slice = 0; slice < maxSlices && to >= floor; slice++) {
    const from = Math.max(floor, to - window + 1)
    try {
      const logs = await hub.queryFilter(hub.filters.Sent(endpoint), from, to)
      for (const l of logs) found.push(l)
      if (from === floor) break
      to = from - 1
    } catch (e) {
      // narrow the window on a range error, otherwise give up on older history
      if (window > 25) { window = Math.floor(window / 2); continue }
      to = from - 1
    }
  }
  return found.sort((a, b) => a.args.inboxIndex.cmp(b.args.inboxIndex))
}

/** Deterministic message ref binding (escrow, phase): also the hub digest input. */
export function phaseRef(escrow, phase) {
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address', 'uint8'], [escrow, phase]))
}
