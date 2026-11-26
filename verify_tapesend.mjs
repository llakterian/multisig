// Live verification of the rewritten TapeSend client against the X Layer hub.
// Run: node verify_tapesend.mjs   (uses app/node_modules for ethers + @noble)
import { ethers } from 'ethers'
import {
  HUB, IMPL_SLOT, AUDITED_HUB_IMPLEMENTATIONS,
  hubStatus, hubContract, recipientKey, readInbox, endpointOf, phaseRef,
  containerIdentity, processorIndex,
} from './app/src/lib/tapesend.js'

const RPC = 'https://rpc.xlayer.tech'
const CHAIN_ID = 196
const FACTORY = '0x1f09daefa827f02cbb40967cc91b259763760761'
const CPU0 = '0x839bdD6fa7A66416A609A735e11DE5411B98574e'
const CONTAINER = '0xE2E5FfD861C8a0b50Ce21A7bcbDD6Bb5aaC250aB'

const provider = new ethers.providers.JsonRpcProvider(RPC, CHAIN_ID)
const utilsAddr = (a) => ethers.utils.getAddress(a)
const ok = (b) => (b ? 'PASS' : 'FAIL')
let failures = 0
function check(label, cond, extra = '') {
  if (!cond) failures++
  console.log(`  [${ok(cond)}] ${label}${extra ? ', ' + extra : ''}`)
}

