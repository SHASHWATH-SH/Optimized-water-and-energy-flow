import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Helper to create a cylinder (pipe or power line)
function createCylinder(start, end, radius, color) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const orientation = new THREE.Matrix4();
  orientation.lookAt(start, end, new THREE.Object3D().up);
  orientation.multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const cylinderGeom = new THREE.CylinderGeometry(radius, radius, direction.length(), 16);
  const material = new THREE.MeshPhongMaterial({ color });
  const cylinder = new THREE.Mesh(cylinderGeom, material);
  cylinder.applyMatrix4(orientation);
  cylinder.position.copy(start).add(direction.multiplyScalar(0.5));
  return cylinder;
}

// Helper to create a static 3D text label
function createLabel(text, position, scene) {
  // Use Three.js built-in TextGeometry (requires three/examples/jsm/geometries/TextGeometry and a font)
  // For simplicity, use a basic box as a placeholder label if font loader is not set up
  // You can replace this with TextGeometry if you add the font loader
  const label = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.5, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  label.position.copy(position.clone().add(new THREE.Vector3(0, 6, 0)));
  scene.add(label);
  return label;
}

function createCity(scene, state, objects, labels, buildingPositions) {
  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshPhongMaterial({ color: 0x88cc88 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // River (Cauvery) with animated texture
  const riverTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/water.jpg');
  riverTexture.wrapS = riverTexture.wrapT = THREE.RepeatWrapping;
  const riverMaterial = new THREE.MeshPhongMaterial({ color: 0x3366ff, map: riverTexture, transparent: true, opacity: 0.85 });
  const river = new THREE.Mesh(
    new THREE.BoxGeometry(60, 1, 8),
    riverMaterial
  );
  river.position.set(0, 0.5, -40);
  scene.add(river);
  createLabel('Cauvery River', river.position, scene);

  // Trees
  for (let i = 0; i < 15; i++) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 2, 8),
      new THREE.MeshStandardMaterial({ color: 0x8d5524 })
    );
    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x2e8b57 })
    );
    const x = Math.random() * 100 - 50;
    const z = Math.random() * 100 - 50;
    trunk.position.set(x, 1, z);
    foliage.position.set(x, 3, z);
    scene.add(trunk);
    scene.add(foliage);
  }

  // Streetlights
  for (let i = 0; i < 8; i++) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc })
    );
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffff99, emissiveIntensity: 0.7 })
    );
    const x = -40 + i * 10;
    const z = 40;
    pole.position.set(x, 2, z);
    lamp.position.set(x, 4.2, z);
    scene.add(pole);
    scene.add(lamp);
  }

  // Powerhouse
  const powerhouse = new THREE.Mesh(
    new THREE.BoxGeometry(8, 8, 8),
    new THREE.MeshPhongMaterial({ color: 0x555555 })
  );
  powerhouse.position.set(-40, 4, 40);
  scene.add(powerhouse);
  createLabel('Powerhouse', powerhouse.position, scene);
  objects.push({ mesh: powerhouse, type: 'powerhouse', status: state.energyDisrupted ? 'Disrupted' : 'OK' });

  // Solar panels
  for (let i = 0; i < 5; i++) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.3, 3),
      new THREE.MeshPhongMaterial({ color: 0x2222aa })
    );
    panel.position.set(-30 + i * 6, 0.2, 35);
    panel.rotation.x = -Math.PI / 8;
    scene.add(panel);
    createLabel('Solar Panel', panel.position, scene);
    objects.push({ mesh: panel, type: 'solar', status: state.energyDisrupted ? 'Disrupted' : 'OK' });
  }

  // Groundwater wells
  for (let i = 0; i < 3; i++) {
    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 4, 16),
      new THREE.MeshPhongMaterial({ color: 0x8888ff })
    );
    well.position.set(-20 + i * 20, 2, -10);
    scene.add(well);
    createLabel('Well', well.position, scene);
    objects.push({ mesh: well, type: 'well', status: state.waterDisrupted ? 'Disrupted' : 'OK' });
  }

  // Buildings
  const buildingColors = [0x8ecae6, 0xffb703, 0x219ebc, 0x023047, 0xf4a261, 0xe76f51, 0x264653, 0x2a9d8f, 0x457b9d, 0xa8dadc];
  for (let i = 0; i < 10; i++) {
    const height = Math.random() * 10 + 8;
    const color = buildingColors[i % buildingColors.length];
    // Main building body
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(4, height, 4),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 })
    );
    const pos = new THREE.Vector3(Math.random() * 80 - 40, height / 2, Math.random() * 60 - 10);
    building.position.copy(pos);
    scene.add(building);
    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, metalness: 0.7 })
    );
    roof.position.set(pos.x, pos.y + height / 2 + 0.5, pos.z);
    scene.add(roof);
    // Windows (simple pattern)
    for (let y = 0; y < Math.floor(height / 2); y++) {
      for (let x = -1; x <= 1; x++) {
        const windowMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.6, 0.1),
          new THREE.MeshStandardMaterial({ color: 0xcce3f7, emissive: 0x99ccff, emissiveIntensity: 0.3 })
        );
        windowMesh.position.set(pos.x + x * 1.2, pos.y - height / 2 + 1.5 + y * 2, pos.z + 2.05);
        scene.add(windowMesh);
      }
    }
    createLabel('Building ' + (i + 1), building.position, scene);
    objects.push({ mesh: building, type: 'building', status: state.energyDisrupted || state.waterDisrupted ? 'Disrupted' : 'OK' });
    buildingPositions.push(pos.clone());
  }

  // Garden
  const garden = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1, 10),
    new THREE.MeshPhongMaterial({ color: 0x228822 })
  );
  garden.position.set(30, 0.5, 30);
  scene.add(garden);
  createLabel('Garden', garden.position, scene);
  objects.push({ mesh: garden, type: 'garden', status: 'OK' });

  // Pipes: river to wells, wells to garden (semi-transparent)
  for (let i = 0; i < 3; i++) {
    const start = new THREE.Vector3(-20 + i * 20, 2, -10);
    const end = new THREE.Vector3(30, 0.5, 30);
    const pipe = createCylinder(start, end, 0.5, state.waterDisrupted ? 0xff6600 : 0x3399ff);
    pipe.material.transparent = true;
    pipe.material.opacity = 0.5;
    scene.add(pipe);
    objects.push({ mesh: pipe, type: 'pipe', status: state.waterDisrupted ? 'Disrupted' : 'OK' });
  }
  for (let i = 0; i < 3; i++) {
    const start = new THREE.Vector3(0, 0.5, -40);
    const end = new THREE.Vector3(-20 + i * 20, 2, -10);
    const pipe = createCylinder(start, end, 0.5, state.waterDisrupted ? 0xff6600 : 0x3399ff);
    pipe.material.transparent = true;
    pipe.material.opacity = 0.5;
    scene.add(pipe);
    objects.push({ mesh: pipe, type: 'pipe', status: state.waterDisrupted ? 'Disrupted' : 'OK' });
  }

  // Power lines: powerhouse/solar to buildings
  for (let i = 0; i < buildingPositions.length; i++) {
    const buildingPos = buildingPositions[i].clone().add(new THREE.Vector3(0, 5, 0));
    // powerhouse
    const powerLine1 = createCylinder(new THREE.Vector3(-40, 8, 40), buildingPos, 0.2, state.energyDisrupted ? 0xff0000 : 0xffff00);
    scene.add(powerLine1);
    objects.push({ mesh: powerLine1, type: 'powerline', status: state.energyDisrupted ? 'Disrupted' : 'OK' });
    // solar
    const powerLine2 = createCylinder(new THREE.Vector3(-30 + (i % 5) * 6, 0.5, 35), buildingPos, 0.1, state.energyDisrupted ? 0xff0000 : 0x00ff00);
    scene.add(powerLine2);
    objects.push({ mesh: powerLine2, type: 'powerline', status: state.energyDisrupted ? 'Disrupted' : 'OK' });
  }
}

function animateFlows(scene, state, flowObjs, tick, buildingPositions) {
  // Remove old flows
  flowObjs.forEach(obj => scene.remove(obj));
  flowObjs.length = 0;

  // Water flow: moving blue/orange particles
  const waterSpeed = 120; // Increase this value to slow down the flow
  if (!state.waterDisrupted) {
    for (let i = 0; i < 10; i++) {
      const t = ((tick / waterSpeed) + i / 10) % 1;
      const x = (1 - t) * 0 + t * 30;
      const y = 1 + Math.sin(t * Math.PI) * 2;
      const z = (1 - t) * -40 + t * 30;
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0x3399ff })
      );
      drop.position.set(x, y, z);
      scene.add(drop);
      flowObjs.push(drop);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const t = ((tick / waterSpeed) + i / 5) % 1;
      const x = (1 - t) * 0 + t * 30;
      const y = 1 + Math.sin(t * Math.PI) * 2;
      const z = (1 - t) * -40 + t * 30;
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0xff6600 })
      );
      drop.position.set(x, y, z);
      scene.add(drop);
      flowObjs.push(drop);
    }
  }

  // Energy flow: moving yellow/red particles from powerhouse to each building
  const energySpeed = 120;
  if (!state.energyDisrupted) {
    for (let i = 0; i < buildingPositions.length; i++) {
      const start = new THREE.Vector3(-40, 8, 40);
      const end = buildingPositions[i].clone().add(new THREE.Vector3(0, 5, 0));
      for (let j = 0; j < 2; j++) { // 2 particles per line
        const t = ((tick / energySpeed) + j / 2) % 1;
        const x = (1 - t) * start.x + t * end.x;
        const y = (1 - t) * start.y + t * end.y;
        const z = (1 - t) * start.z + t * end.z;
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 12, 12),
          new THREE.MeshPhongMaterial({ color: 0xffff00 })
        );
        spark.position.set(x, y, z);
        scene.add(spark);
        flowObjs.push(spark);
      }
    }
  } else {
    for (let i = 0; i < buildingPositions.length; i++) {
      const start = new THREE.Vector3(-40, 8, 40);
      const end = buildingPositions[i].clone().add(new THREE.Vector3(0, 5, 0));
      for (let j = 0; j < 1; j++) { // 1 particle per line
        const t = ((tick / energySpeed) + j) % 1;
        const x = (1 - t) * start.x + t * end.x;
        const y = (1 - t) * start.y + t * end.y;
        const z = (1 - t) * start.z + t * end.z;
        const spark = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 12, 12),
          new THREE.MeshPhongMaterial({ color: 0xff0000 })
        );
        spark.position.set(x, y, z);
        scene.add(spark);
        flowObjs.push(spark);
      }
    }
  }
}

