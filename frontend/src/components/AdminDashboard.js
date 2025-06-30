import React, { useEffect, useState } from 'react';
import { FaCheck, FaEye, FaPlay, FaRedo, FaRocket, FaSpinner, FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

function AdminDashboard({ user, onLogout }) {
  const [requests, setRequests] = useState([]);
  const [simulationStatus, setSimulationStatus] = useState('not_started');
  const [simulationData, setSimulationData] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [guestRequests, setGuestRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    await Promise.all([
      fetchRequests(),
      fetchSimulationStatus(),
      fetchBuildings(),
      fetchGuestRequests()
    ]);
    setLastUpdate(new Date().toLocaleTimeString());
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

  const fetchGuestRequests = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/guest/water-requests');
      if (response.ok) {
        const data = await response.json();
        setGuestRequests(data);
      }
    } catch (error) {
      console.error('Error fetching guest requests:', error);
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
        setSimulationData(data);
      }
    } catch (error) {
      console.error('Error fetching simulation status:', error);
    }
  };

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

  const startSimulation = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/simulation/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('✅ Simulation started successfully!\n\n📊 Default building data has been loaded to the database.\n🏢 Buildings can now update their water requirements.\n🚰 You can now run the comprehensive 3D simulation with real data.');
        fetchSimulationStatus();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to start simulation');
      }
    } catch (error) {
      alert('Error starting simulation');
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async () => {
    // Navigate to the 3D simulation page
    navigate('/simulation');
  };

  const resetSimulation = async () => {
    if (!window.confirm('Are you sure you want to reset the simulation? This will clear all today\'s data.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/simulation/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Simulation reset successfully!');
        fetchSimulationStatus();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to reset simulation');
      }
    } catch (error) {
      alert('Error resetting simulation');
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (requestId, status, notes = '') => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/water-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, admin_notes: notes })
      });

      if (response.ok) {
        alert(`Request ${status} successfully!`);
        await fetchRequests();
        await fetchSimulationStatus();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update request');
      }
    } catch (error) {
      alert('Error updating request');
    } finally {
      setLoading(false);
    }
  };

  const approveGuestRequest = async (requestId, status, notes = '') => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/water-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, admin_notes: notes })
      });

      if (response.ok) {
        alert(`Guest request ${status} successfully!`);
        fetchGuestRequests();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to update guest request');
      }
    } catch (error) {
      alert('Error updating guest request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f57c00';
      case 'approved': return '#2e7d32';
      case 'rejected': return '#d32f2f';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <FaSpinner />;
      case 'approved': return <FaCheck />;
      case 'rejected': return <FaTimes />;
      default: return <FaEye />;
    }
  };

  const totalWaterRequirement = buildings.reduce((sum, building) => sum + building.water_requirement, 0);
  const pendingRequests = requests.filter(req => req.status === 'pending').length;
  const pendingGuestRequests = guestRequests.filter(req => req.status === 'pending').length;

  return (
    <div style={{ padding: '20px', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #2563eb, #43e97b)', 
        padding: '30px', 
        borderRadius: '15px', 
        color: 'white', 
        marginBottom: '30px',
        boxShadow: '0 8px 32px rgba(37, 99, 235, 0.3)',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
              👨‍💼 City Administrator Dashboard
            </h1>
            <p style={{ margin: '10px 0 0 0', fontSize: '16px', opacity: 0.9 }}>
              Manage smart city water distribution and monitor system performance
            </p>
            {lastUpdate && (
              <div style={{ marginTop: '15px', fontSize: '14px', opacity: 0.8 }}>
                Last updated: {lastUpdate}
                <button
                  onClick={fetchData}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    marginLeft: '10px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  🔄 Refresh
                </button>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Welcome, {user?.username || 'Admin'}
            </div>
            <button
              onClick={onLogout}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      {/* System Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2563eb' }}>🏢 {buildings.length}</div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>Total Buildings</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2e7d32' }}>💧 {totalWaterRequirement}</div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>Total Water Required</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f57c00' }}>⏳ {pendingRequests}</div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>Pending Requests</div>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#9c27b0' }}>🎉 {pendingGuestRequests}</div>
          <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>Guest Event Requests</div>
        </div>
      </div>

      {/* Simulation Controls */}
      <div style={{ background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
        <h2 style={{ color: '#2563eb', marginBottom: '20px', fontSize: '24px' }}>🎮 Simulation Controls</h2>
        
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={startSimulation}
            disabled={loading || simulationStatus === 'started'}
            style={{
              background: simulationStatus === 'started' ? '#ccc' : '#2563eb',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: simulationStatus === 'started' ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FaPlay /> Start Simulation
          </button>

          <button
            onClick={runSimulation}
            disabled={loading || simulationStatus !== 'started'}
            style={{
              background: simulationStatus !== 'started' ? '#ccc' : '#43e97b',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: simulationStatus !== 'started' ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FaRocket /> Run 3D Simulation
          </button>

          <button
            onClick={resetSimulation}
            disabled={loading}
            style={{
              background: '#f57c00',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FaRedo /> Reset Simulation
          </button>
        </div>

        <div style={{ marginTop: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            <strong>Current Status:</strong> {simulationStatus === 'not_started' ? 'Not Started' : 
                                           simulationStatus === 'started' ? 'Started - Users can update requirements' : 
                                           'Completed'}
          </div>
          {simulationData && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
              Last run: {simulationData.last_run || 'Never'}
            </div>
          )}
        </div>
      </div>

      {/* Water Requests */}
      <div style={{ background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
        <h2 style={{ color: '#2563eb', marginBottom: '20px', fontSize: '24px' }}>📋 Water Requests</h2>
        
        {requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            No water requests found
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {requests.map((request) => (
              <div key={request.id} style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: '8px', 
                padding: '15px', 
                marginBottom: '10px',
                background: request.status === 'pending' ? '#fff8e1' : '#f8f9fa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <strong style={{ color: '#2563eb' }}>{request.building_name || 'Unknown Building'}</strong>
                    <span style={{ marginLeft: '10px', color: '#666' }}>({request.building_code})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ 
                      color: getStatusColor(request.status), 
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      {getStatusIcon(request.status)} {request.status}
                    </span>
                  </div>
                </div>
                
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                  <div><strong>Water Amount:</strong> {request.water_amount} units</div>
                  <div><strong>Request Type:</strong> {request.request_type}</div>
                  <div><strong>Reason:</strong> {request.reason || 'No reason provided'}</div>
                  {request.ai_recommendation && (
                    <div style={{ marginTop: '10px', padding: '10px', background: '#e3f2fd', borderRadius: '5px' }}>
                      <strong>AI Recommendation:</strong> {request.ai_recommendation}
                    </div>
                  )}
                </div>

                {request.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => approveRequest(request.id, 'approved')}
                      disabled={loading}
                      style={{
                        background: '#2e7d32',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      <FaCheck /> Approve
                    </button>
                    <button
                      onClick={() => approveRequest(request.id, 'rejected')}
                      disabled={loading}
                      style={{
                        background: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      <FaTimes /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guest Event Requests */}
      <div style={{ background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
        <h2 style={{ color: '#2563eb', marginBottom: '20px', fontSize: '24px' }}>🎉 Guest Event Requests</h2>
        
        {guestRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            No guest event requests found
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {guestRequests.map((request) => (
              <div key={request.id} style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: '8px', 
                padding: '15px', 
                marginBottom: '10px',
                background: request.status === 'pending' ? '#f3e5f5' : '#f8f9fa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <strong style={{ color: '#9c27b0' }}>🎉 {request.event_type}</strong>
                    <span style={{ marginLeft: '10px', color: '#666' }}>(Guest Request)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ 
                      color: getStatusColor(request.status), 
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      {getStatusIcon(request.status)} {request.status}
                    </span>
                  </div>
                </div>
                
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                  <div><strong>Water Amount:</strong> {request.water_amount} units</div>
                  <div><strong>Event Type:</strong> {request.event_type}</div>
                  <div><strong>Reason:</strong> {request.reason || 'No reason provided'}</div>
                  <div><strong>Duration:</strong> {request.duration} day(s)</div>
                  {request.ai_recommendation && (
                    <div style={{ marginTop: '10px', padding: '10px', background: '#e3f2fd', borderRadius: '5px' }}>
                      <strong>AI Recommendation:</strong> {request.ai_recommendation}
                    </div>
                  )}
                </div>

                {request.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => approveGuestRequest(request.id, 'approved')}
                      disabled={loading}
                      style={{
                        background: '#2e7d32',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      <FaCheck /> Approve
                    </button>
                    <button
                      onClick={() => approveGuestRequest(request.id, 'rejected')}
                      disabled={loading}
                      style={{
                        background: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      <FaTimes /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Building Overview */}
      <div style={{ background: 'white', padding: '25px', borderRadius: '15px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#2563eb', marginBottom: '20px', fontSize: '24px' }}>🏢 Building Overview</h2>
        
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {buildings.map((building) => (
              <div key={building.id} style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: '8px', 
                padding: '15px',
                background: '#f8f9fa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong style={{ color: '#2563eb' }}>{building.building_name}</strong>
                  <span style={{ fontSize: '12px', color: '#666' }}>{building.building_code}</span>
                </div>
                
                <div style={{ fontSize: '14px', color: '#666' }}>
                  <div><strong>Water Requirement:</strong> {building.water_requirement} units</div>
                  <div><strong>Preferred Source:</strong> {building.preferred_source}</div>
                  <div><strong>Apartments:</strong> {building.apartments}</div>
                  <div><strong>Priority:</strong> {building.priority}</div>
                  <div><strong>Status:</strong> {building.is_active ? 'Active' : 'Inactive'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard; 