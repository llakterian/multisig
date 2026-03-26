import React, { useState } from 'react';
import { ethers } from 'ethers';

const DiscoveryPhase = ({ escrow, onFund, loading }) => {
  const [showPropertyList, setShowPropertyList] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [fundAmount, setFundAmount] = useState('');

  // Mock property data - in production, this would come from your backend
  const properties = [
    {
      id: 1,
      title: 'Beachfront Plot - Paradise Cove',
      location: 'Coast',
      price: '5000',
      description: 'Prime beachfront location with ocean views',
      images: ['beach1.jpg', 'beach2.jpg'],
      geoTag: { lat: 12.3456, lng: -78.9012 }
    },
    {
      id: 2,
      title: 'Mountain Retreat - Alpine Heights',
      location: 'Mountains',
      price: '7500',
      description: 'Secluded mountain property with panoramic views',
      images: ['mountain1.jpg', 'mountain2.jpg'],
      geoTag: { lat: 34.5678, lng: -45.6789 }
    },
    {
      id: 3,
      title: 'Urban Development - City Center',
      location: 'Downtown',
      price: '10000',
      description: 'Commercial plot in heart of business district',
      images: ['urban1.jpg', 'urban2.jpg'],
      geoTag: { lat: 56.7890, lng: -12.3456 }
    }
  ];

  const handlePropertySelect = (property) => {
    setSelectedProperty(property);
    setFundAmount(property.price);
    setShowPropertyList(false);
  };

  const handleFundEscrow = async () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const amountWei = ethers.utils.parseEther(fundAmount);
    await onFund(escrow.address, amountWei);
  };

  const isFunded = escrow.state > 1; // State > Created means funded

  return (
    <div className="discovery-phase">
      <h2>Phase 1: Discovery & Lock-up</h2>
      
      {!isFunded ? (
        <div className="fund-section">
          <div className="fund-info">
            <h3>Lock Up Your Budget</h3>
            <p>Deposit your total budget into the Treasury to begin the escrow process.</p>
            <div className="fund-amount">
              <label>Total Amount (ETH):</label>
              <input
                type="number"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="Enter amount in ETH"
                disabled={loading}
              />
            </div>
            <button
              className="fund-btn"
              onClick={handleFundEscrow}
              disabled={loading || !fundAmount}
            >
              {loading ? 'Processing...' : 'Lock Funds'}
            </button>
          </div>

          {showPropertyList && (
            <div className="property-list">
              <h3>Available Properties</h3>
              <div className="properties-grid">
                {properties.map((property) => (
                  <div key={property.id} className="property-card">
                    <div className="property-images">
                      {property.images.map((img, index) => (
                        <img key={index} src={`/images/${img}`} alt={property.title} />
                      ))}
                    </div>
                    <div className="property-info">
                      <h4>{property.title}</h4>
                      <p className="location">{property.location}</p>
                      <p className="description">{property.description}</p>
                      <div className="property-footer">
                        <span className="price">{property.price} ETH</span>
                        <button
                          className="select-btn"
                          onClick={() => handlePropertySelect(property)}
                        >
                          Select Property
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedProperty && (
            <div className="selected-property">
              <h3>Selected Property</h3>
              <div className="property-summary">
                <h4>{selectedProperty.title}</h4>
                <p>Location: {selectedProperty.location}</p>
                <p>Price: {selectedProperty.price} ETH</p>
                <div className="geo-tag">
                  <strong>Geo-tag:</strong> {selectedProperty.geoTag.lat}, {selectedProperty.geoTag.lng}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="funded-section">
          <div className="success-message">
            <h3> Funds Locked Successfully</h3>
            <p>Your budget has been secured in the Multi-sig Treasury.</p>
            <div className="fund-details">
              <p>Amount Locked: {ethers.utils.formatEther(escrow.totalAmount)} ETH</p>
              <p>Escrow Address: {escrow.address}</p>
            </div>
          </div>

          {selectedProperty && (
            <div className="next-phase-info">
              <h3>Ready for Phase 2: Safety Gate</h3>
              <p>Once you select a property, the $200 due diligence milestone will be unlocked for the notary's verification services.</p>
              <div className="milestone-preview">
                <div className="milestone-item">
                  <span className="milestone-amount">$200</span>
                  <span className="milestone-description">Due Diligence Fee (Registry Search + Site Visit)</span>
                </div>
              </div>
            </div>
          )}

          <div className="digital-proofs">
            <h3>Digital Proofs Available</h3>
            <p>Geo-tagged photos and videos have been uploaded for verification:</p>
            <div className="proofs-list">
              <div className="proof-item">[Done] High-resolution property photos</div>
              <div className="proof-item">[Done] Video walkthrough of the land</div>
              <div className="proof-item">[Done] Satellite imagery verification</div>
              <div className="proof-item">[Done] Boundary survey documentation</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscoveryPhase;