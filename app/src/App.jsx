import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Folder from './components/Folder'
import { PHASES, DOC_TYPES, FACTORY_ABI, ESCROW_ABI, MS_ABI } from './lib/abi'
import { HUB, endpointOf, sendPhase, readInbox, phaseRef, hubStatus, containerIdentity } from './lib/tapesend'

const env = (k) => (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[k]) || ''
const addr = (v) => { try { return ethers.utils.getAddress(v) } catch { return '' } }
const fmt = (v) => { try { return ethers.utils.formatEther(v) } catch { return String(v) } }

// X Layer (TapeOut Accelerate) — RPCs/chainIds verified live 2026-11-19 (eth_chainId: 0xc4 / 0x7a0)
const XLAYER_CHAINS = {
  196:  { chainId: '0xc4',  chainName: 'X Layer', rpcUrls: ['https://rpc.xlayer.tech'], nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 }, blockExplorerUrls: ['https://www.oklink.com/xlayer'] },
  1952: { chainId: '0x7a0', chainName: 'X Layer Testnet', rpcUrls: ['https://testrpc.xlayer.tech'], nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 }, blockExplorerUrls: ['https://www.oklink.com/xlayer'] },
}
const CHAIN_NAMES = { 1: 'Ethereum', 56: 'BNB Chain', 8453: 'Base', 196: 'X Layer', 1952: 'X Layer Testnet', 11155111: 'Sepolia' }
const TARGET_CHAIN = Number(env('VITE_XLAYER_CHAIN_ID') || 196)
async function switchChain(id = TARGET_CHAIN) {
  if (!window.ethereum) throw new Error('No Web3 wallet detected. Install MetaMask or a compatible wallet.')
  const cfg = XLAYER_CHAINS[id]; if (!cfg) throw new Error(`Unknown chain ${id}.`)
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: cfg.chainId }] })
  } catch (e) {
    const code = e?.code ?? e?.data?.originalError?.code
    if (code === 4902) await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [cfg] })
    else throw e
  }
}

function useProvider() {
  const [state, setState] = useState({ account: '', chainId: null, provider: null, signer: null })
  async function connect() {
    if (!window.ethereum) throw new Error('No Web3 wallet detected. Install MetaMask or a compatible wallet.')
    const provider = new ethers.providers.Web3Provider(window.ethereum, 'any')
    await provider.send('eth_requestAccounts', [])
    const signer = provider.getSigner()
    const account = addr(await signer.getAddress())
    const net = await provider.getNetwork()
    setState({ account, chainId: net.chainId, provider, signer })
    window.ethereum.on?.('accountsChanged', () => window.location.reload())
    window.ethereum.on?.('chainChanged', () => window.location.reload())
  }
  return { ...state, connect }
}

function Tx({ title, children, onRun, busy, note }) {
  const [msg,setMsg]=useState(''); const [err,setErr]=useState('')
  async function run(e){ e?.preventDefault?.(); setMsg(''); setErr(''); try{ const m=await onRun(); setMsg(m||'Transaction confirmed.') }catch(x){ setErr(x?.reason||x?.error?.message||x?.message||String(x)) } }
  return <form className="card" onSubmit={run}><div className="hd">{title}</div><div className="bd stack">{children}{note?<p className="note" style={{margin:0}}>{note}</p>:null}<div className="row"><button className="btn" disabled={busy} type="submit">Submit</button></div>{msg?<div className="status ok">{msg}</div>:null}{err?<div className="err">{err}</div>:null}</div></form>
}

export default function App() {
  const w = useProvider()
  const [factoryAddr,setFactoryAddr]=useState(env('VITE_FACTORY_ADDRESS')||'')
  const [escrowAddr,setEscrowAddr]=useState(env('VITE_ESCROW_ADDRESS')||'')
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const [ctx,setCtx]=useState(null) // escrow context
  const [myEscrows,setMyEscrows]=useState([])

  async function loadEscrow(address) {
    const a = addr(address||escrowAddr); if(!a) throw new Error('Enter a valid escrow address.')
    if(!w.provider) throw new Error('Connect wallet first.')
    const e = new ethers.Contract(a, ESCROW_ABI, w.provider)
    const [prog, msAddr, bal, treas, details] = await Promise.all([
      e.getEscrowProgress(0), e.getMultiSigAddress(), e.getBalance(), e.treasury(), e.escrows(0)
    ])
    const ms = new ethers.Contract(msAddr, MS_ABI, w.provider)
    let isMsOwner=false, owners=[], txCount=0
    try { [isMsOwner, owners, txCount] = await Promise.all([ms.isOwner(w.account||ethers.constants.AddressZero), ms.getOwners(), ms.getTransactionCount()]) } catch {}
    setCtx({
      address:a, state:Number(prog.state), releases:prog.releases, amounts:prog.amounts,
      multisig:msAddr, balance:bal, treasury:treas,
      client:details.client, seller:details.seller, notary:details.notary, budget:details.budget,
      isClient: w.account && addr(w.account)===addr(details.client),
      isSeller: w.account && addr(w.account)===addr(details.seller),
      isNotary: w.account && addr(w.account)===addr(details.notary),
      isTreasury: w.account && addr(w.account)===addr(treas),
      isMsOwner, owners, txCount
    })
    loadTrail(a, details).catch(()=>{}) // best-effort: notification trail for this escrow
  }
  async function refresh(){ if(!escrowAddr) return; setBusy(true); setErr(''); try{ await loadEscrow(escrowAddr) }catch(e){ setErr(e.message) }finally{ setBusy(false) } }

  async function createEscrow(form) {
    if(!w.signer) throw new Error('Connect wallet.')
    const fa=addr(factoryAddr); if(!fa) throw new Error('Set factory address.')
    const f = new ethers.Contract(fa, FACTORY_ABI, w.signer)
    const tx = await f.createEscrow(addr(form.client)||w.account, addr(form.seller), addr(form.notary), ethers.utils.parseEther(form.amount||'0'))
    const rc = await tx.wait()
    const ev = rc.events?.find(x=>x.event==='EscrowCreated')
    const ea = ev?.args?.escrowContract
    if(ea){ setEscrowAddr(ea); await loadEscrow(ea) }
    return ea ? `Escrow created at ${ea}` : 'Escrow created.'
  }

  async function runEscrow(fn){ if(!w.signer||!ctx) throw new Error('Connect wallet and load escrow.'); const c=new ethers.Contract(ctx.address, ESCROW_ABI, w.signer); const tx=await fn(c); await tx.wait(); await loadEscrow(ctx.address); return `Confirmed: ${tx.hash.slice(0,10)}…` }
  async function runMs(fn){ if(!w.signer||!ctx) throw new Error('Connect wallet and load escrow.'); const c=new ethers.Contract(ctx.multisig, MS_ABI, w.signer); const tx=await fn(c); await tx.wait(); await loadEscrow(ctx.address); return `Multisig tx confirmed: ${tx.hash.slice(0,10)}…` }

  // --- TapeSend: on-chain notification trail for this escrow's participants ---
  const participantRefs = (escrow) => new Set([0,1,2,3,4].map(p => phaseRef(escrow, p)))
  async function loadTrail(escrow, details) {
    if (!w.provider || !details) return
    setTapeErr('')
    if (!tape.container) { setTrail([]); return }
    try {
      const chainId = w.chainId || TARGET_CHAIN
      const refs = participantRefs(escrow)
      const people = [['Client', details.client], ['Seller', details.seller], ['Notary', details.notary]]
      const seen = new Map()
      for (const [label, who] of people) {
        if (!who) continue
        const r = await readInbox(w.provider, { endpoint: endpointOf(chainId, who), fromBlock: tape.fromBlock, limit: 20, chainId })
        for (const it of r.items) if (it.ref && refs.has(it.ref.toLowerCase())) seen.set(it.index + who, { ...it, label, who })
      }
      setTrail([...seen.values()].sort((a,b)=>b.timestamp-a.timestamp).slice(0,12))
    } catch (e) { setTapeErr(e?.message || String(e)) }
  }
  async function notifyPhase() {
    if (!w.signer || !ctx) throw new Error('Connect wallet and load escrow.')
    if (!tape.container) throw new Error('TapeSend container not configured (VITE_TAPE_CONTAINER).')
    if (!tapeIdent) throw new Error('Could not read the container identity on-chain — check VITE_TAPE_CONTAINER and the network.')
    const chainId = w.chainId || TARGET_CHAIN
    const ref = phaseRef(ctx.address, ctx.state)
    const subject = `SafeShamba · ${PHASES[ctx.state] || 'Phase ' + ctx.state}`
    const body = `Escrow ${ctx.address} entered ${PHASES[ctx.state] || ctx.state}. Document hashes and releases are enforced on-chain.`
    const people = [['Client', ctx.client], ['Seller', ctx.seller], ['Notary', ctx.notary]]
    const sent = []
    for (const [label, who] of people) {
      if (!who) continue
      const r = await sendPhase({
        signer: w.signer, circuits: tapeIdent.circuits, tokenId: tapeIdent.tokenId, cpuIndex: tape.cpu,
        container: tape.container, holder: w.account, chainId,
        to: endpointOf(chainId, who), subject, body, ref,
      })
      sent.push(`${label} #${r.inboxIndex}`)
    }
    await loadTrail(ctx.address, { client: ctx.client, seller: ctx.seller, notary: ctx.notary })
    return `Published ${sent.join(', ')} to the TapeSend hub ${HUB.slice(0,10)}…`
  }

  const [cform,setCform]=useState({client:'',seller:'',notary:'',amount:'1.0'})
  const [ifm,setIfm]=useState({budget:'1.0',size:'1',purpose:'Land purchase',seller:'',notary:''})
  const [doc,setDoc]=useState({type:1,hash:''})
  const [fiat,setFiat]=useState({kes:'100000',rate:'130'})
  const [rates,setRates]=useState({deposit:'1000',fee:'200'})
  const [rel,setRel]=useState({purpose:'DD',to:'',amount:''})
  // TapeSend (TAP-10) phase notifications — container minted in build stage 5
  const tape = {
    circuits: env('VITE_TAPE_CIRCUITS') || '0x1f09daefa827f02cbb40967cc91b259763760761', // TapeOut factory on X Layer (verified live)
    tokenId: env('VITE_TAPE_TOKEN_ID') || '0',
    cpu: env('VITE_TAPE_CPU') || '0',
    container: env('VITE_TAPE_CONTAINER') || '',
    fromBlock: Number(env('VITE_TAPE_FROM_BLOCK') || 0),
  }
  const [trail,setTrail]=useState([]); const [tapeErr,setTapeErr]=useState(''); const [tapeMsg,setTapeMsg]=useState('')
  const [tapeIdent,setTapeIdent]=useState(null); const [hubState,setHubState]=useState(null)

  useEffect(()=>{ if(w.account && !cform.client) setCform(f=>({...f,client:w.account})) },[w.account])

  // Resolve the container's on-chain identity (chainId, circuits contract, token id)
  // and read the hub's trust state. Both are shown in the TapeSend card — the hub
  // is a proxy the owner can still upgrade, so the app states the facts instead
  // of implying a sealed, audited deployment.
  useEffect(()=>{
    let dead = false
    async function load(){
      if(!w.provider) return
      if(tape.container){
        try { const id = await containerIdentity(w.provider, tape.container); if(!dead) setTapeIdent(id) }
        catch(e) { if(!dead) setTapeIdent(null) }
      }
      try { const hs = await hubStatus(w.provider, w.chainId || TARGET_CHAIN); if(!dead) setHubState(hs) }
      catch(e) { if(!dead) setHubState(null) }
    }
    load()
    return ()=>{ dead = true }
  },[w.provider, w.chainId, tape.container])

  const role = ctx ? (ctx.isClient?'Client':ctx.isNotary?'Notary':ctx.isTreasury?'Treasury':ctx.isMsOwner?'Multisig owner':ctx.isSeller?'Seller':'Observer') : '—'
  const native = (w.chainId===196||w.chainId===1952) ? 'OKB' : 'ETH' // X Layer gas token is OKB

  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><h1>SafeShamba</h1><p>Secure land purchase with multisig custody. Personal console.</p></div>
        <div className="conn">
          {w.account ? <span className="pill mono">{w.account.slice(0,6)}…{w.account.slice(-4)}</span> : null}
          {w.chainId ? <span className="pill" style={w.chainId===TARGET_CHAIN?{color:'var(--accent)'}:{color:'#e0a458'}} title={w.chainId===TARGET_CHAIN?'On the expected chain':'Wrong network — switch to X Layer'}>{CHAIN_NAMES[w.chainId]||`chain ${w.chainId}`}</span> : null}
          {w.account && w.chainId!==TARGET_CHAIN ? <button className="btn secondary" onClick={()=>switchChain().catch(e=>setErr(e.message))}>Switch to X Layer</button> : null}
          <button className="btn" onClick={()=>w.connect().catch(e=>setErr(e.message))}>{w.account?'Connected':'Connect wallet'}</button>
        </div>
      </header>

      <div className="grid">
        <aside className="stack">
          <div className="card"><div className="hd">Matter files</div><div className="bd"><div className="folder-container"><Folder color="dossier" size="md" label={ctx?`Escrow · ${PHASES[ctx.state]||ctx.state}`:'Active escrow'} /></div><p className="note" style={{margin:'12px 0 0', lineHeight:1.5}}>Four stages: intake & discovery, safety gate (due diligence), execution & fiat bridge, transfer registry. Funds move to multisig custody; releases are state-gated and require multisig owner confirmation.</p></div></div>
          <div className="card"><div className="hd">Connection</div><div className="bd stack">
            <label>Factory<input className="mono" value={factoryAddr} onChange={e=>setFactoryAddr(e.target.value)} placeholder="0x… (VITE_FACTORY_ADDRESS)"/></label>
            <label>Escrow<input className="mono" value={escrowAddr} onChange={e=>setEscrowAddr(e.target.value)} placeholder="0x… (VITE_ESCROW_ADDRESS)"/></label>
            <div className="row"><button className="btn secondary" onClick={refresh} disabled={busy}>Load escrow</button></div>
            {err?<div className="err">{err}</div>:null}
          </div></div>
          {ctx ? <div className="card"><div className="hd">Record</div><div className="bd stack note">
            <div className="grid-2"><div><strong>State:</strong> {PHASES[ctx.state]}</div><div><strong>Role:</strong> {role}</div></div>
            <div className="addr-line"><strong>Client</strong> {ctx.client}</div>
            <div className="addr-line"><strong>Seller</strong> {ctx.seller}</div>
            <div className="addr-line"><strong>Notary</strong> {ctx.notary}</div>
            <div className="addr-line"><strong>Treasury</strong> {ctx.treasury}</div>
            <div className="addr-line"><strong>Multisig</strong> {ctx.multisig}</div>
            <div>Deposited {fmt(ctx.amounts[4])} {native} · Released {fmt(ctx.amounts[5])} {native} · Multisig balance {fmt(ctx.balance)} {native}</div>
            <div>DD {fmt(ctx.amounts[0])} · Facilitation {fmt(ctx.amounts[3])} · Deposit {fmt(ctx.amounts[1])} · Final {fmt(ctx.amounts[2])}</div>
          </div></div> : null}
          {ctx ? <div className="card"><div className="hd">TapeSend · notification trail</div><div className="bd stack note">
            <div className="addr-line"><strong>Hub</strong> <span className="mono">{HUB.slice(0,10)}…{HUB.slice(-6)}</span> · {CHAIN_NAMES[w.chainId] || (w.chainId ? 'chain ' + w.chainId : '—')}</div>
            {hubState ? <>
              <div className="addr-line"><strong>Hub impl</strong> <span className="mono">{hubState.implementation ? hubState.implementation.slice(0,10)+'…'+hubState.implementation.slice(-6) : '—'}</span> · {hubState.expectedImplementation ? 'audited build' : 'not the published audited build'} · {hubState.sealed ? 'sealed' : 'owner can still upgrade'}</div>
              <p style={{margin:0}}>Read live from the chain on every load. The hub is a proxy: until it is sealed, its owner can replace the implementation, so notifications are verifiable but not yet final.</p>
            </> : null}
            {!tape.container ? <p style={{margin:0}}>Phase notifications activate once the SafeShamba container is minted on X Layer (build stage 5 → sets <span className="mono">VITE_TAPE_CONTAINER</span>).</p> : <>
              {tapeIdent ? <div className="addr-line"><strong>Container</strong> <span className="mono">{tape.container.slice(0,10)}…{tape.container.slice(-6)}</span> · circuit <span className="mono">{tapeIdent.circuits.slice(0,10)}…</span> · token #{tapeIdent.tokenId}</div> : null}
              {trail.length ? trail.map((t,i)=>(
                <div key={i} className="addr-line" title={t.body||''}><strong>{t.label}</strong> {t.subject || 'phase update'} <span style={{opacity:.7}}>· {t.digestOk ? '✓ digest verified' : (t.openError || '…')} · {new Date(t.timestamp*1000).toLocaleString()}</span></div>
              )) : <p style={{margin:0}}>No phase notifications yet for this escrow.</p>}
              <div className="row"><button className="btn secondary" disabled={busy} onClick={async()=>{setBusy(true);setTapeErr('');setTapeMsg('');try{setTapeMsg(await notifyPhase())}catch(e){setTapeErr(e?.reason||e?.error?.message||e.message)}finally{setBusy(false)}}}>Notify participants of current phase</button></div>
            </>}
            {tapeMsg?<div className="status ok">{tapeMsg}</div>:null}
            {tapeErr?<div className="err">{tapeErr}</div>:null}
          </div></div> : null}
        </aside>

        <main className="stack">
          <div className="card"><div className="hd">Create escrow (factory)</div><div className="bd stack note">
            <div className="grid-2">
              <label>Client<input className="mono" value={cform.client} onChange={e=>setCform({...cform,client:e.target.value})}/></label>
              <label>Seller<input className="mono" value={cform.seller} onChange={e=>setCform({...cform,seller:e.target.value})}/></label>
              <label>Notary<input className="mono" value={cform.notary} onChange={e=>setCform({...cform,notary:e.target.value})}/></label>
              <label>Total ({native})<input value={cform.amount} onChange={e=>setCform({...cform,amount:e.target.value})}/></label>
            </div>
            <div className="row"><button className="btn secondary" disabled={busy||!w.signer} onClick={async()=>{setBusy(true);setErr('');try{setErr(await createEscrow(cform))}catch(e){setErr(e?.reason||e.message)}finally{setBusy(false)}}}>Create via factory</button></div>
            <p style={{margin:0}}>Requires connected wallet and factory address. The factory initializes client/seller/notary atomically.</p>
          </div></div>

          {ctx && ctx.isClient ? <div className="phase-list">
            <Tx title="Client — Select plot" busy={busy} onRun={()=>runEscrow(c=>c.selectPlot(0))} note="Discovery → Plot selected."/>
            <Tx title="Client — Fund escrow" busy={busy} onRun={()=>runEscrow(c=>c.fundEscrow(0,true,{value:ethers.utils.parseEther(fmt(ctx.budget))}))} note={`Pays full budget (${fmt(ctx.budget)} ${native}) into multisig custody.`}/>
            <Tx title="Client — Verify document" busy={busy} onRun={()=>runEscrow(c=>c.verifyDocument(0, Number(doc.type)))}><label>Document type<select value={doc.type} onChange={e=>setDoc({...doc,type:e.target.value})}>{DOC_TYPES.map((n,i)=><option key={n} value={i}>{i}: {n}</option>)}</select></label></Tx>
            <Tx title="Client — Proceed with purchase" busy={busy} onRun={()=>runEscrow(c=>c.proceedWithPurchase(0))}/>
            <Tx title="Client — Cancel (pre-execution)" busy={busy} onRun={()=>runEscrow(c=>c.cancelEscrow(0))} note="Only before execution; enables refund release authorization."/>
          </div> : null}

          {ctx && (ctx.isNotary || ctx.isTreasury) ? <div className="phase-list">
            <Tx title="Treasury/Notary — Upload gallery (advance to discovery)" busy={busy} onRun={()=>runEscrow(c=>c.uploadDigitalGallery(0))}/>
            <Tx title="Notary — Upload document hash" busy={busy} onRun={()=>runEscrow(c=>c.uploadDocument(0, Number(doc.type), doc.hash||ethers.constants.HashZero))}>
              <label>Type<select value={doc.type} onChange={e=>setDoc({...doc,type:e.target.value})}>{DOC_TYPES.map((n,i)=><option key={n} value={i}>{i}: {n}</option>)}</select></label>
              <label>Hash (bytes32)<input className="mono" value={doc.hash} onChange={e=>setDoc({...doc,hash:e.target.value})} placeholder="0x…"/></label>
            </Tx>
            <Tx title="Notary — Set negotiated rates" busy={busy} onRun={()=>runEscrow(c=>c.setNegotiatedRates(0, Number(rates.deposit), Number(rates.fee)))}>
              <div className="grid-2">
                <label>Deposit (bp)<input value={rates.deposit} onChange={e=>setRates({...rates,deposit:e.target.value})}/></label>
                <label>Facilitation fee (bp, ≤500)<input value={rates.fee} onChange={e=>setRates({...rates,fee:e.target.value})}/></label>
              </div>
            </Tx>
            <Tx title="Notary — Execute fiat bridge" busy={busy} onRun={()=>runEscrow(c=>c.executeFiatBridge(0, ethers.BigNumber.from(fiat.kes||'0'), ethers.BigNumber.from(fiat.rate||'0')))}>
              <div className="grid-2"><label>KES amount<input value={fiat.kes} onChange={e=>setFiat({...fiat,kes:e.target.value})}/></label><label>Exchange rate<input value={fiat.rate} onChange={e=>setFiat({...fiat,rate:e.target.value})}/></label></div>
            </Tx>
            <Tx title="Notary — Upload lodgement receipt" busy={busy} onRun={()=>runEscrow(c=>c.uploadLodgementReceipt(0, doc.hash||ethers.constants.HashZero, Math.floor(Date.now()/1000)+30*86400))}/>
            <Tx title="Notary — Complete transfer" busy={busy} onRun={()=>runEscrow(c=>c.completeTransfer(0, doc.hash||ethers.constants.HashZero, 'TRACKING'))}/>
          </div> : null}

          {ctx && ctx.isMsOwner ? <div className="card"><div className="hd">Multisig owner — submit authorized release</div><div className="bd stack note">
            <p style={{margin:0}}>Releases are <strong>state-gated</strong>: the escrow authorizes (escrowId, recipient, amount, purpose) only when the workflow state permits it. Submitting consumes the release slot and creates/confirms a multisig transaction.</p>
            <label>Purpose<select value={rel.purpose} onChange={async e=>{const p=e.target.value; const map={DD:await new ethers.Contract(ctx.address,ESCROW_ABI,w.provider).P_DD_FEE(),FAC:await new ethers.Contract(ctx.address,ESCROW_ABI,w.provider).P_FACILITATION(),REF:await new ethers.Contract(ctx.address,ESCROW_ABI,w.provider).P_REFUND()}; setRel({...rel,purpose:p,_hash:map[p]})}}>
              <option value="DD">DD_FEE → treasury ({fmt(ctx.amounts[0])} {native})</option>
              <option value="FAC">FACILITATION → treasury ({fmt(ctx.amounts[3])} {native}, after completion)</option>
              <option value="REF">REFUND → client ({fmt(ctx.amounts[4]-ctx.amounts[5])} {native}, after cancel)</option>
            </select></label>
            <label>Recipient<input className="mono" value={rel.to} onChange={e=>setRel({...rel,to:e.target.value})} placeholder="defaults per purpose"/></label>
            <label>Amount ({native})<input value={rel.amount} onChange={e=>setRel({...rel,amount:e.target.value})} placeholder="defaults per purpose"/></label>
            <div className="row"><button className="btn" disabled={busy} onClick={async()=>{
              setBusy(true);setErr('');try{
                const ec=new ethers.Contract(ctx.address,ESCROW_ABI,w.provider);
                const map={DD:[ctx.treasury,ctx.amounts[0],await ec.P_DD_FEE()],FAC:[ctx.treasury,ctx.amounts[3],await ec.P_FACILITATION()],REF:[ctx.client,ctx.amounts[4].sub(ctx.amounts[5]),await ec.P_REFUND()]};
                const [toD,amtD,purpose]=map[rel.purpose];
                const to=addr(rel.to)||toD; const amt=rel.amount?ethers.utils.parseEther(rel.amount):amtD;
                const ok=await ec.releaseAuthorized(0,to,amt,purpose);
                if(!ok) throw new Error('Escrow does not authorize this release in the current state (check state/recipient/amount/purpose).');
                const ms=new ethers.Contract(ctx.multisig,MS_ABI,w.signer);
                const tx=await ms.submitAuthorizedRelease(ctx.address,0,to,amt,purpose); await tx.wait(); await loadEscrow(ctx.address);
                setErr('Release submitted and confirmed by your signature (auto-executes at threshold).');
              }catch(e){setErr(e?.reason||e?.error?.message||e.message)}finally{setBusy(false)}
            }}>Submit authorized release</button></div>
            {err?<div className="status warn">{err}</div>:null}
          </div></div> : null}

          {ctx && role==='Observer' ? <div className="card"><div className="bd note">Connected as observer. Role-based actions appear for the client, notary/treasury, or multisig owners of this escrow.</div></div> : null}
        </main>
      </div>
<footer style={{textAlign:'center',padding:'20px 16px',color:'var(--muted)',fontFamily:'ui-sans-serif,system-ui,sans-serif',fontSize:'0.8rem',lineHeight:1.6, borderTop:'1px solid var(--line)',marginTop:24}}>
        <div>Secure land purchase with multisig custody & notary verification</div>
        <div style={{marginTop:4}}>
          <a href="https://las.longspear.co.ke" target="_blank" rel="noopener noreferrer" style={{color:'var(--accent)',textDecoration:'none'}}>Longspear</a> ·{' '}
          <a href="mailto:cheru.sambu@longspear.co.ke" style={{color:'var(--accent)',textDecoration:'none'}}>cheru</a> ·{' '}
          <a href="https://github.com/llakterian/multisig" target="_blank" rel="noopener noreferrer" style={{color:'var(--accent)',textDecoration:'none'}}>Source</a>
        </div>
      </footer>
    </div>
  )
}
