import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const MultiSigVerification = ({ 
  escrowAddress, 
  transactionData, 
  userAddress, 
  isOwner,
  onTransactionComplete 
}) => {
  const [transactions, setTransactions] = useState([]);
  const [confirmations, setConfirmations] = useState({});
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(null);
  const [numConfirmationsRequired, setNumConfirmationsRequired] = useState(2);

  useEffect(() => {
    initializeContract();
  }, [escrowAddress]);

  const initializeContract = async () => {
    if (window.ethereum && escrowAddress) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contractInstance = new ethers.Contract(
        escrowAddress,
        MultiSigWallet.abi,
        provider
      );
      setContract(contractInstance);
      
      // Get required confirmations
      const required = await contractInstance.numConfirmationsRequired();
      setNumConfirmationsRequired(required.toNumber());
      
      // Load existing transactions
      await loadTransactions(contractInstance);
    }
  };

  const loadTransactions = async (contractInstance) => {
    try {
      const count = await contractInstance.getTransactionCount();
      const txList = [];
      
      for (let i = 0; i < count; i++) {
        const tx = await contractInstance.getTransaction(i);
        const confirmations = await contractInstance.getConfirmationsCount(i);
        
        txList.push({
          index: i,
          to: tx.to,
          value: ethers.utils.formatEther(tx.value),
          data: tx.data,
          executed: tx.executed,
          numConfirmations: confirmations.toNumber(),
          timestamp: new Date().toISOString() // In production, get actual timestamp
        });
      }
      
      setTransactions(txList);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const submitTransaction = async (to, value, data) => {
    if (!isOwner) {
      alert('Only owners can submit transactions');
      return;
    }

    setLoading(true);
    try {
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.submitTransaction(to, value, data);
      await tx.wait();
      
      await loadTransactions(contract);
      alert('Transaction submitted successfully!');
    } catch (error) {
      console.error('Error submitting transaction:', error);
      alert('Error submitting transaction');
    } finally {
      setLoading(false);
    }
  };

  const confirmTransaction = async (txIndex) => {
    if (!isOwner) {
      alert('Only owners can confirm transactions');
      return;
    }

    setLoading(true);
    try {
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.confirmTransaction(txIndex);
      await tx.wait();
      
      await loadTransactions(contract);
      alert('Transaction confirmed successfully!');
    } catch (error) {
      console.error('Error confirming transaction:', error);
      alert('Error confirming transaction');
    } finally {
      setLoading(false);
    }
  };

  const executeTransaction = async (txIndex) => {
    setLoading(true);
    try {
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.executeTransaction(txIndex);
      await tx.wait();
      
      await loadTransactions(contract);
      
      if (onTransactionComplete) {
        onTransactionComplete();
      }
      
      alert('Transaction executed successfully!');
    } catch (error) {
      console.error('Error executing transaction:', error);
      alert('Error executing transaction');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionStatus = (tx) => {
    if (tx.executed) return { status: 'executed', color: 'green', text: 'Executed' };
    if (tx.numConfirmations >= numConfirmationsRequired) {
      return { status: 'ready', color: 'blue', text: 'Ready to Execute' };
    }
    if (tx.numConfirmations > 0) {
      return { status: 'pending', color: 'orange', text: `${tx.numConfirmations}/${numConfirmationsRequired} Confirmations` };
    }
    return { status: 'submitted', color: 'gray', text: 'Submitted' };
  };

  const canConfirm = (tx) => {
    return isOwner && !tx.executed && tx.numConfirmations < numConfirmationsRequired;
  };

  const canExecute = (tx) => {
    return !tx.executed && tx.numConfirmations >= numConfirmationsRequired;
  };

  return (
    <div className="multi-sig-verification">
      <h2>Multi-Signature Verification</h2>
      
      <div className="multi-sig-info">
        <div className="info-grid">
          <div className="info-item">
            <span className="label">Required Signatures:</span>
            <span className="value">{numConfirmationsRequired}</span>
          </div>
          <div className="info-item">
            <span className="label">Your Role:</span>
            <span className="value">{isOwner ? 'Owner' : 'Observer'}</span>
          </div>
          <div className="info-item">
            <span className="label">Contract:</span>
            <span className="value contract-address">{escrowAddress}</span>
          </div>
        </div>
      </div>

      <div className="transactions-list">
        <h3>Transaction Queue</h3>
        
        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"></div>
            <p>No transactions submitted yet</p>
          </div>
        ) : (
          <div className="transactions-grid">
            {transactions.map((tx) => {
              const status = getTransactionStatus(tx);
              
              return (
                <div key={tx.index} className={`transaction-card ${status.status}`}>
                  <div className="transaction-header">
                    <div className="transaction-index">#{tx.index}</div>
                    <div className={`transaction-status ${status.color}`}>
                      {status.text}
                    </div>
                  </div>

                  <div className="transaction-details">
                    <div className="detail-row">
                      <span className="label">To:</span>
                      <span className="address">{tx.to}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Value:</span>
                      <span className="value">{tx.value} ETH</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Confirmations:</span>
                      <span className="confirmations">
                        {tx.numConfirmations}/{numConfirmationsRequired}
                      </span>
                    </div>
                  </div>

                  <div className="transaction-actions">
                    {canConfirm(tx) && (
                      <button
                        className="confirm-btn"
                        onClick={() => confirmTransaction(tx.index)}
                        disabled={loading}
                      >
                        {loading ? 'Confirming...' : 'Confirm Transaction'}
                      </button>
                    )}
                    
                    {canExecute(tx) && (
                      <button
                        className="execute-btn"
                        onClick={() => executeTransaction(tx.index)}
                        disabled={loading}
                      >
                        {loading ? 'Executing...' : 'Execute Transaction'}
                      </button>
                    )}
                    
                    {tx.executed && (
                      <div className="executed-badge">
                        <span> Executed</span>
                      </div>
                    )}
                  </div>

                  {/* Confirmation Progress Bar */}
                  <div className="confirmation-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ 
                          width: `${(tx.numConfirmations / numConfirmationsRequired) * 100}%` 
                        }}
                      ></div>
                    </div>
                    <div className="progress-text">
                      {tx.numConfirmations} of {numConfirmationsRequired} confirmations received
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isOwner && (
        <div className="submit-transaction">
          <h3>Submit New Transaction</h3>
          <div className="submit-form">
            <div className="form-group">
              <label>Recipient Address:</label>
              <input
                type="text"
                placeholder="0x..."
                id="recipient-address"
              />
            </div>
            
            <div className="form-group">
              <label>Amount (ETH):</label>
              <input
                type="number"
                placeholder="0.0"
                step="0.001"
                id="amount"
              />
            </div>
            
            <div className="form-group">
              <label>Transaction Data (hex):</label>
              <textarea
                placeholder="0x... (optional)"
                id="transaction-data"
                rows="3"
              ></textarea>
            </div>
            
            <button
              className="submit-btn"
              onClick={() => {
                const to = document.getElementById('recipient-address').value;
                const value = ethers.utils.parseEther(
                  document.getElementById('amount').value || '0'
                );
                const data = document.getElementById('transaction-data').value || '0x';
                
                if (to) {
                  submitTransaction(to, value, data);
                }
              }}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Transaction'}
            </button>
          </div>
        </div>
      )}

      <div className="security-info">
        <h3>Security Information</h3>
        <div className="security-features">
          <div className="feature-item">
            <span className="feature-icon"></span>
            <div className="feature-text">
              <strong>Multi-Sig Protection:</strong> Requires {numConfirmationsRequired} signatures for execution
            </div>
          </div>
          
          <div className="feature-item">
            <span className="feature-icon"></span>
            <div className="feature-text">
              <strong>Owner Verification:</strong> Only designated owners can confirm transactions
            </div>
          </div>
          
          <div className="feature-item">
            <span className="feature-icon">[Time]</span>
            <div className="feature-text">
              <strong>Time-Locked:</strong> Transactions can be revoked before execution
            </div>
          </div>
          
          <div className="feature-item">
            <span className="feature-icon"></span>
            <div className="feature-text">
              <strong>Transparent:</strong> All transactions visible on blockchain
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiSigVerification;