import React, { useState } from 'react';
import { ethers } from 'ethers';
import DocumentSigningSystem from './DocumentSigningSystem';

const ExecutionPhase = ({ escrow, onConfirm, loading, userAddress, userRole }) => {
  const [showAgreementDetails, setShowAgreementDetails] = useState(false);
  const [showSigningSystem, setShowSigningSystem] = useState(false);
  const [agreementConfirmed, setAgreementConfirmed] = useState(false);

  const isDepositMilestoneComplete = escrow.milestones[1]; // Deposit milestone
  const isSignedSaleAgreementVerified = escrow.documents[3]; // SignedSaleAgreement document
  const isDueDiligenceComplete = escrow.milestones[0]; // Due Diligence milestone

  const handleConfirmNotarizedAgreement = async () => {
    if (!agreementConfirmed) {
      alert('Please confirm you have reviewed the Notarized Sale Agreement');
      return;
    }
    
    await onConfirm(escrow.address);
  };

  const formatAmount = (amountWei) => {
    return ethers.utils.formatEther(amountWei);
  };

  return (
    <div className="execution-phase">
      <h2>Phase 3: Execution - Commitment Milestone</h2>
      
      <div className="milestone-info">
        <div className="milestone-header">
          <h3>Deposit Release Milestone</h3>
          <p>Upon notarized Sale Agreement confirmation, the deposit will be released to the seller.</p>
        </div>
        
        <div className="milestone-status">
          <div className={`status-indicator ${isDepositMilestoneComplete ? 'completed' : 'pending'}`}>
            {isDepositMilestoneComplete ? ' Completed' : ' Pending'}
          </div>
          {isDepositMilestoneComplete && (
            <div className="release-info">
              <span>{formatAmount(escrow.amounts[1])} ETH released to seller</span>
            </div>
          )}
        </div>
      </div>

      <div className="sale-agreement-section">
        <h3>On-Platform Document Signing</h3>
        <p>Upload draft agreement, both parties sign on platform, then the notary notarizes to proceed.</p>
        
        <div className="agreement-actions">
          <button
            className="signing-system-btn"
            onClick={() => setShowSigningSystem(!showSigningSystem)}
          >
            {showSigningSystem ? 'Hide Signing System' : ' Open Document Signing System'}
          </button>
        </div>

        {showSigningSystem && (
          <DocumentSigningSystem
            escrowAddress={escrow.address}
            userAddress={userAddress}
            userRole={userRole}
            escrowData={escrow}
          />
        )}
        
        <div className="agreement-status">
          <span className={`status ${isSignedSaleAgreementVerified ? 'verified' : 'pending'}`}>
            {isSignedSaleAgreementVerified ? ' Notarized' : ' Pending Notarization'}
          </span>
        </div>

        <div className="agreement-details">
          <div className="document-preview">
            <div className="pdf-preview">
              <div className="pdf-icon"></div>
              <p>Signed_Sale_Agreement.pdf</p>
              <button 
                className="view-btn"
                onClick={() => setShowAgreementDetails(!showAgreementDetails)}
              >
                {showAgreementDetails ? 'Hide Details' : 'View Agreement'}
              </button>
            </div>
          </div>

          {showAgreementDetails && (
            <div className="agreement-content">
              <div className="agreement-info">
                <h4>Sale Agreement Details</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <strong>Property:</strong> Beachfront Plot - Paradise Cove
                  </div>
                  <div className="info-item">
                    <strong>Buyer:</strong> {escrow.client}
                  </div>
                  <div className="info-item">
                    <strong>Seller:</strong> {escrow.seller}
                  </div>
                  <div className="info-item">
                    <strong>Total Price:</strong> {formatAmount(escrow.totalAmount)} ETH
                  </div>
                  <div className="info-item">
                    <strong>Deposit Amount:</strong> {formatAmount(escrow.amounts[1])} ETH
                  </div>
                  <div className="info-item">
                    <strong>Notary:</strong> Notary (Authorized)
                  </div>
                </div>
              </div>

              <div className="agreement-terms">
                <h5>Key Terms</h5>
                <ul>
                  <li>Buyer confirms due diligence completion</li>
                  <li>Seller confirms property transfer readiness</li>
                  <li>Notary confirms document authenticity</li>
                  <li>Deposit to be released upon agreement signing</li>
                  <li>Final settlement upon title transfer</li>
                </ul>
              </div>

              <div className="document-hash">
                <p><strong>Document Hash:</strong></p>
                <code>0x7f8a9b3c4d5e6f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5</code>
              </div>
            </div>
          )}
        </div>

        {!isDepositMilestoneComplete && isDueDiligenceComplete && (
          <div className="confirmation-section">
            <h4>Client Confirmation Required</h4>
            <p>Review the notarized Sale Agreement and confirm to release the deposit to the seller.</p>
            
            <div className="confirmation-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={agreementConfirmed}
                  onChange={(e) => setAgreementConfirmed(e.target.checked)}
                  disabled={loading}
                />
                I have reviewed and confirm the Notarized Sale Agreement terms
              </label>
            </div>

            <button
              className="confirm-btn"
              onClick={handleConfirmNotarizedAgreement}
              disabled={loading || !agreementConfirmed || !isSignedSaleAgreementVerified}
            >
              {loading ? 'Processing...' : 'Confirm Notarized Agreement & Release Deposit'}
            </button>

            <div className="warning-message">
              <p>[Warning] This action will release {formatAmount(escrow.amounts[1])} ETH to the seller.</p>
              <p>Please ensure you have thoroughly reviewed all notarized documents.</p>
            </div>
          </div>
        )}
      </div>

      <div className="milestone-tracker">
        <h3>Milestone Tracker</h3>
        <div className="tracker-content">
          <div className="milestone-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${isDepositMilestoneComplete ? 100 : 50}%` }}
              ></div>
            </div>
          </div>
          
          <div className="milestone-items">
            <div className={`milestone-item ${isDueDiligenceComplete ? 'completed' : 'pending'}`}>
              <div className="milestone-icon">[Done]</div>
              <div className="milestone-text">
                <div className="milestone-title">Due Diligence Complete</div>
                <div className="milestone-desc">Registry search and site visit verified</div>
              </div>
            </div>
            
            <div className={`milestone-item ${isDepositMilestoneComplete ? 'completed' : 'pending'}`}>
              <div className="milestone-icon">
                {isDepositMilestoneComplete ? '[Done]' : ''}
              </div>
              <div className="milestone-text">
                <div className="milestone-title">Deposit Paid</div>
                <div className="milestone-desc">
                  {formatAmount(escrow.amounts[1])} ETH released to seller
                </div>
              </div>
            </div>
            
            <div className={`milestone-item ${isDepositMilestoneComplete ? 'pending' : 'upcoming'}`}>
              <div className="milestone-icon"></div>
              <div className="milestone-text">
                <div className="milestone-title">Documents in Possession</div>
                <div className="milestone-desc">Original title and LCB consents pending</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDepositMilestoneComplete && (
        <div className="next-phase-ready">
          <div className="success-message">
            <h3> Execution Phase Completed</h3>
            <p>Deposit has been successfully released to the seller.</p>
            <div className="completed-items">
              <div className="completed-item">[Done] Sale Agreement verified and confirmed</div>
              <div className="completed-item">[Done] Deposit released to seller</div>
              <div className="completed-item">[Done] Commitment milestone achieved</div>
            </div>
          </div>
          
          <div className="next-phase-info">
            <h4>Ready for Phase 4: Final Settlement</h4>
            <p>The final phase involves title transfer verification and balance release.</p>
            <div className="next-milestone-preview">
              <div className="milestone-item">
                <span className="milestone-amount">
                  {formatAmount(escrow.amounts[2])} ETH
                </span>
                <span className="milestone-description">Final Balance to Seller</span>
              </div>
              <div className="milestone-item">
                <span className="milestone-amount">
                  {formatAmount(escrow.amounts[3])} ETH
                </span>
                <span className="milestone-description">Facilitation Fee to Treasury</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionPhase;