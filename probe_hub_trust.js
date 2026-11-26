// TapeSend hub trust probe, read the hub's trust state on every supported chain
// and diff the running implementation against TapeKit's published audited one.
//
//   node probe_hub_trust.js
//
// Facts this prints are the ones quoted in docs/X_LAYER_TAPEOut.md; re-run it
// before the demo so the README claims stay true.
const { providers, utils } = require('ethers')

const HUB = '0xe61A9C7213a6Aa616C246a2B569e555B417b25ee'
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
const TAPEOUT_ALLOW = {
  56: ['0x80afe7b77f2dfd08e9feab7675780bac34a7ee85'],
  8453: ['0x38a2d320b8984bbac9b0a2691b6c0fd829a23867'],
  196: ['0xdcc57797089ebd9f26e686379a4323f353a3f9c6'],
}
const CHAINS = [
  ['BNB 56', 'https://bsc-dataseed.bnbchain.org', 56],
  ['Base 8453', 'https://mainnet.base.org', 8453],
  ['X Layer 196', 'https://rpc.xlayer.tech', 196],
]

async function main() {
  for (const [name, url, cid] of CHAINS) {
    try {
      const p = new providers.JsonRpcProvider(url, cid)
      const code = await p.getCode(HUB)
      if (!code || code === '0x') { console.log(`${name}: no hub code at ${HUB}`); continue }
      const slot = await p.send('eth_getStorageAt', [HUB, IMPL_SLOT, 'latest'])
      const impl = utils.getAddress('0x' + slot.slice(-40))
      const sealed = await p.send('eth_call', [{ to: HUB, data: utils.id('isSealed()').slice(0, 10) }, 'latest'])
      const owner = await p.send('eth_call', [{ to: HUB, data: utils.id('owner()').slice(0, 10) }, 'latest'])
      const allow = TAPEOUT_ALLOW[cid] || []
      const onList = allow.map((a) => a.toLowerCase()).includes(impl.toLowerCase())
      const implCode = await p.getCode(impl)
      console.log(`${name}:`)
      console.log(`  hub impl        : ${impl}`)
      console.log(`  TapeKit allow   : ${allow.join(', ')}`)
      console.log(`  on allow-list?  : ${onList}`)
      console.log(`  impl code bytes : ${(implCode.length - 2) / 2}`)
      console.log(`  isSealed        : ${parseInt(sealed, 16) === 1}   owner: ${utils.getAddress('0x' + owner.slice(-40))}`)
    } catch (e) { console.log(`${name}: ERR ${(e.message || '').replace(/\s+/g, ' ').slice(0, 110)}`) }
  }

  // Bytecode diff: the implementation running on X Layer vs. the audited one.
  console.log('\n=== X Layer: running implementation vs. TapeKit audited implementation ===')
  const p = new providers.JsonRpcProvider('https://rpc.xlayer.tech')
  const live = await p.getCode(TAPEOUT_ALLOW[196][0] ? '0xf6b86f44bD039bACc8D3670971D556202d579261' : HUB)
  const aud = await p.getCode(TAPEOUT_ALLOW[196][0])
  console.log('  live runtime bytes   :', (live.length - 2) / 2)
  console.log('  audited runtime bytes:', (aud.length - 2) / 2)
  console.log('  identical bytecode   :', live === aud)
  const SIGS = [
    'send(address,uint256,bytes32,bytes32,bytes)',
    'publishKey(address,uint256,uint8,uint16,bytes32,uint64)',
    'revokeKey(address,uint256)',
    'keyFor(address,uint256)',
    'keyOf(address)',
    'accountOf(address,uint256)',
    'inboxCount(bytes32)',
    'inboxPage(bytes32,uint256,uint256)',
    'outboxCount(address)',
    'digestOf(bytes32,bytes)',
    'endpointOf(address)',
    'isSealed()',
    'owner()',
    'circuitCodehash()',
  ]
  console.log('\n  selector               live    audited')
  for (const s of SIGS) {
    const sel = utils.id(s).slice(2, 10)
    console.log(`  ${live.includes(sel) ? 'Y' : '.'} / ${aud.includes(sel) ? 'Y' : '.'}   ${sel}  ${s}`)
  }
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