async function main() {
  console.log('=== 1. hubStatus (trust reads) ===')
  const st = await hubStatus(provider, CHAIN_ID)
  console.log('   ', JSON.stringify(st, null, 2).replace(/\n/g, '\n    '))
  check('implementation read from ERC-1967 slot', st.implementation.toLowerCase() === '0xf6b86f44bD039bACc8D3670971D556202d579261'.toLowerCase())
  check('isSealed read', st.sealed === false)
  check('owner read', st.owner.toLowerCase() === '0x571d447f4f24688eC35Ccf07f1D6993655F6aF15'.toLowerCase())
  check('expectedImplementation is false on X Layer', st.expectedImplementation === false)
  check('inEffect is false (not sealed)', st.inEffect === false)
  check('audited list present', AUDITED_HUB_IMPLEMENTATIONS[196].length === 1)

  console.log('\n=== 2. endpointOf() matches hub.endpointOf() ===')
  const hub = hubContract(provider)
  const onChain = await hub.endpointOf(CONTAINER)
  const ours = endpointOf(CHAIN_ID, CONTAINER)
  console.log('    ours    :', ours)
  console.log('    on-chain:', onChain)
  check('endpoint bytes match', ours.toLowerCase() === onChain.toLowerCase())

  console.log('\n=== 3. keyFor() decodes as the 10-field KeyView tuple ===')
  const rk = await recipientKey(provider, CPU0, 1)
  console.log('   ', JSON.stringify(rk, null, 2).replace(/\n/g, '\n    '))
  check('container decoded', rk.container.toLowerCase() === CONTAINER.toLowerCase())
  check('opened decoded', rk.opened === true)
  check('key is bytes32 (not an address)', typeof rk.key === 'string' && rk.key.length === 66)
  check('usable is a boolean', typeof rk.usable === 'boolean')
  check('publicKey null when unusable', rk.usable ? rk.publicKey === rk.key : rk.publicKey === null)

  console.log('\n=== 4. keyOf() raw KeyRecord ===')
  const rec = await hub.keyOf(CONTAINER)
  console.log('    key      :', rec.key)
  console.log('    holder   :', rec.holder)
  console.log('    suite    :', rec.suite, ' keyIndex:', rec.keyIndex, ' version:', rec.version, ' chains:', rec.chains)
  check('keyOf returns a record object', !!rec && typeof rec.key === 'string' && rec.key.length === 66)

  console.log('\n=== 5. inbox reads on a real endpoint ===')
  const ep = endpointOf(CHAIN_ID, CONTAINER)
  const count = await hub.inboxCount(ep)
  console.log('    inboxCount:', count.toString())
  const page = count.gt(0) ? await hub.inboxPage(ep, 0, Math.min(20, count.toNumber())) : []
  console.log('    inboxPage entries:', page.length)
  if (page.length) console.log('    first entry:', JSON.stringify(page[0], null, 2).replace(/\n/g, '\n    '))

  console.log('\n=== 6. readInbox() (no Sent logs on X Layer, must not hard-fail) ===')
  const trail = await readInbox(provider, { endpoint: ep, limit: 20, chainId: CHAIN_ID })
  console.log('   ', JSON.stringify(trail, null, 2).replace(/\n/g, '\n    '))
  check('readInbox returns a total', typeof trail.total === 'number')
  check('readInbox returns items array', Array.isArray(trail.items))

  console.log('\n=== 7. readInbox() on an endpoint with a known empty inbox ===')
  const empty = await readInbox(provider, { endpoint: endpointOf(CHAIN_ID, '0x000000000000000000000000000000000000dEaD'), limit: 5, chainId: CHAIN_ID })
  check('empty inbox → total 0', empty.total === 0)
  check('empty inbox → no items', empty.items.length === 0)

  console.log('\n=== 8. phaseRef() determinism ===')
  const refA = phaseRef('0xE2E5FfD861C8a0b50Ce21A7bcbDD6Bb5aaC250aB', 2)
  const refB = phaseRef('0xE2E5FfD861C8a0b50Ce21A7bcbDD6Bb5aaC250aB', 2)
  check('phaseRef is deterministic', refA === refB)
  check('phaseRef differs per phase', phaseRef('0xE2E5FfD861C8a0b50Ce21A7bcbDD6Bb5aaC250aB', 3) !== refA)
  console.log('    ref:', refA)

  console.log('\n=== 9. hub digestOf() matches our digest recomputation ===')
  const payloadHex = '0xdeadbeef'
  const ref = phaseRef('0xE2E5FfD861C8a0b50Ce21A7bcbDD6Bb5aaC250aB', 1)
  const hubDigest = await hub.digestOf(ref, payloadHex)
  const ourDigest = ethers.utils.keccak256(ethers.utils.concat([ref, ethers.utils.keccak256(payloadHex)]))
  console.log('    hub  :', hubDigest)
  console.log('    ours :', ourDigest)
  check('digest recomputation matches the hub', hubDigest.toLowerCase() === ourDigest.toLowerCase())

  console.log('\n=== 10. containerIdentity(). The identity the hub API expects ===')
  const ident = await containerIdentity(provider, CONTAINER)
  console.log('   ', JSON.stringify(ident, null, 2).replace(/\n/g, '\n    '))
  check('chainId decoded', ident.chainId === 196)
  check('circuits is the processor contract', ident.circuits.toLowerCase() === CPU0.toLowerCase())
  check('tokenId decoded', ident.tokenId === '1')
  const identHub = await hub.accountOf(ident.circuits, ident.tokenId)
  check('hub.accountOf(circuits, tokenId) == container', utilsAddr(identHub).toLowerCase() === CONTAINER.toLowerCase())

  console.log('\n=== 11. processorIndex(), locate the processor in the factory table ===')
  const cpu = await processorIndex(provider, FACTORY, ident.circuits)
  console.log('    processor index:', cpu)
  check('processor index found', cpu >= 0)
  const cpuAt = await new ethers.Contract(FACTORY, ['function cpuAt(uint256) view returns (address)'], provider).cpuAt(cpu)
  check('cpuAt(index) == circuits', String(cpuAt).toLowerCase() === ident.circuits.toLowerCase())

  console.log('\n=== 12. keyFor() with the container-resolved identity ===')
  const rk2 = await recipientKey(provider, ident.circuits, ident.tokenId)
  check('same container as accountOf', rk2.container.toLowerCase() === CONTAINER.toLowerCase())
  check('published key is usable', rk2.usable === true)
  console.log('    published key:', rk2.publicKey)

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error('ERR', e); process.exit(1) })
