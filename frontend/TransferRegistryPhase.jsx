import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const TransferRegistryPhase = ({ 
  escrowAddress, 
  userAddress, 
  userRole,
  escrowData 
}) => {
  const [registryStatus, setRegistryStatus] = useState({});
  const [lodgementReceipt, setLodgementReceipt] = useState(null);
  const [finalTitle, setFinalTitle] = useState(null);
  const [contract, setContract] = useState(null);

  useEffect(() => {
    initializeContract();
    loadRegistryStatus();
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

  const loadRegistryStatus = async () => {
    // Mock registry status - in production would fetch from contract
    const mockStatus = {
      expectedCompletionDate: '2024-02-15',
      daysUntilCompletion: 14,
      currentProgress: 25,
      status: 'Processing',
      lodgementReceived: true,
      lodgementDate: '2024-02-01',
      receiptHash: '0xabc123...',
      titleIssued: false,
      courierReady: false,
      courierTracking: ''
    };
    
    setRegistryStatus(mockStatus);
  };

  const handleLodgementReceipt = async () => {
    // This would be called by notary admin panel
    // Here we simulate the effect of receiving the receipt
    setLodgementReceipt({
      hash: '0xdef456...',
      uploadedAt: new Date().toISOString(),
      expectedCompletion: '2024-02-15',
      processingDays: 14
    });
    
    alert('Lodgement receipt uploaded successfully!');
  };

  const handleTitleIssued = async () => {
    // This would be called by notary admin panel
    setFinalTitle({
      hash: '0xghi789...',
      issuedDate: new Date().toISOString(),
      courierTracking: 'TRK' + Math.random().toString().substr(2, 9),
      shippedDate: new Date().toISOString()
    });
    
    alert('Final title uploaded and shipping initiated!');
  };

  const calculateProgress = () => {
    if (!registryStatus.lodgementDate || !registryStatus.expectedCompletionDate) return 0;
    
    const lodgement = new Date(registryStatus.lodgementDate);
    const expected = new Date(registryStatus.expectedCompletionDate);
    const now = new Date();
    
    const totalDays = Math.ceil((expected - lodgement) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((now - lodgement) / (1000 * 60 * 60 * 24));
    
    return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  };

  const progress = calculateProgress();
  const isNotary = userRole === 'notary';

  return (
    <div className="transfer-registry-phase">
      <h2>Phase 4: Transfer Registry & Finalization</h2>
      
      <div className="registry-overview">
        <h3>Land Registry Processing</h3>
        <p>The transfer has been lodged at the Land Registry. Track progress below.</p>
        
        {registryStatus.lodgementReceived && (
          <div className="lodgement-info">
            <div className="info-card">
              <h4> Lodgement Received</h4>
              <div className="lodgement-details">
                <div className="detail-item">
                  <span>Lodgement Date:</span>
                  <span>{new Date(registryStatus.lodgementDate).toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <span>Receipt Hash:</span>
                  <code>{registryStatus.receiptHash}</code>
                </div>
                <div className="detail-item">
                  <span>Expected Completion:</span>
                  <span>{new Date(registryStatus.expectedCompletionDate).toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <span>Processing Time:</span>
                  <span>{registryStatus.daysUntilCompletion} days remaining</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Progress Bar */}
        <div className="progress-section">
          <h4>Transfer Progress</h4>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="progress-text">{Math.round(progress)}% Complete</span>
          </div>
          
          <div className="progress-stages">
            <div className={`stage ${progress >= 25 ? 'completed' : 'pending'}`}>
              <div className="stage-dot"></div>
              <span>Lodgement Submitted</span>
            </div>
            <div className={`stage ${progress >= 50 ? 'completed' : 'pending'}`}>
              <div className="stage-dot"></div>
              <span>Registry Processing</span>
            </div>
            <div className={`stage ${progress >= 75 ? 'completed' : 'pending'}`}>
              <div className="stage-dot"></div>
              <span>Title Preparation</span>
            </div>
            <div className={`stage ${progress >= 100 ? 'completed' : 'pending'}`}>
              <div className="stage-dot"></div>
              <span>Title Issued</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notary Actions */}
      {isNotary && (
        <div className="notary-actions">
          <h3>Notary Actions</h3>
          
          {!registryStatus.lodgementReceived && (
            <div className="action-section">
              <h4>Upload Lodgement Receipt</h4>
              <p>Upload the official receipt from Land Registry to update client timeline.</p>
              
              <button
                className="upload-receipt-btn"
                onClick={handleLodgementReceipt}
              >
                 Upload Lodgement Receipt
              </button>
            </div>
          )}
          
          {registryStatus.lodgementReceived && !finalTitle && (
            <div className="action-section">
              <h4>Issue Final Title</h4>
              <p>Upload the scanned title and initiate shipping to client.</p>
              
              <button
                className="issue-title-btn"
                onClick={handleTitleIssued}
              >
                 Issue Title & Ship
              </button>
            </div>
          )}
        </div>
      )}

      {/* Client View */}
      {!isNotary && (
        <div className="client-view">
          <h3>Transfer Status</h3>
          
          <div className="status-cards">
            <div className="status-card">
              <div className="card-icon"></div>
              <div className="card-content">
                <h4>Registry Status</h4>
                <p>{registryStatus.status || 'Processing'}</p>
                <span className="status-date">Updated: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className="status-card">
              <div className="card-icon"></div>
              <div className="card-content">
                <h4>Expected Completion</h4>
                <p>{registryStatus.expectedCompletionDate || 'Calculating...'}</p>
                <span className="status-info">{registryStatus.daysUntilCompletion || 0} days remaining</span>
              </div>
            </div>
            
            <div className="status-card">
              <div className="card-icon"></div>
              <div className="card-content">
                <h4>Progress</h4>
                <p>{Math.round(progress)}% Complete</p>
                <div className="mini-progress">
                  <div style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Document Downloads */}
          {lodgementReceipt && (
            <div className="document-section">
              <h4> Available Documents</h4>
              <div className="document-list">
                <div className="document-item">
                  <span className="doc-icon"></span>
                  <span className="doc-name">Lodgement Receipt</span>
                  <span className="doc-date">{new Date(lodgementReceipt.uploadedAt).toLocaleDateString()}</span>
                  <button className="download-btn">Download</button>
                </div>
              </div>
            </div>
          )}
          
          {finalTitle && (
            <div className="finalization-section">
              <h4> Transfer Complete!</h4>
              <div className="completion-details">
                <div className="completion-item">
                  <span>Title Issued:</span>
                  <span>{new Date(finalTitle.issuedDate).toLocaleDateString()}</span>
                </div>
                <div className="completion-item">
                  <span>Courier:</span>
                  <span>{finalTitle.courierTracking}</span>
                </div>
                <div className="completion-item">
                  <span>Shipped:</span>
                  <span>{new Date(finalTitle.shippedDate).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="tracking-section">
                <h5> Track Your Title</h5>
                <div className="tracking-info">
                  <input
                    type="text"
                    value={finalTitle.courierTracking}
                    readOnly
                    className="tracking-number"
                  />
                  <button className="track-btn">Track Package</button>
                </div>
                <p className="shipping-note">
                  Your original 99-year leasehold title is being shipped to your European address. 
                  Expected delivery: 5-7 business days.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline Information */}
      <div className="timeline-info">
        <h3> Processing Timeline</h3>
        <div className="timeline">
          <div className="timeline-item completed">
            <div className="timeline-marker">[Done]</div>
            <div className="timeline-content">
              <h4>Lodgement Submitted</h4>
              <p>Transfer documents lodged at Land Registry</p>
              <span>{registryStatus.lodgementDate || 'Pending'}</span>
            </div>
          </div>
          
          <div className={`timeline-item ${progress >= 50 ? 'completed' : 'active'}`}>
            <div className="timeline-marker">
              {progress >= 50 ? '[Done]' : ''}
            </div>
            <div className="timeline-content">
              <h4>Registry Processing</h4>
              <p>Official review and verification</p>
              <span>{progress >= 50 ? 'Completed' : 'In Progress'}</span>
            </div>
          </div>
          
          <div className={`timeline-item ${progress >= 75 ? 'completed' : 'upcoming'}`}>
            <div className="timeline-marker">
              {progress >= 75 ? '[Done]' : ''}
            </div>
            <div className="timeline-content">
              <h4>Title Preparation</h4>
              <p>99-year leasehold title creation</p>
              <span>{progress >= 75 ? 'Completed' : 'Upcoming'}</span>
            </div>
          </div>
          
          <div className={`timeline-item ${progress >= 100 ? 'completed' : 'upcoming'}`}>
            <div className="timeline-marker">
              {progress >= 100 ? '[Done]' : ''}
            </div>
            <div className="timeline-content">
              <h4>Title Issued & Shipped</h4>
              <p>Document on way to your address</p>
              <span>{progress >= 100 ? 'Completed' : 'Upcoming'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferRegistryPhase;