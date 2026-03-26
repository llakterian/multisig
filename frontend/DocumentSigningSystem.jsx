import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const DocumentSigningSystem = ({ 
  escrowAddress, 
  userAddress, 
  userRole, // 'client', 'seller', 'notary'
  escrowData 
}) => {
  const [documents, setDocuments] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [contract, setContract] = useState(null);

  const documentTypes = {
    0: 'Registry Search',
    1: 'Site Visit Report', 
    2: 'Draft Sale Agreement',
    3: 'Signed Sale Agreement',
    4: 'Original Title',
    5: 'LCB Consent'
  };

  useEffect(() => {
    initializeContract();
    loadDocuments();
    setupNotifications();
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

  const loadDocuments = async () => {
    if (!contract) return;
    
    try {
      const docs = {};
      for (let i = 0; i < 6; i++) {
        const doc = await contract.documents(0, i);
        docs[i] = {
          documentHash: doc.documentHash,
          uploadedAt: doc.uploadedAt.toNumber(),
          verified: doc.verified,
          uploadedBy: doc.uploadedBy,
          signingStatus: doc.signingStatus,
          hasSigned: [doc.hasSigned0, doc.hasSigned1], // Simplified
          clientSignedAt: doc.clientSignedAt.toNumber(),
          sellerSignedAt: doc.sellerSignedAt.toNumber(),
          notaryVerifiedAt: doc.notaryVerifiedAt.toNumber()
        };
      }
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const setupNotifications = () => {
    // Listen for contract events
    if (contract) {
      contract.on("DraftAgreementUploaded", (escrowId, hash, uploadedBy) => {
        addNotification(`Draft agreement uploaded by ${uploadedBy.slice(0, 6)}...`, 'info');
      });

      contract.on("DocumentSigned", (escrowId, docType, signer, signerRole) => {
        addNotification(`${signerRole} has signed the agreement!`, 'success');
      });

      contract.on("BothPartiesSigned", (escrowId, docType) => {
        addNotification('Both parties have signed! Ready for notarization.', 'success');
      });

      contract.on("NotaryVerifiedSignedDocument", (escrowId, docType) => {
        addNotification('Document has been notarized! Ready for next step.', 'success');
      });

      contract.on("PartyNotified", (escrowId, party, message) => {
        if (party.toLowerCase() === userAddress.toLowerCase()) {
          addNotification(message, 'notification');
        }
      });
    }
  };

  const addNotification = (message, type) => {
    setNotifications(prev => [...prev, {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleString()
    }]);
  };

  const generateFileHash = async (file) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return '0x' + hashHex;
  };

  const uploadDraftAgreement = async () => {
    if (!selectedFile) {
      alert('Please select a draft agreement file');
      return;
    }

    setUploading(true);
    try {
      const hash = await generateFileHash(selectedFile);
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.uploadDraftAgreement(0, hash);
      await tx.wait();
      
      addNotification('Draft agreement uploaded successfully!', 'success');
      await loadDocuments();
      setSelectedFile(null);
    } catch (error) {
      console.error('Error uploading draft agreement:', error);
      addNotification('Error uploading draft agreement', 'error');
    } finally {
      setUploading(false);
    }
  };

  const signDocument = async () => {
    setSigning(true);
    try {
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.signDocument(0, 2); // DraftSaleAgreement
      await tx.wait();
      
      addNotification('Document signed successfully!', 'success');
      await loadDocuments();
    } catch (error) {
      console.error('Error signing document:', error);
      addNotification('Error signing document', 'error');
    } finally {
      setSigning(false);
    }
  };

  const notarizeDocument = async () => {
    setSigning(true);
    try {
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      const tx = await contractWithSigner.notarizeSignedDocument(0, 2); // DraftSaleAgreement
      await tx.wait();
      
      addNotification('Document notarized successfully!', 'success');
      await loadDocuments();
    } catch (error) {
      console.error('Error notarizing document:', error);
      addNotification('Error notarizing document', 'error');
    } finally {
      setSigning(false);
    }
  };

  const getSigningStatus = (doc) => {
    switch (doc.signingStatus) {
      case 0: return { text: 'Not Started', color: 'gray' };
      case 1: return { text: 'Draft', color: 'blue' };
      case 2: return { text: 'Client Signed', color: 'orange' };
      case 3: return { text: 'Seller Signed', color: 'orange' };
      case 4: return { text: 'Both Signed', color: 'green' };
      case 5: return { text: 'Notary Verified', color: 'green' };
      default: return { text: 'Unknown', color: 'gray' };
    }
  };

  const draftDoc = documents[2]; // Draft Sale Agreement
  const signedDoc = documents[3]; // Signed Sale Agreement
  const signingStatus = draftDoc ? getSigningStatus(draftDoc) : { text: 'Not Started', color: 'gray' };

  return (
    <div className="document-signing-system">
      <h2> On-Platform Document Signing</h2>
      
      {/* Notifications Panel */}
      <div className="notifications-panel">
        <h3>Notifications</h3>
        <div className="notifications-list">
          {notifications.map((notif) => (
            <div key={notif.id} className={`notification ${notif.type}`}>
              <div className="notification-message">{notif.message}</div>
              <div className="notification-time">{notif.timestamp}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Draft Agreement Upload */}
      {userRole !== 'notary' && !draftDoc?.uploadedAt && (
        <div className="upload-section">
          <h3>Upload Draft Sale Agreement</h3>
          <div className="upload-form">
            <div className="form-group">
              <label>Select Draft Agreement:</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                disabled={uploading}
              />
            </div>
            
            {selectedFile && (
              <div className="file-preview">
                <p><strong>File:</strong> {selectedFile.name}</p>
                <p><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
            
            <button
              className="upload-btn"
              onClick={uploadDraftAgreement}
              disabled={uploading || !selectedFile}
            >
              {uploading ? 'Uploading...' : 'Upload Draft Agreement'}
            </button>
          </div>
        </div>
      )}

      {/* Document Signing Status */}
      {draftDoc?.uploadedAt && (
        <div className="signing-status">
          <h3>Document Signing Status</h3>
          
          <div className="status-card">
            <div className="status-header">
              <h4>Sale Agreement</h4>
              <span className={`status-badge ${signingStatus.color}`}>
                {signingStatus.text}
              </span>
            </div>
            
            <div className="document-info">
              <div className="info-item">
                <span>Uploaded:</span>
                <span>{new Date(draftDoc.uploadedAt * 1000).toLocaleString()}</span>
              </div>
              <div className="info-item">
                <span>Uploaded By:</span>
                <span>{draftDoc.uploadedBy?.slice(0, 6)}...{draftDoc.uploadedBy?.slice(-4)}</span>
              </div>
              {draftDoc.clientSignedAt > 0 && (
                <div className="info-item">
                  <span>Client Signed:</span>
                  <span>{new Date(draftDoc.clientSignedAt * 1000).toLocaleString()}</span>
                </div>
              )}
              {draftDoc.sellerSignedAt > 0 && (
                <div className="info-item">
                  <span>Seller Signed:</span>
                  <span>{new Date(draftDoc.sellerSignedAt * 1000).toLocaleString()}</span>
                </div>
              )}
              {draftDoc.notaryVerifiedAt > 0 && (
                <div className="info-item">
                  <span>Notarized:</span>
                  <span>{new Date(draftDoc.notaryVerifiedAt * 1000).toLocaleString()}</span>
                </div>
              )}
            </div>
            
            {/* Signing Actions */}
            <div className="signing-actions">
              {userRole !== 'notary' && !draftDoc.hasSigned?.includes(userAddress) && draftDoc.uploadedAt && (
                <button
                  className="sign-btn"
                  onClick={signDocument}
                  disabled={signing}
                >
                  {signing ? 'Signing...' : 'Sign Document'}
                </button>
              )}
              
              {userRole === 'notary' && draftDoc.signingStatus === 4 && ( // BothSigned
                <button
                  className="notarize-btn"
                  onClick={notarizeDocument}
                  disabled={signing}
                >
                  {signing ? 'Notarizing...' : 'Notarize & Proceed to Next Step'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Party Status */}
      {draftDoc?.uploadedAt && (
        <div className="party-status">
          <h3>Party Signing Status</h3>
          
          <div className="party-grid">
            <div className={`party-card ${draftDoc.hasSigned?.includes(escrowData.client) ? 'signed' : 'pending'}`}>
              <div className="party-info">
                <h4>Client</h4>
                <p>{escrowData.client?.slice(0, 6)}...{escrowData.client?.slice(-4)}</p>
              </div>
              <div className="party-signature">
                {draftDoc.hasSigned?.includes(escrowData.client) ? (
                  <div className="signature-block">
                    <div className="signature-icon"></div>
                    <span>Signed</span>
                  </div>
                ) : (
                  <div className="signature-block">
                    <div className="signature-icon"></div>
                    <span>Pending</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className={`party-card ${draftDoc.hasSigned?.includes(escrowData.seller) ? 'signed' : 'pending'}`}>
              <div className="party-info">
                <h4>Seller</h4>
                <p>{escrowData.seller?.slice(0, 6)}...{escrowData.seller?.slice(-4)}</p>
              </div>
              <div className="party-signature">
                {draftDoc.hasSigned?.includes(escrowData.seller) ? (
                  <div className="signature-block">
                    <div className="signature-icon"></div>
                    <span>Signed</span>
                  </div>
                ) : (
                  <div className="signature-block">
                    <div className="signature-icon"></div>
                    <span>Pending</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className={`party-card ${draftDoc.signingStatus === 5 ? 'verified' : 'pending'}`}>
              <div className="party-info">
                <h4>Notary</h4>
                <p>{escrowData.notary?.slice(0, 6)}...{escrowData.notary?.slice(-4)}</p>
              </div>
              <div className="party-signature">
                {draftDoc.signingStatus === 5 ? (
                  <div className="signature-block">
                    <div className="signature-icon"></div>
                    <span>Notarized</span>
                  </div>
                ) : (
                  <div className="signature-block">
                    <div className="signature-icon"></div>
                    <span>Waiting</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Preview */}
      {draftDoc?.uploadedAt && (
        <div className="document-preview">
          <h3>Document Preview</h3>
          <div className="preview-card">
            <div className="document-icon"></div>
            <h4>Sale Agreement</h4>
            <p>Document Hash: {draftDoc.documentHash?.slice(0, 20)}...</p>
            <button className="view-btn">View Document</button>
          </div>
        </div>
      )}

      <div className="info-section">
        <h3>How It Works</h3>
        <div className="workflow-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Upload Draft</h4>
              <p>Client or seller uploads draft sale agreement</p>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Both Parties Sign</h4>
              <p>Each party signs on the platform with notifications</p>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Notary Verification</h4>
              <p>The notary verifies signatures and notarizes document</p>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h4>Proceed to Next Step</h4>
              <p>Notarized document triggers deposit release</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentSigningSystem;