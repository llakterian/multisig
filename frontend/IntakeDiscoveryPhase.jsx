import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const IntakeDiscoveryPhase = ({ 
  escrowAddress, 
  userAddress, 
  userRole,
  onIntakeComplete,
  onPlotSelected 
}) => {
  const [formData, setFormData] = useState({
    budget: '',
    desiredSize: '',
    purpose: ''
  });
  const [currentStep, setCurrentStep] = useState('intake'); // intake, discovery, gallery
  const [digitalGallery, setDigitalGallery] = useState([]);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState(null);

  const purposes = ['Farming', 'Speculation'];
  const sizeOptions = [
    { value: 1, label: '1 Acre' },
    { value: 2, label: '2 Acres' },
    { value: 5, label: '5 Acres' },
    { value: 10, label: '10 Acres' }
  ];

  useEffect(() => {
    initializeContract();
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const submitIntake = async () => {
    if (!formData.budget || !formData.desiredSize || !formData.purpose) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      // Convert to wei (assuming 18 decimals and $1 = 1 ETH for simplicity)
      const budgetWei = ethers.utils.parseEther(formData.budget);
      const sizeValue = parseInt(formData.desiredSize);
      
      // Mock seller and notary addresses - in production these would be dynamic
      const mockSeller = "0xSeller123456789012345678901234567890";
      const mockNotary = "0xDoddyNotary123456789012345678901234567890";
      
      const tx = await contractWithSigner.createIntake(
        budgetWei,
        sizeValue,
        formData.purpose,
        mockSeller,
        mockNotary
      );
      await tx.wait();
      
      setCurrentStep('discovery');
      alert('Intake submitted successfully! Sizland team will source options for you.');
    } catch (error) {
      console.error('Error submitting intake:', error);
      alert('Error submitting intake');
    } finally {
      setLoading(false);
    }
  };

  // Mock digital gallery data - in production this would come from Sizland admin
  const mockGallery = [
    {
      id: 1,
      title: 'Coastal Farm Land',
      location: 'Mombasa Coast',
      size: 2,
      geoPin: '-4.0435, 39.6682',
      photos: ['coastal1.jpg', 'coastal2.jpg'],
      videos: ['coastal_tour.mp4'],
      price: 5000,
      description: 'Prime agricultural land near coastline, perfect for farming'
    },
    {
      id: 2,
      title: 'Highland Speculation Plot',
      location: 'Central Highlands',
      size: 2,
      geoPin: '-1.2921, 36.8219',
      photos: ['highland1.jpg', 'highland2.jpg'],
      videos: ['highland_tour.mp4'],
      price: 7500,
      description: 'High potential for development, great views'
    },
    {
      id: 3,
      title: 'Rural Agricultural Zone',
      location: 'Rift Valley',
      size: 5,
      geoPin: '-0.5228, 35.6693',
      photos: ['rural1.jpg', 'rural2.jpg'],
      videos: ['rural_tour.mp4'],
      price: 3000,
      description: 'Large plot perfect for commercial farming'
    }
  ];

  const loadDigitalGallery = async () => {
    // Simulate admin upload
    setDigitalGallery(mockGallery);
    
    if (contract) {
      try {
        const signer = contract.provider.getSigner();
        const contractWithSigner = contract.connect(signer);
        
        // Mock gallery upload by Sizland admin
        const geoPins = mockGallery.map(plot => plot.geoPin);
        const photos = mockGallery.flatMap(plot => plot.photos);
        const videos = mockGallery.flatMap(plot => plot.videos);
        
        // This would normally be called by Sizland admin
        await contractWithSigner.uploadDigitalGallery(0, geoPins, photos, videos);
      } catch (error) {
        console.log('Gallery upload simulation');
      }
    }
  };

  const handlePlotSelection = async (plot) => {
    setSelectedPlot(plot);
    setLoading(true);
    
    try {
      const signer = contract.provider.getSigner();
      const contractWithSigner = contract.connect(signer);
      
      await contractWithSigner.selectPlot(0);
      
      alert(`Selected: ${plot.title} - ${plot.size} acres for $${plot.price}`);
      if (onPlotSelected) {
        onPlotSelected(plot);
      }
    } catch (error) {
      console.error('Error selecting plot:', error);
      alert('Error selecting plot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="intake-discovery-phase">
      <h2>Phase 1: Intake & Discovery</h2>
      
      {currentStep === 'intake' && (
        <div className="intake-section">
          <h3>Tell Us Your Requirements</h3>
          <p>Enter your land purchase preferences and our team will source the perfect options for you.</p>
          
          <div className="intake-form">
            <div className="form-row">
              <div className="form-group">
                <label>Budget (USD)</label>
                <input
                  type="number"
                  name="budget"
                  value={formData.budget}
                  onChange={handleInputChange}
                  placeholder="5000"
                  min="1000"
                  step="100"
                  disabled={loading}
                />
                <span className="hint">Enter your total budget in USD</span>
              </div>
              
              <div className="form-group">
                <label>Desired Size (Acres)</label>
                <select
                  name="desiredSize"
                  value={formData.desiredSize}
                  onChange={handleInputChange}
                  disabled={loading}
                >
                  <option value="">Select size</option>
                  {sizeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="hint">Choose your preferred land size</span>
              </div>
            </div>
            
            <div className="form-group">
              <label>Purpose of Purchase</label>
              <div className="purpose-options">
                {purposes.map(purpose => (
                  <label key={purpose} className="purpose-option">
                    <input
                      type="radio"
                      name="purpose"
                      value={purpose}
                      checked={formData.purpose === purpose}
                      onChange={handleInputChange}
                      disabled={loading}
                    />
                    <span className="purpose-label">{purpose}</span>
                  </label>
                ))}
              </div>
              <span className="hint">Select your primary purpose for this land</span>
            </div>
            
            <button
              className="submit-intake-btn"
              onClick={submitIntake}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Requirements'}
            </button>
          </div>
        </div>
      )}

      {currentStep === 'discovery' && (
        <div className="discovery-section">
          <h3>Digital Gallery</h3>
          <p>Our team has curated the following options based on your requirements. Review and select your preferred plot.</p>
          
          <button
            className="load-gallery-btn"
            onClick={loadDigitalGallery}
            disabled={digitalGallery.length > 0}
          >
            {digitalGallery.length > 0 ? 'Gallery Loaded' : 'Load Digital Gallery'}
          </button>
          
          {digitalGallery.length > 0 && (
            <div className="gallery-grid">
              {digitalGallery.map(plot => (
                <div key={plot.id} className="plot-card">
                  <div className="plot-visuals">
                    <div className="photo-gallery">
                      {plot.photos.map((photo, index) => (
                        <img key={index} src={`/images/${photo}`} alt={plot.title} />
                      ))}
                    </div>
                    <div className="video-preview">
                      <div className="video-icon"></div>
                      <span>{plot.videos.length} videos</span>
                    </div>
                  </div>
                  
                  <div className="plot-details">
                    <h4>{plot.title}</h4>
                    <div className="plot-meta">
                      <span className="location"> {plot.location}</span>
                      <span className="size"> {plot.size} acres</span>
                      <span className="price">${plot.price.toLocaleString()}</span>
                    </div>
                    <p className="plot-description">{plot.description}</p>
                    
                    <div className="geo-pin">
                      <strong>Geo-Location:</strong> {plot.geoPin}
                    </div>
                    
                    <button
                      className={`select-plot-btn ${selectedPlot?.id === plot.id ? 'selected' : ''}`}
                      onClick={() => handlePlotSelection(plot)}
                      disabled={loading}
                    >
                      {selectedPlot?.id === plot.id ? '[Done] Selected' : 'Select This Plot'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {selectedPlot && (
            <div className="selection-confirmation">
              <h4> Plot Selected!</h4>
              <div className="selected-details">
                <p><strong>Selected:</strong> {selectedPlot.title}</p>
                <p><strong>Location:</strong> {selectedPlot.location}</p>
                <p><strong>Size:</strong> {selectedPlot.size} acres</p>
                <p><strong>Price:</strong> ${selectedPlot.price.toLocaleString()}</p>
              </div>
              
              <button
                className="proceed-to-funding-btn"
                onClick={() => setCurrentStep('gallery')}
              >
                Proceed to Funding
              </button>
            </div>
          )}
        </div>
      )}

      <div className="workflow-info">
        <h3>How It Works</h3>
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>You Submit Requirements</h4>
              <p>Budget, size, and purpose help us find perfect options</p>
            </div>
          </div>
          
          <div className="workflow-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Sizland Sources Options</h4>
              <p>Our team finds and vets available properties</p>
            </div>
          </div>
          
          <div className="workflow-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Digital Gallery</h4>
              <p>Review geo-pins, photos, and videos online</p>
            </div>
          </div>
          
          <div className="workflow-step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h4>Select & Fund</h4>
              <p>Choose your plot and proceed to escrow funding</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntakeDiscoveryPhase;