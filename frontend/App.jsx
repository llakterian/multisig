import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import EscrowInterface from './EscrowInterface';
import DocumentHashingSystem from './EscrowInterface';
import MultiSigVerification from './MultiSigVerification';
import ProgressBar from './ProgressBar';
import './App.css';

const FACTORY_ADDRESS = process.env.REACT_APP_FACTORY_ADDRESS || '';

const isValidAddress = (address) => {
  return address && ethers.utils.isAddress(address);
};

const App = () => {
  const [userAddress, setUserAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isNotary, setIsNotary] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState('escrow');
  const [factoryAddress, setFactoryAddress] = useState(FACTORY_ADDRESS);
  const [factoryContract, setFactoryContract] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

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
        
        if (!isValidAddress(accounts[0])) {
          setValidationErrors(prev => ({ ...prev, wallet: 'Invalid wallet address' }));
          return;
        }
        
        setUserAddress(accounts[0]);
        setIsConnected(true);
        
        if (factoryAddress && isValidAddress(factoryAddress)) {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const factory = new ethers.Contract(
            factoryAddress,
            ['function doddyNotary() view returns (address)', 'function owner() view returns (address)'],
            provider
          );
          setFactoryContract(factory);
          
          try {
            const notary = await factory.doddyNotary();
            const owner = await factory.owner();
            
            if (accounts[0].toLowerCase() === notary.toLowerCase()) {
              setIsNotary(true);
            }
            if (accounts[0].toLowerCase() === owner.toLowerCase()) {
              setIsOwner(true);
            }
          } catch (error) {
            console.error('Error fetching roles:', error);
          }
        }
      } catch (error) {
        console.error('Error connecting wallet:', error);
        setValidationErrors(prev => ({ ...prev, wallet: 'Failed to connect wallet' }));
      }
    } else {
      setValidationErrors(prev => ({ ...prev, wallet: 'Please install MetaMask to use this application' }));
    }
  };
  
  const handleFactoryAddressChange = (e) => {
    const value = e.target.value;
    setFactoryAddress(value);
    
    if (value && !isValidAddress(value)) {
      setValidationErrors(prev => ({ ...prev, factory: 'Invalid contract address' }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.factory;
        return newErrors;
      });
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
            isAdmin={isNotary || isOwner}
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
            <h1>Escrow</h1>
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
                {isOwner && (
                  <div className="owner-badge">Owner</div>
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
          {(isNotary || isOwner) && (
            <button
              className={`nav-tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              Admin Panel
            </button>
          )}
        </div>
      </nav>
      
      {!factoryAddress && (
        <div className="factory-config">
          <label htmlFor="factoryAddress">Factory Contract Address:</label>
          <input
            id="factoryAddress"
            type="text"
            value={factoryAddress}
            onChange={handleFactoryAddressChange}
            placeholder="0x..."
          />
          {validationErrors.factory && <span className="error">{validationErrors.factory}</span>}
        </div>
      )}

      <main className="app-main">
        {renderActiveTab()}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-info">
            <p>(c) 2024 Escrow Platform - Secure Land Purchase Platform</p>
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