function App() {
  const mountRef = useRef(null);
  const [state, setState] = useState({
    waterDisrupted: false,
    energyDisrupted: false,
    optimized: false,
    stats: null,
    selected: null
  });
  const [hovered, setHovered] = useState(null);
  const [tick, setTick] = useState(0);
  const [dayTime, setDayTime] = useState(0);

  useEffect(() => {
    let animationId;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaadfff);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 60, 100);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 30;
    controls.maxDistance = 200;
    controls.maxPolarAngle = Math.PI / 2.1;

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(20, 50, 20);
    light.castShadow = true;
    scene.add(light);
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    // City
    const objects = [];
    const labels = [];
    const buildingPositions = [];
    createCity(scene, state, objects, labels, buildingPositions);
    labels.forEach(label => scene.add(label));

    // Flows
    const flowObjs = [];
    let localTick = tick;
    let localDay = dayTime;
    function animate() {
      localTick++;
      localDay = (localDay + 0.002) % 1;
      // Day/night cycle: change ambient and background
      const skyColor = new THREE.Color().lerpColors(
        new THREE.Color(0x0a2342), // night
        new THREE.Color(0xaadfff), // day
        Math.abs(Math.sin(localDay * Math.PI))
      );
      scene.background = skyColor;
      ambient.intensity = 0.2 + 0.6 * Math.abs(Math.sin(localDay * Math.PI));
      light.intensity = 0.5 + 0.7 * Math.abs(Math.sin(localDay * Math.PI));
      // Animate river texture
      scene.children.forEach(obj => {
        if (obj.material && obj.material.map && obj.material.map instanceof THREE.Texture) {
          obj.material.map.offset.x += 0.002;
        }
      });
      animateFlows(scene, state, flowObjs, localTick, buildingPositions);
      controls.update();
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    }
    animate();

    // Raycaster for interactivity
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function onPointerMove(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(objects.map(o => o.mesh));
      if (intersects.length > 0) {
        const obj = objects.find(o => o.mesh === intersects[0].object);
        setHovered(obj);
      } else {
        setHovered(null);
      }
    }
    function onClick(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(objects.map(o => o.mesh));
      if (intersects.length > 0) {
        const obj = objects.find(o => o.mesh === intersects[0].object);
        setState(s => ({ ...s, selected: obj }));
      } else {
        setState(s => ({ ...s, selected: null }));
      }
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      mountRef.current.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line
  }, [state.waterDisrupted, state.energyDisrupted, state.optimized]);

  // Animation tick for flows
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30);
    return () => clearInterval(interval);
  }, []);

  const handleDisruptWater = () => setState(s => ({ ...s, waterDisrupted: !s.waterDisrupted, optimized: false, stats: null, selected: null }));
  const handleDisruptEnergy = () => setState(s => ({ ...s, energyDisrupted: !s.energyDisrupted, optimized: false, stats: null, selected: null }));

  const handleOptimize = async () => {
    const cityData = {
      buildings: 10,
      gardens: 1,
      waterSources: 4,
      energyDisrupted: state.energyDisrupted,
      waterDisrupted: state.waterDisrupted
    };
    const res = await axios.post('http://localhost:5000/api/optimize', cityData);
    setState(s => ({ ...s, optimized: true, stats: res.data, selected: null }));
    alert(`Optimization complete! Estimated savings: ${res.data.savings.toFixed(2)}%`);
  };

  return (
    <div>
      <div ref={mountRef} style={{ width: '100vw', height: '90vh' }} />
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 2, background: '#fff', padding: 10, borderRadius: 8, boxShadow: '0 2px 8px #0002' }}>
        <button onClick={handleDisruptWater} style={{ marginRight: 10 }}>
          {state.waterDisrupted ? 'Restore Water Flow' : 'Simulate Water Disruption'}
        </button>
        <button onClick={handleDisruptEnergy} style={{ marginRight: 10 }}>
          {state.energyDisrupted ? 'Restore Energy Flow' : 'Simulate Power Cut'}
        </button>
        <button onClick={handleOptimize}>
          Optimize System
        </button>
      </div>
      {/* Floating stats panel */}
      <div style={{ position: 'absolute', top: 80, left: 20, zIndex: 2, background: '#f8f8ff', padding: 12, borderRadius: 8, minWidth: 220, boxShadow: '0 2px 8px #0001' }}>
        <b>System Status</b>
        <div>Water: <span style={{ color: state.waterDisrupted ? '#ff6600' : '#3399ff' }}>{state.waterDisrupted ? 'Disrupted' : 'OK'}</span></div>
        <div>Energy: <span style={{ color: state.energyDisrupted ? '#ff0000' : '#00cc00' }}>{state.energyDisrupted ? 'Disrupted' : 'OK'}</span></div>
        {state.stats && (
          <div style={{ marginTop: 8 }}>
            <b>Estimated Savings:</b> {state.stats.savings.toFixed(2)}%<br />
            <b>Optimized:</b> {state.stats.optimized ? 'Yes' : 'No'}
          </div>
        )}
      </div>
      {/* Tooltip for hovered object */}
      {hovered && (
        <div style={{ position: 'absolute', left: 300, top: 20, zIndex: 3, background: '#fffbe7', padding: 10, borderRadius: 8, boxShadow: '0 2px 8px #0002', minWidth: 180 }}>
          <b>{hovered.type.charAt(0).toUpperCase() + hovered.type.slice(1)}</b><br />
          Status: <b>{hovered.status}</b>
        </div>
      )}
      {/* Info panel for selected object */}
      {state.selected && (
        <div style={{ position: 'absolute', right: 30, top: 20, zIndex: 3, background: '#e7f7ff', padding: 16, borderRadius: 8, boxShadow: '0 2px 8px #0002', minWidth: 220 }}>
          <b>Details</b><br />
          Type: {state.selected.type}<br />
          Status: {state.selected.status}<br />
        </div>
      )}
    </div>
  );
}

export default App; 