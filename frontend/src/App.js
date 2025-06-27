import React, { useEffect, useRef, useState } from 'react';
import { FaBug, FaCog, FaExclamationTriangle, FaPlay, FaRedo, FaStop, FaTint, FaTools, FaWater, FaWind } from 'react-icons/fa';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Loader from './components/Loader';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Models from './components/Models';

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

  // Instanced mesh references
  let dropletInstancedMesh = null;
  let trailInstancedMesh = null;

  // Helper to trigger disruptions (update)
  function triggerDisruption(type) {
    setDisruptions(d => {
      if (type === 'reset') return { pipeLeak: false, wellDry: false, riverPollution: false, pumpFailure: false };
      return { ...d, [type]: !d[type] };
    });
  }

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
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const pos = new THREE.Vector3(startX + col * spacing, 12, startZ + row * spacing);
        // Skip if building center is inside park bounds
        if (
          pos.x > parkMinX && pos.x < parkMaxX &&
          pos.z > parkMinZ && pos.z < parkMaxZ
        ) continue;
        
        // Determine water source based on building position
        // Buildings closer to the river (left side) use river water
        // Buildings further from the river (right side) use groundwater
        const riverThreshold = startX + (gridCols / 2) * spacing; // Middle of the grid
        const usesRiver = pos.x < riverThreshold;
        
        if (usesRiver) {
          riverBuildings++;
          buildingWaterSources.push('river');
        } else {
          groundBuildings++;
          buildingWaterSources.push('ground');
        }
        
        buildingPositions.push(pos);
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
        scene.add(bldg);
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
          new THREE.MeshPhysicalMaterial({ color: 0x654321, roughness: 0.5, metalness: 0.2, clearcoat: 0.2 })
        );
        door.position.copy(pos).add(new THREE.Vector3(0, -height / 2 + doorH / 2, depth / 2 + 0.8 * scaleUp * buildingScale));
        scene.add(door);
        // Door frame
        const doorFrame = new THREE.Mesh(
          new THREE.BoxGeometry(doorW + 1.2 * scaleUp, doorH + 1.2 * scaleUp, 0.5 * scaleUp * buildingScale),
          new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4 })
        );
        doorFrame.position.copy(door.position).add(new THREE.Vector3(0, 0, 0.7 * scaleUp * buildingScale));
        scene.add(doorFrame);
        // Windows (3-5 rows x 3-5 columns, random pattern)
        const winRows = 3 + Math.floor(Math.random() * 3);
        const winCols = 3 + Math.floor(Math.random() * 3);
        for (let wy = 0; wy < winRows; wy++) {
          for (let wx = -Math.floor(winCols / 2); wx <= Math.floor(winCols / 2); wx++) {
            // Window frame
            const frame = new THREE.Mesh(
              new THREE.BoxGeometry(3.2 * scaleUp * buildingScale, 4.2 * scaleUp * buildingScale, 0.5 * scaleUp * buildingScale),
              new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 })
            );
            frame.position.copy(pos).add(new THREE.Vector3(wx * 6 * scaleUp * buildingScale, 10 * scaleUp * buildingScale + wy * 7 * scaleUp * buildingScale, depth / 2 + 1.1 * scaleUp * buildingScale));
            scene.add(frame);
            // Window glass (glow at night)
            const glass = new THREE.Mesh(
              new THREE.BoxGeometry(2.2 * scaleUp * buildingScale, 3.2 * scaleUp * buildingScale, 0.7 * scaleUp * buildingScale),
              new THREE.MeshPhysicalMaterial({
                color: 0x87ceeb,
                metalness: 0.25,
                roughness: 0.12,
                transmission: 0.7,
                opacity: 0.92,
                transparent: true,
                emissive: Math.random() < 0.5 ? 0x222244 : 0xf7e97c,
                emissiveIntensity: Math.random() < 0.5 ? 0.18 : 0.45
              })
            );
            glass.position.copy(frame.position).add(new THREE.Vector3(0, 0, 0.2 * scaleUp * buildingScale));
            scene.add(glass);
          }
        }
        // Rooftop details
        if (Math.random() < 0.5) {
          // Water tank
          const tank = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2 * scaleUp * buildingScale, 2.2 * scaleUp * buildingScale, 4.5 * scaleUp * buildingScale, 18),
            new THREE.MeshPhysicalMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.7 })
          );
          tank.position.copy(pos).setY(height + 4.5 * scaleUp * buildingScale);
          scene.add(tank);
        }
        if (Math.random() < 0.3) {
          // Solar panel
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(7 * scaleUp * buildingScale, 0.6 * scaleUp * buildingScale, 4.5 * scaleUp * buildingScale),
            new THREE.MeshPhysicalMaterial({ color: 0x2222aa, roughness: 0.22, metalness: 0.85, clearcoat: 0.5 })
          );
          panel.position.copy(pos).setY(height + 2.8 * scaleUp * buildingScale);
          panel.rotation.x = -Math.PI / 8;
          scene.add(panel);
        }
        if (Math.random() < 0.25) {
          // AC unit
          const ac = new THREE.Mesh(
            new THREE.BoxGeometry(2.2 * scaleUp * buildingScale, 1.4 * scaleUp * buildingScale, 1.4 * scaleUp * buildingScale),
            new THREE.MeshPhysicalMaterial({ color: 0xe0e0e0, roughness: 0.6, metalness: 0.3 })
          );
          ac.position.copy(pos).setY(height + 2.2 * scaleUp * buildingScale).add(new THREE.Vector3(3.5 * scaleUp * buildingScale, 0, 0));
          scene.add(ac);
        }
        if (Math.random() < 0.18) {
          // Rooftop railing
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(width - 2.5 * scaleUp * buildingScale, 0.6 * scaleUp * buildingScale, 0.6 * scaleUp * buildingScale),
            new THREE.MeshStandardMaterial({ color: 0x888888 })
          );
          rail.position.copy(pos).setY(height + 3.2 * scaleUp * buildingScale).add(new THREE.Vector3(0, 0, depth / 2 - 0.4 * scaleUp * buildingScale));
          scene.add(rail);
        }
        // Balconies/ledges
        if (Math.random() < 0.32) {
          for (let by = 0; by < 2; by++) {
            const balcony = new THREE.Mesh(
              new THREE.BoxGeometry(7 * scaleUp * buildingScale, 0.9 * scaleUp * buildingScale, 2.7 * scaleUp * buildingScale),
              new THREE.MeshPhysicalMaterial({ color: 0xb0b0b0, roughness: 0.5, metalness: 0.2 })
            );
            balcony.position.copy(pos).add(new THREE.Vector3(0, 12 * scaleUp * buildingScale + by * 12 * scaleUp * buildingScale, depth / 2 + 1.5 * scaleUp * buildingScale));
            scene.add(balcony);
            // Balcony railing
            const bRail = new THREE.Mesh(
              new THREE.BoxGeometry(7 * scaleUp * buildingScale, 0.4 * scaleUp * buildingScale, 0.4 * scaleUp * buildingScale),
              new THREE.MeshStandardMaterial({ color: 0x888888 })
            );
            bRail.position.copy(balcony.position).add(new THREE.Vector3(0, 0.6 * scaleUp * buildingScale, 1.2 * scaleUp * buildingScale));
            scene.add(bRail);
          }
        }
        // Roof style: sometimes add a sloped or gabled roof
        if (Math.random() < 0.22) {
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(width * 0.55, 8 * scaleUp * buildingScale, 4 + Math.floor(Math.random() * 4)),
            new THREE.MeshPhysicalMaterial({ color: 0x7c4a02, roughness: 0.5, metalness: 0.2 })
          );
          roof.position.copy(pos).setY(height + 4 * scaleUp * buildingScale);
          scene.add(roof);
        }
        // For each building:
        let source, label, waterSupplied;
        if (usesRiver) {
          source = 'Kaveri River';
          waterSupplied = riverBuildings > 0 ? (riverWaterAmount / riverBuildings).toFixed(1) : 0;
        } else {
          source = 'Groundwater';
          waterSupplied = groundBuildings > 0 ? (groundWaterAmount / groundBuildings).toFixed(1) : 0;
        }
        // Position label above the building (above the actual building height)
        const labelPosition = pos.clone().setY(height + 20 * scaleUp * buildingScale);
        createLabel(`${waterSupplied} units from ${source}`, labelPosition, scene);
      }
    }
    
    // Connect buildings to water sources
    buildingPositions.forEach((buildingPos, index) => {
      const waterSource = buildingWaterSources[index];
      let sourcePos;
      
      if (waterSource === 'river') {
        // Connect to Kaveri River (left side)
        sourcePos = new THREE.Vector3(-480 * scaleUp, 2, buildingPos.z);
      } else {
        // Connect to Groundwater Source (aquifer)
        sourcePos = new THREE.Vector3(600 * scaleUp, 2, -600 * scaleUp);
      }
      
      // Connect building to water source
      addWaterPipe(sourcePos, buildingPos, waterSource, 'building');
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

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      if (mountRef.current && renderer.domElement && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      stopSimulation();
      pipesRef.current = [];
    };
  }, [isSimulating, disruptions, showWaterConnections, riverWaterAmount, groundWaterAmount]);

  // --- Refactored layout: simulation canvas, then controls, then ground section ---
  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#e3f2fd', position: 'relative' }}>
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
              <button
                style={{ marginBottom: 10, padding: '12px 0', fontSize: 18, borderRadius: 10, background: '#43e97b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 6px #43e97b22', width: '100%', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => setIsSimulating(s => !s)}
                title={isSimulating ? 'Stop the water flow simulation' : 'Start the water flow simulation'}
              >
                {isSimulating ? <FaStop /> : <FaPlay />} {isSimulating ? 'Stop Simulation' : 'Simulate Water Flow'}
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
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2200); // Loader for 2.2s
    return () => clearTimeout(timer);
  }, []);
  if (loading) return <Loader />;
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route path="/models" element={<Models />} />
      </Routes>
    </Router>
  );
}

export default MainApp;
