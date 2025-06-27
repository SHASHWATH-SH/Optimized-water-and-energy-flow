import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

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
  // Modern floating label using Sprite
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 28px Segoe UI, Arial';
  ctx.fillStyle = '#222';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 44);
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(32, 8, 1);
  sprite.position.copy(position.clone().add(new THREE.Vector3(0, 20, 0)));
  scene.add(sprite);
}

function App() {
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
  const pipesRef = useRef([]); // Store pipe data for simulation
  const dropletsRef = useRef([]); // Store droplet meshes
  const buildingPipeIndices = useRef([]); // Store building pipe indices

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
    scene.background = new THREE.Color(0xbfefff);

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
    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(80, 180, 80);
    light.castShadow = true;
    scene.add(light);
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    const scaleUp = 1.4; // 40% larger for realism
    const buildingScale = 2.0; // Double building size for realism
    const spacing = 60 * scaleUp * 1.5; // Increase grid spacing by 50% for less congestion
    // --- Realistic and beautiful 16x12 city grid (doubled area, scaled up, more open) ---
    const gridRows = 12, gridCols = 16; // Wider city
    // Shift grid center to the left so buildings are near the river but not overlapping
    const startX = 200 + -((gridCols - 1) * spacing) / 2;
    const startZ = -((gridRows - 1) * spacing) / 2;
    // Ground (solid grass color, much larger)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: 0x8fd694, roughness: 0.7 })
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
    createLabel('Cauvery River', new THREE.Vector3(-500 * scaleUp * riverScale, 6, 0), scene);
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
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const pos = new THREE.Vector3(startX + col * spacing, 12, startZ + row * spacing);
        // Skip if building center is inside park bounds
        if (
          pos.x > parkMinX && pos.x < parkMaxX &&
          pos.z > parkMinZ && pos.z < parkMaxZ
        ) continue;
        buildingPositions.push(pos);
        const width = (18 + Math.random() * 4) * scaleUp * buildingScale;
        const depth = (18 + Math.random() * 4) * scaleUp * buildingScale;
        const height = (22 + Math.random() * 36) * scaleUp * buildingScale;
        const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const bldg = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 })
        );
        bldg.position.copy(pos).setY(height / 2 + 1);
        bldg.castShadow = true;
        bldg.receiveShadow = true;
        scene.add(bldg);
        // Main door
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(4 * scaleUp * buildingScale, 8 * scaleUp * buildingScale, 1.5 * scaleUp * buildingScale),
          new THREE.MeshStandardMaterial({ color: 0x654321 })
        );
        door.position.copy(pos).add(new THREE.Vector3(0, -height / 2 + 4 * scaleUp * buildingScale, depth / 2 + 0.8 * scaleUp * buildingScale));
        scene.add(door);
        // Windows (3 rows x 3 columns)
        for (let wy = 0; wy < 3; wy++) {
          for (let wx = -1; wx <= 1; wx++) {
            const windowMesh = new THREE.Mesh(
              new THREE.BoxGeometry(2.5 * scaleUp * buildingScale, 3 * scaleUp * buildingScale, 0.7 * scaleUp * buildingScale),
              new THREE.MeshStandardMaterial({ color: 0x87ceeb, metalness: 0.1, roughness: 0.2, emissive: 0x222244, emissiveIntensity: 0.15 })
            );
            windowMesh.position.copy(pos).add(new THREE.Vector3(wx * 5 * scaleUp * buildingScale, 8 * scaleUp * buildingScale + wy * 7 * scaleUp * buildingScale, depth / 2 + 0.8 * scaleUp * buildingScale));
            scene.add(windowMesh);
          }
        }
        // Rooftop details
        if (Math.random() < 0.4) {
          // Water tank
          const tank = new THREE.Mesh(
            new THREE.CylinderGeometry(2 * scaleUp * buildingScale, 2 * scaleUp * buildingScale, 4 * scaleUp * buildingScale, 16),
            new THREE.MeshStandardMaterial({ color: 0xcccccc })
          );
          tank.position.copy(pos).setY(height + 4 * scaleUp * buildingScale);
          scene.add(tank);
        }
        if (Math.random() < 0.2) {
          // Solar panel
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(6 * scaleUp * buildingScale, 0.5 * scaleUp * buildingScale, 4 * scaleUp * buildingScale),
            new THREE.MeshStandardMaterial({ color: 0x2222aa, roughness: 0.3, metalness: 0.7 })
          );
          panel.position.copy(pos).setY(height + 2.5 * scaleUp * buildingScale);
          panel.rotation.x = -Math.PI / 8;
          scene.add(panel);
        }
        if (Math.random() < 0.2) {
          // AC unit
          const ac = new THREE.Mesh(
            new THREE.BoxGeometry(2 * scaleUp * buildingScale, 1.2 * scaleUp * buildingScale, 1.2 * scaleUp * buildingScale),
            new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.6 })
          );
          ac.position.copy(pos).setY(height + 2 * scaleUp * buildingScale).add(new THREE.Vector3(3 * scaleUp * buildingScale, 0, 0));
          scene.add(ac);
        }
        if (Math.random() < 0.15) {
          // Rooftop railing
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(width - 2 * scaleUp * buildingScale, 0.5 * scaleUp * buildingScale, 0.5 * scaleUp * buildingScale),
            new THREE.MeshStandardMaterial({ color: 0x888888 })
          );
          rail.position.copy(pos).setY(height + 2.8 * scaleUp * buildingScale).add(new THREE.Vector3(0, 0, depth / 2 - 0.3 * scaleUp * buildingScale));
          scene.add(rail);
        }
        // Balconies/ledges
        if (Math.random() < 0.25) {
          for (let by = 0; by < 2; by++) {
            const balcony = new THREE.Mesh(
              new THREE.BoxGeometry(6 * scaleUp * buildingScale, 0.7 * scaleUp * buildingScale, 2.2 * scaleUp * buildingScale),
              new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.5 })
            );
            balcony.position.copy(pos).add(new THREE.Vector3(0, 10 * scaleUp * buildingScale + by * 10 * scaleUp * buildingScale, depth / 2 + 1.2 * scaleUp * buildingScale));
            scene.add(balcony);
          }
        }
        createLabel(`Building (${row + 1},${col + 1})`, bldg.position, scene);
      }
    }
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
      const pipe = createCylinder(from, to, 2.5 * scaleUp, 0x3399ff, 0.8, 0.8, 0.2);
      pipe.material.emissive = new THREE.Color(0x3399ff);
      pipe.material.emissiveIntensity = 0.12;
      pipe.material.metalness = 0.7;
      scene.add(pipe);
      pipesRef.current.push({ from: from.clone(), to: to.clone(), pipe, sourceType, type });
    }
    // Assign water source to each building and connect with pipes
    for (let i = 0; i < buildingPositions.length; i++) {
      const pos = buildingPositions[i];
      const col = Math.round((pos.x - startX) / spacing);
      let source, label, sourceType;
      if (col <= 1) {
        source = new THREE.Vector3(-500 * scaleUp * riverScale, 2, 0);
        label = 'From Cauvery';
        sourceType = 'river';
      } else {
        source = getQuadrantWell(pos);
        label = 'From Well';
        sourceType = 'well';
      }
      addWaterPipe(source, pos, sourceType, 'building');
      buildingPipeIndices.current.push(pipesRef.current.length - 1);
      createLabel(`Building (${label})`, pos, scene);
    }
    // Connect park to center well only
    const parkSource = wellPositions[4];
    addWaterPipe(parkSource, parkCenter, 'well', 'park');
    createLabel('Central Park (From Well)', parkCenter, scene);

    // --- Water Flow Simulation ---
    function startSimulation() {
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
          const droplet = new THREE.Mesh(
            new THREE.SphereGeometry(2.5 * scaleUp, 18, 18), // larger, more visible
            new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 })
          );
          // Stagger droplets along the pipe
          const t = i / numDroplets;
          droplet.position.lerpVectors(from, to, t);
          scene.add(droplet);
          dropletsRef.current.push({ mesh: droplet, from, to, t, offset: t });
          dropletCount++;
        }
        // Add ripple at destination
        if (visible) {
          const ripple = new THREE.Mesh(
            new THREE.RingGeometry(2 * scaleUp, 3.5 * scaleUp, 32),
            new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.25 })
          );
          ripple.position.copy(to).add(new THREE.Vector3(0, 2 * scaleUp, 0));
          ripple.rotation.x = -Math.PI / 2;
          scene.add(ripple);
          setTimeout(() => scene.remove(ripple), 1200);
        }
      });
      console.log('Droplets created:', dropletCount);
    }
    function stopSimulation() {
      dropletsRef.current.forEach(d => scene.remove(d.mesh));
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
        dropletsRef.current.forEach(droplet => {
          droplet.t += speed;
          if (droplet.t > 1) droplet.t -= 1; // Loop
          droplet.mesh.position.lerpVectors(droplet.from, droplet.to, droplet.t);
          // Optional: pulse effect
          const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200 + droplet.offset * Math.PI * 2);
          droplet.mesh.material.opacity = 0.5 + 0.5 * pulse;
        });
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
      mountRef.current.removeChild(renderer.domElement);
      stopSimulation();
      pipesRef.current = [];
    };
  }, [isSimulating, disruptions]);

  return (
    <div>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
      {/* Floating status box */}
      <div style={{
        position: 'fixed', top: 24, left: 24, zIndex: 10,
        background: 'rgba(255,255,255,0.96)', padding: 18, borderRadius: 14,
        boxShadow: '0 2px 16px #0002', fontFamily: 'Segoe UI, Arial',
        minWidth: 220, maxWidth: 320, fontSize: 17, fontWeight: 500,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: 8, border: '1.5px solid #e0e0e0',
        backdropFilter: 'blur(3px)'
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#3399ff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span role="img" aria-label="status">💧</span> System Status
        </span>
        <span style={{ fontSize: 16, marginTop: 2 }}>Water: <span style={{ color: '#3399ff', fontWeight: 600 }}>OK</span></span>
      </div>
      {/* Modern right sidebar for controls */}
      {!showControls && (
        <button
          style={{
            position: 'fixed', top: 32, right: 32, zIndex: 30,
            padding: '18px 36px', fontSize: 20, borderRadius: 12, background: '#3399ff', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 12px #3399ff22'
          }}
          onClick={() => setShowControls(true)}
        >
          ⚙️ Show Controls
        </button>
      )}
      {showControls && (
        <div style={{
          position: 'fixed', top: 0, right: 0, height: '100vh', width: 320, zIndex: 20,
          background: 'rgba(255,255,255,0.98)', boxShadow: '-2px 0 16px #0002',
          padding: '32px 24px 24px 24px', display: 'flex', flexDirection: 'column',
          gap: 24, borderTopLeftRadius: 24, borderBottomLeftRadius: 24,
          borderLeft: '1.5px solid #e0e0e0',
          backdropFilter: 'blur(4px)'
        }}>
          {/* Segmented control for selecting section */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <button
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 16,
                borderRadius: 8,
                background: selectedControl === 'Water Flow' ? '#3399ff' : '#f4f8ff',
                color: selectedControl === 'Water Flow' ? '#fff' : '#3399ff',
                border: selectedControl === 'Water Flow' ? '2px solid #3399ff' : '1.5px solid #cce0ff',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s',
                outline: 'none',
              }}
              onClick={() => setSelectedControl('Water Flow')}
            >
              💧 Water Flow
            </button>
            <button
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 16,
                borderRadius: 8,
                background: selectedControl === 'Disruptions' ? '#3399ff' : '#f4f8ff',
                color: selectedControl === 'Disruptions' ? '#fff' : '#3399ff',
                border: selectedControl === 'Disruptions' ? '2px solid #3399ff' : '1.5px solid #cce0ff',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s',
                outline: 'none',
              }}
              onClick={() => setSelectedControl('Disruptions')}
            >
              🚨 Disruptions
            </button>
          </div>
          {/* Section content */}
          {selectedControl === 'Water Flow' && (
            <>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#222', marginBottom: 8, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span role="img" aria-label="controls">⚙️</span> Simulation Controls
              </div>
              <button
                style={{ marginBottom: 10, padding: '12px 0', fontSize: 18, borderRadius: 8, background: '#3399ff', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 6px #3399ff22', width: '100%', transition: 'background 0.2s' }}
                onClick={() => setIsSimulating(s => !s)}
              >
                {isSimulating ? '⏹️ Stop Simulation' : '▶️ Simulate Water Flow'}
              </button>
            </>
          )}
          {selectedControl === 'Disruptions' && (
            <>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#444', marginBottom: 6, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span role="img" aria-label="disruptions">🚨</span> Disruptions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={() => triggerDisruption('pipeLeak')} style={disruptionBtnStyle}>🚧 Pipe Leak</button>
                <button onClick={() => triggerDisruption('wellDry')} style={disruptionBtnStyle}>💧 Well Dry</button>
                <button onClick={() => triggerDisruption('riverPollution')} style={disruptionBtnStyle}>🟤 River Pollution</button>
                <button onClick={() => triggerDisruption('pumpFailure')} style={disruptionBtnStyle}>⚡ Pump Failure</button>
                <button onClick={() => triggerDisruption('reset')} style={{ ...disruptionBtnStyle, background: '#eee', color: '#333', fontWeight: 500 }}>🔄 Reset Disruptions</button>
              </div>
            </>
          )}
          <button
            style={{ marginTop: 32, width: '100%', padding: '10px 0', fontSize: 16, borderRadius: 8, background: '#eee', color: '#3399ff', border: '1.5px solid #cce0ff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 4px #3399ff11' }}
            onClick={() => setShowControls(false)}
          >
            ❌ Hide Controls
          </button>
          <div style={{ marginTop: 'auto', fontSize: 14, color: '#888', textAlign: 'center' }}>
            <span>Optimized Water & Energy Flow<br />Simulation UI</span>
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

export default App;
