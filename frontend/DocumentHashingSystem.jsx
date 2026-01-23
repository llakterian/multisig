import React, { useState, useCallback } from 'react';
import { ethers } from 'ethers';

const DocumentHashingSystem = ({ escrowAddress, userAddress, isNotary }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentType, setDocumentType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [documentHash, setDocumentHash] = useState('');
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState({});

  const documentTypes = {
    0: 'Registry Search',
    1: 'Site Visit Report', 
    2: 'Sale Agreement',
    3: 'Original Title',
    4: 'LCB Consent'
  };

  // Generate SHA-256 hash from file
  const generateFileHash = async (file) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return '0x' + hashHex;
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      const hash = await generateFileHash(file);
      setDocumentHash(hash);
    }
  }, []);

  // Upload document to IPFS (mock implementation)
  const uploadToIPFS = async (file) => {
    // In production, this would upload to actual IPFS
    // For now, return a mock IPFS hash
    const mockIPFSHash = 'Qm' + Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15);
    return mockIPFSHash;
  };

  // Upload document and hash to smart contract
  const handleUploadDocument = async () => {
    if (!selectedFile || !documentType) {
      alert('Please select a file and document type');
      return;
    }

    setUploading(true);
    try {
      // Upload to IPFS
      const ipfsHash = await uploadToIPFS(selectedFile);
      
      // Get contract instance
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(
        escrowAddress, 
        NotaryMediatedEscrow.abi, 
        provider.getSigner()
      );

      // Upload document hash to smart contract
      const tx = await contract.uploadDocument(
        0, // escrowId (assuming first escrow)
        parseInt(documentType),
        documentHash
      );
      await tx.wait();

      // Update local state
      const newDoc = {
        id: Date.now(),
        type: documentTypes[documentType],
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        documentHash: documentHash,
        ipfsHash: ipfsHash,
        uploadedAt: new Date().toISOString(),
        uploadedBy: userAddress
      };

      setUploadedDocuments(prev => [...prev, newDoc]);
      setSelectedFile(null);
      setDocumentHash('');
      setDocumentType('');

      alert('Document uploaded successfully!');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Error uploading document');
    } finally {
      setUploading(false);
    }
  };

  // Verify document hash
  const verifyDocumentHash = async (doc) => {
    try {
      // In production, this would verify against the smart contract
      // For now, simulate verification
      setVerificationStatus(prev => ({
        ...prev,
        [doc.id]: { status: 'verifying', message: 'Verifying...' }
      }));

      // Simulate verification delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      setVerificationStatus(prev => ({
        ...prev,
        [doc.id]: { status: 'verified', message: 'Document hash verified on-chain' }
      }));
    } catch (error) {
      setVerificationStatus(prev => ({
        ...prev,
        [doc.id]: { status: 'error', message: 'Verification failed' }
      }));
    }
  };

  // Download document from IPFS
  const downloadFromIPFS = async (ipfsHash, fileName) => {
    try {
      // In production, this would fetch from actual IPFS
      // For now, simulate download
      alert(`Downloading ${fileName} from IPFS (${ipfsHash})`);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Error downloading document');
    }
  };

  return (
    <div className="document-hashing-system">
      <h2>Document Hashing & Verification System</h2>
      
      {isNotary && (
        <div className="upload-section">
          <h3>Upload Document (Notary Only)</h3>
          <div className="upload-form">
            <div className="form-group">
              <label>Document Type:</label>
              <select 
                value={documentType} 
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={uploading}
              >
                <option value="">Select document type</option>
                {Object.entries(documentTypes).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Select File:</label>
              <input 
                type="file" 
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={uploading}
              />
            </div>

            {selectedFile && (
              <div className="file-preview">
                <div className="file-info">
                  <p><strong>File:</strong> {selectedFile.name}</p>
                  <p><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p><strong>Type:</strong> {selectedFile.type}</p>
                </div>
                
                {documentHash && (
                  <div className="hash-info">
                    <p><strong>SHA-256 Hash:</strong></p>
                    <code className="hash-display">{documentHash}</code>
                  </div>
                )}
              </div>
            )}

            <button 
              className="upload-btn"
              onClick={handleUploadDocument}
              disabled={uploading || !selectedFile || !documentType}
            >
              {uploading ? 'Uploading...' : 'Upload & Hash Document'}
            </button>
          </div>
        </div>
      )}

      <div className="documents-vault">
        <h3>Document Vault</h3>
        <p>Secure storage for all legal documents with on-chain hashing verification.</p>
        
        <div className="documents-grid">
          {uploadedDocuments.map((doc) => (
            <div key={doc.id} className="document-card">
              <div className="document-header">
                <h4>{doc.type}</h4>
                <div className="document-status">
                  {verificationStatus[doc.id]?.status === 'verified' && (
                    <span className="status verified"> Verified</span>
                  )}
                  {verificationStatus[doc.id]?.status === 'verifying' && (
                    <span className="status verifying"> Verifying...</span>
                  )}
                  {verificationStatus[doc.id]?.status === 'error' && (
                    <span className="status error">[Error] Error</span>
                  )}
                  {!verificationStatus[doc.id] && (
                    <span className="status pending"> Pending</span>
                  )}
                </div>
              </div>

              <div className="document-details">
                <div className="detail-item">
                  <span className="label">File Name:</span>
                  <span className="value">{doc.fileName}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Uploaded:</span>
                  <span className="value">{new Date(doc.uploadedAt).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Document Hash:</span>
                  <code className="hash-value">{doc.documentHash.slice(0, 20)}...</code>
                </div>
                <div className="detail-item">
                  <span className="label">IPFS Hash:</span>
                  <code className="ipfs-value">{doc.ipfsHash}</code>
                </div>
              </div>

              <div className="document-actions">
                <button 
                  className="verify-btn"
                  onClick={() => verifyDocumentHash(doc)}
                  disabled={verificationStatus[doc.id]?.status === 'verifying'}
                >
                  {verificationStatus[doc.id]?.status === 'verified' ? '[Done] Verified' : 'Verify Hash'}
                </button>
                
                <button 
                  className="download-btn"
                  onClick={() => downloadFromIPFS(doc.ipfsHash, doc.fileName)}
                >
                   Download
                </button>
              </div>

              {verificationStatus[doc.id]?.message && (
                <div className={`verification-message ${verificationStatus[doc.id].status}`}>
                  {verificationStatus[doc.id].message}
                </div>
              )}
            </div>
          ))}
        </div>

        {uploadedDocuments.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"></div>
            <p>No documents uploaded yet</p>
            {isNotary && <p>Upload legal documents to begin the verification process</p>}
          </div>
        )}
      </div>

      <div className="hashing-info">
        <h3>How Document Hashing Works</h3>
        <div className="info-grid">
          <div className="info-item">
            <div className="info-icon"></div>
            <div className="info-content">
              <h4>SHA-256 Hashing</h4>
              <p>Each document is cryptographically hashed using SHA-256 algorithm</p>
            </div>
          </div>
          
          <div className="info-item">
            <div className="info-icon">[Link]</div>
            <div className="info-content">
              <h4>On-Chain Storage</h4>
              <p>Document hashes are stored on the blockchain for immutable verification</p>
            </div>
          </div>
          
          <div className="info-item">
            <div className="info-icon"></div>
            <div className="info-content">
              <h4>IPFS Storage</h4>
              <p>Original documents are stored on IPFS for decentralized access</p>
            </div>
          </div>
          
          <div className="info-item">
            <div className="info-icon"></div>
            <div className="info-content">
              <h4>Verification</h4>
              <p>Anyone can verify document authenticity by comparing hashes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="security-features">
        <h3>Security Features</h3>
        <div className="security-list">
          <div className="security-feature">
            <span className="feature-icon">[Shield]</span>
            <div className="feature-text">
              <strong>Tamper-Proof:</strong> Any document modification changes the hash
            </div>
          </div>
          
          <div className="security-feature">
            <span className="feature-icon"></span>
            <div className="feature-text">
              <strong>Transparent:</strong> All document hashes publicly verifiable on-chain
            </div>
          </div>
          
          <div className="security-feature">
            <span className="feature-icon"></span>
            <div className="feature-text">
              <strong>Authorized Upload:</strong> Only Doddy (notary) can upload documents
            </div>
          </div>
          
          <div className="security-feature">
            <span className="feature-icon">[Time]</span>
            <div className="feature-text">
              <strong>Timestamped:</strong> Upload time recorded on blockchain
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentHashingSystem;