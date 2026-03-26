import React, { useState } from 'react';
import { ethers } from 'ethers';

const SafetyGatePhase = ({ escrow, onVerify, loading }) => {
  const [activeTab, setActiveTab] = useState('registry');
  const [documentHashes, setDocumentHashes] = useState({
    registry: '',
    siteVisit: ''
  });

  const documentTypes = {
    registry: { name: 'Registry Search', enum: 0 },
    siteVisit: { name: 'Site Visit Report', enum: 1 }
  };

  const isDueDiligenceComplete = escrow.milestones[0]; // Due Diligence milestone
  const isRegistryVerified = escrow.documents[0]; // RegistrySearch document
  const isSiteVisitVerified = escrow.documents[1]; // SiteVisitReport document

  const handleVerifyDocument = async (docType) => {
    await onVerify(escrow.address, documentTypes[docType].enum);
  };

  const formatAmount = (amountWei) => {
    return ethers.utils.formatEther(amountWei);
  };

  return (
    <div className="safety-gate-phase">
      <h2>Phase 2: Safety Gate - Due Diligence</h2>
      
      <div className="milestone-info">
        <div className="milestone-header">
          <h3>$200 Safety Gate Milestone</h3>
          <p>This milestone covers the notary's verification services including Registry Search and Site Visit.</p>
        </div>
        
        <div className="milestone-status">
          <div className={`status-indicator ${isDueDiligenceComplete ? 'completed' : 'pending'}`}>
            {isDueDiligenceComplete ? ' Completed' : ' Pending'}
          </div>
          {isDueDiligenceComplete && (
            <div className="release-info">
              <span>$200 released to notary's wallet</span>
            </div>
          )}
        </div>
      </div>

      <div className="document-vault">
        <h3>Document Vault</h3>
          <p>Secure section for viewing and verifying legal documents uploaded by the notary.</p>
        
        <div className="document-tabs">
          {Object.entries(documentTypes).map(([key, doc]) => (
            <button
              key={key}
              className={`tab-button ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {doc.name}
            </button>
          ))}
        </div>

        <div className="document-content">
          {activeTab === 'registry' && (
            <div className="registry-search">
              <h4>Registry Search Document</h4>
              <div className="document-status">
                <span className={`status ${isRegistryVerified ? 'verified' : 'pending'}`}>
                  {isRegistryVerified ? ' Verified' : ' Pending Verification'}
                </span>
              </div>
              
              <div className="document-details">
                <div className="document-info">
                  <p><strong>Document Type:</strong> Registry Search Report</p>
                  <p><strong>Purpose:</strong> Verify property ownership and legal status</p>
                  <p><strong>Authority:</strong> Land Registry</p>
                  {documentHashes.registry && (
                    <p><strong>Document Hash:</strong> {documentHashes.registry}</p>
                  )}
                </div>
                
                <div className="document-preview">
                  <div className="pdf-preview">
                    <div className="pdf-icon"></div>
                    <p>Registry_Search_Report.pdf</p>
                    <button className="view-btn">View Document</button>
                  </div>
                </div>
              </div>

              {!isRegistryVerified && (
                <div className="verification-section">
                  <h5>Client Verification Required</h5>
                  <p>Review the Registry Search document and verify its authenticity.</p>
                  <button
                    className="verify-btn"
                    onClick={() => handleVerifyDocument('registry')}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Verify Registry Search'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'siteVisit' && (
            <div className="site-visit">
              <h4>Site Visit Report</h4>
              <div className="document-status">
                <span className={`status ${isSiteVisitVerified ? 'verified' : 'pending'}`}>
                  {isSiteVisitVerified ? ' Verified' : ' Pending Verification'}
                </span>
              </div>
              
              <div className="document-details">
                <div className="document-info">
                  <p><strong>Document Type:</strong> Site Visit Report</p>
                  <p><strong>Purpose:</strong> Physical verification of property boundaries and condition</p>
                  <p><strong>Inspector:</strong> Notary (Authorized)</p>
                  {documentHashes.siteVisit && (
                    <p><strong>Document Hash:</strong> {documentHashes.siteVisit}</p>
                  )}
                </div>
                
                <div className="document-preview">
                  <div className="pdf-preview">
                    <div className="pdf-icon"></div>
                    <p>Site_Visit_Report.pdf</p>
                    <button className="view-btn">View Document</button>
                  </div>
                </div>
              </div>

              {!isSiteVisitVerified && (
                <div className="verification-section">
                  <h5>Client Verification Required</h5>
                  <p>Review the Site Visit Report and verify its accuracy.</p>
                  <button
                    className="verify-btn"
                    onClick={() => handleVerifyDocument('siteVisit')}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Verify Site Visit'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isDueDiligenceComplete && (
        <div className="next-phase-ready">
          <div className="success-message">
            <h3> Safety Gate Completed</h3>
            <p>Due Diligence milestone has been successfully completed.</p>
            <div className="completed-items">
              <div className="completed-item">[Done] Registry Search verified</div>
              <div className="completed-item">[Done] Site Visit Report verified</div>
              <div className="completed-item">[Done] $200 released to Notary</div>
            </div>
          </div>
          
          <div className="next-phase-info">
            <h4>Ready for Phase 3: Execution</h4>
            <p>You can now proceed to the Execution phase where the deposit will be released to the seller upon Sale Agreement confirmation.</p>
            <div className="next-milestone-preview">
              <div className="milestone-item">
                <span className="milestone-amount">
                  {formatAmount(escrow.amounts[1])} ETH
                </span>
                <span className="milestone-description">Deposit to Seller (10% of total)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="progress-tracker">
        <h4>Safety Gate Progress</h4>
        <div className="progress-items">
          <div className={`progress-item ${isRegistryVerified ? 'completed' : 'pending'}`}>
            <span className="item-name">Registry Search</span>
            <span className="item-status">{isRegistryVerified ? '[Done]' : ''}</span>
          </div>
          <div className={`progress-item ${isSiteVisitVerified ? 'completed' : 'pending'}`}>
            <span className="item-name">Site Visit Report</span>
            <span className="item-status">{isSiteVisitVerified ? '[Done]' : ''}</span>
          </div>
          <div className={`progress-item ${isDueDiligenceComplete ? 'completed' : 'pending'}`}>
            <span className="item-name">$200 Fee Released</span>
            <span className="item-status">{isDueDiligenceComplete ? '[Done]' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafetyGatePhase;