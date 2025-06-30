import React, { useEffect, useRef, useState } from 'react';
import { FaBug, FaExclamationTriangle, FaPlay, FaStop, FaTint, FaTools, FaWater } from 'react-icons/fa';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import AdminDashboard from './components/AdminDashboard';
import BuildingDashboard from './components/BuildingDashboard';
import Home from './components/Home';
import Loader from './components/Loader';
import Login from './components/Login';
import Models from './components/Models';
import Navbar from './components/Navbar';

// Add CSS for spinner animation
const spinnerStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject the CSS
const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerText = spinnerStyle;
document.head.appendChild(styleSheet);

function createCylinder(start, end, radius, color, opacity = 1, metalness = 0.5, roughness = 0.3) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const orientation = new THREE.Matrix4();
  orientation.lookAt(start, end, new THREE.Object3D().up);
  orientation.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const cylinderGeom = new THREE.CylinderGeometry(radius, radius, direction.length(), 24);
  const material = new THREE.MeshStandardMaterial({ color, metalness, roughness, transparent: opacity < 1, opacity });
  const cylinder = new THREE.Mesh(cylinderGeom, material);
  cylinder.applyMatrix4(orientation);
  cylinder.position.copy(start).add(direction.multiplyScalar(0.5));
  return cylinder;
}
//ru656
function createLabel(text, position, scene) {
  // Modern floating label using Sprite - much larger and more visible
  const canvas = document.createElement('canvas');
  canvas.width = 600; // Much larger canvas
  canvas.height = 150; // Much larger canvas
  const ctx = canvas.getContext('2d');
  
  // Add dark border for better visibility
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, 600, 150);
  
  // Main background
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(4, 4, 592, 142);
  
  // Add border
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 592, 142);
  
  ctx.font = 'bold 48px Segoe UI, Arial'; // Much larger font
  ctx.fillStyle = '#2563eb'; // Blue text for better visibility
  ctx.textAlign = 'center';
  ctx.fillText(text, 300, 95); // Adjusted position for larger canvas
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(80, 20, 1); // Much larger scale
  sprite.position.copy(position.clone().add(new THREE.Vector3(0, 20, 0)));
  scene.add(sprite);
}

function SimulationPage() {
  const mountRef = useRef(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [disruptions, setDisruptions] = useState({
    pipeLeak: false,
    wellDry: false,
    riverPollution: false,
    pumpFailure: false
  });
  const [selectedControl, setSelectedControl] = useState('Water Flow');
  const [showControls, setShowControls] = useState(false);
  const [showWaterConnections, setShowWaterConnections] = useState(false);
  const pipesRef = useRef([]); // Store pipe data for simulation
  const dropletsRef = useRef([]); // Store droplet meshes
  const buildingPipeIndices = useRef([]); // Store building pipe indices
  const [riverWaterAmount, setRiverWaterAmount] = useState(1000);
  const [groundWaterAmount, setGroundWaterAmount] = useState(1000);

  // Building data state
  const [buildings, setBuildings] = useState([]);
  const [showBuildingDetails, setShowBuildingDetails] = useState(false);
  const [clickedBuilding, setClickedBuilding] = useState(null);
  
  // Building instances array for disruption effects
  const buildingInstances = useRef([]);
  
  // Backend data state
  const [waterRequests, setWaterRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [buildingAllocations, setBuildingAllocations] = useState({});
  const [dailyDistribution, setDailyDistribution] = useState({});
  const [simulationResults, setSimulationResults] = useState({});
  const [isDeliveryRunning, setIsDeliveryRunning] = useState(false);
  const [deliveryProgress, setDeliveryProgress] = useState(0);
  const [showDeliveryResults, setShowDeliveryResults] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [totalWaterNeeded, setTotalWaterNeeded] = useState(0);
  const [extraWaterRequests, setExtraWaterRequests] = useState([]);
  const [eventWaterRequests, setEventWaterRequests] = useState([]);

  // Disruption simulation state
  const [disruptionActive, setDisruptionActive] = useState(false);
  const [disruptionType, setDisruptionType] = useState(null);
  const [disruptionLocation, setDisruptionLocation] = useState(null);
  const [disruptionResults, setDisruptionResults] = useState(null);
  const [showDisruptionResults, setShowDisruptionResults] = useState(false);
  const [disruptionProgress, setDisruptionProgress] = useState(0);
  const [brokenPipes, setBrokenPipes] = useState([]);
  const [affectedBuildings, setAffectedBuildings] = useState([]);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState('');

  // Baseline simulation data for disruption analysis
  const [baselineSimulationData, setBaselineSimulationData] = useState(null);

  // TODO: Add fallback building data here

  // Instanced mesh references
  let dropletInstancedMesh = null;
  let trailInstancedMesh = null;

  const [housesByBuilding, setHousesByBuilding] = useState({});

  // Add fetchHouses function
  const fetchHouses = async (buildingId) => {
    const token = localStorage.getItem('token');
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
      console.error('Error fetching houses:', err);
    }
  };

  // Add useEffect to fetch houses when buildings are loaded
  useEffect(() => {
    if (buildings.length > 0) {
      buildings.forEach(b => {
        if (!housesByBuilding[b.id]) fetchHouses(b.id);
      });
    }
  }, [buildings]);

  // Add helper function to get updated buildings with house requirements
  const getUpdatedBuildingsWithHouseRequirements = () => {
    return buildings.map(b => {
      const houses = housesByBuilding[b.id] || [];
      const totalPeople = houses.reduce((sum, h) => sum + (h.num_people || 0), 0);
      const total = houses.length > 0 ? totalPeople * 175 : b.water_requirement;
      return { ...b, water_requirement: total, num_people: totalPeople };
    });
  };

  // Helper to trigger disruptions (update)
  function triggerDisruption(type) {
    setDisruptions(d => {
      if (type === 'reset') return { pipeLeak: false, wellDry: false, riverPollution: false, pumpFailure: false };
      return { ...d, [type]: !d[type] };
    });
  }

  // Fetch building data from backend
  const fetchBuildingData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found, using fallback data');
        setBuildings(fallbackBuildingData);
        return;
      }

      console.log('Fetching building data from backend...');
      const response = await fetch('http://localhost:5000/api/buildings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Building data fetched successfully:', data.length, 'buildings');
        setBuildings(data);
      } else {
        console.log('Failed to fetch building data, using fallback');
        setBuildings(fallbackBuildingData);
      }
    } catch (error) {
      console.error('Error fetching building data:', error);
      console.log('Using fallback building data');
      setBuildings(fallbackBuildingData);
    }
  };

  // Fetch water requests from backend
  const fetchWaterRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token available for fetching water requests');
        return;
      }

      const response = await fetch('http://localhost:5000/api/water-requests', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWaterRequests(data.requests || []);
        // Separate approved requests
        const approved = data.requests?.filter(req => req.status === 'approved') || [];
        setApprovedRequests(approved);
        // Separate extra water requests
        const extraRequests = data.requests?.filter(req => req.request_type === 'extra_water' && req.status === 'approved') || [];
        setExtraWaterRequests(extraRequests);
        // Separate event requests
        const eventRequests = data.requests?.filter(req => req.request_type === 'event' && req.status === 'approved') || [];
        setEventWaterRequests(eventRequests);
        console.log('Approved requests:', approved.length);

        // --- PATCH: Update buildingAllocations for approved extra water requests ---
        setBuildingAllocations(prev => {
          if (!prev) return prev;
          const updated = { ...prev };
          extraRequests.forEach(req => {
            const buildingId = req.building_id;
            if (updated[buildingId]) {
              updated[buildingId] = {
                ...updated[buildingId],
                extra_water: (updated[buildingId].extra_water || 0) + req.water_amount,
                total_water: (updated[buildingId].total_water || 0) + req.water_amount,
              };
            }
          });
          return updated;
        });
        // --- END PATCH ---
      } else {
        setWaterRequests([]);
        setApprovedRequests([]);
        setExtraWaterRequests([]);
        setEventWaterRequests([]);
      }
    } catch (error) {
      console.error('Error fetching water requests:', error);
      setWaterRequests([]);
      setApprovedRequests([]);
      setExtraWaterRequests([]);
      setEventWaterRequests([]);
    }
  };

  // Fetch daily distribution data
  const fetchDailyDistribution = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`http://localhost:5000/api/daily-distribution/${today}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setDailyDistribution(data.distribution || {});
      }
    } catch (error) {
      console.error('Error fetching daily distribution:', error);
    }
  };

  // Initialize data when component mounts
  useEffect(() => {
    console.log('SimulationPage: Initializing data...');
    fetchBuildingData();
    fetchWaterRequests();
    fetchDailyDistribution();
  }, []);

  // Calculate total water needed when buildings change
  useEffect(() => {
    const totalNeeded = buildings.reduce((sum, building) => sum + (building.water_requirement || 0), 0);
    setTotalWaterNeeded(totalNeeded);
    // Automatically set water source amounts based on total needed
    setRiverWaterAmount(totalNeeded);
    setGroundWaterAmount(totalNeeded);
    console.log('Total water needed updated:', totalNeeded, 'for', buildings.length, 'buildings');
  }, [buildings]);

  // Start comprehensive simulation
  const startComprehensiveSimulation = async () => {
    if (isDeliveryRunning) return;
    setIsDeliveryRunning(true);
    setDeliveryProgress(0);
    try {
      // Always refresh water requests before running simulation
      await fetchWaterRequests();
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login first to run the comprehensive simulation');
        setIsDeliveryRunning(false);
        return;
      }

      const updatedBuildings = getUpdatedBuildingsWithHouseRequirements();
      const totalPeople = updatedBuildings.reduce((sum, b) => sum + (b.num_people || 0), 0);
      const totalWaterRequired = updatedBuildings.reduce((sum, b) => sum + b.water_requirement, 0);
      // Allocate total water required to both sources
      const riverWaterAmount = totalWaterRequired;
      const groundWaterAmount = totalWaterRequired;
      
      console.log('Starting comprehensive simulation with updated buildings:', {
        buildings: updatedBuildings.length,
        totalPeople,
        totalWaterRequired,
        waterPerPerson: '175L/day',
        approvedRequests: approvedRequests.length,
        extraWaterRequests: extraWaterRequests.length,
        eventWaterRequests: eventWaterRequests.length
      });

      // Log first few buildings as example
      console.log('Sample buildings water requirements:');
      updatedBuildings.slice(0, 5).forEach(b => {
        console.log(`${b.building_code}: ${b.num_people} people → ${b.water_requirement}L/day`);
      });

      // Step 1: Try to start simulation
      let startResponse;
      try {
        startResponse = await fetch('http://localhost:5000/api/simulation/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            river_water_amount: riverWaterAmount,
            ground_water_amount: groundWaterAmount,
            total_water_needed: totalWaterRequired,
            approved_requests: approvedRequests,
            extra_water_requests: extraWaterRequests,
            event_water_requests: eventWaterRequests,
            buildings: updatedBuildings
          })
        });
      } catch (error) {
        console.log('Simulation start failed, continuing with run...');
      }

      setDeliveryProgress(30);
      
      // Step 2: Run simulation with all data
      console.log('Sending extraWaterRequests to simulation:', extraWaterRequests);
      console.log('Simulation run payload:', {
        disruptions: disruptions,
        river_water_amount: riverWaterAmount,
        ground_water_amount: groundWaterAmount,
        buildings: updatedBuildings,
        approved_requests: approvedRequests,
        extra_water_requests: extraWaterRequests,
        event_water_requests: eventWaterRequests,
        total_water_needed: totalWaterRequired
      });
      const runResponse = await fetch('http://localhost:5000/api/simulation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          disruptions: disruptions,
          river_water_amount: riverWaterAmount,
          ground_water_amount: groundWaterAmount,
          buildings: updatedBuildings,
          approved_requests: approvedRequests,
          extra_water_requests: extraWaterRequests,
          event_water_requests: eventWaterRequests,
          total_water_needed: totalWaterRequired
        })
      });

      if (runResponse.ok) {
        setDeliveryProgress(70);
        const simulationData = await runResponse.json();
        console.log('Simulation results:', simulationData);
        setSimulationResults(simulationData.results || {});
        setBuildingAllocations(simulationData.building_allocations || {});
        
        // Store baseline data for disruption analysis
        const baselineData = {
          buildings: updatedBuildings,
          totalWaterNeeded: totalWaterRequired,
          buildingAllocations: simulationData.building_allocations || {},
          simulationResults: simulationData.results || {},
          approvedRequests: approvedRequests,
          extraWaterRequests: extraWaterRequests,
          eventWaterRequests: eventWaterRequests,
          riverWaterAmount: riverWaterAmount,
          groundWaterAmount: groundWaterAmount,
          timestamp: new Date().toISOString()
        };
        console.log('Storing baseline data:', baselineData);
        setBaselineSimulationData(baselineData);
        
        // Get AI suggestions
        await getAiSuggestions(simulationData.results);
        setDeliveryProgress(100);
        setShowDeliveryResults(true);
      } else {
        const errorData = await runResponse.json();
        alert(`Simulation failed: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error running comprehensive simulation:', error);
      alert('Error running simulation. Please try again.');
    } finally {
      setIsDeliveryRunning(false);
    }
  };

  // Get AI suggestions
  const getAiSuggestions = async (results) => {
    setIsLoadingAi(true);
    try {
      const response = await fetch('http://localhost:5000/api/ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          delivery_data: results,
          disruptions: disruptions,
          buildings: buildings,
          approved_requests: approvedRequests,
          extra_water_requests: extraWaterRequests,
          event_water_requests: eventWaterRequests,
          total_water_needed: totalWaterNeeded
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data.suggestions);
      } else {
        // Fallback suggestions
        setAiSuggestions(generateFallbackSuggestions(results));
      }
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
      setAiSuggestions(generateFallbackSuggestions(results));
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Generate fallback AI suggestions
  const generateFallbackSuggestions = (results) => {
    const suggestions = [];
    
    // Water efficiency analysis
    const efficiency = results.efficiency_percentage || 0;
    if (efficiency < 80) {
      suggestions.push(`⚠️ **Low Efficiency Alert**: System efficiency at ${efficiency}%. Consider optimizing water distribution.`);
    } else {
      suggestions.push(`✅ **Good Efficiency**: System running at ${efficiency}% efficiency.`);
    }
    
    // Extra water requests analysis
    if (extraWaterRequests.length > 0) {
      const totalExtra = extraWaterRequests.reduce((sum, req) => sum + req.water_amount, 0);
      suggestions.push(`📈 **Extra Water Requests**: ${extraWaterRequests.length} approved requests for ${totalExtra} additional units.`);
    }
    
    // Event analysis
    if (eventWaterRequests.length > 0) {
      suggestions.push(`🎉 **Special Events**: ${eventWaterRequests.length} events requiring additional water supply.`);
    }
    
    // Building requirements analysis
    const unmetBuildings = buildings.filter(building => {
      const allocation = results.building_allocations?.[building.id];
      return allocation && allocation.total_water < building.water_requirement;
    });
    
    if (unmetBuildings.length > 0) {
      suggestions.push(`⚠️ **Water Shortage**: ${unmetBuildings.length} buildings have unmet water requirements.`);
    }
    
    return suggestions.join('\n\n');
  };

  // Function to handle building click
  const handleBuildingClick = async (building, position) => {
    // If house data for this building is not loaded, fetch it first
    if (!housesByBuilding[building.id]) {
      await fetchHouses(building.id);
    }
    // After ensuring house data is loaded, get the enriched building
    const enriched = getUpdatedBuildingsWithHouseRequirements().find(b => b.id === building.id);
    setClickedBuilding({ ...enriched, position });
    setShowBuildingDetails(true);
  };

  useEffect(() => {
    let animationId;
    const scene = new THREE.Scene();
    // --- Realistic sky with clouds and distant mountains ---
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512; skyCanvas.height = 256;
    const skyCtx = skyCanvas.getContext('2d');
    // Sky gradient
    const grad = skyCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#7ecfff'); // top sky blue
    grad.addColorStop(0.5, '#bfefff'); // mid
    grad.addColorStop(0.8, '#e6ffe6'); // horizon
    grad.addColorStop(1, '#b7e0c2'); // ground haze
    skyCtx.fillStyle = grad;
    skyCtx.fillRect(0, 0, 512, 256);
    // Distant mountains
    skyCtx.beginPath();
    skyCtx.moveTo(0, 180);
    for (let x = 0; x <= 512; x += 32) {
      skyCtx.lineTo(x, 180 - 18 * Math.sin(x / 80) - 12 * Math.cos(x / 40));
    }
    skyCtx.lineTo(512, 256); skyCtx.lineTo(0, 256); skyCtx.closePath();
    skyCtx.fillStyle = '#a3b18a';
    skyCtx.globalAlpha = 0.7;
    skyCtx.fill();
    skyCtx.globalAlpha = 1;
    // Clouds
    for (let i = 0; i < 8; i++) {
      const cx = Math.random() * 512, cy = 40 + Math.random() * 80;
      skyCtx.beginPath();
      skyCtx.ellipse(cx, cy, 32 + Math.random() * 24, 16 + Math.random() * 8, 0, 0, 2 * Math.PI);
      skyCtx.fillStyle = 'rgba(255,255,255,0.7)';
      skyCtx.fill();
    }
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    scene.background = skyTex;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 8000);
    camera.position.set(0, 1200, 1800); // Move camera back and up for full view
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 200;
    controls.maxDistance = 6000;
    controls.maxPolarAngle = Math.PI / 2.05;

    // Mouse interaction for building clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onMouseClick(event) {
      // Calculate mouse position in normalized device coordinates
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Update the picking ray with the camera and mouse position
      raycaster.setFromCamera(mouse, camera);

      // Calculate objects intersecting the picking ray
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;
        if (object.userData && object.userData.onClick) {
          object.userData.onClick();
          break;
        }
      }
    }

    // Add click event listener
    renderer.domElement.addEventListener('click', onMouseClick);

    // Lighting
    // Sun (directional light) with soft shadows
    const sun = new THREE.DirectionalLight(0xfff7e0, 1.25);
    sun.position.set(-600, 1200, 800);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.left = -2000;
    sun.shadow.camera.right = 2000;
    sun.shadow.camera.top = 2000;
    sun.shadow.camera.bottom = -2000;
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 4000;
    scene.add(sun);
    // Sun glow (lens flare effect)
    const sunGlow = new THREE.PointLight(0xfff7e0, 0.5, 0, 2);
    sunGlow.position.copy(sun.position);
    scene.add(sunGlow);
    // Hemisphere light for natural sky/ground color
    const hemi = new THREE.HemisphereLight(0xbfefff, 0x8fd694, 0.7);
    scene.add(hemi);
    // Ambient light for soft fill
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);
    // Fog for atmospheric depth
    scene.fog = new THREE.FogExp2(0xbfefff, 0.00022);

    const scaleUp = 1.4; // 40% larger for realism
    const buildingScale = 2.0; // Double building size for realism
    const spacing = 60 * scaleUp * 1.5; // Increase grid spacing by 50% for less congestion
    // --- Realistic and beautiful 16x12 city grid (doubled area, scaled up, more open) ---
    const gridRows = 12, gridCols = 16; // Wider city
    // Shift grid center to the left so buildings are near the river but not overlapping
    const startX = 200 + -((gridCols - 1) * spacing) / 2;
    const startZ = -((gridRows - 1) * spacing) / 2;
    // Ground (solid grass color, much larger)
    const groundTexCanvas = document.createElement('canvas');
    groundTexCanvas.width = 256; groundTexCanvas.height = 256;
    const gtx = groundTexCanvas.getContext('2d');
    // Grass base
    gtx.fillStyle = '#8fd694';
    gtx.fillRect(0, 0, 256, 256);
    // Add noise for texture
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      gtx.fillStyle = `rgba(60,160,60,${Math.random() * 0.18 + 0.08})`;
      gtx.beginPath(); gtx.arc(x, y, Math.random() * 2.2 + 0.5, 0, 2 * Math.PI); gtx.fill();
    }
    // Some dirt patches
    for (let i = 0; i < 1200; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      gtx.fillStyle = `rgba(180,140,80,${Math.random() * 0.12 + 0.04})`;
      gtx.beginPath(); gtx.arc(x, y, Math.random() * 2.8 + 0.5, 0, 2 * Math.PI); gtx.fill();
    }
    const groundTex = new THREE.CanvasTexture(groundTexCanvas);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ map: groundTex, color: 0x8fd694, roughness: 0.7 })
    );
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    // River (curved, embanked) - scale up and move to left side
    const riverScale = 1.7; // Make river much larger
    const riverShape = new THREE.Shape();
    riverShape.moveTo(-520 * scaleUp * riverScale, -360 * scaleUp * riverScale);
    riverShape.bezierCurveTo(-560 * scaleUp * riverScale, -160 * scaleUp * riverScale, -560 * scaleUp * riverScale, 160 * scaleUp * riverScale, -520 * scaleUp * riverScale, 360 * scaleUp * riverScale);
    riverShape.lineTo(-440 * scaleUp * riverScale, 360 * scaleUp * riverScale);
    riverShape.bezierCurveTo(-480 * scaleUp * riverScale, 160 * scaleUp * riverScale, -480 * scaleUp * riverScale, -160 * scaleUp * riverScale, -440 * scaleUp * riverScale, -360 * scaleUp * riverScale);
    riverShape.lineTo(-520 * scaleUp * riverScale, -360 * scaleUp * riverScale);
    const extrudeSettings = { depth: 20 * scaleUp * riverScale, bevelEnabled: false, steps: 1, curveSegments: 32 };
    const riverGeom = new THREE.ExtrudeGeometry(riverShape, extrudeSettings);
    const riverMat = new THREE.MeshPhysicalMaterial({
      color: 0x3399ff, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.85, clearcoat: 0.5
    });
    const river = new THREE.Mesh(riverGeom, riverMat);
    river.position.set(0, 1, 0);
    river.rotation.x = -Math.PI / 2;
    scene.add(river);
    // Place and label the Kaveri River
    const riverLabelPos = new THREE.Vector3(-500 * scaleUp * riverScale, 40, 0);
    createLabel('Kaveri River', new THREE.Vector3(river.position.x, river.position.y + 12, river.position.z), scene);

    // River walkway
    const walkway = new THREE.Mesh(
      new THREE.BoxGeometry(200 * scaleUp, 1 * scaleUp, 28 * scaleUp),
      new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.8 })
    );
    walkway.position.set(-440 * scaleUp, 3, 80 * scaleUp);
    scene.add(walkway);
    createLabel('Riverside Walk', walkway.position.clone().add(new THREE.Vector3(0, 3, 0)), scene);
    // Wells (stone, roof, bucket, animated water surface)
    const wellPositions = [
      new THREE.Vector3(startX - spacing * 0.7, 2, startZ - spacing * 0.7), // top-left outside
      new THREE.Vector3(startX + (gridCols - 1) * spacing + spacing * 0.7, 2, startZ - spacing * 0.7), // top-right outside
      new THREE.Vector3(startX - spacing * 0.7, 2, startZ + (gridRows - 1) * spacing + spacing * 0.7), // bottom-left outside
      new THREE.Vector3(startX + (gridCols - 1) * spacing + spacing * 0.7, 2, startZ + (gridRows - 1) * spacing + spacing * 0.7), // bottom-right outside
      new THREE.Vector3(startX + 6 * spacing, 2, startZ + 6 * spacing) // center
    ];

    function getQuadrantWell(pos) {
      const cornerWells = wellPositions.slice(0, 4);
      let minDist = Infinity, nearest = null;
      for (const w of cornerWells) {
        const d = pos.distanceTo(w);
        if (d < minDist) { minDist = d; nearest = w; }
      }
      return nearest;
    }

    wellPositions.forEach((pos, i) => {
      // Well base
      const well = new THREE.Mesh(
        new THREE.CylinderGeometry(7 * scaleUp, 7 * scaleUp, 16 * scaleUp, 24),
        new THREE.MeshStandardMaterial({ color: 0x8a9ba8, roughness: 0.7, metalness: 0.5 })
      );
      well.position.copy(pos);
      scene.add(well);
      // Well roof
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(8 * scaleUp, 8 * scaleUp, 2 * scaleUp, 8, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x7c4a02 })
      );
      roof.position.copy(pos).add(new THREE.Vector3(0, 10 * scaleUp, 0));
      roof.rotation.z = Math.PI / 2;
      scene.add(roof);
      // Bucket
      const bucket = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2 * scaleUp, 1.2 * scaleUp, 2.5 * scaleUp, 12),
        new THREE.MeshStandardMaterial({ color: 0x9e7b53 })
      );
      bucket.position.copy(pos).add(new THREE.Vector3(0, 8 * scaleUp, 2 * scaleUp));
      scene.add(bucket);
      // Animated water surface in well
      const wellWater = new THREE.Mesh(
        new THREE.CylinderGeometry(6.2 * scaleUp, 6.2 * scaleUp, 1.2 * scaleUp, 24),
        new THREE.MeshStandardMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.7, roughness: 0.2, metalness: 0.7, emissive: 0x3399ff, emissiveIntensity: 0.2 })
      );
      wellWater.position.copy(pos).add(new THREE.Vector3(0, 2.5 * scaleUp, 0));
      scene.add(wellWater);
      createLabel('Well', pos, scene);
    });
    // Park (large, occupies 4x4 blocks in center)
    const parkSize = (spacing * 4 + 36) * scaleUp;
    const parkCenter = new THREE.Vector3(startX + 5.5 * spacing, 2, startZ + 5.5 * spacing);
    const parkMinX = parkCenter.x - parkSize / 2;
    const parkMaxX = parkCenter.x + parkSize / 2;
    const parkMinZ = parkCenter.z - parkSize / 2;
    const parkMaxZ = parkCenter.z + parkSize / 2;
    // Park mesh with richer green for realistic grass
    const park = new THREE.Mesh(
      new THREE.BoxGeometry(parkSize, 2 * scaleUp, parkSize, 8, 1, 8),
      new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.5 }) // richer green
    );
    park.position.copy(parkCenter);
    park.castShadow = true;
    scene.add(park);
    createLabel('Central Park', parkCenter, scene);
    // Buildings (12x12 grid, skip park area, realistic details)
    const buildingPositions = [];
    const buildingColors = [0xf5f5f5, 0xe0c097, 0xb0b0b0, 0x8d99ae, 0x6d6875, 0x457b9d, 0xa8dadc, 0xf4a261, 0xe76f51, 0x264653];
    // Water source tracking variables
    let riverBuildings = 0;
    let groundBuildings = 0;
    const buildingWaterSources = []; // Array to store water source for each building
    
    // Use actual building data from backend, fallback to 160 buildings if no data
    const actualBuildings = buildings.length > 0 ? buildings : Array.from({length: 160}, (_, i) => ({
      id: i + 1,
      building_name: `Building ${i + 1}`,
      building_code: `BLD${(i + 1).toString().padStart(3, '0')}`,
      water_requirement: 50 + (i % 30),
      preferred_source: i % 3 === 0 ? 'both' : (i % 2 === 0 ? 'river' : 'ground'),
      river_water_ratio: i % 3 === 0 ? 60 : (i % 2 === 0 ? 100 : 0),
      ground_water_ratio: i % 3 === 0 ? 40 : (i % 2 === 0 ? 0 : 100),
      apartments: 10 + (i % 20),
      priority: 1 + (i % 3)
    }));
    
    let buildingIndex = 0;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const pos = new THREE.Vector3(startX + col * spacing, 12, startZ + row * spacing);
        // Skip if building center is inside park bounds
        if (
          pos.x > parkMinX && pos.x < parkMaxX &&
          pos.z > parkMinZ && pos.z < parkMaxZ
        ) continue;
        
        // Determine water source based on building position
        // All buildings now have both river and groundwater connections
        riverBuildings++;
        groundBuildings++;
        buildingWaterSources.push('both');
        
        buildingPositions.push(pos);
        
        // Get building data
        const building = actualBuildings[buildingIndex] || {
          id: buildingIndex + 1,
          building_name: `Building ${buildingIndex + 1}`,
          building_code: `BLD${(buildingIndex + 1).toString().padStart(3, '0')}`,
          water_requirement: 50 + (buildingIndex % 30),
          apartments: 10 + (buildingIndex % 20),
          priority: 1 + (buildingIndex % 3)
        };
        
        // --- Realistic Building ---
        // Vary shape and roof style
        const width = (18 + Math.random() * 8) * scaleUp * buildingScale;
        const depth = (18 + Math.random() * 8) * scaleUp * buildingScale;
        const height = (28 + Math.random() * 48) * scaleUp * buildingScale;
        const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        
        // PBR wall material
        const wallMat = new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.38 + Math.random() * 0.18,
          metalness: 0.18 + Math.random() * 0.12,
          clearcoat: 0.18,
          sheen: 0.12,
          reflectivity: 0.18,
          transmission: 0.01
        });
        
        // Main building block
        const bldg = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          wallMat
        );
        bldg.position.copy(pos).setY(height / 2 + 1);
        bldg.castShadow = true;
        bldg.receiveShadow = true;
        bldg.userData = { building, buildingIndex: buildingIndex + 1 };
        bldg.userData.onClick = () => handleBuildingClick(building, pos);
        scene.add(bldg);
        
        // Add building details (windows, doors, etc.)
        // Base steps
        if (Math.random() < 0.5) {
          const steps = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.7, 2 * scaleUp, depth * 0.7),
            new THREE.MeshStandardMaterial({ color: 0xbbb9b9, roughness: 0.7 })
          );
          steps.position.copy(pos).setY(2 * scaleUp);
          scene.add(steps);
        }
        
        // Main door with frame
        const doorW = 4 * scaleUp * buildingScale, doorH = 8 * scaleUp * buildingScale;
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(doorW, doorH, 1.5 * scaleUp * buildingScale),
          new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.6 })
        );
        door.position.copy(pos).setY(doorH / 2 + 2 * scaleUp);
        scene.add(door);
        
        // Windows (random placement)
        for (let w = 0; w < 3 + Math.floor(Math.random() * 4); w++) {
          const windowW = 3 * scaleUp * buildingScale, windowH = 4 * scaleUp * buildingScale;
          const window = new THREE.Mesh(
            new THREE.BoxGeometry(windowW, windowH, 0.5 * scaleUp * buildingScale),
            new THREE.MeshStandardMaterial({ color: 0x87ceeb, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.7 })
          );
          const windowX = pos.x + (Math.random() - 0.5) * (width * 0.6);
          const windowY = pos.y + 8 * scaleUp * buildingScale + Math.random() * (height - 16 * scaleUp * buildingScale);
          const windowZ = pos.z + (Math.random() > 0.5 ? 1 : -1) * (depth / 2 + 0.5 * scaleUp * buildingScale);
          window.position.set(windowX, windowY, windowZ);
          scene.add(window);
        }
        
        // Roof (varied styles)
        if (Math.random() < 0.3) {
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(width * 0.6, 8 * scaleUp * buildingScale, 8),
            new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 })
          );
          roof.position.copy(pos).setY(height + 4 * scaleUp * buildingScale);
          scene.add(roof);
        }
        
        // For each building:
        let source, label, waterSupplied;
        // All buildings have both sources
        source = 'Both Sources';
        waterSupplied = (riverWaterAmount + groundWaterAmount) / (riverBuildings + groundBuildings);
        waterSupplied = waterSupplied.toFixed(1);
        
        // Create building label with building number and details
        const labelPosition = pos.clone().setY(height + 20 * scaleUp * buildingScale);
        const buildingLabel = `${buildingIndex + 1}\n${building.building_name}\n${building.apartments} apts`;
        createLabel(buildingLabel, labelPosition, scene);
        
        buildingIndex++;
      }
    }
    
    // Connect buildings to water sources (both river and groundwater for all buildings)
    buildingPositions.forEach((buildingPos, index) => {
      // Connect to Kaveri River (left side)
      const riverSourcePos = new THREE.Vector3(-480 * scaleUp, 2, buildingPos.z);
      addWaterPipe(riverSourcePos, buildingPos, 'river', 'building');
      
      // Connect to Groundwater Source (right side)
      const groundSourcePos = new THREE.Vector3(600 * scaleUp, 2, -600 * scaleUp);
      addWaterPipe(groundSourcePos, buildingPos, 'ground', 'building');
    });
    
    // Park path
    const path = new THREE.Mesh(
      new THREE.TorusGeometry(36 * scaleUp, 2.4 * scaleUp, 16, 40),
      new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.8 })
    );
    path.position.copy(parkCenter).setY(3.5 * scaleUp);
    path.rotation.x = Math.PI / 2;
    scene.add(path);
    // Park pond
    const pond = new THREE.Mesh(
      new THREE.CylinderGeometry(16 * scaleUp, 16 * scaleUp, 2 * scaleUp, 24),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.7, roughness: 0.3, metalness: 0.5 })
    );
    pond.position.copy(parkCenter).add(new THREE.Vector3(20 * scaleUp, 2 * scaleUp, -20 * scaleUp));
    scene.add(pond);
    // Park trees and benches in rows (robust, beautiful trees)
    const numRows = 3, numCols = 4;
    const treeSpacingX = parkSize / (numCols + 1);
    const treeSpacingZ = parkSize / (numRows + 1);
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const tx = parkCenter.x - parkSize / 2 + (c + 1) * treeSpacingX + (Math.random() - 0.5) * 4 * scaleUp * buildingScale;
        const tz = parkCenter.z - parkSize / 2 + (r + 1) * treeSpacingZ + (Math.random() - 0.5) * 4 * scaleUp * buildingScale;
        // Alternate between lollipop and pine tree styles
        if ((r + c) % 2 === 0) {
          // Lollipop/broadleaf tree: thick, tall trunk, big ellipsoid foliage
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(2.5 * scaleUp * buildingScale, 3.2 * scaleUp * buildingScale, 18 * scaleUp * buildingScale, 16),
            new THREE.MeshStandardMaterial({ color: 0x7c4a02, roughness: 0.8 })
          );
          trunk.position.set(tx, 9 * scaleUp * buildingScale, tz);
          trunk.castShadow = true;
          trunk.receiveShadow = true;
          scene.add(trunk);
          const foliage = new THREE.Mesh(
            new THREE.SphereGeometry(7 * scaleUp * buildingScale, 24, 24),
            new THREE.MeshStandardMaterial({ color: 0x3a7d3b, roughness: 0.4, metalness: 0.2 })
          );
          foliage.scale.set(1.3 + Math.random() * 0.2, 1.7 + Math.random() * 0.3, 1.3 + Math.random() * 0.2);
          foliage.position.set(tx, 21 * scaleUp * buildingScale, tz);
          foliage.castShadow = true;
          foliage.receiveShadow = true;
          scene.add(foliage);
        } else {
          // Pine/conifer tree: thick, tall trunk, stacked cones
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(1.8 * scaleUp * buildingScale, 2.5 * scaleUp * buildingScale, 15 * scaleUp * buildingScale, 12),
            new THREE.MeshStandardMaterial({ color: 0x7c4a02, roughness: 0.8 })
          );
          trunk.position.set(tx, 7.5 * scaleUp * buildingScale, tz);
          trunk.castShadow = true;
          trunk.receiveShadow = true;
          scene.add(trunk);
          for (let i = 0; i < 3; i++) {
            const cone = new THREE.Mesh(
              new THREE.ConeGeometry((6 - i * 1.5) * scaleUp * buildingScale, 7 * scaleUp * buildingScale, 16),
              new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.4, metalness: 0.2 })
            );
            cone.position.set(tx, (15 + i * 4) * scaleUp * buildingScale, tz);
            cone.castShadow = true;
            cone.receiveShadow = true;
            scene.add(cone);
          }
        }
        // Benches at the end of each row
        if (c === numCols - 1) {
          const bench = new THREE.Mesh(
            new THREE.BoxGeometry(5 * scaleUp, 1 * scaleUp, 1.5 * scaleUp),
            new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.8 })
          );
          bench.position.set(tx + 6 * scaleUp, 2 * scaleUp, tz);
          scene.add(bench);
        }
      }
    }
    // Add flower patches
    for (let i = 0; i < 8; i++) {
      const flower = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2 * scaleUp, 1.2 * scaleUp, 0.6 * scaleUp, 8),
        new THREE.MeshStandardMaterial({ color: 0xff69b4, roughness: 0.5 })
      );
      const angle = Math.random() * Math.PI * 2;
      const radius = (parkSize / 2 - 10 * scaleUp) * Math.random();
      flower.position.copy(parkCenter).add(new THREE.Vector3(Math.cos(angle) * radius, 2.5 * scaleUp, Math.sin(angle) * radius));
      scene.add(flower);
    }
    // Add benches
    for (let i = 0; i < 4; i++) {
      const bench = new THREE.Mesh(
        new THREE.BoxGeometry(10 * scaleUp, 2 * scaleUp, 2.5 * scaleUp),
        new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.8 })
      );
      const angle = (i / 4) * Math.PI * 2;
      const radius = parkSize / 2 - 18 * scaleUp;
      bench.position.copy(parkCenter).add(new THREE.Vector3(Math.cos(angle) * radius, 3 * scaleUp, Math.sin(angle) * radius));
      scene.add(bench);
    }
    // Water pipes (realistic: thicker, metallic, blue glow)
    function addWaterPipe(from, to, sourceType, type = 'building') {
      // Only add pipes if showWaterConnections is true
      if (!showWaterConnections) return;
      const pipe = createCylinder(from, to, 2.5 * scaleUp, 0x3399ff, 0.8, 0.8, 0.2);
      pipe.material.emissive = new THREE.Color(0x3399ff);
      pipe.material.emissiveIntensity = 0.12;
      pipe.material.metalness = 0.7;
      scene.add(pipe);
      pipesRef.current.push({ from: from.clone(), to: to.clone(), pipe, sourceType, type });
    }
    // Place and label the Groundwater Source (aquifer)
    const aquiferPos = new THREE.Vector3(600 * scaleUp, 2, -600 * scaleUp);
    const aquifer = new THREE.Mesh(
      new THREE.CylinderGeometry(32 * scaleUp, 32 * scaleUp, 10 * scaleUp, 32),
      new THREE.MeshPhysicalMaterial({ color: 0x4fc3f7, roughness: 0.3, metalness: 0.7, transparent: true, opacity: 0.55 })
    );
    aquifer.position.copy(aquiferPos);
    scene.add(aquifer);
    const aquiferTopY = aquifer.position.y + (10 * scaleUp) / 2;
    createLabel('Groundwater Source', new THREE.Vector3(aquifer.position.x, aquiferTopY + 10, aquifer.position.z), scene);

    // --- Water Flow Simulation ---
    function startSimulation() {
      // Remove old instanced meshes if present
      if (dropletInstancedMesh) scene.remove(dropletInstancedMesh);
      if (trailInstancedMesh) scene.remove(trailInstancedMesh);
      dropletsRef.current.forEach(d => scene.remove(d.mesh));
      dropletsRef.current = [];

      // Highlight pipes during simulation
      pipesRef.current.forEach(({ pipe }) => {
        if (pipe.material.emissive) {
          pipe.material.emissive.setHex(0x3399ff);
          pipe.material.emissiveIntensity = 0.25;
        }
      });
      // For each pipe, add multiple droplets spaced evenly
      const numDroplets = 5;
      let dropletCount = 0;
      let dropletTransforms = [];
      let dropletColors = [];
      let trailTransforms = [];
      let trailColors = [];
      pipesRef.current.forEach(({ from, to, sourceType, type }, pipeIdx) => {
        // Disruption logic
        let color = sourceType === 'river' ? 0x3399ff : 0x00e6e6;
        let visible = true;
        let pipeColor = 0x3399ff;
        let emissive = color;
        let warningLabel = null;
        // Pipe leak: show red droplets escaping mid-pipe
        if (disruptions.pipeLeak && pipeIdx === 0) {
          color = 0xff2222;
          pipeColor = 0xff2222;
          warningLabel = 'Pipe Leak!';
        }
        // Well dry: all well pipes gray, no droplets
        if (disruptions.wellDry && sourceType === 'well') {
          color = 0x888888;
          pipeColor = 0x888888;
          visible = false;
          warningLabel = 'Well Dry';
        }
        // River pollution: river pipes brown
        if (disruptions.riverPollution && sourceType === 'river') {
          color = 0x8b5a2b;
          pipeColor = 0x8b5a2b;
          warningLabel = 'Polluted';
        }
        // Pump failure: all river pipes orange, no droplets
        if (disruptions.pumpFailure && sourceType === 'river') {
          color = 0xffa500;
          pipeColor = 0xffa500;
          visible = false;
          warningLabel = 'Pump Failure';
        }
        // Set pipe color
        if (pipesRef.current[pipeIdx].pipe.material) {
          pipesRef.current[pipeIdx].pipe.material.color.setHex(pipeColor);
          pipesRef.current[pipeIdx].pipe.material.emissive.setHex(pipeColor);
        }
        // Add warning label if needed (with warning icon)
        if (warningLabel) {
          createLabel('⚠️ ' + warningLabel, to.clone().add(new THREE.Vector3(0, 18 * scaleUp, 0)), scene);
        }
        if (!visible) return;
        for (let i = 0; i < numDroplets; i++) {
          // Store transform and color for instanced mesh
          const t = i / numDroplets;
          dropletTransforms.push({ from: from.clone(), to: to.clone(), t, offset: t });
          dropletColors.push(color);
          // Trails
          for (let j = 1; j <= 4; j++) {
            const tTrail = t - j * 0.04;
            if (tTrail < 0) continue;
            trailTransforms.push({ from: from.clone(), to: to.clone(), t: tTrail, offset: t, j });
            trailColors.push(color);
          }
          dropletCount++;
        }
        // Add ripple at destination (keep as mesh for now)
        if (visible) {
          const ripple = new THREE.Mesh(
            new THREE.RingGeometry(2.5 * scaleUp, 5.5 * scaleUp, 48),
            new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.32 })
          );
          ripple.position.copy(to).add(new THREE.Vector3(0, 2 * scaleUp, 0));
          ripple.rotation.x = -Math.PI / 2;
          scene.add(ripple);
          // Animate ripple scale and fade
          let rippleStart = Date.now();
          function animateRipple() {
            const elapsed = (Date.now() - rippleStart) / 900;
            ripple.scale.set(1 + elapsed * 1.2, 1 + elapsed * 1.2, 1);
            ripple.material.opacity = 0.32 * (1 - elapsed);
            if (elapsed < 1) requestAnimationFrame(animateRipple);
            else scene.remove(ripple);
          }
          animateRipple();
        }
      });
      // Create instanced mesh for droplets
      const dropletGeo = new THREE.SphereGeometry(4.2 * scaleUp, 24, 24);
      const dropletMat = new THREE.MeshPhysicalMaterial({
        color: 0x3399ff,
        emissive: 0x3399ff,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.92,
        transmission: 0.7,
        roughness: 0.15,
        metalness: 0.2,
        clearcoat: 0.7,
        ior: 1.33
      });
      dropletInstancedMesh = new THREE.InstancedMesh(dropletGeo, dropletMat, dropletTransforms.length);
      // Create instanced mesh for trails
      const trailGeo = new THREE.SphereGeometry(2.2 * scaleUp, 16, 16);
      const trailMat = new THREE.MeshStandardMaterial({
        color: 0x3399ff,
        emissive: 0x3399ff,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.18
      });
      trailInstancedMesh = new THREE.InstancedMesh(trailGeo, trailMat, trailTransforms.length);
      scene.add(dropletInstancedMesh);
      scene.add(trailInstancedMesh);
      // Store transforms for animation
      dropletsRef.current = { dropletTransforms, trailTransforms, dropletInstancedMesh, trailInstancedMesh, dropletColors, trailColors };
      console.log('Droplets created:', dropletCount);
    }
    function stopSimulation() {
      if (dropletsRef.current.dropletInstancedMesh) scene.remove(dropletsRef.current.dropletInstancedMesh);
      if (dropletsRef.current.trailInstancedMesh) scene.remove(dropletsRef.current.trailInstancedMesh);
      dropletsRef.current = [];
      // Remove pipe highlight
      pipesRef.current.forEach(({ pipe }) => {
        if (pipe.material.emissive) {
          pipe.material.emissive.setHex(0x000000);
          pipe.material.emissiveIntensity = 0;
        }
      });
    }

    // Animation loop
    function animate() {
      controls.update();
      
      // Animate disruption effects
      if (disruptionActive && disruptionLocation) {
        // Update disruption indicator pulsing
        if (window.disruptionMesh) {
          const scale = 1 + 0.3 * Math.sin(Date.now() * 0.005);
          window.disruptionMesh.scale.set(scale, scale, scale);
        }
        
        // Animate water spray for pipe leak
        if (disruptionType === 'pipeLeak' && window.sprayMesh) {
          window.sprayMesh.rotation.y += 0.02;
          const sprayScale = 1 + 0.2 * Math.sin(Date.now() * 0.01);
          window.sprayMesh.scale.set(sprayScale, sprayScale, sprayScale);
        }
        
        // Animate affected buildings
        affectedBuildings.forEach(building => {
          const buildingIndex = building.id - 1;
          if (buildingInstances.current[buildingIndex]) {
            const pulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.003 + buildingIndex);
            buildingInstances.current[buildingIndex].material.opacity = pulse;
          }
        });
      }
      
      // Animate droplets if simulating
      if (isSimulating) {
        const speed = 0.008;
        if (dropletsRef.current.dropletTransforms) {
          // Animate droplets
          for (let i = 0; i < dropletsRef.current.dropletTransforms.length; i++) {
            let d = dropletsRef.current.dropletTransforms[i];
            d.t += speed;
            if (d.t > 1) d.t -= 1;
            let tEased = 0.5 - 0.5 * Math.cos(Math.PI * d.t);
            let pos = new THREE.Vector3().lerpVectors(d.from, d.to, tEased);
            let mat = new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z);
            dropletsRef.current.dropletInstancedMesh.setMatrixAt(i, mat);
            // Optionally, set color per instance
            // dropletsRef.current.dropletInstancedMesh.setColorAt(i, new THREE.Color(dropletsRef.current.dropletColors[i]));
          }
          dropletsRef.current.dropletInstancedMesh.instanceMatrix.needsUpdate = true;
          // Animate trails
          for (let i = 0; i < dropletsRef.current.trailTransforms.length; i++) {
            let tObj = dropletsRef.current.trailTransforms[i];
            let tTrail = tObj.t + speed;
            if (tTrail > 1) tTrail -= 1;
            let tEasedTrail = 0.5 - 0.5 * Math.cos(Math.PI * (tTrail < 0 ? tTrail + 1 : tTrail));
            let pos = new THREE.Vector3().lerpVectors(tObj.from, tObj.to, tEasedTrail);
            let mat = new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z);
            dropletsRef.current.trailInstancedMesh.setMatrixAt(i, mat);
            // Optionally, set color per instance
            // dropletsRef.current.trailInstancedMesh.setColorAt(i, new THREE.Color(dropletsRef.current.trailColors[i]));
          }
          dropletsRef.current.trailInstancedMesh.instanceMatrix.needsUpdate = true;
        }
      }
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    }
    animate();

    // React to simulation state changes
    if (isSimulating) {
      startSimulation();
    } else {
      stopSimulation();
    }

    // Add disruption visual effects
    if (disruptionActive && disruptionLocation) {
      // Create disruption indicator
      const disruptionGeometry = new THREE.SphereGeometry(5, 16, 16);
      const disruptionMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000, 
        transparent: true, 
        opacity: 0.7,
        wireframe: true 
      });
      const disruptionMesh = new THREE.Mesh(disruptionGeometry, disruptionMaterial);
      disruptionMesh.position.set(disruptionLocation.x, 10, disruptionLocation.z);
      scene.add(disruptionMesh);
      window.disruptionMesh = disruptionMesh;
      
      // Add specific effects based on disruption type
      if (disruptionType === 'pipeLeak') {
        // Broken pipe visual
        const brokenPipeGeometry = new THREE.CylinderGeometry(0.5, 0.5, 20, 8);
        const brokenPipeMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x8B0000, 
          transparent: true, 
          opacity: 0.8 
        });
        const brokenPipe = new THREE.Mesh(brokenPipeGeometry, brokenPipeMaterial);
        brokenPipe.position.set(disruptionLocation.x, 5, disruptionLocation.z);
        brokenPipe.rotation.z = Math.PI / 2;
        scene.add(brokenPipe);
        
        // Water spray effect
        const sprayGeometry = new THREE.ConeGeometry(2, 8, 8);
        const sprayMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x00BFFF, 
          transparent: true, 
          opacity: 0.6 
        });
        const spray = new THREE.Mesh(sprayGeometry, sprayMaterial);
        spray.position.set(disruptionLocation.x + 10, 8, disruptionLocation.z);
        spray.rotation.z = -Math.PI / 2;
        scene.add(spray);
        window.sprayMesh = spray;
      }
      
      // Highlight affected buildings
      affectedBuildings.forEach(building => {
        const buildingIndex = building.id - 1;
        if (buildingInstances.current[buildingIndex]) {
          buildingInstances.current[buildingIndex].material.color.setHex(0xff6666);
          buildingInstances.current[buildingIndex].material.transparent = true;
          buildingInstances.current[buildingIndex].material.opacity = 0.8;
        }
      });
    } else {
      // Clean up disruption effects
      if (window.disruptionMesh) {
        scene.remove(window.disruptionMesh);
        window.disruptionMesh = null;
      }
      if (window.sprayMesh) {
        scene.remove(window.sprayMesh);
        window.sprayMesh = null;
      }
      
      // Reset building colors
      buildingInstances.current.forEach(instance => {
        if (instance && instance.material) {
          instance.material.color.setHex(0x4a90e2);
          instance.material.transparent = false;
          instance.material.opacity = 1;
        }
      });
    }

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      if (mountRef.current && renderer.domElement && mountRef.current.contains(renderer.domElement)) {
      mountRef.current.removeChild(renderer.domElement);
      }
      stopSimulation();
      pipesRef.current = [];
      // Remove click event listener
      renderer.domElement.removeEventListener('click', onMouseClick);
    };
  }, [isSimulating, disruptions, showWaterConnections, riverWaterAmount, groundWaterAmount, buildings]);

  // Disruption simulation functions
  const runDisruptionSimulation = async () => {
    if (!disruptionType || !disruptionLocation) {
      alert('Please select both disruption type and location');
      return;
    }

    // Check if baseline simulation data exists
    if (!baselineSimulationData && buildings.length === 0) {
      alert('Please run a comprehensive simulation first to establish baseline data for disruption analysis');
      return;
    }

    setDisruptionActive(true);
    setDisruptionProgress(0);
    setDisruptionResults(null);
    setShowDisruptionResults(false);
    setBrokenPipes([]);
    setAffectedBuildings([]);
    setOptimizationSuggestions('');

    try {
      // Use baseline data for disruption simulation, with fallback to current state
      const baseline = baselineSimulationData || {
        buildings: buildings,
        totalWaterNeeded: totalWaterNeeded,
        buildingAllocations: buildingAllocations,
        simulationResults: simulationResults,
        approvedRequests: approvedRequests,
        extraWaterRequests: extraWaterRequests,
        eventWaterRequests: eventWaterRequests,
        riverWaterAmount: riverWaterAmount,
        groundWaterAmount: groundWaterAmount,
        timestamp: new Date().toISOString()
      };
      console.log('Using baseline data for disruption simulation:', baseline);
      console.log('Baseline buildings count:', baseline.buildings?.length);
      console.log('Baseline total water needed:', baseline.totalWaterNeeded);
      console.log('Disruption type:', disruptionType);
      console.log('Disruption location:', disruptionLocation);

      // Simulate disruption impact
      setDisruptionProgress(20);
      await new Promise(resolve => setTimeout(resolve, 500));

      let affectedBuildingsList = [];
      let brokenPipesList = [];
      let waterShortage = 0;
      let efficiencyLoss = 0;

      // Determine affected buildings based on disruption type and location
      if (disruptionType === 'pipe_leak') {
        // Simulate pipe leak affecting buildings in the same area
        const locationArea = disruptionLocation.split('_')[0]; // e.g., "north", "south"
        // For pipe leak, affect buildings based on location area
        const affectedPercentage = 0.3; // 30% of buildings affected
        const numAffected = Math.floor(baseline.buildings.length * affectedPercentage);
        affectedBuildingsList = baseline.buildings.slice(0, numAffected);
        
        brokenPipesList = [`${locationArea}_main_pipe`, `${locationArea}_secondary_pipe`];
        waterShortage = baseline.totalWaterNeeded * 0.25; // 25% water loss
        efficiencyLoss = 35;
      } else if (disruptionType === 'well_dry') {
        // Simulate well drying up affecting groundwater-dependent buildings
        const affectedPercentage = 0.4; // 40% of buildings affected
        const numAffected = Math.floor(baseline.buildings.length * affectedPercentage);
        affectedBuildingsList = baseline.buildings.slice(0, numAffected);
        
        brokenPipesList = ['groundwater_main_pipe', 'groundwater_pump_1', 'groundwater_pump_2'];
        waterShortage = baseline.totalWaterNeeded * 0.4; // 40% water loss
        efficiencyLoss = 50;
      } else if (disruptionType === 'river_pollution') {
        // Simulate river pollution affecting river-dependent buildings
        const affectedPercentage = 0.35; // 35% of buildings affected
        const numAffected = Math.floor(baseline.buildings.length * affectedPercentage);
        affectedBuildingsList = baseline.buildings.slice(0, numAffected);
        
        brokenPipesList = ['river_intake_pipe', 'river_treatment_pipe'];
        waterShortage = baseline.totalWaterNeeded * 0.35; // 35% water loss
        efficiencyLoss = 45;
      } else if (disruptionType === 'pump_failure') {
        // Simulate pump failure affecting all buildings
        const affectedPercentage = 0.5; // 50% of buildings affected
        const numAffected = Math.floor(baseline.buildings.length * affectedPercentage);
        affectedBuildingsList = baseline.buildings.slice(0, numAffected);
        
        brokenPipesList = ['main_pump_1', 'main_pump_2', 'distribution_pump'];
        waterShortage = baseline.totalWaterNeeded * 0.3; // 30% water loss
        efficiencyLoss = 40;
      }

      setDisruptionProgress(50);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Calculate disruption results
      const disruptionResults = {
        disruptionType,
        disruptionLocation,
        affectedBuildings: affectedBuildingsList.length,
        totalBuildings: baseline.buildings.length,
        waterShortage: Math.round(waterShortage),
        efficiencyLoss,
        estimatedRecoveryTime: Math.floor(Math.random() * 24) + 6, // 6-30 hours
        emergencyMeasures: [
          'Activate backup water sources',
          'Implement water rationing',
          'Deploy emergency repair teams',
          'Notify affected buildings'
        ],
        costImpact: Math.round(waterShortage * 0.5), // ₹0.5 per liter
        timestamp: new Date().toISOString()
      };

      setDisruptionProgress(80);
      await new Promise(resolve => setTimeout(resolve, 500));

      setBrokenPipes(brokenPipesList);
      setAffectedBuildings(affectedBuildingsList);
      setDisruptionResults(disruptionResults);
      setDisruptionProgress(100);
      setShowDisruptionResults(true);

      // Generate optimization suggestions for disruption recovery
      const suggestions = await generateDisruptionSuggestions(disruptionResults, baseline);
      setOptimizationSuggestions(suggestions);

    } catch (error) {
      console.error('Error running disruption simulation:', error);
      console.error('Baseline data:', baselineSimulationData);
      console.error('Disruption type:', disruptionType);
      console.error('Disruption location:', disruptionLocation);
      alert(`Error running disruption simulation: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setDisruptionActive(false);
    }
  };

  const calculateDisruptionImpact = (type, affectedBuildings) => {
    const totalBuildings = buildings.length;
    const affectedCount = affectedBuildings.length;
    const affectedPercentage = (affectedCount / totalBuildings) * 100;
    
    let waterReduction, duration, severity;
    
    switch (type) {
      case 'pipeLeak':
        waterReduction = 0.15; // 15% water loss
        duration = '2-4 hours';
        severity = 'Medium';
        break;
      case 'wellDry':
        waterReduction = 0.25; // 25% reduction
        duration = '6-12 hours';
        severity = 'High';
        break;
      case 'riverPollution':
        waterReduction = 0.30; // 30% reduction
        duration = '12-24 hours';
        severity = 'Critical';
        break;
      case 'pumpFailure':
        waterReduction = 0.20; // 20% reduction
        duration = '4-8 hours';
        severity = 'High';
        break;
      default:
        waterReduction = 0.10;
        duration = 'Unknown';
        severity = 'Low';
    }
    
    return {
      affectedBuildings: affectedCount,
      affectedPercentage,
      waterReduction,
      duration,
      severity,
      totalWaterNeeded: totalWaterNeeded,
      reducedWaterAvailable: totalWaterNeeded * (1 - waterReduction),
      emergencyWaterNeeded: totalWaterNeeded * waterReduction
    };
  };

  const runDisruptionOptimization = async (type, impact) => {
    // Simulate the Python optimization algorithms
    const optimizationData = {
      disruption_type: type,
      affected_buildings: impact.affectedBuildings,
      water_reduction: impact.waterReduction,
      total_demand: impact.totalWaterNeeded,
      available_water: impact.reducedWaterAvailable,
      buildings: buildings.map(b => ({
        id: b.id,
        building_name: b.building_name,
        building_code: b.building_code,
        water_requirement: b.water_requirement,
        priority: b.priority,
        sector: b.sector || 'Municipal',
        is_affected: impact.affectedBuildings.some(ab => ab.id === b.id)
      }))
    };
    
    // Simulate optimization results based on the Python algorithms
    const results = simulateOptimizationAlgorithms(optimizationData);
    
    // Generate AI suggestions
    const suggestions = generateDisruptionSuggestions(type, impact, results);
    setOptimizationSuggestions(suggestions);
    
    return results;
  };

  const simulateOptimizationAlgorithms = (data) => {
    // Simulate water_alloc.py linear programming optimization
    const linearProgrammingResults = simulateLinearProgramming(data);
    
    // Simulate water_optim.py multi-objective optimization
    const multiObjectiveResults = simulateMultiObjectiveOptimization(data);
    
    return {
      linear_programming: linearProgrammingResults,
      multi_objective: multiObjectiveResults,
      recommended_approach: data.water_reduction > 0.2 ? 'multi_objective' : 'linear_programming'
    };
  };

  const simulateLinearProgramming = (data) => {
    const { total_demand, available_water, buildings } = data;
    
    // Simulate LP optimization
    const allocation_factor = Math.min(1, available_water / total_demand);
    const priority_weights = { 1: 1.0, 2: 0.7, 3: 0.4 };
    
    const allocations = buildings.map(building => {
      const priority_weight = priority_weights[building.priority] || 0.5;
      const base_allocation = building.water_requirement * allocation_factor;
      const priority_adjusted = base_allocation * priority_weight;
      
      return {
        building_id: building.id,
        building_name: building.building_name,
        original_demand: building.water_requirement,
        allocated_water: Math.min(building.water_requirement, priority_adjusted),
        unmet_demand: Math.max(0, building.water_requirement - priority_adjusted),
        priority_met: priority_adjusted >= building.water_requirement * 0.8,
        allocation_efficiency: (priority_adjusted / building.water_requirement) * 100
      };
    });
    
    const total_allocated = allocations.reduce((sum, a) => sum + a.allocated_water, 0);
    const total_unmet = allocations.reduce((sum, a) => sum + a.unmet_demand, 0);
    const high_priority_met = allocations.filter(a => a.priority_met && buildings.find(b => b.id === a.building_id)?.priority === 1).length;
    
    return {
      method: 'Linear Programming',
      total_allocated,
      total_unmet,
      allocation_efficiency: (total_allocated / total_demand) * 100,
      high_priority_compliance: high_priority_met / buildings.filter(b => b.priority === 1).length * 100,
      building_allocations: allocations
    };
  };

  const simulateMultiObjectiveOptimization = (data) => {
    const { total_demand, available_water, buildings } = data;
    
    // Simulate multi-objective optimization with sustainability focus
    const sustainability_weight = 0.7;
    const supply_weight = 0.3;
    
    // Calculate sustainable allocation considering groundwater levels
    const sustainable_factor = Math.min(1, available_water / total_demand * 0.8); // Conservative approach
    
    const allocations = buildings.map(building => {
      const base_allocation = building.water_requirement * sustainable_factor;
      const priority_multiplier = building.priority === 1 ? 1.2 : building.priority === 2 ? 1.0 : 0.8;
      const sustainable_allocation = base_allocation * priority_multiplier;
      
      return {
        building_id: building.id,
        building_name: building.building_name,
        original_demand: building.water_requirement,
        allocated_water: Math.min(building.water_requirement, sustainable_allocation),
        unmet_demand: Math.max(0, building.water_requirement - sustainable_allocation),
        sustainability_score: (sustainable_allocation / building.water_requirement) * 100,
        energy_efficiency: building.priority === 1 ? 95 : building.priority === 2 ? 85 : 75,
        groundwater_impact: building.priority === 1 ? 'Low' : building.priority === 2 ? 'Medium' : 'High'
      };
    });
    
    const total_allocated = allocations.reduce((sum, a) => sum + a.allocated_water, 0);
    const avg_sustainability = allocations.reduce((sum, a) => sum + a.sustainability_score, 0) / allocations.length;
    const avg_energy_efficiency = allocations.reduce((sum, a) => sum + a.energy_efficiency, 0) / allocations.length;
    
    return {
      method: 'Multi-Objective Optimization',
      total_allocated,
      sustainability_score: avg_sustainability,
      energy_efficiency: avg_energy_efficiency,
      supply_ratio: (total_allocated / total_demand) * 100,
      building_allocations: allocations
    };
  };

  const generateDisruptionSuggestions = async (disruptionResults, baseline) => {
    try {
      const prompt = `Analyze this water system disruption and provide comprehensive recovery recommendations:

DISRUPTION DETAILS:
- Type: ${disruptionResults.disruptionType}
- Location: ${disruptionResults.disruptionLocation}
- Affected Buildings: ${disruptionResults.affectedBuildings}/${disruptionResults.totalBuildings}
- Water Shortage: ${disruptionResults.waterShortage} liters
- Efficiency Loss: ${disruptionResults.efficiencyLoss}%
- Recovery Time: ${disruptionResults.estimatedRecoveryTime} hours
- Cost Impact: ₹${disruptionResults.costImpact}

BASELINE SYSTEM:
- Total Buildings: ${baseline.buildings.length}
- Total Water Needed: ${baseline.totalWaterNeeded} liters
- River Water: ${baseline.riverWaterAmount} liters
- Groundwater: ${baseline.groundWaterAmount} liters

Please provide:
1. Immediate emergency response actions
2. Short-term recovery strategies (next 24-48 hours)
3. Long-term resilience improvements
4. Cost-benefit analysis of recovery options
5. Priority order for affected buildings
6. Alternative water source recommendations

Format as a professional technical report with clear sections and actionable recommendations.`;

      const response = await fetch('http://localhost:5000/generate-ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt })
      });

      if (response.ok) {
        const data = await response.json();
        return data.suggestions;
      } else {
        // Fallback suggestions
        return generateFallbackDisruptionSuggestions(disruptionResults, baseline);
      }
    } catch (error) {
      console.error('Error generating disruption suggestions:', error);
      return generateFallbackDisruptionSuggestions(disruptionResults, baseline);
    }
  };

  const generateFallbackDisruptionSuggestions = (disruptionResults, baseline) => {
    let suggestions = `🚨 **DISRUPTION ANALYSIS: ${disruptionResults.disruptionType.toUpperCase()}**\n\n`;
    
    suggestions += `📊 **Impact Assessment:**\n`;
    suggestions += `• Affected Buildings: ${disruptionResults.affectedBuildings}/${disruptionResults.totalBuildings} (${((disruptionResults.affectedBuildings/disruptionResults.totalBuildings)*100).toFixed(1)}%)\n`;
    suggestions += `• Water Shortage: ${disruptionResults.waterShortage} liters\n`;
    suggestions += `• Efficiency Loss: ${disruptionResults.efficiencyLoss}%\n`;
    suggestions += `• Recovery Time: ${disruptionResults.estimatedRecoveryTime} hours\n`;
    suggestions += `• Cost Impact: ₹${disruptionResults.costImpact}\n\n`;
    
    suggestions += `🚨 **Immediate Emergency Response:**\n`;
    suggestions += `• Activate emergency water distribution protocols\n`;
    suggestions += `• Implement water rationing for non-critical buildings\n`;
    suggestions += `• Deploy repair teams to affected infrastructure\n`;
    suggestions += `• Notify all affected buildings and coordinate response\n\n`;
    
    suggestions += `⚙️ **Recovery Strategies:**\n`;
    switch (disruptionResults.disruptionType) {
      case 'pipe_leak':
        suggestions += `• Isolate and repair damaged pipe sections\n`;
        suggestions += `• Activate backup distribution routes\n`;
        suggestions += `• Prioritize high-priority buildings (hospitals, emergency services)\n`;
        break;
      case 'well_dry':
        suggestions += `• Increase surface water extraction from river\n`;
        suggestions += `• Implement water conservation measures\n`;
        suggestions += `• Activate emergency water storage systems\n`;
        break;
      case 'river_pollution':
        suggestions += `• Switch to groundwater sources exclusively\n`;
        suggestions += `• Implement additional water treatment protocols\n`;
        suggestions += `• Coordinate with environmental agencies for cleanup\n`;
        break;
      case 'pump_failure':
        suggestions += `• Activate backup pumping stations\n`;
        suggestions += `• Implement gravity-fed distribution where possible\n`;
        suggestions += `• Deploy mobile water distribution units\n`;
        break;
    }
    
    suggestions += `\n💡 **Long-term Resilience:**\n`;
    suggestions += `• Implement redundant water distribution systems\n`;
    suggestions += `• Enhance monitoring and early warning systems\n`;
    suggestions += `• Develop comprehensive emergency response protocols\n`;
    suggestions += `• Invest in backup water storage infrastructure\n`;
    
    return suggestions;
  };

  // --- Refactored layout: simulation canvas, then controls, then ground section ---
  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#e3f2fd', position: 'relative' }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      {/* Show Water Connections Button */}
        <button
        style={{ position: 'absolute', top: 24, right: 32, zIndex: 30, padding: '14px 32px', fontSize: 18, borderRadius: 12, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, boxShadow: '0 2px 16px #2563eb22', letterSpacing: 1 }}
        onClick={() => setShowWaterConnections(s => !s)}
      >
        {showWaterConnections ? 'Hide Water Connections' : 'Show Water Connections'}
        </button>
      {/* 3D Simulation Canvas */}
      <div ref={mountRef} style={{ width: '100vw', height: '70vh', background: '#bfefff', position: 'relative' }} />
      {/* Top-left overlay: System Status and Simulation Controls */}
      <div style={{ position: 'absolute', top: 32, left: 32, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* System Status Panel */}
        <div style={{ minWidth: 260, maxWidth: 340, background: 'rgba(255,255,255,0.85)', borderRadius: 18, boxShadow: '0 4px 32px #2563eb22', padding: 20, fontFamily: 'inherit', fontSize: 18, fontWeight: 500, marginBottom: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FaWater style={{ fontSize: 26, color: '#43e97b' }} /> System Status
          </span>
          <span style={{ fontSize: 15, marginTop: 2 }}>Water: <span style={{ color: '#43e97b', fontWeight: 600 }}>OK</span></span>
        </div>
        {/* Simulation Controls Panel */}
        <div style={{ minWidth: 260, maxWidth: 340, background: 'rgba(255,255,255,0.85)', borderRadius: 18, boxShadow: '0 4px 32px #2563eb22', padding: 20, fontFamily: 'inherit', fontSize: 18, fontWeight: 500 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
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

              {/* Water Sources Section */}
              {/*
              <div style={{ margin: '10px 0 10px 0', fontWeight: 700, color: '#2563eb' }}>Water Sources</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                <div style={{ fontSize: 15, color: '#2563eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Kaveri River:</span>
                  <span style={{ color: '#43e97b', fontWeight: 600 }}>{riverWaterAmount} units</span>
                </div>
                <div style={{ fontSize: 15, color: '#2563eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Groundwater:</span>
                  <span style={{ color: '#43e97b', fontWeight: 600 }}>{groundWaterAmount} units</span>
                </div>
              </div>
              */}
              {/* Data Status Indicator */}
              <div style={{ 
                marginBottom: 10, 
                padding: '8px 12px', 
                borderRadius: '8px', 
                background: buildings.length > 0 ? '#e8f5e8' : '#fff3cd',
                border: `1px solid ${buildings.length > 0 ? '#43e97b' : '#e67e22'}`,
                fontSize: '14px',
                color: buildings.length > 0 ? '#2e7d32' : '#e67e22',
                fontWeight: 600
              }}>
                📊 Data Status: {buildings.length > 0 ? 
                  `✅ Loaded (${buildings.length} buildings, ${totalWaterNeeded} units needed)` : 
                  '⚠️ Not loaded - Click "Refresh Data" or start simulation from admin dashboard'
                }
              </div>
              
              {/* Help message when no data */}
              {buildings.length === 0 && (
                <div style={{ 
                  marginBottom: 15, 
                  padding: '12px', 
                  borderRadius: '8px', 
                  background: '#e3f2fd',
                  border: '1px solid #2196f3',
                  fontSize: '13px',
                  color: '#1976d2',
                  lineHeight: '1.4'
                }}>
                  <strong>💡 How to get started:</strong><br/>
                  1. Go to Admin Dashboard<br/>
                  2. Click "Start Simulation" to load default building data<br/>
                  3. Return here and click "Refresh Data"<br/>
                  4. Run the comprehensive simulation with real data
                </div>
              )}
              <button
                style={{ marginBottom: 10, padding: '12px 0', fontSize: 18, borderRadius: 10, background: '#43e97b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 6px #43e97b22', width: '100%', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => setIsSimulating(s => !s)}
                title={isSimulating ? 'Stop the water flow simulation' : 'Start the water flow simulation'}
              >
                {isSimulating ? <FaStop /> : <FaPlay />} {isSimulating ? 'Stop Simulation' : 'Simulate Water Flow'}
              </button>
              <button
                style={{ marginBottom: 10, padding: '12px 0', fontSize: 18, borderRadius: 10, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 6px #2563eb22', width: '100%', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={startComprehensiveSimulation}
                disabled={isDeliveryRunning}
                title="Start comprehensive simulation with backend data"
              >
                {isDeliveryRunning ? (
                  <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    Running Simulation...
                  </>
                ) : (
                  <>🚰 Comprehensive Simulation</>
                )}
              </button>
              
              <button
                style={{ marginBottom: 10, padding: '12px 0', fontSize: 16, borderRadius: 10, background: '#e67e22', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 6px #e67e2222', width: '100%', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={async () => {
                  await fetchBuildingData();
                  await fetchWaterRequests();
                  await fetchDailyDistribution();
                  alert(`Data refreshed! Buildings: ${buildings.length}, Total Water Needed: ${totalWaterNeeded} units`);
                }}
                title="Refresh data from backend"
              >
                🔄 Refresh Data ({buildings.length} buildings)
              </button>
              
              <button
                style={{ marginBottom: 10, padding: '12px 0', fontSize: 16, borderRadius: 10, background: '#6c757d', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 6px #6c757d22', width: '100%', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => setCurrentPage('admin-dashboard')}
                title="Go back to admin dashboard"
              >
                ⬅️ Back to Admin Dashboard
              </button>
              
              <button
                style={{ marginBottom: 10, padding: '8px 0', fontSize: 14, borderRadius: 8, background: '#17a2b8', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 6px #17a2b822', width: '100%', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => {
                  console.log('=== Current State Debug ===');
                  console.log('Buildings:', buildings.length);
                  console.log('Total Water Needed:', totalWaterNeeded);
                  console.log('Token:', !!localStorage.getItem('token'));
                  console.log('Sample Building:', buildings[0]);
                  alert(`Debug Info:\nBuildings: ${buildings.length}\nTotal Water: ${totalWaterNeeded}\nLogged In: ${!!localStorage.getItem('token')}\nCheck console for details`);
                }}
                title="Debug current state"
              >
                🔍 Debug State
              </button>
            </>
          )}
          {selectedControl === 'Disruptions' && (
            <>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#2563eb', marginBottom: 6, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaBug style={{ color: '#e67e22' }} /> Disruption Simulation
              </div>
              
              {/* Disruption Type Selection */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 14, color: '#2563eb', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Disruption Type:
                </label>
                <select 
                  value={disruptionType || ''} 
                  onChange={(e) => setDisruptionType(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    border: '1.5px solid #e3f2fd', 
                    fontSize: 14,
                    background: 'white'
                  }}
                >
                  <option value="">Select disruption type...</option>
                  <option value="pipe_leak">Pipe Leak</option>
                  <option value="well_dry">Well Dry</option>
                  <option value="river_pollution">River Pollution</option>
                  <option value="pump_failure">Pump Failure</option>
                </select>
              </div>

              {/* Disruption Location Selection */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 14, color: '#2563eb', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Location:
                </label>
                <select 
                  value={disruptionLocation || ''} 
                  onChange={(e) => setDisruptionLocation(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    border: '1.5px solid #e3f2fd', 
                    fontSize: 14,
                    background: 'white'
                  }}
                >
                  <option value="">Select location...</option>
                  <option value="north_main">North Main Pipe</option>
                  <option value="south_main">South Main Pipe</option>
                  <option value="east_main">East Main Pipe</option>
                  <option value="west_main">West Main Pipe</option>
                  <option value="central_pump">Central Pump Station</option>
                  <option value="river_intake">River Intake Point</option>
                  <option value="groundwater_well">Groundwater Well</option>
                </select>
              </div>

              {/* Run Disruption Simulation Button */}
              <button 
                onClick={runDisruptionSimulation} 
                disabled={disruptionActive || !disruptionType || !disruptionLocation || (!baselineSimulationData && buildings.length === 0)}
                style={{
                  ...disruptionBtnStyle,
                  background: !disruptionType || !disruptionLocation || (!baselineSimulationData && buildings.length === 0) ? '#ccc' : '#e67e22',
                  color: !disruptionType || !disruptionLocation || (!baselineSimulationData && buildings.length === 0) ? '#666' : 'white',
                  cursor: !disruptionType || !disruptionLocation || (!baselineSimulationData && buildings.length === 0) ? 'not-allowed' : 'pointer'
                }}
                title={(!baselineSimulationData && buildings.length === 0) ? "Run comprehensive simulation first" : "Run disruption simulation"}
              >
                {disruptionActive ? (
                  <>
                    <div style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #fff', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 8 }}></div>
                    Running... {disruptionProgress}%
                  </>
                ) : (
                  <>
                    <FaBug style={{ marginRight: 8 }} />
                    Run Disruption Simulation
                  </>
                )}
              </button>

              {/* Baseline Warning */}
              {!baselineSimulationData && (
                <div style={{ 
                  marginTop: 8, 
                  padding: '8px 12px', 
                  background: '#fff3cd', 
                  borderRadius: 8, 
                  border: '1px solid #e67e22',
                  fontSize: 12,
                  color: '#e67e22'
                }}>
                  ⚠️ Run comprehensive simulation first to establish baseline
                </div>
              )}
              
              {/* Baseline Available */}
              {baselineSimulationData && (
                <div style={{ 
                  marginTop: 8, 
                  padding: '8px 12px', 
                  background: '#e8f5e8', 
                  borderRadius: 8, 
                  border: '1px solid #43e97b',
                  fontSize: 12,
                  color: '#43e97b'
                }}>
                  ✅ Baseline data available ({baselineSimulationData.buildings?.length || 0} buildings)
                </div>
              )}
            </>
          )}
          {/* <div style={{ margin: '18px 0 8px 0', fontWeight: 700, color: '#2563eb' }}>Water Sources</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 15, color: '#2563eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Kaveri River:</span>
              <span style={{ color: '#43e97b', fontWeight: 600 }}>{riverWaterAmount} units</span>
            </div>
            <div style={{ fontSize: 15, color: '#2563eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Groundwater:</span>
              <span style={{ color: '#43e97b', fontWeight: 600 }}>{groundWaterAmount} units</span>
            </div>
          </div> */}
        </div>
      </div>
      {/* Side status indicators (left and right) */}
      <div style={{ position: 'absolute', top: '30%', left: 24, zIndex: 10, background: 'rgba(255,255,255,0.7)', borderRadius: 14, boxShadow: '0 2px 16px #2563eb22', padding: 14, minWidth: 120, fontFamily: 'inherit', fontWeight: 600, color: '#2563eb', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <FaWater style={{ fontSize: 22, color: '#43e97b' }} />
        <span>Left Status</span>
        <span style={{ fontSize: 15, color: '#43e97b' }}>OK</span>
      </div>
      <div style={{ position: 'absolute', top: '30%', right: 24, zIndex: 10, background: 'rgba(255,255,255,0.7)', borderRadius: 14, boxShadow: '0 2px 16px #2563eb22', padding: 14, minWidth: 120, fontFamily: 'inherit', fontWeight: 600, color: '#2563eb', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <FaWater style={{ fontSize: 22, color: '#43e97b' }} />
        <span>Right Status</span>
        <span style={{ fontSize: 15, color: '#43e97b' }}>OK</span>
      </div>
      {/* Natural ground section */}
      <div style={{ width: '100vw', minHeight: 120, background: 'linear-gradient(0deg, #b7e0c2 0%, #e3f2fd 100%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: 'inherit', fontSize: 22, color: '#2563eb', fontWeight: 700, letterSpacing: 1, boxShadow: '0 -8px 32px #2563eb22' }}>
        <span style={{ marginBottom: 24 }}>Nature-inspired ground — CityResource AI Simulation Environment</span>
      </div>
      {/* Groundwater Source */}
      <div style={{ position: 'absolute', top: 100, left: 200, zIndex: 10, background: 'rgba(255,255,255,0.7)', borderRadius: 14, boxShadow: '0 2px 16px #2563eb22', padding: 14, minWidth: 120, fontFamily: 'inherit', fontWeight: 600, color: '#2563eb', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <FaWater style={{ fontSize: 22, color: '#43e97b' }} />
        <span>Groundwater Source</span>
        <span style={{ fontSize: 15, color: '#43e97b' }}>OK</span>
      </div>

      {/* Building Details Modal */}
      {showBuildingDetails && clickedBuilding && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setShowBuildingDetails(false)}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            maxWidth: '600px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px 16px',
              borderBottom: '1px solid #e3f2fd'
            }}>
              <h3 style={{ margin: 0, color: '#2563eb', fontSize: '22px', fontWeight: 700 }}>🏢 Building Details</h3>
              <button style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: '#666',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }} onClick={() => setShowBuildingDetails(false)}>×</button>
            </div>
            <div style={{ padding: '20px 24px 24px' }}>
              {(() => {
                const houses = housesByBuilding[clickedBuilding.id] || [];
                if (houses.length === 0) {
                  return <div style={{ color: '#888', fontSize: '16px', marginBottom: '18px' }}>Loading building data...</div>;
                }
                const totalPeople = houses.reduce((sum, h) => sum + (h.num_people || 0), 0);
                const totalWaterRequirement = houses.reduce((sum, h) => sum + (h.water_requirement || h.num_people * 175), 0);
                const allocation = buildingAllocations[clickedBuilding.id] || {};
                const requirementMet = allocation.total_water >= totalWaterRequirement;
                const satisfactionPercentage = totalWaterRequirement > 0 ? Math.round((allocation.total_water / totalWaterRequirement) * 100) : 0;
                const buildingNumber = buildings.findIndex(b => b.id === clickedBuilding.id) + 1;
                return (
                  <div>
                    {/* --- Summary Section --- */}
                    <div style={{ marginBottom: '18px', padding: '16px', background: '#e8f5e8', borderRadius: '10px', borderLeft: '5px solid #2563eb' }}>
                      <div style={{ fontSize: '16px', color: '#2563eb', fontWeight: 700, marginBottom: '6px' }}>🏢 Building Number: {buildingNumber}</div>
                      <div style={{ fontSize: '16px', color: '#2563eb', fontWeight: 700, marginBottom: '6px' }}>🏠 Houses in Building: {houses.length}</div>
                      <div style={{ fontSize: '16px', color: '#2563eb', fontWeight: 700, marginBottom: '6px' }}>👥 People in Building: {totalPeople}</div>
                      <div style={{ fontSize: '16px', color: '#2563eb', fontWeight: 700, marginBottom: '6px' }}>💧 Water Required: {totalWaterRequirement} L/day</div>
                      <div style={{ fontSize: '16px', color: '#43e97b', fontWeight: 700, marginBottom: '6px' }}>🚚 Water Delivered: {allocation.total_water || 0} L/day</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: requirementMet ? '#43e97b' : '#e67e22' }}>
                        {requirementMet ? '✅' : '❌'} {satisfactionPercentage}% satisfied
                      </div>
                      {allocation.extra_water > 0 && requirementMet && (
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#43e97b', marginTop: '6px' }}>
                          ✅ Extra water requirement satisfied!
                        </div>
                      )}
                    </div>
                    {/* --- End Summary Section --- */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px', marginBottom: '12px' }}>
                      <div><span style={{ color: '#666' }}>People:</span> <span style={{ fontWeight: 600, color: '#2563eb' }}>{totalPeople}</span></div>
                      <div><span style={{ color: '#666' }}>Requirement:</span> <span style={{ fontWeight: 600, color: '#2563eb' }}>{totalWaterRequirement} L/day</span></div>
                      <div><span style={{ color: '#666' }}>Delivered:</span> <span style={{ fontWeight: 600, color: '#43e97b' }}>{allocation.total_water || 0} L/day</span></div>
                      <div><span style={{ color: '#666' }}>River:</span> <span style={{ fontWeight: 600, color: '#3399ff' }}>{allocation.river_water || 0} L/day</span></div>
                      <div><span style={{ color: '#666' }}>Ground:</span> <span style={{ fontWeight: 600, color: '#00e6e6' }}>{allocation.ground_water || 0} L/day</span></div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 600, color: requirementMet ? '#43e97b' : '#e67e22' }}>
                      {requirementMet ? '✅' : '❌'} {satisfactionPercentage}% satisfied
                    </div>
                    {allocation.extra_water > 0 && requirementMet && (
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#43e97b', marginTop: '4px' }}>
                        ✅ Extra water requirement satisfied!
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Simulation Results Modal */}
      {showDeliveryResults && simulationResults && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setShowDeliveryResults(false)}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            maxWidth: '900px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px 16px',
              borderBottom: '1px solid #e3f2fd'
            }}>
              <h3 style={{ margin: 0, color: '#2563eb', fontSize: '24px', fontWeight: 700 }}>🎉 Comprehensive Simulation Results</h3>
              <button style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: '#666',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }} onClick={() => setShowDeliveryResults(false)}>×</button>
            </div>
            <div style={{ padding: '20px 24px 24px' }}>
              
              {/* System Overview */}
              <div style={{ marginBottom: '24px', padding: '20px', background: '#f8faff', borderRadius: '12px', borderLeft: '4px solid #2563eb' }}>
                <h4 style={{ color: '#2563eb', fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0' }}>📊 System Overview</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Total Buildings</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>{buildings.length}</div>
                  </div>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Total Water Needed</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#43e97b' }}>{totalWaterNeeded} units</div>
                  </div>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Available Water</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#3399ff' }}>{riverWaterAmount + groundWaterAmount} units</div>
                  </div>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>System Efficiency</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: simulationResults.efficiency_percentage >= 80 ? '#43e97b' : '#e67e22' }}>
                      {simulationResults.efficiency_percentage || 0}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Water Distribution Summary */}
              <div style={{ marginBottom: '24px', padding: '20px', background: '#f8faff', borderRadius: '12px', borderLeft: '4px solid #43e97b' }}>
                <h4 style={{ color: '#2563eb', fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0' }}>💧 Water Distribution Summary</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>River Water Delivered</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#3399ff' }}>{simulationResults.river_water || 0} units</div>
                  </div>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Groundwater Delivered</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#00e6e6' }}>{simulationResults.ground_water || 0} units</div>
                  </div>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Total Delivered</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#43e97b' }}>{simulationResults.total_delivered || 0} units</div>
                  </div>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Average per Building</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#43e97b' }}>
                      {buildings.length > 0 ? Math.round((simulationResults.total_delivered || 0) / buildings.length) : 0} units
                    </div>
                  </div>
                </div>
              </div>

              {/* Water Availability and Reservoir */}
              <div style={{ marginBottom: '24px', padding: '20px', background: '#f8faff', borderRadius: '12px', borderLeft: '4px solid #e67e22' }}>
                <h4 style={{ color: '#2563eb', fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0' }}>🌊 Water Availability & Reservoir</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Total Required</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>{simulationResults.total_required || 0} units</div>
                  </div>
                  <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Total Available</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#3399ff' }}>{simulationResults.total_available || 0} units</div>
                  </div>
                  {simulationResults.water_shortage > 0 && (
                    <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e67e22' }}>
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Water Shortage</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#e67e22' }}>{simulationResults.water_shortage || 0} units</div>
                    </div>
                  )}
                  {simulationResults.reservoir_storage > 0 && (
                    <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #43e97b' }}>
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Reservoir Storage</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#43e97b' }}>{simulationResults.reservoir_storage || 0} units</div>
                    </div>
                  )}
                </div>
                
                {/* Historical Reservoir Data */}
                {dailyDistribution.previous_day_reservoir > 0 && (
                  <div style={{ marginTop: '16px', padding: '12px', background: '#f0f8ff', borderRadius: '8px', border: '1px solid #87ceeb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '16px' }}>📅</span>
                      <span style={{ fontSize: '16px', fontWeight: 600, color: '#2563eb' }}>Previous Day Reservoir Data</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                      <div>
                        <span style={{ color: '#666' }}>Previous Reservoir:</span>
                        <span style={{ fontWeight: 600, color: '#43e97b', marginLeft: '8px' }}>{dailyDistribution.previous_day_reservoir} units</span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>Previous Shortage:</span>
                        <span style={{ fontWeight: 600, color: '#e67e22', marginLeft: '8px' }}>{dailyDistribution.previous_day_shortage} units</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Proportional Distribution Notice */}
                {simulationResults.proportional_distribution && (
                  <div style={{ marginTop: '16px', padding: '12px', background: '#e3f2fd', borderRadius: '8px', border: '1px solid #2563eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '16px' }}>📊</span>
                      <span style={{ fontSize: '16px', fontWeight: 600, color: '#2563eb' }}>Proportional Distribution Applied</span>
                    </div>
                    <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                      Due to insufficient water availability, all buildings received {Math.round(simulationResults.distribution_factor * 100)}% of their required water.
                    </p>
                    <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                      Distribution Factor: {simulationResults.distribution_factor?.toFixed(2) || 0}
                    </p>
                  </div>
                )}
              </div>

              {/* Approved Requests Summary */}
              {(approvedRequests.length > 0 || extraWaterRequests.length > 0 || eventWaterRequests.length > 0) && (
                <div style={{ marginBottom: '24px', padding: '20px', background: '#f8faff', borderRadius: '12px', borderLeft: '4px solid #e67e22' }}>
                  <h4 style={{ color: '#2563eb', fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0' }}>📋 Approved Requests Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    {approvedRequests.length > 0 && (
                      <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Total Approved Requests</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#43e97b' }}>{approvedRequests.length}</div>
                      </div>
                    )}
                    {extraWaterRequests.length > 0 && (
                      <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Extra Water Requests</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#e67e22' }}>{extraWaterRequests.length}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {extraWaterRequests.reduce((sum, req) => sum + req.water_amount, 0)} additional units
                        </div>
                      </div>
                    )}
                    {eventWaterRequests.length > 0 && (
                      <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e3f2fd' }}>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Event Requests</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#ff6b35' }}>{eventWaterRequests.length}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {eventWaterRequests.reduce((sum, req) => sum + req.water_amount, 0)} event units
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Building Allocation Details */}
              {Object.keys(buildingAllocations).length > 0 && (
                <div style={{ marginBottom: '24px', padding: '20px', background: '#f8faff', borderRadius: '12px', borderLeft: '4px solid #43e97b' }}>
                  <h4 style={{ color: '#2563eb', fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0' }}>🏢 Building Allocation Details</h4>
                  <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                      {Object.entries(buildingAllocations).slice(0, 20).map(([buildingId, allocation]) => {
                        const building = buildings.find(b => b.id == buildingId);
                        if (!building) return null;
                        const houses = housesByBuilding[building.id] || [];
                        const totalPeople = houses.reduce((sum, h) => sum + (h.num_people || 0), 0);
                        const totalWaterRequirement = houses.reduce((sum, h) => sum + (h.water_requirement || h.num_people * 175), 0);
                        const requirementMet = allocation.total_water >= totalWaterRequirement;
                        const satisfactionPercentage = totalWaterRequirement > 0 ? Math.round((allocation.total_water / totalWaterRequirement) * 100) : 0;
                        return (
                          <div key={buildingId} style={{
                            background: requirementMet ? '#e8f5e8' : '#fff3cd',
                            padding: '12px',
                            borderRadius: '8px',
                            border: `2px solid ${requirementMet ? '#43e97b' : '#e67e22'}`
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb', marginBottom: '8px' }}>
                              {building.building_name} ({building.building_code})
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                              <div><span style={{ color: '#666' }}>People:</span> <span style={{ fontWeight: 600, color: '#2563eb' }}>{totalPeople}</span></div>
                              <div><span style={{ color: '#666' }}>Requirement:</span> <span style={{ fontWeight: 600, color: '#2563eb' }}>{totalWaterRequirement} L/day</span></div>
                              <div><span style={{ color: '#666' }}>Delivered:</span> <span style={{ fontWeight: 600, color: '#43e97b' }}>{allocation.total_water} L/day</span></div>
                              {allocation.extra_water > 0 && (
                                <div><span style={{ color: '#666' }}>Extra Water:</span> <span style={{ fontWeight: 600, color: '#e67e22' }}>{allocation.extra_water} L/day</span></div>
                              )}
                              <div><span style={{ color: '#666' }}>River:</span> <span style={{ fontWeight: 600, color: '#3399ff' }}>{allocation.river_water || 0} L/day</span></div>
                              <div><span style={{ color: '#666' }}>Ground:</span> <span style={{ fontWeight: 600, color: '#00e6e6' }}>{allocation.ground_water || 0} L/day</span></div>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 600, color: requirementMet ? '#43e97b' : '#e67e22' }}>
                              {requirementMet ? '✅' : '❌'} {satisfactionPercentage}% satisfied
                            </div>
                            {allocation.extra_water > 0 && requirementMet && (
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#43e97b', marginTop: '4px' }}>
                                ✅ Extra water requirement satisfied!
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {Object.keys(buildingAllocations).length > 20 && (
                      <div style={{ marginTop: '12px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                        Showing first 20 buildings. Total: {Object.keys(buildingAllocations).length} buildings
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Recommendations */}
              <div style={{ marginBottom: '24px', padding: '20px', background: '#f8faff', borderRadius: '12px', borderLeft: '4px solid #2563eb' }}>
                <h4 style={{ color: '#2563eb', fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0' }}>
                  🤖 AI Recommendations
                  {isLoadingAi && <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>Loading...</span>}
                </h4>
                <div style={{ background: 'white', padding: '16px', borderRadius: '8px', whiteSpace: 'pre-line', fontSize: '14px', lineHeight: 1.6 }}>
                  {aiSuggestions || 'AI suggestions will appear here...'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
          <button
                  onClick={() => setShowDeliveryResults(false)}
                  style={{ flex: 1, padding: '12px', fontSize: '16px', borderRadius: '10px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
                  Close
          </button>
                <button
                  onClick={() => {
                    setShowDeliveryResults(false);
                    // Reset simulation
                  }}
                  style={{ flex: 1, padding: '12px', fontSize: '16px', borderRadius: '10px', background: '#43e97b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Reset Simulation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disruption Simulation Controls */}
      <div style={{ marginBottom: 20, padding: '20px', background: '#fff5f5', borderRadius: '12px', border: '2px solid #fed7d7' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#e53e3e', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🚨</span> Disruption Simulation
        </div>
        
        {disruptionActive ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#e53e3e', marginBottom: 10 }}>
              Simulating {disruptionType}...
            </div>
            <div style={{ 
              width: '100%', 
              height: '8px', 
              background: '#fed7d7', 
              borderRadius: '4px', 
              overflow: 'hidden',
              marginBottom: 10
            }}>
              <div style={{ 
                width: `${disruptionProgress}%`, 
                height: '100%', 
                background: '#e53e3e',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            <div style={{ fontSize: 14, color: '#666' }}>
              Progress: {disruptionProgress}%
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 15, lineHeight: 1.5 }}>
              Simulate different disruption scenarios to test system resilience and optimization strategies.
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: 15 }}>
              <button
                style={{ 
                  ...disruptionBtnStyle, 
                  background: disruptionType === 'pipeLeak' ? '#e53e3e' : '#f4f8ff',
                  color: disruptionType === 'pipeLeak' ? '#fff' : '#3399ff'
                }}
                onClick={() => runDisruptionSimulation()}
                disabled={disruptionActive}
              >
                🔧 Pipe Leak
              </button>
              <button
                style={{ 
                  ...disruptionBtnStyle, 
                  background: disruptionType === 'wellDry' ? '#e53e3e' : '#f4f8ff',
                  color: disruptionType === 'wellDry' ? '#fff' : '#3399ff'
                }}
                onClick={() => runDisruptionSimulation()}
                disabled={disruptionActive}
              >
                💧 Well Dry
              </button>
              <button
                style={{ 
                  ...disruptionBtnStyle, 
                  background: disruptionType === 'riverPollution' ? '#e53e3e' : '#f4f8ff',
                  color: disruptionType === 'riverPollution' ? '#fff' : '#3399ff'
                }}
                onClick={() => runDisruptionSimulation()}
                disabled={disruptionActive}
              >
                🌊 River Pollution
              </button>
              <button
                style={{ 
                  ...disruptionBtnStyle, 
                  background: disruptionType === 'pumpFailure' ? '#e53e3e' : '#f4f8ff',
                  color: disruptionType === 'pumpFailure' ? '#fff' : '#3399ff'
                }}
                onClick={() => runDisruptionSimulation()}
                disabled={disruptionActive}
              >
                ⚡ Pump Failure
              </button>
            </div>
            
            <button
              style={{ 
                width: '100%', 
                padding: '10px', 
                fontSize: 14, 
                borderRadius: '8px', 
                background: '#e2e8f0', 
                color: '#4a5568', 
                border: 'none', 
                cursor: 'pointer',
                fontWeight: 600
              }}
              onClick={() => {
                setDisruptionActive(false);
                setDisruptionType(null);
                setDisruptionLocation(null);
                setShowDisruptionResults(false);
                setDisruptionResults(null);
              }}
            >
              🔄 Reset Disruption
            </button>
          </div>
        )}
      </div>

      {/* Disruption Results Modal */}
      {showDisruptionResults && disruptionResults && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '25px',
              borderBottom: '2px solid #e53e3e',
              paddingBottom: '15px'
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#e53e3e' }}>
                🚨 Disruption Analysis Results
              </div>
              <button
                onClick={() => setShowDisruptionResults(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ✕
              </button>
            </div>

            {/* Disruption Summary */}
            <div style={{ marginBottom: '25px', padding: '20px', background: '#fff5f5', borderRadius: '12px' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#e53e3e', marginBottom: '15px' }}>
                📊 Disruption Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <strong>Type:</strong> {disruptionResults.disruptionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div>
                  <strong>Location:</strong> {disruptionResults.disruptionLocation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div>
                  <strong>Affected Buildings:</strong> {disruptionResults.affectedBuildings}/{disruptionResults.totalBuildings} ({((disruptionResults.affectedBuildings/disruptionResults.totalBuildings)*100).toFixed(1)}%)
                </div>
                <div>
                  <strong>Water Shortage:</strong> {disruptionResults.waterShortage} liters
                </div>
                <div>
                  <strong>Efficiency Loss:</strong> {disruptionResults.efficiencyLoss}%
                </div>
                <div>
                  <strong>Recovery Time:</strong> {disruptionResults.estimatedRecoveryTime} hours
                </div>
                <div>
                  <strong>Cost Impact:</strong> ₹{disruptionResults.costImpact}
                </div>
                <div>
                  <strong>Timestamp:</strong> {new Date(disruptionResults.timestamp).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Emergency Measures */}
            <div style={{ marginBottom: '25px', padding: '20px', background: '#fff5f5', borderRadius: '12px' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#e53e3e', marginBottom: '15px' }}>
                🚨 Emergency Measures
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {disruptionResults.emergencyMeasures.map((measure, index) => (
                  <div key={index} style={{ 
                    padding: '8px 12px', 
                    background: '#fff', 
                    borderRadius: '6px', 
                    border: '1px solid #fed7d7',
                    fontSize: '14px'
                  }}>
                    • {measure}
                  </div>
                ))}
              </div>
            </div>

            {/* Affected Infrastructure */}
            <div style={{ marginBottom: '25px', padding: '20px', background: '#fff5f5', borderRadius: '12px' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#e53e3e', marginBottom: '15px' }}>
                🔧 Affected Infrastructure
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {brokenPipes.map((pipe, index) => (
                  <div key={index} style={{ 
                    padding: '8px 12px', 
                    background: '#fff', 
                    borderRadius: '6px', 
                    border: '1px solid #fed7d7',
                    fontSize: '14px',
                    color: '#e53e3e',
                    fontWeight: 600
                  }}>
                    ⚠️ {pipe.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                ))}
              </div>
            </div>

            {/* Optimization Results */}
            <div style={{ marginBottom: '25px' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#2563eb', marginBottom: '15px' }}>
                ⚙️ Disruption Impact Analysis
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Impact Assessment */}
                <div style={{ padding: '15px', background: '#f0f8ff', borderRadius: '8px' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#2563eb', marginBottom: '10px' }}>
                    📊 Impact Assessment
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                    <div><strong>Affected Buildings:</strong> {disruptionResults.affectedBuildings}</div>
                    <div><strong>Water Shortage:</strong> {disruptionResults.waterShortage} liters</div>
                    <div><strong>Efficiency Loss:</strong> {disruptionResults.efficiencyLoss}%</div>
                    <div><strong>Recovery Time:</strong> {disruptionResults.estimatedRecoveryTime} hours</div>
                  </div>
                </div>

                {/* Cost Analysis */}
                <div style={{ padding: '15px', background: '#f0fff4', borderRadius: '8px' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#38a169', marginBottom: '10px' }}>
                    💰 Cost Analysis
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                    <div><strong>Direct Cost Impact:</strong> ₹{disruptionResults.costImpact}</div>
                    <div><strong>Infrastructure Damage:</strong> ₹{Math.round(disruptionResults.costImpact * 0.3)}</div>
                    <div><strong>Emergency Response:</strong> ₹{Math.round(disruptionResults.costImpact * 0.2)}</div>
                    <div><strong>Total Estimated Cost:</strong> ₹{Math.round(disruptionResults.costImpact * 1.5)}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '15px', padding: '12px', background: '#e6fffa', borderRadius: '8px', border: '1px solid #81e6d9' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#319795' }}>
                  🎯 Priority Actions: Immediate response required for {disruptionResults.affectedBuildings} affected buildings
                </div>
              </div>
            </div>

            {/* AI Suggestions */}
            <div style={{ marginBottom: '25px' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#805ad5', marginBottom: '15px' }}>
                🤖 AI Recommendations
              </div>
              <div style={{ 
                padding: '15px', 
                background: '#faf5ff', 
                borderRadius: '8px', 
                border: '1px solid #d6bcfa',
                whiteSpace: 'pre-line',
                fontSize: '14px',
                lineHeight: '1.6',
                maxHeight: '300px',
                overflow: 'auto'
              }}>
                {optimizationSuggestions || 'AI recommendations will appear here...'}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDisruptionResults(false)}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  borderRadius: '8px',
                  background: '#e2e8f0',
                  color: '#4a5568',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  // Export results
                  const resultsData = {
                    disruption: disruptionResults,
                    timestamp: new Date().toISOString(),
                    optimization_suggestions: optimizationSuggestions
                  };
                  const dataStr = JSON.stringify(resultsData, null, 2);
                  const dataBlob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(dataBlob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `disruption_analysis_${disruptionResults.disruptionType}_${new Date().toISOString().split('T')[0]}.json`;
                  link.click();
                }}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                📥 Export Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

function MainApp() {
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [totalWaterNeeded, setTotalWaterNeeded] = useState(0);
  const [waterRequests, setWaterRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [extraWaterRequests, setExtraWaterRequests] = useState([]);
  const [eventWaterRequests, setEventWaterRequests] = useState([]);
  const [dailyDistribution, setDailyDistribution] = useState(null);
  const [simulationResults, setSimulationResults] = useState({});
  const [buildingAllocations, setBuildingAllocations] = useState({});
  const [aiSuggestions, setAiSuggestions] = useState('');
  const [showDeliveryResults, setShowDeliveryResults] = useState(false);
  const [isDeliveryRunning, setIsDeliveryRunning] = useState(false);
  const [deliveryProgress, setDeliveryProgress] = useState(0);
  const [disruptions, setDisruptions] = useState({
    pipeLeak: false,
    wellDry: false,
    riverPollution: false,
    pumpFailure: false
  });
  const [riverWaterAmount, setRiverWaterAmount] = useState(1000);
  const [groundWaterAmount, setGroundWaterAmount] = useState(1000);

  // TODO: Add fallback building data here

  // Building instances array for disruption effects
  const buildingInstances = useRef([]);

  // Fallback building data (160 buildings)
  const fallbackBuildingData = Array.from({ length: 160 }, (_, i) => {
    const numPeople = 65 + (i % 50); // Base of 65 people, varying up to 115 per building
    return {
      id: i + 1,
      building_name: `Building ${i + 1}`,
      building_code: `BLD${String(i + 1).padStart(3, '0')}`,
      water_requirement: numPeople * 175, // 175L per person
      preferred_source: 'both',
      river_water_ratio: 60,
      ground_water_ratio: 40,
      apartments: 11 + (i % 10), // 11-20 apartments per building
      priority: 1 + (i % 3),
      is_active: 1,
      num_people: numPeople // Store the number of people for reference
    };
  });

  const [housesByBuilding, setHousesByBuilding] = useState({});

  // After fetching all houses, update each building's water_requirement
  const updateBuildingsWithHouseRequirements = (buildings, housesByBuilding) => {
    return buildings.map(b => {
      const houses = housesByBuilding[b.id] || [];
      const totalPeople = houses.reduce((sum, h) => sum + (h.num_people || 0), 0);
      const total = houses.reduce((sum, h) => sum + (h.water_requirement || h.num_people * 175), 0);
      return { 
        ...b, 
        water_requirement: total || (totalPeople * 175), // Use 175L per person if no specific requirement
        num_people: totalPeople
      };
    });
  }

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2200); // Loader for 2.2s
    
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } else {
      setShowLogin(true);
    }
    
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setShowLogin(true);
  };

  if (loading) return <Loader />;

  // Show login/signup if not authenticated
  if (showLogin || !user) {
    return <Login onLogin={handleLogin} />;
  }

  // Show appropriate dashboard based on user type
  if (user.user_type === 'admin') {
    return (
      <Router>
        <Routes>
          <Route path="/" element={<AdminDashboard user={user} onLogout={handleLogout} />} />
          <Route path="/simulation" element={<SimulationPage />} />
        </Routes>
      </Router>
    );
  } else if (user.user_type === 'building') {
    return (
      <Router>
        <BuildingDashboard user={user} onLogout={handleLogout} />
      </Router>
    );
  }

  // Fallback to main app with navigation
  return (
    <Router>
      <Navbar user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="/models" element={<Models />} />
        <Route path="/admin" element={<AdminDashboard user={user} onLogout={handleLogout} />} />
        <Route path="/building" element={<BuildingDashboard user={user} onLogout={handleLogout} />} />
      </Routes>
    </Router>
  );
}

export default MainApp;