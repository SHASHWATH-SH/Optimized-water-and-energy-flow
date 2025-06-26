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
  // --- Helper functions for realistic objects ---
  function addTree(x, z, trunkHeight = 15, foliageRadius = 7) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.2, trunkHeight, 10),
      new THREE.MeshStandardMaterial({ color: 0x8d5524 })
    );
    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(foliageRadius, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x2e8b57 })
    );
    trunk.position.set(x, trunkHeight / 2, z);
    foliage.position.set(x, trunkHeight + foliageRadius - 2, z);
    scene.add(trunk);
    scene.add(foliage);
  }
  function addBench(x, z) {
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.5, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.8 })
    );
    bench.position.set(x, 1, z);
    scene.add(bench);
  }
  function addWell(x, z) {
    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 5, 24),
      new THREE.MeshStandardMaterial({ color: 0x8888ff })
    );
    well.position.set(x, 2.5, z);
    scene.add(well);
    createLabel('Well', well.position, scene);
  }
  function addPipe(start, end, color) {
    const pipe = createCylinder(start, end, 1.2, color);
    pipe.material.transparent = true;
    pipe.material.opacity = 0.5;
    scene.add(pipe);
    return pipe;
  }

  // --- Larger ground ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 480),
    new THREE.MeshPhongMaterial({ color: 0x88cc88 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // --- Fewer roads ---
  // Main horizontal and vertical roads
  const mainRoad = new THREE.Mesh(
    new THREE.BoxGeometry(480, 0.3, 12),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 })
  );
  mainRoad.position.set(0, 0.16, 0);
  scene.add(mainRoad);
  const vertRoad = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.3, 480),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 })
  );
  vertRoad.position.set(0, 0.16, 0);
  scene.add(vertRoad);
  // One cross street in each direction
  for (let i of [-60, 60]) {
    const crossH = new THREE.Mesh(
      new THREE.BoxGeometry(480, 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 })
    );
    crossH.position.set(0, 0.13, i);
    scene.add(crossH);
    const crossV = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.2, 480),
      new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 })
    );
    crossV.position.set(i, 0.13, 0);
    scene.add(crossV);
  }
  // Streetlights only along main roads
  for (let i = -220; i <= 220; i += 40) {
    // Along horizontal main road
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 5, 8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc })
    );
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffff99, emissiveIntensity: 0.8 })
    );
    pole.position.set(i, 2.5, 6);
    lamp.position.set(i, 5.5, 6);
    scene.add(pole);
    scene.add(lamp);
    // Along vertical main road
    const pole2 = pole.clone();
    const lamp2 = lamp.clone();
    pole2.position.set(6, 2.5, i);
    lamp2.position.set(6, 5.5, i);
    scene.add(pole2);
    scene.add(lamp2);
  }

  // --- More buildings, filling the area, larger and more realistic ---
  const buildingColors = [0x8ecae6, 0xffb703, 0x219ebc, 0x023047, 0xf4a261, 0xe76f51, 0x264653, 0x2a9d8f, 0x457b9d, 0xa8dadc];
  let buildingIdx = 0;
  const blockSize = 44;
  const margin = 6;
  const buildingBase = 8;
  const buildingHeightMin = 20;
  const buildingHeightMax = 40;
  const buildingCenters = [];
  for (let row = -5; row <= 4; row++) {
    for (let col = -5; col <= 4; col++) {
      // Skip main roads and cross streets
      if (row === 0 || col === 0 || row === -2 || row === 2 || col === -2 || col === 2) continue;
      const height = Math.random() * (buildingHeightMax - buildingHeightMin) + buildingHeightMin;
      const color = buildingColors[buildingIdx % buildingColors.length];
      const roofColors = [0x222222, 0x6d6875, 0x8d99ae, 0x495057];
      const roofColor = roofColors[Math.floor(Math.random() * roofColors.length)];
      // Center of block, with margin and small jitter
      const x = col * blockSize + (Math.random() - 0.5) * 6;
      const z = row * blockSize + (Math.random() - 0.5) * 6;
      const rotY = (Math.random() - 0.5) * 0.1;
      // Main building body
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(buildingBase, height, buildingBase),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 })
      );
      const pos = new THREE.Vector3(x, height / 2, z);
      building.position.copy(pos);
      building.rotation.y = rotY;
      scene.add(building);
      // Roof
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(buildingBase + 0.5, 1, buildingBase + 0.5),
        new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.3, metalness: 0.7 })
      );
      roof.position.set(pos.x, pos.y + height / 2 + 0.5, pos.z);
      roof.rotation.y = rotY;
      scene.add(roof);
      // Doorway (proportional)
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 3, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.7 })
      );
      door.position.set(pos.x, pos.y - height / 2 + 1.5, pos.z + buildingBase / 2 + 0.15);
      door.rotation.y = rotY;
      scene.add(door);
      // Windows (proportional, variety)
      for (let y = 0; y < Math.floor(height / 6); y++) {
        for (let wx = -1; wx <= 1; wx++) {
          if (Math.random() > 0.5) {
            const windowMesh = new THREE.Mesh(
              new THREE.BoxGeometry(1.2, 1.2, 0.2),
              new THREE.MeshStandardMaterial({ color: 0xcce3f7, emissive: 0x99ccff, emissiveIntensity: 0.3 })
            );
            windowMesh.position.set(pos.x + wx * 2, pos.y - height / 2 + 2.5 + y * 6, pos.z + buildingBase / 2 + 0.25);
            windowMesh.rotation.y = rotY;
            scene.add(windowMesh);
          }
        }
      }
      createLabel('Building ' + (buildingIdx + 1), building.position, scene);
      objects.push({ mesh: building, type: 'building', status: state.energyDisrupted || state.waterDisrupted ? 'Disrupted' : 'OK' });
      buildingPositions.push(pos.clone());
      buildingCenters.push(pos.clone());
      buildingIdx++;
    }
  }

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
  for (let i = 0; i < 10; i++) {
    const x = (Math.random() - 0.5) * 400;
    const z = (Math.random() - 0.5) * 400;
    addTree(x, z);
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

  // --- Multiple powerhouses at city edges/corners ---
  const powerhousePositions = [
    new THREE.Vector3(-220, 4, -220),
    new THREE.Vector3(-220, 4, 220),
    new THREE.Vector3(220, 4, -220),
    new THREE.Vector3(220, 4, 220)
  ];
  powerhousePositions.forEach((pos, i) => {
    const ph = new THREE.Mesh(
      new THREE.BoxGeometry(18, 18, 18),
      new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.7, roughness: 0.3 })
    );
    ph.position.copy(pos);
    scene.add(ph);
    createLabel(`Powerhouse ${i + 1}`, ph.position.clone().add(new THREE.Vector3(0, 14, 0)), scene);
  });

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

  // --- Groundwater wells and pumps ---
  const wellStatuses = ['OK', 'Dry', 'Contaminated'];
  const pumpStatuses = ['OK', 'Failed'];
  const wellColors = { OK: 0x1e90ff, Dry: 0xaaaaaa, Contaminated: 0xff3333 };
  const pumpColors = { OK: 0x228B22, Failed: 0xffa500 };
  // Place 8 wells at various locations
  const wellPositions = [
    new THREE.Vector3(-120, 2, -80),
    new THREE.Vector3(80, 2, -100),
    new THREE.Vector3(-60, 2, 120),
    new THREE.Vector3(120, 2, 60),
    new THREE.Vector3(-150, 2, 150),
    new THREE.Vector3(150, 2, -150),
    new THREE.Vector3(0, 2, 180),
    new THREE.Vector3(-180, 2, 0)
  ];
  wellPositions.forEach((pos, i) => {
    // Randomly assign status
    const wellStatus = wellStatuses[Math.floor(Math.random() * wellStatuses.length)];
    const pumpStatus = pumpStatuses[Math.floor(Math.random() * pumpStatuses.length)];
    // Well
    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 10, 24),
      new THREE.MeshStandardMaterial({ color: wellColors[wellStatus], metalness: 0.3, roughness: 0.7 })
    );
    well.position.copy(pos);
    scene.add(well);
    createLabel(`Well (${wellStatus})`, well.position.clone().add(new THREE.Vector3(0, 8, 0)), scene);
    // Pump (as a box next to well)
    const pump = new THREE.Mesh(
      new THREE.BoxGeometry(6, 6, 6),
      new THREE.MeshStandardMaterial({ color: pumpColors[pumpStatus], metalness: 0.4, roughness: 0.6 })
    );
    pump.position.copy(pos).add(new THREE.Vector3(8, 3, 0));
    scene.add(pump);
    createLabel(`Pump (${pumpStatus})`, pump.position.clone().add(new THREE.Vector3(0, 6, 0)), scene);
  });

  // --- New garden outside the city ---
  // Large grass patch for garden
  const gardenPos = new THREE.Vector3(70, 0.5, -70);
  const gardenGrass = new THREE.Mesh(
    new THREE.CylinderGeometry(18, 18, 0.5, 40),
    new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 0.8 })
  );
  gardenGrass.position.copy(gardenPos.clone().setY(0.25));
  scene.add(gardenGrass);
  // Walking path (ellipse)
  const gardenPath = new THREE.Mesh(
    new THREE.TorusGeometry(13, 0.5, 16, 60),
    new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.9 })
  );
  gardenPath.position.copy(gardenPos.clone().setY(1.1));
  gardenPath.rotation.x = Math.PI / 2;
  scene.add(gardenPath);
  // Garden mesh
  const garden = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1, 10),
    new THREE.MeshPhongMaterial({ color: 0x228822 })
  );
  garden.position.copy(gardenPos);
  scene.add(garden);
  createLabel('Garden', garden.position, scene);
  objects.push({ mesh: garden, type: 'garden', status: 'OK' });
  // Trees near garden
  for (let i = 0; i < 7; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 10 + Math.random() * 6;
    const x = gardenPos.x + Math.cos(angle) * radius;
    const z = gardenPos.z + Math.sin(angle) * radius;
    addTree(x, z);
  }
  // Benches near garden
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 14;
    const x = gardenPos.x + Math.cos(angle) * radius;
    const z = gardenPos.z + Math.sin(angle) * radius;
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.8 })
    );
    bench.position.set(x, 1, z);
    scene.add(bench);
  }
  // --- End new garden area ---
  // Extend ground area if needed
  scene.children.forEach(obj => {
    if (obj.geometry && obj.geometry.type === 'PlaneGeometry') {
      obj.scale.set(2, 2, 2); // double the ground size
    }
  });

  // Separate garden with its own supply (far from buildings)
  const garden2 = new THREE.Mesh(
    new THREE.BoxGeometry(12, 1, 12),
    new THREE.MeshPhongMaterial({ color: 0x43aa8b })
  );
  garden2.position.set(-60, 0.5, 60);
  scene.add(garden2);
  createLabel('Garden 2', garden2.position, scene);
  objects.push({ mesh: garden2, type: 'garden', status: 'OK' });

  // Water supply to garden2: from nearest well
  const wellPos = new THREE.Vector3(-20, 2, -10);
  const pipeToGarden2 = addPipe(wellPos, new THREE.Vector3(-60, 0.5, 60), state.waterDisrupted ? 0xff6600 : 0x3399ff);
  objects.push({ mesh: pipeToGarden2, type: 'pipe', status: state.waterDisrupted ? 'Disrupted' : 'OK' });

  // Power supply to garden2: from powerhouse
  const powerLineToGarden2 = addPipe(new THREE.Vector3(-40, 8, 40), new THREE.Vector3(-60, 2, 60), state.energyDisrupted ? 0xff0000 : 0xffff00);
  objects.push({ mesh: powerLineToGarden2, type: 'powerline', status: state.energyDisrupted ? 'Disrupted' : 'OK' });

  // Pipes: river to wells, wells to garden (semi-transparent)
  for (let i = 0; i < 3; i++) {
    const start = new THREE.Vector3(-20 + i * 20, 2, -10);
    const end = new THREE.Vector3(30, 0.5, 30);
    const pipe = addPipe(start, end, state.waterDisrupted ? 0xff6600 : 0x3399ff);
    objects.push({ mesh: pipe, type: 'pipe', status: state.waterDisrupted ? 'Disrupted' : 'OK' });
  }
  for (let i = 0; i < 3; i++) {
    const start = new THREE.Vector3(0, 0.5, -40);
    const end = new THREE.Vector3(-20 + i * 20, 2, -10);
    const pipe = addPipe(start, end, state.waterDisrupted ? 0xff6600 : 0x3399ff);
    objects.push({ mesh: pipe, type: 'pipe', status: state.waterDisrupted ? 'Disrupted' : 'OK' });
  }

  // Power lines: powerhouse/solar to buildings
  for (let i = 0; i < buildingPositions.length; i++) {
    const buildingPos = buildingPositions[i].clone().add(new THREE.Vector3(0, 5, 0));
    // powerhouse
    const powerLine1 = addPipe(new THREE.Vector3(-40, 8, 40), buildingPos, state.energyDisrupted ? 0xff0000 : 0xffff00);
    objects.push({ mesh: powerLine1, type: 'powerline', status: state.energyDisrupted ? 'Disrupted' : 'OK' });
    // solar
    const powerLine2 = addPipe(new THREE.Vector3(-30 + (i % 5) * 6, 0.5, 35), buildingPos, state.energyDisrupted ? 0xff0000 : 0x00ff00);
    objects.push({ mesh: powerLine2, type: 'powerline', status: state.energyDisrupted ? 'Disrupted' : 'OK' });
  }

  // Park
  function createPark() {
    // Park base
    const park = new THREE.Mesh(
      new THREE.BoxGeometry(24, 1, 24),
      new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 0.7 })
    );
    park.position.set(-70, 0.5, 70);
    scene.add(park);
    // Park label
    createLabel('Park', park.position.clone().add(new THREE.Vector3(0, 2, 0)), scene);
    // Walking path (rectangle)
    const pathMaterial = new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.9 });
    const path1 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 2), pathMaterial);
    path1.position.set(-70, 1.1, 82);
    scene.add(path1);
    const path2 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 2), pathMaterial);
    path2.position.set(-70, 1.1, 58);
    scene.add(path2);
    const path3 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 24), pathMaterial);
    path3.position.set(-82, 1.1, 70);
    scene.add(path3);
    const path4 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 24), pathMaterial);
    path4.position.set(-58, 1.1, 70);
    scene.add(path4);
    // More trees around park
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 13 + Math.random() * 5;
      const x = -70 + Math.cos(angle) * radius;
      const z = 70 + Math.sin(angle) * radius;
      addTree(x, z);
    }
    // Grass patches
    for (let i = 0; i < 8; i++) {
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(2 + Math.random() * 2, 16),
        new THREE.MeshStandardMaterial({ color: 0x6bbf59, roughness: 0.8 })
      );
      patch.position.set(-70 + Math.random() * 18 - 9, 1.01, 70 + Math.random() * 18 - 9);
      patch.rotation.x = -Math.PI / 2;
      scene.add(patch);
    }
    // Benches
    for (let i = 0; i < 4; i++) {
      addBench(-75 + i * 5, 75);
    }
    // Pond (animated water)
    const pondTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/water.jpg');
    pondTexture.wrapS = pondTexture.wrapT = THREE.RepeatWrapping;
    const pond = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 0.5, 32),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, map: pondTexture, transparent: true, opacity: 0.8, roughness: 0.3, metalness: 0.5 })
    );
    pond.position.set(-70, 1, 65);
    scene.add(pond);
    // Water supply to park: from nearest well
    const wellPos = new THREE.Vector3(-20, 2, -10);
    const pipeToPark = addPipe(wellPos, new THREE.Vector3(-70, 1, 70), state.waterDisrupted ? 0xff6600 : 0x3399ff);
    objects.push({ mesh: pipeToPark, type: 'pipe', status: state.waterDisrupted ? 'Disrupted' : 'OK' });
    // Power supply to park: from powerhouse
    const powerLineToPark = addPipe(new THREE.Vector3(-40, 8, 40), new THREE.Vector3(-70, 2, 70), state.energyDisrupted ? 0xff0000 : 0xffff00);
    objects.push({ mesh: powerLineToPark, type: 'powerline', status: state.energyDisrupted ? 'Disrupted' : 'OK' });
  }
  createPark();

  // --- Power grid with transformers and clusters (clean version) ---
  const transformerPositions = [
    new THREE.Vector3(-200, 4, -200),
    new THREE.Vector3(-200, 4, 200),
    new THREE.Vector3(200, 4, -200),
    new THREE.Vector3(200, 4, 200)
  ];
  for (let i = 0; i < transformerPositions.length; i++) {
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 10, 16),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 })
    );
    t.position.copy(transformerPositions[i]);
    scene.add(t);
    createLabel('Transformer', t.position, scene);
  }
  // Power lines: each transformer → nearest powerhouse
  transformerPositions.forEach((tpos) => {
    let minDist = Infinity;
    let nearestPH = powerhousePositions[0];
    for (let ph of powerhousePositions) {
      const dist = tpos.distanceTo(ph);
      if (dist < minDist) {
        minDist = dist;
        nearestPH = ph;
      }
    }
    const powerLine = addPipe(nearestPH, tpos, state.energyDisrupted ? 0xff0000 : 0xffff00);
    objects.push({ mesh: powerLine, type: 'powerline', status: state.energyDisrupted ? 'Disrupted' : 'OK' });
  });

  // --- Huge water source: River ---
  const mainRiverGeometry = new THREE.BoxGeometry(60, 2, 400);
  const mainRiverMaterial = new THREE.MeshPhongMaterial({ color: 0x3399ff, transparent: true, opacity: 0.7 });
  const mainRiver = new THREE.Mesh(mainRiverGeometry, mainRiverMaterial);
  mainRiver.position.set(-250, 1, 0); // Place river to the side of the city
  scene.add(mainRiver);
  createLabel('River', mainRiver.position.clone().add(new THREE.Vector3(0, 8, 0)), scene);
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

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 200, 400);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 30;
    controls.maxDistance = 2000;
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