import React from 'react';

const ProgressBar = ({ currentPhase, phases, milestones, escrowState }) => {
  const getPhaseProgress = () => {
    const phaseProgress = {
      0: { progress: 0, status: 'active' },    // Discovery
      1: { progress: 25, status: 'pending' },  // Safety Gate
      2: { progress: 50, status: 'pending' },  // Execution
      3: { progress: 75, status: 'pending' }   // Final Settlement
    };

    // Update progress based on milestones
    if (milestones[0]) { // Due Diligence complete
      phaseProgress[0].status = 'completed';
      phaseProgress[1].status = 'active';
      phaseProgress[1].progress = 50;
    }
    
    if (milestones[1]) { // Deposit complete
      phaseProgress[1].status = 'completed';
      phaseProgress[2].status = 'active';
      phaseProgress[2].progress = 75;
    }
    
    if (milestones[2]) { // Final Settlement complete
      phaseProgress[2].status = 'completed';
      phaseProgress[3].status = 'completed';
      phaseProgress[3].progress = 100;
    }

    return phaseProgress;
  };

  const phaseProgress = getPhaseProgress();
  const overallProgress = phaseProgress[currentPhase]?.progress || 0;

  return (
    <div className="progress-bar-container">
      <div className="progress-header">
        <h3>Escrow Progress</h3>
        <div className="progress-percentage">{overallProgress}% Complete</div>
      </div>

      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${overallProgress}%` }}
        ></div>
      </div>

      <div className="progress-phases">
        {phases.map((phase, index) => (
          <div 
            key={phase.id} 
            className={`phase-marker ${phaseProgress[index].status}`}
            onClick={() => {/* Handle phase navigation */}}
          >
            <div className="phase-dot">
              {phaseProgress[index].status === 'completed' && '[Done]'}
              {phaseProgress[index].status === 'active' && '*'}
              {phaseProgress[index].status === 'pending' && ''}
            </div>
            <div className="phase-label">
              <div className="phase-name">{phase.name}</div>
              <div className="phase-desc">{phase.description}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="progress-details">
        <div className="detail-item">
          <span className="detail-label">Current State:</span>
          <span className="detail-value">{escrowState}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Active Phase:</span>
          <span className="detail-value">{phases[currentPhase]?.name}</span>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;