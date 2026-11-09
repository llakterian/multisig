import React, { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import Folder from './components/Folder'
import { PHASES, DOC_TYPES, FACTORY_ABI, ESCROW_ABI, MS_ABI } from './lib/abi'

const env = (k) => (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[k]) || ''
const addr = (v) => { try { return ethers.utils.getAddress(v) } catch { return '' } }
const fmt = (v) => { try { return ethers.utils.formatEther(v) } catch { return String(v) } }

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
      isTreasury: w.account && addr(w.account)===addr(treasas),
      isMsOwner, owners, txCount
    })
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

  const [cform,setCform]=useState({client:'',seller:'',notary:'',amount:'1.0'})
  const [ifm,setIfm]=useState({budget:'1.0',size:'1',purpose:'Land purchase',seller:'',notary:''})
  const [doc,setDoc]=useState({type:1,hash:''})
  const [fiat,setFiat]=useState({kes:'100000',rate:'130'})
  const [rates,setRates]=useState({deposit:'1000',fee:'200'})
  const [rel,setRel]=useState({purpose:'DD',to:'',amount:''})

  useEffect(()=>{ if(w.account && !cform.client) setCform(f=>({...f,client:w.account})) },[w.account])

  const role = ctx ? (ctx.isClient?'Client':ctx.isNotary?'Notary':ctx.isTreasury?'Treasury':ctx.isMsOwner?'Multisig owner':ctx.isSeller?'Seller':'Observer') : '—'

  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><h1>Escrow Dossier</h1><p>Notary-mediated land purchase with multisig custody. Personal console.</p></div>
        <div className="conn">
          {w.account ? <span className="pill mono">{w.account.slice(0,6)}…{w.account.slice(-4)}</span> : null}
          <button className="btn" onClick={()=>w.connect().catch(e=>setErr(e.message))}>{w.account?'Connected':'Connect wallet'}</button>
        </div>
      </header>

      <div className="grid">
        <aside className="stack">
          <div className="card"><div className="hd">Matter files</div><div className="bd"><div className="folder-row"><Folder color="dossier" size="md" label={ctx?`Escrow · ${PHASES[ctx.state]||ctx.state}`:'Active escrow'} /></div><p className="note" style={{margin:'8px 0 0'}}>Four stages: intake & discovery, safety gate (due diligence), execution & fiat bridge, transfer registry. Funds move to multisig custody; releases are state-gated and require multisig owner confirmation.</p></div></div>
          <div className="card"><div className="hd">Connection</div><div className="bd stack">
            <label>Factory<input className="mono" value={factoryAddr} onChange={e=>setFactoryAddr(e.target.value)} placeholder="0x… (VITE_FACTORY_ADDRESS)"/></label>
            <label>Escrow<input className="mono" value={escrowAddr} onChange={e=>setEscrowAddr(e.target.value)} placeholder="0x… (VITE_ESCROW_ADDRESS)"/></label>
            <div className="row"><button className="btn secondary" onClick={refresh} disabled={busy}>Load escrow</button></div>
            {err?<div className="err">{err}</div>:null}
          </div></div>
          {ctx ? <div className="card"><div className="hd">Record</div><div className="bd stack note">
            <div><strong>State:</strong> {PHASES[ctx.state]}</div>
            <div><strong>Your role:</strong> {role}</div>
            <div className="mono"><strong>Client</strong> {ctx.client}</div>
            <div className="mono"><strong>Seller</strong> {ctx.seller}</div>
            <div className="mono"><strong>Notary</strong> {ctx.notary}</div>
            <div className="mono"><strong>Treasury</strong> {ctx.treasury}</div>
            <div className="mono"><strong>Multisig</strong> {ctx.multisig}</div>
            <div>Deposited {fmt(ctx.amounts[4])} ETH · Released {fmt(ctx.amounts[5])} ETH · Multisig balance {fmt(ctx.balance)} ETH</div>
            <div>DD {fmt(ctx.amounts[0])} · Facilitation {fmt(ctx.amounts[3])} · Deposit {fmt(ctx.amounts[1])} · Final {fmt(ctx.amounts[2])}</div>
          </div></div> : null}
        </aside>

        <main className="stack">
          <div className="card"><div className="hd">Create escrow (factory)</div><div className="bd stack note">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <label>Client<input className="mono" value={cform.client} onChange={e=>setCform({...cform,client:e.target.value})}/></label>
              <label>Seller<input className="mono" value={cform.seller} onChange={e=>setCform({...cform,seller:e.target.value})}/></label>
              <label>Notary<input className="mono" value={cform.notary} onChange={e=>setCform({...cform,notary:e.target.value})}/></label>
              <label>Total (ETH)<input value={cform.amount} onChange={e=>setCform({...cform,amount:e.target.value})}/></label>
            </div>
            <div className="row"><button className="btn secondary" disabled={busy||!w.signer} onClick={async()=>{setBusy(true);setErr('');try{setErr(await createEscrow(cform))}catch(e){setErr(e?.reason||e.message)}finally{setBusy(false)}}}>Create via factory</button></div>
            <p style={{margin:0}}>Requires connected wallet and factory address. The factory initializes client/seller/notary atomically.</p>
          </div></div>

          {ctx && ctx.isClient ? <div className="phase-list">
            <Tx title="Client — Select plot" busy={busy} onRun={()=>runEscrow(c=>c.selectPlot(0))} note="Discovery → Plot selected."/>
            <Tx title="Client — Fund escrow" busy={busy} onRun={()=>runEscrow(c=>c.fundEscrow(0,true,{value:ethers.utils.parseEther(fmt(ctx.budget))}))} note={`Pays full budget (${fmt(ctx.budget)} ETH) into multisig custody.`}/>
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
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <label>Deposit (bp)<input value={rates.deposit} onChange={e=>setRates({...rates,deposit:e.target.value})}/></label>
                <label>Facilitation fee (bp, ≤500)<input value={rates.fee} onChange={e=>setRates({...rates,fee:e.target.value})}/></label>
              </div>
            </Tx>
            <Tx title="Notary — Execute fiat bridge" busy={busy} onRun={()=>runEscrow(c=>c.executeFiatBridge(0, ethers.BigNumber.from(fiat.kes||'0'), ethers.BigNumber.from(fiat.rate||'0')))}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><label>KES amount<input value={fiat.kes} onChange={e=>setFiat({...fiat,kes:e.target.value})}/></label><label>Exchange rate<input value={fiat.rate} onChange={e=>setFiat({...fiat,rate:e.target.value})}/></label></div>
            </Tx>
            <Tx title="Notary — Upload lodgement receipt" busy={busy} onRun={()=>runEscrow(c=>c.uploadLodgementReceipt(0, doc.hash||ethers.constants.HashZero, Math.floor(Date.now()/1000)+30*86400))}/>
            <Tx title="Notary — Complete transfer" busy={busy} onRun={()=>runEscrow(c=>c.completeTransfer(0, doc.hash||ethers.constants.HashZero, 'TRACKING'))}/>
          </div> : null}

          {ctx && ctx.isMsOwner ? <div className="card"><div className="hd">Multisig owner — submit authorized release</div><div className="bd stack note">
            <p style={{margin:0}}>Releases are <strong>state-gated</strong>: the escrow authorizes (escrowId, recipient, amount, purpose) only when the workflow state permits it. Submitting consumes the release slot and creates/confirms a multisig transaction.</p>
            <label>Purpose<select value={rel.purpose} onChange={async e=>{const p=e.target.value; const map={DD:await new ethers.Contract(ctx.address,ESCROW_ABI,w.provider).P_DD_FEE(),FAC:await new ethers.Contract(ctx.address,ESCROW_ABI,w.provider).P_FACILITATION(),REF:await new ethers.Contract(ctx.address,ESCROW_ABI,w.provider).P_REFUND()}; setRel({...rel,purpose:p,_hash:map[p]})}}>
              <option value="DD">DD_FEE → treasury ({fmt(ctx.amounts[0])} ETH)</option>
              <option value="FAC">FACILITATION → treasury ({fmt(ctx.amounts[3])} ETH, after completion)</option>
              <option value="REF">REFUND → client ({fmt(ctx.amounts[4]-ctx.amounts[5])} ETH, after cancel)</option>
            </select></label>
            <label>Recipient<input className="mono" value={rel.to} onChange={e=>setRel({...rel,to:e.target.value})} placeholder="defaults per purpose"/></label>
            <label>Amount (ETH)<input value={rel.amount} onChange={e=>setRel({...rel,amount:e.target.value})} placeholder="defaults per purpose"/></label>
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
    </div>
  )
}
