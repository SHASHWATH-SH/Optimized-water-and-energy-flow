import React, { useEffect, useState } from 'react';
import { FaCheck, FaEdit, FaHistory, FaPlus, FaTimes } from 'react-icons/fa';

function BuildingDashboard({ user, onLogout }) {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [waterRequirement, setWaterRequirement] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestData, setRequestData] = useState({
    water_amount: '',
    reason: '',
    event_type: 'party',
    duration: 1
  });
  const [requests, setRequests] = useState([]);
  const [simulationStatus, setSimulationStatus] = useState('not_started');
  const [loading, setLoading] = useState(false);
  const [housesByBuilding, setHousesByBuilding] = useState({});
  const [expandedBuilding, setExpandedBuilding] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchBuildings();
    fetchRequests();
    fetchSimulationStatus();
  }, []);

  useEffect(() => {
    if (buildings.length > 0) {
      buildings.forEach(b => {
        if (!housesByBuilding[b.id]) fetchHouses(b.id);
      });
    }
    // eslint-disable-next-line
  }, [buildings]);

  const fetchBuildings = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/buildings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBuildings(data);
      }
    } catch (error) {
      console.error('Error fetching buildings:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/water-requests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const fetchSimulationStatus = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/simulation/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSimulationStatus(data.status);
      }
    } catch (error) {
      console.error('Error fetching simulation status:', error);
    }
  };

  const fetchHouses = async (buildingId) => {
    if (!token) return;
    try {
      const response = await fetch(`http://localhost:5000/api/buildings/${buildingId}/houses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHousesByBuilding(prev => ({ ...prev, [buildingId]: data.houses }));
      }
    } catch (err) {
      // handle error
    }
  };

  const updateWaterRequirement = async (buildingId) => {
    if (!waterRequirement || waterRequirement < 0) {
      alert('Please enter a valid water requirement');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/buildings/${buildingId}/water-requirement`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ water_requirement: parseInt(waterRequirement) })
      });

      if (response.ok) {
        alert('Water requirement updated successfully!');
        setWaterRequirement('');
        setSelectedBuilding(null);
        fetchBuildings();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update water requirement');
      }
    } catch (error) {
      alert('Error updating water requirement');
    } finally {
      setLoading(false);
    }
  };

  const submitWaterRequest = async () => {
    if (!requestData.water_amount || !requestData.reason) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/water-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...requestData,
          water_amount: parseInt(requestData.water_amount),
          building_id: selectedBuilding?.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert('Water request submitted successfully!');
        setShowRequestModal(false);
        setRequestData({ water_amount: '', reason: '', event_type: 'party', duration: 1 });
        fetchRequests();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to submit request');
      }
    } catch (error) {
      alert('Error submitting request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#28a745';
      case 'rejected': return '#dc3545';
      case 'pending': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <FaCheck />;
      case 'rejected': return <FaTimes />;
      case 'pending': return <FaHistory />;
      default: return <FaHistory />;
    }
  };

  const getBuildingTotals = (buildingId) => {
    const houses = housesByBuilding[buildingId] || [];
    const totalPeople = houses.reduce((sum, h) => sum + h.num_people, 0);
    const totalWater = houses.reduce((sum, h) => sum + h.water_requirement, 0);
    return { totalPeople, totalWater };
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div>
            <h1 style={{ color: '#2563eb', marginBottom: '10px' }}>
              🏢 Building Management Dashboard
            </h1>
            <p style={{ color: '#666' }}>
              Welcome, {user?.username}! Manage your building's water requirements and submit special requests.
            </p>
          </div>
          
          <button
            onClick={onLogout}
            style={{
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#c82333'}
            onMouseOut={(e) => e.target.style.background = '#dc3545'}
          >
            🚪 Logout
          </button>
        </div>
        
        <div style={{
          background: simulationStatus === 'started' ? '#e8f5e8' : '#fff3cd',
          padding: '15px',
          borderRadius: '10px',
          marginTop: '15px',
          border: `1px solid ${simulationStatus === 'started' ? '#28a745' : '#ffc107'}`
        }}>
          <strong>Simulation Status:</strong> {simulationStatus === 'started' ? '🟢 Active - You can update water requirements' : '🟡 Not Started - Admin needs to start simulation'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Buildings Section */}
        <div>
          <h2 style={{ color: '#2563eb', marginBottom: '15px' }}>🏢 Your Buildings</h2>
          <div style={{ maxHeight: '500px', overflow: 'auto' }}>
            {buildings.map(building => (
              <div key={building.id} style={{
                background: 'white',
                border: '1px solid #e0e0e0',
                borderRadius: '10px',
                padding: '15px',
                marginBottom: '10px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, color: '#333' }}>{building.building_name}</h3>
                  <span style={{
                    background: '#e3f2fd',
                    color: '#1976d2',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {building.building_code}
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px', fontSize: '14px' }}>
                  <div>
                    <strong>Total People:</strong> {housesByBuilding[building.id] ? getBuildingTotals(building.id).totalPeople : '...'}
                  </div>
                  <div>
                    <strong>Total Water Requirement:</strong> {housesByBuilding[building.id] ? getBuildingTotals(building.id).totalWater : '...'} L/day
                  </div>
                  <div>
                    <strong>Apartments:</strong> {building.apartments}
                  </div>
                  <div>
                    <strong>Source:</strong> {building.preferred_source}
                  </div>
                  <div>
                    <strong>Priority:</strong> {building.priority}
                  </div>
                </div>

                <button
                  style={{ marginBottom: '10px', background: '#e3f2fd', color: '#1976d2', border: 'none', borderRadius: '5px', padding: '5px 10px', cursor: 'pointer' }}
                  onClick={() => {
                    setExpandedBuilding(expandedBuilding === building.id ? null : building.id);
                    if (!housesByBuilding[building.id]) fetchHouses(building.id);
                  }}
                >
                  {expandedBuilding === building.id ? 'Hide Houses' : 'Show Houses'}
                </button>
                {expandedBuilding === building.id && housesByBuilding[building.id] && (
                  <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                    <strong>Houses:</strong>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {housesByBuilding[building.id].map(house => (
                        <li key={house.house_number}>
                          House {house.house_number}: {house.num_people} people, {house.water_requirement} L/day
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {simulationStatus === 'started' && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="number"
                      placeholder="New water requirement"
                      value={selectedBuilding?.id === building.id ? waterRequirement : ''}
                      onChange={(e) => {
                        setSelectedBuilding(building);
                        setWaterRequirement(e.target.value);
                      }}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid #ddd',
                        borderRadius: '5px'
                      }}
                    />
                    <button
                      onClick={() => updateWaterRequirement(building.id)}
                      disabled={loading || selectedBuilding?.id !== building.id}
                      style={{
                        padding: '8px 15px',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        opacity: loading || selectedBuilding?.id !== building.id ? 0.5 : 1
                      }}
                    >
                      <FaEdit /> Update
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBuilding(building);
                        setShowRequestModal(true);
                      }}
                      style={{
                        padding: '8px 15px',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      <FaPlus /> Request
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Requests Section */}
        <div>
          <h2 style={{ color: '#2563eb', marginBottom: '15px' }}>📋 Water Requests</h2>
          <div style={{ maxHeight: '500px', overflow: 'auto' }}>
            {requests.length === 0 ? (
              <div style={{
                background: '#f8f9fa',
                padding: '20px',
                borderRadius: '10px',
                textAlign: 'center',
                color: '#666'
              }}>
                No water requests yet
              </div>
            ) : (
              requests.map(request => (
                <div key={request.id} style={{
                  background: 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '10px',
                  padding: '15px',
                  marginBottom: '10px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ margin: 0, color: '#333' }}>
                      {request.building_name || 'General Request'}
                    </h4>
                    <span style={{
                      background: getStatusColor(request.status),
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {getStatusIcon(request.status)} {request.status}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                    <div><strong>Amount:</strong> {request.water_amount} units</div>
                    <div><strong>Type:</strong> {request.event_type}</div>
                    <div><strong>Duration:</strong> {request.duration} days</div>
                    <div><strong>Reason:</strong> {request.reason}</div>
                  </div>

                  {request.ai_recommendation && (
                    <div style={{
                      background: '#f8f9fa',
                      padding: '10px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      marginBottom: '10px'
                    }}>
                      <strong>AI Recommendation:</strong><br />
                      {request.ai_recommendation}
                    </div>
                  )}

                  {request.admin_notes && (
                    <div style={{
                      background: '#e3f2fd',
                      padding: '10px',
                      borderRadius: '5px',
                      fontSize: '12px'
                    }}>
                      <strong>Admin Notes:</strong><br />
                      {request.admin_notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '15px',
            padding: '25px',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <h2 style={{ color: '#2563eb', marginBottom: '20px' }}>
              💧 Water Request - {selectedBuilding?.building_name}
            </h2>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Additional Water Required (units)
              </label>
              <input
                type="number"
                value={requestData.water_amount}
                onChange={(e) => setRequestData({...requestData, water_amount: e.target.value})}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
                placeholder="Enter amount"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Event Type
              </label>
              <select
                value={requestData.event_type}
                onChange={(e) => setRequestData({...requestData, event_type: e.target.value})}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
              >
                <option value="party">🎉 Party/Celebration</option>
                <option value="conference">🏢 Conference/Meeting</option>
                <option value="construction">🏗️ Construction Work</option>
                <option value="maintenance">🔧 Maintenance Work</option>
                <option value="emergency">🚨 Emergency Situation</option>
                <option value="other">📋 Other</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Duration (days)
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={requestData.duration}
                onChange={(e) => setRequestData({...requestData, duration: parseInt(e.target.value)})}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Reason/Description
              </label>
              <textarea
                value={requestData.reason}
                onChange={(e) => setRequestData({...requestData, reason: e.target.value})}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
                placeholder="Please describe why additional water is needed..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowRequestModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitWaterRequest}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BuildingDashboard; 