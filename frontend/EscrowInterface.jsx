import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { NotaryMediatedEscrow, EscrowFactory } from './contracts';

const EscrowInterface = ({ factoryAddress, userAddress }) => {
  const [escrows, setEscrows] = useState([]);
  const [selectedEscrow, setSelectedEscrow] = useState(null);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(null);
  const [factory, setFactory] = useState(null);

  // Phases for the workflow
  const phases = [
    { id: 0, name: 'Intake & Discovery', description: 'Submit requirements and select plot' },
    { id: 1, name: 'Safety Gate', description: '$200 Due Diligence and DD report' },
    { id: 2, name: 'Execution & Fiat Bridge', description: 'Crypto to KES conversion and payment' },
    { id: 3, name: 'Transfer Registry', description: 'Land registry processing and title issuance' }
  ];

  useEffect(() => {
    initializeContracts();
  }, []);

  const initializeContracts = async () => {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(provider);
      
      const factory = new ethers.Contract(factoryAddress, EscrowFactory.abi, provider);
      setFactory(factory);
      
      await loadUserEscrows(factory, userAddress);
    }
  };

  const loadUserEscrows = async (factory, userAddress) => {
    try {
      const userEscrowAddresses = await factory.getUserEscrows(userAddress);
      const escrowDetails = await Promise.all(
        userEscrowAddresses.map(async (address) => {
          const escrow = new ethers.Contract(address, NotaryMediatedEscrow.abi, provider);
          const progress = await escrow.getEscrowProgress(0);
          return {
            address,
            ...progress
          };
        })
      );
      setEscrows(escrowDetails);
    } catch (error) {
      console.error('Error loading escrows:', error);
    }
  };

  const createNewEscrow = async (sellerAddress, totalAmount) => {
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const factoryWithSigner = factory.connect(signer);
      
      const tx = await factoryWithSigner.createEscrowWithDefaultNotary(sellerAddress, totalAmount);
      await tx.wait();
      
      await loadUserEscrows(factory, userAddress);
    } catch (error) {
      console.error('Error creating escrow:', error);
    } finally {
      setLoading(false);
    }
  };

  const fundEscrow = async (escrowAddress, amount) => {
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const escrow = new ethers.Contract(escrowAddress, NotaryMediatedEscrow.abi, signer);
      
      const tx = await escrow.fundEscrow(escrowAddress, { value: amount });
      await tx.wait();
      
      await loadUserEscrows(factory, userAddress);
    } catch (error) {
      console.error('Error funding escrow:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyDocument = async (escrowAddress, documentType) => {
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const escrow = new ethers.Contract(escrowAddress, NotaryMediatedEscrow.abi, signer);
      
      const tx = await escrow.verifyDocument(0, documentType);
      await tx.wait();
      
      await loadUserEscrows(factory, userAddress);
    } catch (error) {
      console.error('Error verifying document:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmSaleAgreement = async (escrowAddress) => {
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const escrow = new ethers.Contract(escrowAddress, NotaryMediatedEscrow.abi, signer);
      
      const tx = await escrow.confirmSaleAgreement(0);
      await tx.wait();
      
      await loadUserEscrows(factory, userAddress);
    } catch (error) {
      console.error('Error confirming sale agreement:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderPhaseContent = () => {
    if (!selectedEscrow) {
      // Show Intake & Discovery when no escrow selected
      return <IntakeDiscoveryPhase 
        escrowAddress={factoryAddress} 
        userAddress={userAddress}
        userRole={getUserRole()}
        onIntakeComplete={loadUserEscrows}
        onPlotSelected={(plot) => {
          // Create escrow when plot is selected
          createNewEscrow(plot.sellerAddress, plot.price);
        }}
      />;
    }

    switch (currentPhase) {
      case 0: // Intake & Discovery
        return <IntakeDiscoveryPhase escrow={selectedEscrow} userAddress={userAddress} userRole={getUserRole()} />;
      case 1: // Safety Gate
        return <SafetyGatePhase escrow={selectedEscrow} onVerify={verifyDocument} loading={loading} />;
      case 2: // Execution & Fiat Bridge
        return <TransferRegistryPhase escrow={selectedEscrow} userAddress={userAddress} userRole={getUserRole()} />;
      case 3: // Transfer Registry
        return <TransferRegistryPhase escrow={selectedEscrow} userAddress={userAddress} userRole={getUserRole()} />;
      default:
        return null;
    }
  };

  const getUserRole = () => {
    // In production, this would check user's role in the system
    if (userAddress.toLowerCase().includes('doddy')) return 'notary';
    if (userAddress.toLowerCase().includes('sizland')) return 'admin';
    return 'client';
  };

  return (
    <div className="escrow-interface">
      <h1>Notary-Mediated Escrow</h1>
      
      {/* Phase Progress Bar */}
      <div className="phase-progress">
        {phases.map((phase, index) => (
          <div
            key={phase.id}
            className={`phase-item ${index <= currentPhase ? 'active' : ''}`}
            onClick={() => setCurrentPhase(index)}
          >
            <div className="phase-number">{index + 1}</div>
            <div className="phase-info">
              <div className="phase-name">{phase.name}</div>
              <div className="phase-description">{phase.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Escrow Selection */}
      <div className="escrow-selection">
        <h2>Your Escrows</h2>
        <div className="escrow-list">
          {escrows.map((escrow) => (
            <div
              key={escrow.address}
              className={`escrow-item ${selectedEscrow?.address === escrow.address ? 'selected' : ''}`}
              onClick={() => setSelectedEscrow(escrow)}
            >
              <div className="escrow-address">{escrow.address}</div>
              <div className="escrow-state">State: {escrow.state}</div>
              <div className="escrow-amount">Amount: {ethers.utils.formatEther(escrow.totalAmount)} ETH</div>
            </div>
          ))}
        </div>
        
        <button 
          className="create-escrow-btn"
          onClick={() => {/* Open create escrow modal */}}
        >
          Create New Escrow
        </button>
      </div>

      {/* Phase Content */}
      <div className="phase-content">
        {renderPhaseContent()}
      </div>
    </div>
  );
};

export default EscrowInterface;