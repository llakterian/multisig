import React, { useState } from 'react';
import { ethers } from 'ethers';

const FinalSettlementPhase = ({ escrow, loading }) => {
  const [showTitleDetails, setShowTitleDetails] = useState(false);
  const [showLCBDetails, setShowLCBDetails] = useState(false);

  const isFinalSettlementComplete = escrow.milestones[2]; // FinalSettlement milestone
  const isOriginalTitleVerified = escrow.documents[3]; // OriginalTitle document
  const isLCBConsentVerified = escrow.documents[4]; // LCBConsent document
  const isDepositMilestoneComplete = escrow.milestones[1]; // Deposit milestone

  const formatAmount = (amountWei) => {
    return ethers.utils.formatEther(amountWei);
  };

  const getSettlementStatus = () => {
    if (isFinalSettlementComplete) return 'completed';
    if (isOriginalTitleVerified && isLCBConsentVerified) return 'ready';
    if (isDepositMilestoneComplete) return 'pending';
    return 'locked';
  };

  const settlementStatus = getSettlementStatus();

  return (
    <div className="final-settlement-phase">
      <h2>Phase 4: Final Settlement & Title Transfer</h2>
      
      <div className="milestone-info">
        <div className="milestone-header">
          <h3>Final Settlement Milestone</h3>
          <p>Upon title verification, the balance will be released to the seller and facilitation fee to Sizland.</p>
        </div>
        
        <div className="milestone-status">
          <div className={`status-indicator ${settlementStatus}`}>
            {settlementStatus === 'completed' && ' Completed'}
            {settlementStatus === 'ready' && ' Ready for Release'}
            {settlementStatus === 'pending' && ' Pending Verification'}
            {settlementStatus === 'locked' && ' Locked - Previous phases incomplete'}
          </div>
          
          {isFinalSettlementComplete && (
            <div className="release-info">
              <div className="release-item">
                <span>{formatAmount(escrow.amounts[2])} ETH -> Seller</span>
              </div>
              <div className="release-item">
                <span>{formatAmount(escrow.amounts[3])} ETH -> Sizland Treasury</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="document-verification">
        <h3>Final Document Verification</h3>
        <p>Doddy must confirm possession of Original Title and LCB Consents before final release.</p>
        
        <div className="documents-grid">
          <div className="document-card">
            <div className="document-header">
              <h4>Original Title</h4>
              <div className={`status ${isOriginalTitleVerified ? 'verified' : 'pending'}`}>
                {isOriginalTitleVerified ? ' Verified' : ' Pending'}
              </div>
            </div>
            
            <div className="document-content">
              <div className="document-preview">
                <div className="pdf-icon"></div>
                <p>Original_Property_Title.pdf</p>
                <button 
                  className="view-btn"
                  onClick={() => setShowTitleDetails(!showTitleDetails)}
                >
                  {showTitleDetails ? 'Hide Details' : 'View Document'}
                </button>
              </div>
              
              {showTitleDetails && (
                <div className="document-details">
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>Title Number:</strong> ST-2024-0847
                    </div>
                    <div className="info-item">
                      <strong>Property ID:</strong> SZ-BCV-0012
                    </div>
                    <div className="info-item">
                      <strong>Owner:</strong> {escrow.seller}
                    </div>
                    <div className="info-item">
                      <strong>Issued:</strong> Sizland Land Registry
                    </div>
                    <div className="info-item">
                      <strong>Date:</strong> January 15, 2024
                    </div>
                  </div>
                  
                  <div className="verification-stamps">
                    <div className="stamp">
                      <span className="stamp-icon"></span>
                      <span>Registry Verified</span>
                    </div>
                    <div className="stamp">
                      <span className="stamp-icon">[Sign]</span>
                      <span>Notary Certified</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="document-card">
            <div className="document-header">
              <h4>LCB Consents</h4>
              <div className={`status ${isLCBConsentVerified ? 'verified' : 'pending'}`}>
                {isLCBConsentVerified ? ' Verified' : ' Pending'}
              </div>
            </div>
            
            <div className="document-content">
              <div className="document-preview">
                <div className="pdf-icon"></div>
                <p>LCB_Transfer_Consents.pdf</p>
                <button 
                  className="view-btn"
                  onClick={() => setShowLCBDetails(!showLCBDetails)}
                >
                  {showLCBDetails ? 'Hide Details' : 'View Document'}
                </button>
              </div>
              
              {showLCBDetails && (
                <div className="document-details">
                  <div className="info-grid">
                    <div className="info-item">
                      <strong>Consent Type:</strong> Land Transfer Approval
                    </div>
                    <div className="info-item">
                      <strong>Authority:</strong> Local Council Board (LCB)
                    </div>
                    <div className="info-item">
                      <strong>Reference:</strong> LCB-TA-2024-0156
                    </div>
                    <div className="info-item">
                      <strong>Valid Until:</strong> December 31, 2024
                    </div>
                    <div className="info-item">
                      <strong>Conditions:</strong> All taxes paid, boundaries verified
                    </div>
                  </div>
                  
                  <div className="verification-stamps">
                    <div className="stamp">
                      <span className="stamp-icon"></span>
                      <span>LCB Approved</span>
                    </div>
                    <div className="stamp">
                      <span className="stamp-icon"></span>
                      <span>Compliance Verified</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="finalization-status">
        <h3>Finalization Status</h3>
        <div className="status-timeline">
          <div className={`timeline-item ${isDepositMilestoneComplete ? 'completed' : 'pending'}`}>
            <div className="timeline-marker">[Done]</div>
            <div className="timeline-content">
              <div className="timeline-title">Transfer Initiated</div>
              <div className="timeline-desc">Deposit released to seller</div>
            </div>
          </div>
          
          <div className={`timeline-item ${isOriginalTitleVerified ? 'completed' : 'pending'}`}>
            <div className="timeline-marker">
              {isOriginalTitleVerified ? '[Done]' : ''}
            </div>
            <div className="timeline-content">
              <div className="timeline-title">Title Verified</div>
              <div className="timeline-desc">Original title confirmed by Doddy</div>
            </div>
          </div>
          
          <div className={`timeline-item ${isLCBConsentVerified ? 'completed' : 'pending'}`}>
            <div className="timeline-marker">
              {isLCBConsentVerified ? '[Done]' : ''}
            </div>
            <div className="timeline-content">
              <div className="timeline-title">LCB Consents Obtained</div>
              <div className="timeline-desc">Local council board approvals verified</div>
            </div>
          </div>
          
          <div className={`timeline-item ${isFinalSettlementComplete ? 'completed' : 'upcoming'}`}>
            <div className="timeline-marker">
              {isFinalSettlementComplete ? '[Done]' : ''}
            </div>
            <div className="timeline-content">
              <div className="timeline-title">Title Issued</div>
              <div className="timeline-desc">Property title transferred to buyer</div>
            </div>
          </div>
        </div>
      </div>

      {settlementStatus === 'ready' && (
        <div className="release-ready">
          <div className="ready-message">
            <h3> Ready for Final Release</h3>
            <p>All documents have been verified. Doddy can now initiate the final settlement.</p>
            <div className="release-summary">
              <div className="release-item">
                <span className="release-amount">{formatAmount(escrow.amounts[2])} ETH</span>
                <span className="release-recipient">-> Seller (Final Balance)</span>
              </div>
              <div className="release-item">
                <span className="release-amount">{formatAmount(escrow.amounts[3])} ETH</span>
                <span className="release-recipient">-> Sizland (Facilitation Fee)</span>
              </div>
            </div>
            <div className="note">
              <p> Note: Final release requires Doddy's confirmation via smart contract.</p>
            </div>
          </div>
        </div>
      )}

      {isFinalSettlementComplete && (
        <div className="completion-section">
          <div className="success-message">
            <h3> Escrow Completed Successfully!</h3>
            <p>The land purchase has been completed and all funds have been distributed.</p>
            
            <div className="completion-summary">
              <h4>Transaction Summary</h4>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Total Purchase:</span>
                  <span className="value">{formatAmount(escrow.totalAmount)} ETH</span>
                </div>
                <div className="summary-item">
                  <span className="label">Due Diligence:</span>
                  <span className="value">{formatAmount(escrow.amounts[0])} ETH</span>
                </div>
                <div className="summary-item">
                  <span className="label">Deposit (10%):</span>
                  <span className="value">{formatAmount(escrow.amounts[1])} ETH</span>
                </div>
                <div className="summary-item">
                  <span className="label">Final Balance:</span>
                  <span className="value">{formatAmount(escrow.amounts[2])} ETH</span>
                </div>
                <div className="summary-item">
                  <span className="label">Facilitation Fee:</span>
                  <span className="value">{formatAmount(escrow.amounts[3])} ETH</span>
                </div>
              </div>
            </div>

            <div className="completion-documents">
              <h4>Documents Secured</h4>
              <div className="documents-list">
                <div className="doc-item">[Done] Registry Search Report</div>
                <div className="doc-item">[Done] Site Visit Report</div>
                <div className="doc-item">[Done] Signed Sale Agreement</div>
                <div className="doc-item">[Done] Original Property Title</div>
                <div className="doc-item">[Done] LCB Transfer Consents</div>
              </div>
            </div>

            <div className="next-steps">
              <h4>Next Steps</h4>
              <ul>
                <li>Property title has been transferred to your name</li>
                <li>All legal documents are stored in the Document Vault</li>
                <li>Physical copies can be collected from Doddy's office</li>
                <li>Property registration with local authorities completed</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="security-features">
        <h3>Security & Verification</h3>
        <div className="security-items">
          <div className="security-item">
            <span className="security-icon"></span>
            <div className="security-text">
              <strong>Multi-sig Verification:</strong> All releases required multiple confirmations
            </div>
          </div>
          <div className="security-item">
            <span className="security-icon"></span>
            <div className="security-text">
              <strong>Document Hashing:</strong> All legal documents hashed on-chain for verification
            </div>
          </div>
          <div className="security-item">
            <span className="security-icon"></span>
            <div className="security-text">
              <strong>Notary Oracle:</strong> Doddy acted as trusted oracle for legal verification
            </div>
          </div>
          <div className="security-item">
            <span className="security-icon">[Time]</span>
            <div className="security-text">
              <strong>Timestamped:</strong> All actions recorded with blockchain timestamps
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinalSettlementPhase;