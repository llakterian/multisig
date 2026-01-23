import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const NotaryAdminPanel = ({
  escrowAddress,
  userAddress,
  isAdmin
}) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [escrows, setEscrows] = useState([]);
  const [selectedEscrow, setSelectedEscrow] = useState(null);
  const [contract, setContract] = useState(null);

  // Form states
  const [fiatPayment, setFiatPayment] = useState({
    escrowId: '',
    kesAmount: '',
    exchangeRate: '',
    cryptoAmount: ''
  });

  const [timelineUpdate, setTimelineUpdate] = useState({
    escrowId: '',
    expectedDate: '',
    notes: ''
  });

  const [documentUpload, setDocumentUpload] = useState({
    escrowId: '',
    documentType: '',
    file: null,
    notes: ''
  });

  useEffect(() => {
    initializeContract();
    loadEscrows();
  }, [escrowAddress]);

  const initializeContract = async () => {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contractInstance = new ethers.Contract(
        escrowAddress,
        NotaryMediatedEscrow.abi,
        provider
      );
      setContract(contractInstance);
    }
  };

  const loadEscrows = async () => {
    // Mock escrow data - in production would fetch from contract/backend
    const mockEscrows = [
      {
        id: 0,
        client: '0xClient123...',
        seller: '0xSeller456...',
        budget: '5000',
        desiredSize: 2,
        purpose: 'Farming',
        state: 'DueDiligencePending',
        createdAt: '2024-01-15',
        expectedCompletionDate: '',
        courierTracking: '',
        documentsSecured: false,
        sellerKESAmount: 0
      },
      {
        id: 1,
        client: '0xClient789...',
        seller: '0xSeller012...',
        budget: '7500',
        desiredSize: 5,
        purpose: 'Speculation',
        state: 'TransferRegistry',
        createdAt: '2024-01-10',
        expectedCompletionDate: '2024-02-15',
        courierTracking: 'TRK123456789',
        documentsSecured: true,
        sellerKESAmount: 750000
      }
    ];

    setEscrows(mockEscrows);
  };

  const handleFiatPayment = async () => {
    if (!fiatPayment.escrowId || !fiatPayment.kesAmount || !fiatPayment.exchangeRate) {
      alert('Please fill all fields');
      return;
    }

    try {
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      const escrowId = parseInt(fiatPayment.escrowId);
      const kesAmount = parseFloat(fiatPayment.kesAmount);
      const exchangeRate = parseFloat(fiatPayment.exchangeRate);

      await contractWithSigner.executeFiatBridge(escrowId, kesAmount, exchangeRate);

      alert('Fiat payment recorded successfully!');
      setFiatPayment({ escrowId: '', kesAmount: '', exchangeRate: '', cryptoAmount: '' });
      loadEscrows();
    } catch (error) {
      console.error('Error recording fiat payment:', error);
      alert('Error recording fiat payment');
    }
  };

  const handleTimelineUpdate = async () => {
    if (!timelineUpdate.escrowId || !timelineUpdate.expectedDate) {
      alert('Please fill all fields');
      return;
    }

    try {
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      const escrowId = parseInt(timelineUpdate.escrowId);
      const expectedDate = Math.floor(new Date(timelineUpdate.expectedDate).getTime() / 1000);

      // This would need to be implemented in contract
      // await contractWithSigner.updateExpectedCompletionDate(escrowId, expectedDate);

      alert('Timeline updated successfully!');
      setTimelineUpdate({ escrowId: '', expectedDate: '', notes: '' });
      loadEscrows();
    } catch (error) {
      console.error('Error updating timeline:', error);
      alert('Error updating timeline');
    }
  };

  const handleDocumentUpload = async () => {
    if (!documentUpload.escrowId || !documentUpload.documentType || !documentUpload.file) {
      alert('Please fill all fields and select file');
      return;
    }

    try {
      const fileHash = await generateFileHash(documentUpload.file);
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);

      const escrowId = parseInt(documentUpload.escrowId);
      const docType = parseInt(documentUpload.documentType);

      // Upload based on document type
      if (docType === 0) { // Search Certificate
        await contractWithSigner.uploadDocument(escrowId, 0, fileHash);
      } else if (docType === 1) { // DD Report
        await contractWithSigner.uploadDueDiligenceReport(escrowId, fileHash);
      } else if (docType === 3) { // Lodgement Receipt
        const expectedDate = Math.floor(new Date().getTime() / 1000) + (14 * 24 * 60 * 60); // 14 days from now
        await contractWithSigner.uploadLodgementReceipt(escrowId, fileHash, expectedDate);
      } else if (docType === 4) { // Original Title
        await contractWithSigner.completeTransfer(escrowId, fileHash, 'TRK' + Math.random().toString().substr(2, 9));
      }

      alert('Document uploaded successfully!');
      setDocumentUpload({ escrowId: '', documentType: '', file: null, notes: '' });
      loadEscrows();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Error uploading document');
    }
  };

  const generateFileHash = async (file) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return '0x' + hashHex;
  };

  const getStateColor = (state) => {
    const colors = {
      'Intake': 'blue',
      'Discovery': 'orange',
      'Funded': 'green',
      'DueDiligencePending': 'orange',
      'DueDiligenceComplete': 'green',
      'ExecutionPending': 'orange',
      'ExecutionComplete': 'green',
      'TransferRegistry': 'orange',
      'Finalizing': 'blue',
      'Completed': 'green'
    };
    return colors[state] || 'gray';
  };

  const documentTypes = {
    0: 'Search Certificate',
    1: 'Due Diligence Report',
    2: 'Sale Agreement',
    3: 'Lodgement Receipt',
    4: 'Original Title',
    5: 'LCB Consent'
  };

  return (
    <div className="notary-admin-panel">
      <h1>Sizland Notary Admin Panel</h1>

      <div className="admin-tabs">
        <button
          className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`tab-button ${activeTab === 'fiat' ? 'active' : ''}`}
          onClick={() => setActiveTab('fiat')}
        >
          Fiat Payments
        </button>
        <button
          className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline Management
        </button>
        <button
          className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          Document Management
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="dashboard-section">
          <h2>Escrow Management Dashboard</h2>

          <div className="escrow-table-container">
            <table className="escrow-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Client</th>
                  <th>Budget</th>
                  <th>Size</th>
                  <th>Purpose</th>
                  <th>State</th>
                  <th>KES Paid</th>
                  <th>Documents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {escrows.map(escrow => (
                  <tr key={escrow.id}>
                    <td>{escrow.id}</td>
                    <td>{escrow.client}</td>
                    <td>${escrow.budget}</td>
                    <td>{escrow.desiredSize} acres</td>
                    <td>{escrow.purpose}</td>
                    <td>
                      <span className={`state-badge ${getStateColor(escrow.state)}`}>
                        {escrow.state}
                      </span>
                    </td>
                    <td>{escrow.sellerKESAmount.toLocaleString()} KES</td>
                    <td>
                      <span className={`documents-status ${escrow.documentsSecured ? 'secured' : 'pending'}`}>
                        {escrow.documentsSecured ? '[Done] Secured' : ' Pending'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="manage-btn"
                        onClick={() => setSelectedEscrow(escrow)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fiat Payments Tab */}
      {activeTab === 'fiat' && (
        <div className="fiat-section">
          <h2>Log Fiat Payments</h2>
          <p>Record KES payments made to sellers against crypto released from escrow.</p>

          <div className="fiat-form">
            <div className="form-group">
              <label>Escrow ID</label>
              <input
                type="number"
                value={fiatPayment.escrowId}
                onChange={(e) => setFiatPayment(prev => ({ ...prev, escrowId: e.target.value }))}
                placeholder="Enter escrow ID"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>KES Amount Paid</label>
                <input
                  type="number"
                  value={fiatPayment.kesAmount}
                  onChange={(e) => setFiatPayment(prev => ({ ...prev, kesAmount: e.target.value }))}
                  placeholder="600000"
                />
              </div>

              <div className="form-group">
                <label>Exchange Rate (KES/USD)</label>
                <input
                  type="number"
                  value={fiatPayment.exchangeRate}
                  onChange={(e) => setFiatPayment(prev => ({ ...prev, exchangeRate: e.target.value }))}
                  placeholder="120"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Crypto Amount Equivalent</label>
              <input
                type="text"
                value={fiatPayment.cryptoAmount}
                readOnly
                placeholder="5 ETH"
              />
            </div>

            <button
              className="submit-btn"
              onClick={handleFiatPayment}
            >
              Record Payment
            </button>
          </div>
        </div>
      )}

      {/* Timeline Management Tab */}
      {activeTab === 'timeline' && (
        <div className="timeline-section">
          <h2>Timeline Management</h2>
          <p>Update expected completion dates to keep clients informed during 2-3 week registry wait.</p>

          <div className="timeline-form">
            <div className="form-group">
              <label>Escrow ID</label>
              <input
                type="number"
                value={timelineUpdate.escrowId}
                onChange={(e) => setTimelineUpdate(prev => ({ ...prev, escrowId: e.target.value }))}
                placeholder="Enter escrow ID"
              />
            </div>

            <div className="form-group">
              <label>Expected Completion Date</label>
              <input
                type="date"
                value={timelineUpdate.expectedDate}
                onChange={(e) => setTimelineUpdate(prev => ({ ...prev, expectedDate: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={timelineUpdate.notes}
                onChange={(e) => setTimelineUpdate(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes for the client..."
                rows="3"
              />
            </div>

            <button
              className="submit-btn"
              onClick={handleTimelineUpdate}
            >
              Update Timeline
            </button>
          </div>
        </div>
      )}

      {/* Document Management Tab */}
      {activeTab === 'documents' && (
        <div className="documents-section">
          <h2>Document Management</h2>
          <p>Upload and manage all legal documents from this central hub.</p>

          <div className="document-form">
            <div className="form-group">
              <label>Escrow ID</label>
              <input
                type="number"
                value={documentUpload.escrowId}
                onChange={(e) => setDocumentUpload(prev => ({ ...prev, escrowId: e.target.value }))}
                placeholder="Enter escrow ID"
              />
            </div>

            <div className="form-group">
              <label>Document Type</label>
              <select
                value={documentUpload.documentType}
                onChange={(e) => setDocumentUpload(prev => ({ ...prev, documentType: e.target.value }))}
              >
                <option value="">Select document type</option>
                {Object.entries(documentTypes).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Document File</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setDocumentUpload(prev => ({ ...prev, file: e.target.files[0] }))}
              />
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={documentUpload.notes}
                onChange={(e) => setDocumentUpload(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Document details..."
                rows="3"
              />
            </div>

            <button
              className="submit-btn"
              onClick={handleDocumentUpload}
              disabled={!documentUpload.file}
            >
              Upload Document
            </button>
          </div>
        </div>
      )}

      {/* Selected Escrow Detail Modal */}
      {selectedEscrow && (
        <div className="escrow-detail-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Escrow #{selectedEscrow.id} Details</h3>
              <button className="close-btn" onClick={() => setSelectedEscrow(null)}>x</button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Client:</label>
                  <span>{selectedEscrow.client}</span>
                </div>
                <div className="detail-item">
                  <label>Seller:</label>
                  <span>{selectedEscrow.seller}</span>
                </div>
                <div className="detail-item">
                  <label>Budget:</label>
                  <span>${selectedEscrow.budget}</span>
                </div>
                <div className="detail-item">
                  <label>Size:</label>
                  <span>{selectedEscrow.desiredSize} acres</span>
                </div>
                <div className="detail-item">
                  <label>Purpose:</label>
                  <span>{selectedEscrow.purpose}</span>
                </div>
                <div className="detail-item">
                  <label>State:</label>
                  <span className={`state-badge ${getStateColor(selectedEscrow.state)}`}>
                    {selectedEscrow.state}
                  </span>
                </div>
                <div className="detail-item">
                  <label>KES Paid:</label>
                  <span>{selectedEscrow.sellerKESAmount.toLocaleString()} KES</span>
                </div>
                <div className="detail-item">
                  <label>Expected Completion:</label>
                  <span>{selectedEscrow.expectedCompletionDate || 'Not set'}</span>
                </div>
                <div className="detail-item">
                  <label>Courier Tracking:</label>
                  <span>{selectedEscrow.courierTracking || 'Not shipped'}</span>
                </div>
                <div className="detail-item">
                  <label>Documents Secured:</label>
                  <span>{selectedEscrow.documentsSecured ? ' Yes' : ' No'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotaryAdminPanel;