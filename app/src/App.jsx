import React, { useMemo, useState } from 'react'
import { ethers } from 'ethers'
import Folder from './components/Folder'

const PHASES = ['Intake','Discovery','Plot Selected','Funded / DD Pending','Due Diligence Complete','Execution Pending','Execution Complete','Transfer Registry','Completed','Cancelled']
const ESCROW_ABI = [
  "function getEscrowProgress(uint256) view returns (uint8 state,bool[3] milestones,bool[5] docs,uint256[5] amounts)",
  "function createIntake(uint256 budget,uint256 desiredSize,string purpose,address seller,address notary) returns (uint256)",
  "function fundEscrow(uint256 id,bool fullAmount) payable",
  "function getMultiSigAddress() view returns (address)",
  "function getBalance() view returns (uint256)"
]
const FACTORY_ABI = [
  "function createEscrowWithDefaultNotary(address client,address seller,uint256 totalAmount) returns (address)",
  "function getUserEscrows(address) view returns (address[])"
]

export default function App() {
  const [account,setAccount]=useState('')
  const [factoryAddr,setFactoryAddr]=useState('')
  const [escrowAddr,setEscrowAddr]=useState('')
  const [status,setStatus]=useState(null)
  const [err,setErr]=useState('')
  const [busy,setBusy]=useState(false)
  const [form,setForm]=useState({seller:'',notary:'',budget:'1.0',size:'1',purpose:'Land purchase'})

  async function connect(){
    setErr('')
    if(!window.ethereum){ setErr('Install a Web3 wallet (e.g. MetaMask) to connect.'); return }
    const [a]=await window.ethereum.request({method:'eth_requestAccounts'})
    setAccount(ethers.utils.getAddress(a))
  }
  async function loadProgress(){
    if(!ethers.utils.isAddress(escrowAddr)) return setErr('Enter a valid escrow contract address.')
    setBusy(true); setErr('')
    try{
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      const c = new ethers.Contract(escrowAddr, ESCROW_ABI, provider)
      const p = await c.getEscrowProgress(0)
      const [ms,b] = await Promise.all([c.getMultiSigAddress(), c.getBalance()])
      setStatus({ state:Number(p.state), amounts:p.amounts, multisig:ms, balance:b })
    }catch(e){ setErr(e?.reason || e?.message || String(e)) }
    finally{ setBusy(false) }
  }
  const phase = status ? PHASES[status.state] || `State ${status.state}` : 'Not loaded'
  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <h1>Escrow Dossier</h1>
          <p>Notary-mediated land purchase, secured by multisig custody. Personal console.</p>
        </div>
        <div className="conn">
          {account ? <span className="pill mono">{account.slice(0,6)}…{account.slice(-4)}</span> : null}
          <button className="btn" onClick={connect}>{account?'Connected':'Connect wallet'}</button>
        </div>
      </header>

      <div className="grid">
        <aside className="stack">
          <div className="card">
            <div className="hd">Matter files</div>
            <div className="bd">
              <div className="folder-row"><Folder color="dossier" size="md" label="Active escrow" /></div>
              <p className="note" style={{margin:'8px 0 0'}}>Open the dossier to review the 4-stage record: intake & discovery, safety gate (due diligence), execution & fiat bridge, transfer registry.</p>
            </div>
          </div>
          <div className="card">
            <div className="hd">Connection</div>
            <div className="bd stack">
              <label>Factory address<input className="mono" value={factoryAddr} onChange={e=>setFactoryAddr(e.target.value)} placeholder="0x… factory (optional)" /></label>
              <label>Escrow address<input className="mono" value={escrowAddr} onChange={e=>setEscrowAddr(e.target.value)} placeholder="0x… escrow contract" /></label>
              <div className="row"><button className="btn secondary" disabled={busy} onClick={loadProgress}>Load progress</button></div>
              {err ? <div className="err">{err}</div> : null}
            </div>
          </div>
        </aside>

        <main className="stack">
          <div className="card">
            <div className="hd">Transaction record</div>
            <div className="bd">
              <div className="row" style={{alignItems:'center', marginBottom:12}}>
                <span className={`status ${status?'ok':'warn'}`}>{phase}</span>
                {status ? <span className="note mono">Multisig {status.multisig.slice(0,10)}… · Balance {ethers.utils.formatEther(status.balance)} ETH</span> : <span className="note">Load an escrow address to view on-chain progress.</span>}
              </div>
              <div className="phase-list">
                {['Intake & Discovery','Safety Gate (Due Diligence)','Execution & Fiat Bridge','Transfer Registry'].map((n,i)=>(
                  <div key={n} className={`phase ${status && Math.min(Math.floor(status.state/3),3)===i?'active':''}`}><strong>{n}</strong><span className="note">Phase {i+1}</span></div>
                ))}
              </div>
              {status ? (
                <div className="note" style={{marginTop:14}}>
                  DD fee: {ethers.utils.formatEther(status.amounts[0])} · Deposit: {ethers.utils.formatEther(status.amounts[1])} · Final: {ethers.utils.formatEther(status.amounts[2])} · Facilitation: {ethers.utils.formatEther(status.amounts[3])} · Deposited: {ethers.utils.formatEther(status.amounts[4])} ETH
                </div>
              ) : null}
            </div>
          </div>
          <div className="card">
            <div className="hd">New intake (local / personal)</div>
            <div className="bd stack">
              <p className="note">For a personal deployment, use the factory address and submit transactions from your connected wallet. Contract calls require the correct role (client/notary/treasury) per the audited flow.</p>
              <div className="row" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <label>Seller<input className="mono" value={form.seller} onChange={e=>setForm({...form,seller:e.target.value})} placeholder="0x…"/></label>
                <label>Notary<input className="mono" value={form.notary} onChange={e=>setForm({...form,notary:e.target.value})} placeholder="0x…"/></label>
              </div>
              <div className="row" style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:12}}>
                <label>Budget (ETH)<input value={form.budget} onChange={e=>setForm({...form,budget:e.target.value})}/></label>
                <label>Size<input value={form.size} onChange={e=>setForm({...form,size:e.target.value})}/></label>
                <label>Purpose<input value={form.purpose} onChange={e=>setForm({...form,purpose:e.target.value})}/></label>
              </div>
              <div className="row"><button className="btn secondary" disabled title="Wire to deployed factory to enable">Create via factory (configure)</button></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
