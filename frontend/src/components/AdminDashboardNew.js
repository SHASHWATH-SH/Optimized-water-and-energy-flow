import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaStop, FaCheck, FaTimes, FaEye, FaCog, FaChartBar, FaTint, FaExclamationTriangle, FaTools, FaSpinner, FaBug, FaWind, FaWater, FaRedo } from 'react-icons/fa';
import * as THREE from 'three';

function AdminDashboardNew({ user }) {
  const [requests, setRequests] = useState([]);
  const [simulationStatus, setSimulationStatus] = useState('not_started');
  const [simulationData, setSimulationData] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [simulationInputs, setSimulationInputs] = useState({
    river_water_total: 1000,
    ground_water_total: 1000
  });

  // 3D Simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [deliveryComplete, setDeliveryComplete] = useState(false);
  const [showDeliveryPopup, setShowDeliveryPopup] = useState(false);
  const [deliveryResults, setDeliveryResults] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [disruptions, setDisruptions] = useState({
    pipeLeak: false,
    wellDry: false,
    riverPollution: false,
    pumpFailure: false
  });
  const [selectedControl, setSelectedControl] = useState('Water Flow');
  const [riverWaterAmount, setRiverWaterAmount] = useState(1000);
  const [groundWaterAmount, setGroundWaterAmount] = useState(1000);
  const [waterWastage, setWaterWastage] = useState({
    pipeLeak: 0,
    wellDry: 0,
    riverPollution: 0,
    pumpFailure: 0
  });
  const [historicalData, setHistoricalData] = useState({
    '2024-01-01': { river: 950, ground: 1050, total: 2000 },
    '2024-01-02': { river: 980, ground: 1020, total: 2000 },
    '2024-01-03': { river: 920, ground: 1080, total: 2000 },
    '2024-01-04': { river: 960, ground: 1040, total: 2000 },
    '2024-01-05': { river: 940, ground: 1060, total: 2000 }
  });

  const token = localStorage.getItem('token');
  const sceneContainerRef = useRef(null);

  useEffect(() => {
    fetchRequests();
    fetchSimulationStatus();
    fetchBuildings();
  }, []);

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
        alert('Simulation started successfully! Buildings can now update their water requirements.');
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
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/simulation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(simulationInputs)
      });

      if (response.ok) {
        const data = await response.json();
        alert('Simulation completed successfully!');
        setShowSimulationModal(false);
        fetchSimulationStatus();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to run simulation');
      }
    } catch (error) {
      alert('Error running simulation');
    } finally {
      setLoading(false);
    }
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
        fetchRequests();
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

  // 3D Simulation Functions
  const triggerDisruption = (type) => {
    setDisruptions(d => {
      if (type === 'reset') {
        setWaterWastage({
          pipeLeak: 0,
          wellDry: 0,
          riverPollution: 0,
          pumpFailure: 0
        });
        return { pipeLeak: false, wellDry: false, riverPollution: false, pumpFailure: false };
      }
      
      const newDisruptions = { ...d, [type]: !d[type] };
      
      if (newDisruptions[type]) {
        let wastageAmount = 0;
        
        switch (type) {
          case 'pipeLeak':
            wastageAmount = Math.round((riverWaterAmount + groundWaterAmount) * 0.15);
            break;
          case 'wellDry':
            wastageAmount = groundWaterAmount;
            break;
          case 'riverPollution':
            wastageAmount = Math.round(riverWaterAmount * 0.25);
            break;
          case 'pumpFailure':
            wastageAmount = riverWaterAmount;
            break;
        }
        
        setWaterWastage(prev => ({
          ...prev,
          [type]: wastageAmount
        }));
      } else {
        setWaterWastage(prev => ({
          ...prev,
          [type]: 0
        }));
      }
      
      return newDisruptions;
    });
  };

  const startDeliverySimulation = () => {
    setIsSimulating(true);
    setDeliveryComplete(false);
    
    const totalWater = riverWaterAmount + groundWaterAmount;
    const baseTime = 3;
    const timePerUnit = 0.002;
    const dynamicTime = Math.min(baseTime + (totalWater * timePerUnit), 10);
    
    setTimeout(() => {
      setIsSimulating(false);
      setDeliveryComplete(true);
      
      const totalWastage = Object.values(waterWastage).reduce((sum, val) => sum + val, 0);
      const effectiveRiverWater = Math.max(0, riverWaterAmount - waterWastage.riverPollution - waterWastage.pumpFailure);
      const effectiveGroundWater = Math.max(0, groundWaterAmount - waterWastage.wellDry);
      const totalDelivered = effectiveRiverWater + effectiveGroundWater;
      
      const avgWaterPerBuilding = 50;
      const totalBuildings = Math.floor(totalDelivered / avgWaterPerBuilding);
      
      const buildingDistribution = [];
      for (let i = 1; i <= totalBuildings; i++) {
        const sourceType = Math.random();
        let riverWater = 0;
        let groundWater = 0;
        let buildingType = '';
        
        if (sourceType < 0.4) {
          riverWater = avgWaterPerBuilding + Math.floor(Math.random() * 20) - 10;
          buildingType = 'River Supply';
        } else if (sourceType < 0.8) {
          groundWater = avgWaterPerBuilding + Math.floor(Math.random() * 20) - 10;
          buildingType = 'Ground Supply';
        } else {
          riverWater = Math.floor((avgWaterPerBuilding * 0.6) + Math.random() * 10);
          groundWater = avgWaterPerBuilding - riverWater;
          buildingType = 'Dual Supply';
        }
        
        if (riverWater > effectiveRiverWater) riverWater = effectiveRiverWater;
        if (groundWater > effectiveGroundWater) groundWater = effectiveGroundWater;
        
        const totalBuildingWater = riverWater + groundWater;
        const apartments = Math.floor(Math.random() * 20) + 10;
        const avgWaterPerApartment = Math.floor(totalBuildingWater / apartments);
        
        buildingDistribution.push({
          buildingId: i,
          buildingName: `Building ${i}`,
          buildingType: buildingType,
          riverWater: riverWater,
          groundWater: groundWater,
          totalWater: totalBuildingWater,
          apartments: apartments,
          avgWaterPerApartment: avgWaterPerApartment,
          sourceRatio: riverWater > 0 && groundWater > 0 ? 
            `${Math.round((riverWater / totalBuildingWater) * 100)}% River, ${Math.round((groundWater / totalBuildingWater) * 100)}% Ground` :
            riverWater > 0 ? '100% River' : '100% Ground'
        });
      }
      
      const riverBuildings = buildingDistribution.filter(b => b.riverWater > 0).length;
      const groundBuildings = buildingDistribution.filter(b => b.groundWater > 0).length;
      const dualSupplyBuildings = buildingDistribution.filter(b => b.buildingType === 'Dual Supply').length;
      
      const parkWaterUsage = Math.floor(totalDelivered * 0.1);
      const buildingWaterUsage = totalDelivered - parkWaterUsage;
      
      const deliveryEfficiency = ((totalDelivered / (riverWaterAmount + groundWaterAmount)) * 100).toFixed(1);
      const wastagePercentage = ((totalWastage / (riverWaterAmount + groundWaterAmount)) * 100).toFixed(1);
      
      const results = {
        date: new Date().toISOString().split('T')[0],
        riverWaterDelivered: effectiveRiverWater,
        groundWaterDelivered: effectiveGroundWater,
        totalDelivered: totalDelivered,
        wastage: totalWastage,
        disruptions: disruptions,
        deliveryTime: dynamicTime.toFixed(1),
        riverBuildings: riverBuildings,
        groundBuildings: groundBuildings,
        dualSupplyBuildings: dualSupplyBuildings,
        totalBuildings: totalBuildings,
        avgWaterPerBuilding: avgWaterPerBuilding,
        buildingWaterUsage: buildingWaterUsage,
        parkWaterUsage: parkWaterUsage,
        buildingDistribution: buildingDistribution,
        deliveryEfficiency: deliveryEfficiency,
        wastagePercentage: wastagePercentage,
        riverWaterPercentage: totalDelivered > 0 ? ((effectiveRiverWater / totalDelivered) * 100).toFixed(1) : 0,
        groundWaterPercentage: totalDelivered > 0 ? ((effectiveGroundWater / totalDelivered) * 100).toFixed(1) : 0,
        historicalAverage: Math.round(Object.values(historicalData).reduce((sum, day) => sum + day.total, 0) / Object.keys(historicalData).length),
        performanceRating: totalDelivered >= 1900 ? 'Above Average' : 'Below Average'
      };
      
      setDeliveryResults(results);
      setShowDeliveryPopup(true);
      getAiSuggestions(results);
    }, dynamicTime * 1000);
  };

  const getAiSuggestions = async (results) => {
    setIsLoadingAi(true);
    try {
      const response = await fetch('http://localhost:5000/api/ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_data: results,
          disruptions: disruptions,
          historical_data: historicalData
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data.suggestions);
      } else {
        setAiSuggestions(generateAiSuggestions(results, disruptions, waterWastage));
      }
    } catch (error) {
      setAiSuggestions(generateAiSuggestions(results, disruptions, waterWastage));
    } finally {
      setIsLoadingAi(false);
    }
  };

  const generateAiSuggestions = (results, disruptions, wastage) => {
    const totalDelivered = results.totalDelivered || 0;
    const wastageRate = results.wastagePercentage || 0;
    const efficiency = results.deliveryEfficiency || 0;
    const riverBuildings = results.riverBuildings || 0;
    const groundBuildings = results.groundBuildings || 0;
    const dualSupplyBuildings = results.dualSupplyBuildings || 0;

    return `1. 🚰 **INFRASTRUCTURE OPTIMIZATION**
   **Issue**: Current delivery efficiency of ${efficiency}% indicates infrastructure bottlenecks and suboptimal pipe routing
   **Solution**: Implement smart pressure management systems with IoT sensors and automated valve control. Upgrade to high-efficiency pumps and install real-time flow monitoring at critical junctions
   **Expected Impact**: Increase delivery efficiency by 15-20%, reduce energy consumption by 25%, and minimize pressure losses
   **Implementation Timeline**: 6-8 months with phased rollout starting with high-priority zones

2. 📊 **SMART TECHNOLOGY INTEGRATION**
   **Issue**: Limited visibility into real-time water distribution patterns and lack of predictive analytics capabilities
   **Solution**: Deploy AI-powered water management platform with machine learning algorithms for demand forecasting, automated leak detection, and dynamic route optimization
   **Expected Impact**: 30% reduction in water wastage, 40% faster response to disruptions, and 20% improvement in resource allocation
   **Investment Required**: $2.5M initial investment with 3-year ROI through operational savings and reduced maintenance costs

3. 🌊 **SOURCE DIVERSIFICATION STRATEGY**
   **Issue**: Current source distribution (${results.riverWaterPercentage}% River, ${results.groundWaterPercentage}% Ground) lacks resilience and optimal balance
   **Solution**: Implement hybrid water sourcing with rainwater harvesting systems, greywater recycling infrastructure, and smart source switching based on quality and availability
   **Expected Impact**: 50% improvement in system resilience, 25% reduction in dependency on single sources, and enhanced water quality control
   **Risk Mitigation**: Gradual implementation with backup systems and comprehensive water quality monitoring protocols

4. 🔧 **PREDICTIVE MAINTENANCE SYSTEM**
   **Issue**: Reactive maintenance approach leading to ${wastageRate}% wastage rate and unexpected service disruptions
   **Solution**: Deploy IoT-based predictive maintenance system with vibration sensors, flow meters, and AI-powered failure prediction algorithms
   **Expected Impact**: 60% reduction in unplanned outages, 35% decrease in maintenance costs, and 45% improvement in equipment lifespan
   **Technology Stack**: Azure IoT Hub, Power BI analytics, machine learning models, and mobile maintenance apps

5. 🌱 **SUSTAINABILITY & CONSERVATION**
   **Issue**: Current system lacks comprehensive water conservation measures and community engagement in sustainable practices
   **Solution**: Launch city-wide water conservation program including smart metering, behavioral analytics, leak detection apps, and educational campaigns
   **Expected Impact**: 20% reduction in per-capita water consumption, 30% increase in community awareness, and 15% improvement in water quality metrics
   **Community Engagement**: Mobile app for residents to report issues, gamification of conservation efforts, and real-time consumption feedback systems`;
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
      case 'pending': return <FaEye />;
      default: return <FaEye />;
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const totalBuildings = buildings.length;
  const activeBuildings = buildings.filter(b => b.is_active).length;

  // Modern button style for disruptions
  const disruptionBtnStyle = {
    padding: '10px 0',
    fontSize: 16,
    borderRadius: 7,
    background: '#f4f8ff',
    color: '#3399ff',
    border: '1.5px solid #cce0ff',
    cursor: 'pointer',
    fontWeight: 600,
    boxShadow: '0 1px 4px #3399ff11',
    width: '100%',
    transition: 'background 0.2s, color 0.2s',
    outline: 'none',
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: 'linear-gradient(180deg, #87CEEB 0%, #98FB98 50%, #F0E68C 100%)' }}>
      {/* 3D Scene Container */}
      <div id="scene-container" ref={sceneContainerRef} style={{ width: '100%', height: '100%' }}></div>
      
      {/* Admin Dashboard Overlay */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, background: 'rgba(255,255,255,0.95)', borderRadius: 15, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 20, minWidth: 300, fontFamily: 'Segoe UI, Arial, sans-serif', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb', marginBottom: 15, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
          <FaCog style={{ color: '#43e97b' }} /> Admin Dashboard
        </div>
        
        {/* Statistics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            padding: '10px',
            borderRadius: '10px',
            textAlign: 'center',
            fontSize: '12px'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{pendingRequests.length}</div>
            <div>Pending</div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #f093fb, #f5576c)',
            color: 'white',
            padding: '10px',
            borderRadius: '10px',
            textAlign: 'center',
            fontSize: '12px'
          }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{totalBuildings}</div>
            <div>Buildings</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 8, marginBottom: 15 }}>
          <button
            style={{ flex: 1, padding: '10px 0', fontSize: 16, borderRadius: 10, background: selectedControl === 'Water Flow' ? '#2563eb' : '#f5f7fa', color: selectedControl === 'Water Flow' ? '#fff' : '#2563eb', border: selectedControl === 'Water Flow' ? '2px solid #2563eb' : '1.5px solid #e3f2fd', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s, color 0.2s', outline: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => setSelectedControl('Water Flow')}
            title="Show water flow simulation controls"
          >
            <FaTint /> Water Flow
          </button>
          <button
            style={{ flex: 1, padding: '10px 0', fontSize: 16, borderRadius: 10, background: selectedControl === 'Disruptions' ? '#2563eb' : '#f5f7fa', color: selectedControl === 'Disruptions' ? '#fff' : '#2563eb', border: selectedControl === 'Disruptions' ? '2px solid #2563eb' : '1.5px solid #e3f2fd', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s, color 0.2s', outline: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => setSelectedControl('Disruptions')}
            title="Show disruption controls"
          >
            <FaExclamationTriangle /> Disruptions
          </button>
        </div>
        
        {selectedControl === 'Water Flow' && (
          <>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb', marginBottom: 8, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
              <FaTools style={{ color: '#43e97b' }} /> Simulation Controls
            </div>
            <button
              style={{ marginBottom: 10, padding: '12px 0', fontSize: 18, borderRadius: 10, background: '#43e97b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 6px #43e97b22', width: '100%', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 10 }}
              onClick={startDeliverySimulation}
              disabled={isSimulating}
              title={isSimulating ? 'Delivery in progress...' : 'Start water delivery simulation'}
            >
              {isSimulating ? <FaSpinner className="fa-spin" /> : <FaPlay />} 
              {isSimulating ? 'Delivery in Progress...' : 'Start Water Delivery'}
            </button>
          </>
        )}
        
        {selectedControl === 'Disruptions' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#2563eb', marginBottom: 6, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaBug style={{ color: '#e67e22' }} /> Disruptions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => triggerDisruption('pipeLeak')} style={disruptionBtnStyle} title="Simulate a pipe leak"><FaWind style={{ marginRight: 8 }} /> Pipe Leak</button>
              <button onClick={() => triggerDisruption('wellDry')} style={disruptionBtnStyle} title="Simulate a well drying up"><FaTint style={{ marginRight: 8 }} /> Well Dry</button>
              <button onClick={() => triggerDisruption('riverPollution')} style={disruptionBtnStyle} title="Simulate river pollution"><FaWater style={{ marginRight: 8 }} /> River Pollution</button>
              <button onClick={() => triggerDisruption('pumpFailure')} style={disruptionBtnStyle} title="Simulate a pump failure"><FaCog style={{ marginRight: 8 }} /> Pump Failure</button>
              <button onClick={() => triggerDisruption('reset')} style={{ ...disruptionBtnStyle, background: '#eee', color: '#333', fontWeight: 500 }} title="Reset all disruptions"><FaRedo style={{ marginRight: 8 }} /> Reset Disruptions</button>
            </div>
          </>
        )}
        
        <div style={{ margin: '18px 0 8px 0', fontWeight: 700, color: '#2563eb' }}>Water Fetch Amounts</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 15, color: '#2563eb' }}>
            Kaveri River (total):
            <input
              type="number"
              min="0"
              value={riverWaterAmount}
              onChange={e => setRiverWaterAmount(Number(e.target.value))}
              style={{ marginLeft: 8, borderRadius: 6, border: '1.5px solid #e3f2fd', padding: '4px 10px', fontSize: 15, width: 100 }}
            />
          </label>
          <label style={{ fontSize: 15, color: '#2563eb' }}>
            Groundwater (total):
            <input
              type="number"
              min="0"
              value={groundWaterAmount}
              onChange={e => setGroundWaterAmount(Number(e.target.value))}
              style={{ marginLeft: 8, borderRadius: 6, border: '1.5px solid #e3f2fd', padding: '4px 10px', fontSize: 15, width: 100 }}
            />
          </label>
        </div>
      </div>

      {/* Delivery Progress Indicator */}
      {isSimulating && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255,255,255,0.95)',
          padding: '30px',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          zIndex: 999,
          textAlign: 'center',
          fontFamily: 'Segoe UI, Arial, sans-serif',
          minWidth: '300px'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '15px', color: '#2563eb' }}>
            🚰 Water Delivery in Progress
          </div>
          <div style={{ 
            width: '100%', 
            height: '8px', 
            background: '#e3f2fd', 
            borderRadius: '4px', 
            overflow: 'hidden',
            marginBottom: '15px'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #43e97b, #2563eb)',
              borderRadius: '4px',
              animation: `progress ${Math.min(3 + ((riverWaterAmount + groundWaterAmount) * 0.002), 10)}s linear forwards`
            }}></div>
          </div>
          <div style={{ fontSize: '16px', color: '#666' }}>
            Distributing water to buildings...
          </div>
          <div style={{ fontSize: '14px', color: '#999', marginTop: '10px' }}>
            River: {riverWaterAmount} units | Ground: {groundWaterAmount} units
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
            Estimated time: {Math.min(3 + ((riverWaterAmount + groundWaterAmount) * 0.002), 10).toFixed(1)}s
          </div>
        </div>
      )}

      {/* Delivery Results Popup */}
      {showDeliveryPopup && deliveryResults && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h1 style={{ color: '#2563eb', margin: 0, fontSize: '28px' }}>🚰 Water Delivery Complete!</h1>
              <button
                onClick={() => setShowDeliveryPopup(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            {/* Delivery Summary */}
            <div style={{ marginBottom: '25px' }}>
              <h2 style={{ color: '#2563eb', marginBottom: '15px', fontSize: '20px' }}>📊 Delivery Summary</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                    {deliveryResults?.riverWaterDelivered} units
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>River Water Delivered</div>
                  <div style={{ fontSize: '12px', color: '#43e97b', marginTop: '5px' }}>
                    to {deliveryResults?.riverBuildings} buildings ({deliveryResults?.riverWaterPercentage}%)
                  </div>
                </div>
                <div style={{ background: '#e8f5e8', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>
                    {deliveryResults?.groundWaterDelivered} units
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>Groundwater Delivered</div>
                  <div style={{ fontSize: '12px', color: '#43e97b', marginTop: '5px' }}>
                    to {deliveryResults?.groundBuildings} buildings ({deliveryResults?.groundWaterPercentage}%)
                  </div>
                </div>
              </div>
              
              {/* Total Delivery */}
              <div style={{ background: '#e8f5e8', padding: '15px', borderRadius: '10px', textAlign: 'center', marginBottom: '15px' }}>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2e7d32' }}>
                  {deliveryResults?.totalDelivered} units
                </div>
                <div style={{ fontSize: '16px', color: '#2e7d32' }}>Total Water Delivered</div>
              </div>

              {/* Efficiency Metrics */}
              <div style={{ background: '#f3e5f5', padding: '12px', borderRadius: '10px', marginBottom: '15px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#7b1fa2', marginBottom: '8px' }}>
                  📈 Efficiency Metrics
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}>
                  <span style={{ color: '#666' }}>Delivery Efficiency:</span>
                  <span style={{ fontWeight: 'bold', color: '#7b1fa2' }}>{deliveryResults?.deliveryEfficiency}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#666' }}>Wastage Rate:</span>
                  <span style={{ fontWeight: 'bold', color: deliveryResults?.wastagePercentage > 5 ? '#e67e22' : '#43e97b' }}>
                    {deliveryResults?.wastagePercentage}%
                  </span>
                </div>
              </div>

              {deliveryResults?.wastage > 0 && (
                <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#856404' }}>
                    ⚠️ {deliveryResults?.wastage} units wasted
                  </div>
                  <div style={{ fontSize: '14px', color: '#856404' }}>Due to disruptions</div>
                </div>
              )}
            </div>

            {/* AI Suggestions */}
            <div>
              <h3 style={{ color: '#2563eb', marginBottom: '15px', fontSize: '20px' }}>🤖 AI Recommendations</h3>
              {isLoadingAi ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: '16px', color: '#666', marginBottom: '10px' }}>Generating AI suggestions...</div>
                  <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                </div>
              ) : (
                <div style={{ 
                  background: '#f8f9fa', 
                  padding: '15px', 
                  borderRadius: '10px',
                  whiteSpace: 'pre-line',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  maxHeight: '400px',
                  overflow: 'auto'
                }}>
                  {aiSuggestions}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardNew; 