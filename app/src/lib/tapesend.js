// TAP-10 / TapeSend integration for SafeShamba on X Layer (TapeOut Accelerate)
//
// Vendored reference crypto lives in ./tap10 (MIT, from TapeOutProtocol/TapeKit,
// send/module — key derivation, sealing, content encoding). Chain reads/writes go
// through ethers against the DeWEB hub; the hub proxy address is deterministic and
// identical on every chain (same on BNB, Base and X Layer — verified live on 196).
//
// Hub facts verified on X Layer mainnet 2026-11-19 (see xlayer_tapeout/RESEARCH.md):
//   - proxy 0xe61A9C7213a6Aa616C246a2B569e555B417b25ee has code; inboxCount/outboxCount
//     eth_calls return; live implementation 0xf6b86f44… differs from the current
//     TapeKit client allow-list (0xdcc57797…) — flagged in hubStatus, not a read gate.
import { ethers } from 'ethers'
import {
  keyDerivationText, isDeterministic, deriveKeyPair,
  seal, openPayload, encodePublic, encodeContent, decodeContent, displayText,
} from './tap10/index.js'

export const HUB = '0xe61A9C7213a6Aa616C246a2B569e555B417b25ee'
export const SUITE_X25519 = 1

const HUB_ABI = [
  'function send(address circuits, uint256 tokenId, bytes32 to, bytes32 ref, bytes payload) returns (uint256)',
  'function publishKey(address circuits, uint256 tokenId, uint8 suite, uint16 keyIndex, bytes32 key, uint64 chains)',
  'function inboxCount(bytes32 to) view returns (uint256)',
  'function inboxPage(bytes32 to, uint256 start, uint256 n) view returns (tuple(address from, uint56 blockNumber, uint40 timestamp, bytes32 digest)[])',
  'function keyFor(address container, uint256 keyIndex) view returns (bytes32)',
  'function outboxCount(address from) view returns (uint256)',
  'event Sent(bytes32 indexed to, address indexed from, bytes32 indexed ref, uint256 inboxIndex, uint256 outboxIndex, bytes payload)',
]

/** TAP-10 §2.2 endpoint: uint32(0) ‖ uint64(chainId) ‖ container — 32 bytes, globally unique. */
export function endpointOf(chainId, container) {
  return ethers.utils.hexConcat([
    '0x00000000',
    ethers.utils.hexZeroPad(ethers.BigNumber.from(chainId).toHexString(), 8),
    ethers.utils.getAddress(container),
  ])
}

export function hubContract(runner) {
  return new ethers.Contract(HUB, HUB_ABI, runner)
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
  if (!isDeterministic(s1, s2)) throw new Error('wallet is not deterministic — refusing to derive a TapeSend key')
  return deriveKeyPair({ signature: s1, holder, tokenId, cpuIndex, container, hub: HUB, chainId, keyIndex })
}

/** Publish this container's public key to the hub (one tx per key version). */
export async function publishKey({ signer, circuits, tokenId, publicKey, keyIndex = 0, chains }) {
  const hub = hubContract(signer)
  const tx = await hub.publishKey(circuits, tokenId, SUITE_X25519, keyIndex, ethers.utils.hexlify(publicKey), chains)
  return tx.wait()
}

/** Recipient's published key (bytes32) or null when they have not published one. */
export async function recipientKey(provider, container, keyIndex = 0) {
  const k = await hubContract(provider).keyFor(ethers.utils.getAddress(container), keyIndex)
  const hex = ethers.utils.hexlify(k)
  return hex === '0x' + '00'.repeat(32) ? null : ethers.utils.arrayify(hex)
}

/**
 * Send an escrow phase notification from our container to a participant endpoint.
 * - Sealed to the recipient's published key when we have it; otherwise sent as a
 *   TAP-10 public payload (phase metadata is on-chain public anyway).
 * - `ref` binds the message to (escrow, phase) and is what the hub stores the digest over.
 */
export async function sendPhase({ signer, circuits, tokenId, cpuIndex, container, holder, chainId, to, subject, body, ref, recipientPublicKey = null }) {
  const from = endpointOf(chainId, container)
  const content = encodeContent({ subject, body })
  let payload
  if (recipientPublicKey) {
    const keys = await deriveKeys({ signer, holder, tokenId, cpuIndex, container, chainId })
    payload = seal({ content, recipients: [recipientPublicKey, keys.publicKey], to, from, hub: HUB, ref, chainId })
  } else {
    payload = encodePublic(content)
  }
  const hub = hubContract(signer)
  const tx = await hub.send(circuits, tokenId, to, ref, payload)
  const rc = await tx.wait()
  const ev = rc.events?.find((e) => e.event === 'Sent')
  return { hash: rc.hash, inboxIndex: ev ? ev.args.inboxIndex.toString() : null }
}

/**
 * Read an inbox page: metadata from inboxPage, payloads from the Sent events,
 * each verified against the hub digest (keccak256(ref ‖ keccak256(payload))).
 * `fromBlock` should be the hub's deployment block (default: X Layer genesis-era scan).
 */
export async function readInbox(provider, { endpoint, start = 0, limit = 20, fromBlock = 0, secretKey = null, chainId = 196 }) {
  const hub = hubContract(provider)
  const total = (await hub.inboxCount(endpoint)).toNumber()
  const n = Math.max(0, Math.min(limit, total - start))
  const page = n > 0 ? await hub.inboxPage(endpoint, start, n) : []
  const events = n > 0 ? await hub.queryFilter(hub.filters.Sent(endpoint), fromBlock, 'latest') : []
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

/** Deterministic message ref binding (escrow, phase): also the hub digest input. */
export function phaseRef(escrow, phase) {
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address', 'uint8'], [escrow, phase]))
}
