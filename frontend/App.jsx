import React, { useState, useEffect } from 'react';
import EscrowInterface from './EscrowInterface';
import DocumentHashingSystem from './DocumentHashingSystem';
import MultiSigVerification from './MultiSigVerification';
import ProgressBar from './ProgressBar';
import './App.css';

const App = () => {
  const [userAddress, setUserAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isNotary, setIsNotary] = useState(false);
  const [activeTab, setActiveTab] = useState('escrow');
  const [factoryAddress] = useState('0x59b670e9fA9D0A427751Af201D676719a970857b'); // Deployed EscrowFactory address

  const phases = [
    { id: 0, name: 'Intake & Discovery', description: 'Submit requirements and select plot' },
    { id: 1, name: 'Safety Gate', description: '$200 Due Diligence and DD report' },
    { id: 2, name: 'Execution & Fiat Bridge', description: 'Crypto to KES conversion and payment' },
    { id: 3, name: 'Transfer Registry', description: 'Land registry processing and title issuance' }
  ];

  useEffect(() => {
    connectWallet();
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });
        setUserAddress(accounts[0]);
        setIsConnected(true);

        // Check if user is Doddy (notary) - address from Hardhat Account #1
        if (accounts[0].toLowerCase() === '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'.toLowerCase()) {
          setIsNotary(true);
        }
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else {
      alert('Please install MetaMask to use this application');
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'escrow':
        return <EscrowInterface factoryAddress={factoryAddress} userAddress={userAddress} />;
      case 'documents':
        return (
          <DocumentHashingSystem
            escrowAddress={factoryAddress}
            userAddress={userAddress}
            isNotary={isNotary}
          />
        );
      case 'multisig':
        return (
          <MultiSigVerification
            escrowAddress={factoryAddress}
            userAddress={userAddress}
            isOwner={true} // In production, check if user is owner
          />
        );
      case 'admin':
        return (
          <NotaryAdminPanel
            escrowAddress={factoryAddress}
            userAddress={userAddress}
            isAdmin={isNotary} // In production, check admin role
          />
        );
      default:
        return <EscrowInterface factoryAddress={factoryAddress} userAddress={userAddress} />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <h1>Sizland Escrow</h1>
            <p>Notary-Mediated Land Purchase Platform</p>
          </div>

          <div className="wallet-section">
            {isConnected ? (
              <div className="wallet-info">
                <div className="address">
                  {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                </div>
                {isNotary && (
                  <div className="notary-badge">Notary</div>
                )}
              </div>
            ) : (
              <button className="connect-btn" onClick={connectWallet}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="app-nav">
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'escrow' ? 'active' : ''}`}
            onClick={() => setActiveTab('escrow')}
          >
            Escrow
          </button>
          <button
            className={`nav-tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            Documents
          </button>
          <button
            className={`nav-tab ${activeTab === 'multisig' ? 'active' : ''}`}
            onClick={() => setActiveTab('multisig')}
          >
            Multi-Sig
          </button>
          {isNotary && (
            <button
              className={`nav-tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              Admin Panel
            </button>
          )}
        </div>
      </nav>

      <main className="app-main">
        {renderActiveTab()}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-info">
            <p>(c) 2024 Sizland Escrow - Secure Land Purchase Platform</p>
            <p>Powered by Ethereum Smart Contracts & Notary Verification</p>
          </div>

          <div className="footer-links">
            <a href="#help">Help</a>
            <a href="#terms">Terms</a>
            <a href="#privacy">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;