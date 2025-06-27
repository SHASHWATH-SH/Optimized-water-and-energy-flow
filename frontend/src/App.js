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
  const pipesRef = useRef([]); // Store pipe data for simulation
  const dropletsRef = useRef([]); // Store droplet meshes

  useEffect(() => {
    let animationId;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfefff);

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 260, 420);
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
    controls.minDistance = 60;
    controls.maxDistance = 1200;
    controls.maxPolarAngle = Math.PI / 2.1;

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(80, 180, 80);
    light.castShadow = true;
    scene.add(light);
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);

    // --- Realistic and beautiful 12x12 city grid (doubled area) ---
    const gridRows = 12, gridCols = 12, spacing = 60;
    const startX = -((gridCols - 1) * spacing) / 2;
    const startZ = -((gridRows - 1) * spacing) / 2;
    // Ground (solid grass color)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshStandardMaterial({ color: 0x8fd694, roughness: 0.7 })
    );
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    // River (curved, embanked) - scale up and move to left side
    const riverShape = new THREE.Shape();
    riverShape.moveTo(-520, -360);
    riverShape.bezierCurveTo(-560, -160, -560, 160, -520, 360);
    riverShape.lineTo(-440, 360);
    riverShape.bezierCurveTo(-480, 160, -480, -160, -440, -360);
    riverShape.lineTo(-520, -360);
    const extrudeSettings = { depth: 20, bevelEnabled: false, steps: 1, curveSegments: 32 };
    const riverGeom = new THREE.ExtrudeGeometry(riverShape, extrudeSettings);
    const riverMat = new THREE.MeshPhysicalMaterial({
      color: 0x3399ff, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.85, clearcoat: 0.5
    });
    const river = new THREE.Mesh(riverGeom, riverMat);
    river.position.set(0, 1, 0);
    river.rotation.x = -Math.PI / 2;
    scene.add(river);
    createLabel('Cauvery River', new THREE.Vector3(-500, 6, 0), scene);
    // River walkway
    const walkway = new THREE.Mesh(
      new THREE.BoxGeometry(200, 1, 28),
      new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.8 })
    );
    walkway.position.set(-440, 3, 80);
    scene.add(walkway);
    createLabel('Riverside Walk', walkway.position.clone().add(new THREE.Vector3(0, 3, 0)), scene);
    // Wells (stone, roof, bucket)
    // Move wells outside the grid corners to avoid overlap with buildings
    const wellPositions = [
      new THREE.Vector3(startX - spacing * 0.7, 2, startZ - spacing * 0.7), // top-left outside
      new THREE.Vector3(startX + (gridCols - 1) * spacing + spacing * 0.7, 2, startZ - spacing * 0.7), // top-right outside
      new THREE.Vector3(startX - spacing * 0.7, 2, startZ + (gridRows - 1) * spacing + spacing * 0.7), // bottom-left outside
      new THREE.Vector3(startX + (gridCols - 1) * spacing + spacing * 0.7, 2, startZ + (gridRows - 1) * spacing + spacing * 0.7), // bottom-right outside
      new THREE.Vector3(startX + 6 * spacing, 2, startZ + 6 * spacing) // center
    ];
    wellPositions.forEach((pos, i) => {
      // Well base
      const well = new THREE.Mesh(
        new THREE.CylinderGeometry(7, 7, 16, 24),
        new THREE.MeshStandardMaterial({ color: 0x8a9ba8, roughness: 0.7 })
      );
      well.position.copy(pos);
      scene.add(well);
      // Well roof
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(8, 8, 2, 8, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x7c4a02 })
      );
      roof.position.copy(pos).add(new THREE.Vector3(0, 10, 0));
      roof.rotation.z = Math.PI / 2;
      scene.add(roof);
      // Bucket
      const bucket = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 2.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x9e7b53 })
      );
      bucket.position.copy(pos).add(new THREE.Vector3(0, 8, 2));
      scene.add(bucket);
      createLabel('Well', pos, scene);
    });
    // Buildings (12x12 grid, skip 4x4 park in center, realistic details)
    const buildingPositions = [];
    const buildingColors = [0xf5f5f5, 0xe0c097, 0xb0b0b0, 0x8d99ae, 0x6d6875, 0x457b9d, 0xa8dadc, 0xf4a261, 0xe76f51, 0x264653];
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        // Park occupies center 4x4: (4,4)-(7,7)
        if ((row >= 4 && row <= 7) && (col >= 4 && col <= 7)) continue;
        const pos = new THREE.Vector3(startX + col * spacing, 12, startZ + row * spacing);
        buildingPositions.push(pos);
        const width = 18 + Math.random() * 4;
        const depth = 18 + Math.random() * 4;
        const height = 22 + Math.random() * 36;
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
          new THREE.BoxGeometry(4, 8, 1.5),
          new THREE.MeshStandardMaterial({ color: 0x654321 })
        );
        door.position.copy(pos).add(new THREE.Vector3(0, -height / 2 + 4, depth / 2 + 0.8));
        scene.add(door);
        // Windows (3 rows x 3 columns)
        for (let wy = 0; wy < 3; wy++) {
          for (let wx = -1; wx <= 1; wx++) {
            const windowMesh = new THREE.Mesh(
              new THREE.BoxGeometry(2.5, 3, 0.7),
              new THREE.MeshStandardMaterial({ color: 0x87ceeb, metalness: 0.1, roughness: 0.2, emissive: 0x222244, emissiveIntensity: 0.15 })
            );
            windowMesh.position.copy(pos).add(new THREE.Vector3(wx * 5, 8 + wy * 7, depth / 2 + 0.8));
            scene.add(windowMesh);
          }
        }
        // Rooftop details
        if (Math.random() < 0.4) {
          // Water tank
          const tank = new THREE.Mesh(
            new THREE.CylinderGeometry(2, 2, 4, 16),
            new THREE.MeshStandardMaterial({ color: 0xcccccc })
          );
          tank.position.copy(pos).setY(height + 4);
          scene.add(tank);
        }
        if (Math.random() < 0.2) {
          // Solar panel
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(6, 0.5, 4),
            new THREE.MeshStandardMaterial({ color: 0x2222aa, roughness: 0.3, metalness: 0.7 })
          );
          panel.position.copy(pos).setY(height + 2.5);
          panel.rotation.x = -Math.PI / 8;
          scene.add(panel);
        }
        if (Math.random() < 0.2) {
          // AC unit
          const ac = new THREE.Mesh(
            new THREE.BoxGeometry(2, 1.2, 1.2),
            new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.6 })
          );
          ac.position.copy(pos).setY(height + 2).add(new THREE.Vector3(3, 0, 0));
          scene.add(ac);
        }
        if (Math.random() < 0.15) {
          // Rooftop railing
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(width - 2, 0.5, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x888888 })
          );
          rail.position.copy(pos).setY(height + 2.8).add(new THREE.Vector3(0, 0, depth / 2 - 0.3));
          scene.add(rail);
        }
        // Balconies/ledges
        if (Math.random() < 0.25) {
          for (let by = 0; by < 2; by++) {
            const balcony = new THREE.Mesh(
              new THREE.BoxGeometry(6, 0.7, 2.2),
              new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.5 })
            );
            balcony.position.copy(pos).add(new THREE.Vector3(0, 10 + by * 10, depth / 2 + 1.2));
            scene.add(balcony);
          }
        }
        createLabel(`Building (${row + 1},${col + 1})`, bldg.position, scene);
      }
    }
    // Park (large, occupies 4x4 blocks in center)
    const parkSize = spacing * 4 + 36;
    const park = new THREE.Mesh(
      new THREE.BoxGeometry(parkSize, 2, parkSize, 8, 1, 8),
      new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.6 })
    );
    park.position.set(startX + 5.5 * spacing, 2, startZ + 5.5 * spacing);
    park.castShadow = true;
    scene.add(park);
    createLabel('Central Park', park.position, scene);
    // Park path
    const path = new THREE.Mesh(
      new THREE.TorusGeometry(36, 2.4, 16, 40),
      new THREE.MeshStandardMaterial({ color: 0xd2b48c, roughness: 0.8 })
    );
    path.position.copy(park.position).setY(3.5);
    path.rotation.x = Math.PI / 2;
    scene.add(path);
    // Park pond
    const pond = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 16, 2, 24),
      new THREE.MeshStandardMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.7, roughness: 0.3, metalness: 0.5 })
    );
    pond.position.copy(park.position).add(new THREE.Vector3(20, 2, -20));
    scene.add(pond);
    // Park trees and benches in rows (robust, beautiful trees)
    const numRows = 3, numCols = 4;
    const treeSpacingX = parkSize / (numCols + 1);
    const treeSpacingZ = parkSize / (numRows + 1);
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const tx = park.position.x - parkSize / 2 + (c + 1) * treeSpacingX + (Math.random() - 0.5) * 4;
        const tz = park.position.z - parkSize / 2 + (r + 1) * treeSpacingZ + (Math.random() - 0.5) * 4;
        // Alternate between lollipop and pine tree styles
        if ((r + c) % 2 === 0) {
          // Lollipop/broadleaf tree: thick, tall trunk, big ellipsoid foliage
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(2.5, 3.2, 18, 16),
            new THREE.MeshStandardMaterial({ color: 0x7c4a02, roughness: 0.8 })
          );
          trunk.position.set(tx, 9, tz);
          trunk.castShadow = true;
          trunk.receiveShadow = true;
          scene.add(trunk);
          const foliage = new THREE.Mesh(
            new THREE.SphereGeometry(7, 24, 24),
            new THREE.MeshStandardMaterial({ color: 0x3a7d3b, roughness: 0.4, metalness: 0.2 })
          );
          foliage.scale.set(1.3 + Math.random() * 0.2, 1.7 + Math.random() * 0.3, 1.3 + Math.random() * 0.2);
          foliage.position.set(tx, 21, tz);
          foliage.castShadow = true;
          foliage.receiveShadow = true;
          scene.add(foliage);
        } else {
          // Pine/conifer tree: thick, tall trunk, stacked cones
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(1.8, 2.5, 15, 12),
            new THREE.MeshStandardMaterial({ color: 0x7c4a02, roughness: 0.8 })
          );
          trunk.position.set(tx, 7.5, tz);
          trunk.castShadow = true;
          trunk.receiveShadow = true;
          scene.add(trunk);
          for (let i = 0; i < 3; i++) {
            const cone = new THREE.Mesh(
              new THREE.ConeGeometry(6 - i * 1.5, 7, 16),
              new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.4, metalness: 0.2 })
            );
            cone.position.set(tx, 15 + i * 4, tz);
            cone.castShadow = true;
            cone.receiveShadow = true;
            scene.add(cone);
          }
        }
        // Benches at the end of each row
        if (c === numCols - 1) {
          const bench = new THREE.Mesh(
            new THREE.BoxGeometry(5, 1, 1.5),
            new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.8 })
          );
          bench.position.set(tx + 6, 2, tz);
          scene.add(bench);
        }
      }
    }
    // Water pipes (semi-transparent, metallic)
    // Store pipe source type for simulation
    function addWaterPipe(from, to, sourceType) {
      const pipe = createCylinder(from, to, 1.5, 0x3399ff, 0.7, 0.7, 0.2);
      scene.add(pipe);
      // Store pipe data for simulation, including source type
      pipesRef.current.push({ from: from.clone(), to: to.clone(), pipe, sourceType });
    }
    // Assign water source to each building and connect with pipes
    function getQuadrantWell(pos) {
      // Corner wells: 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right
      // Use only these for buildings
      const cornerWells = wellPositions.slice(0, 4);
      let minDist = Infinity, nearest = null;
      for (const w of cornerWells) {
        const d = pos.distanceTo(w);
        if (d < minDist) { minDist = d; nearest = w; }
      }
      return nearest;
    }
    for (let i = 0; i < buildingPositions.length; i++) {
      const pos = buildingPositions[i];
      const col = Math.round((pos.x - startX) / spacing);
      let source, label, sourceType;
      if (col <= 1) {
        source = new THREE.Vector3(-500, 2, 0);
        label = 'From Cauvery';
        sourceType = 'river';
      } else {
        source = getQuadrantWell(pos);
        label = 'From Well';
        sourceType = 'well';
      }
      addWaterPipe(source, pos, sourceType);
      createLabel(`Building (${label})`, pos, scene);
    }
    // Connect park to center well only
    const parkSource = wellPositions[4];
    addWaterPipe(parkSource, park.position, 'well');
    createLabel('Central Park (From Well)', park.position, scene);

    // --- Water Flow Simulation ---
    function startSimulation() {
      // Remove old droplets
      dropletsRef.current.forEach(d => scene.remove(d.mesh));
      dropletsRef.current = [];
      // For each pipe, add a droplet at the start, color by source
      pipesRef.current.forEach(({ from, to, sourceType }) => {
        const color = sourceType === 'river' ? 0x3399ff : 0x00e6e6; // blue for river, cyan for well
        const droplet = new THREE.Mesh(
          new THREE.SphereGeometry(2.2, 16, 16),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7 })
        );
        droplet.position.copy(from);
        scene.add(droplet);
        dropletsRef.current.push({ mesh: droplet, from, to, t: 0 }); // t: 0=start, 1=end
      });
    }
    function stopSimulation() {
      dropletsRef.current.forEach(d => scene.remove(d.mesh));
      dropletsRef.current = [];
    }

    // Animation loop
    function animate() {
      controls.update();
      // Animate droplets if simulating
      if (isSimulating) {
        const speed = 0.008; // Adjust for flow speed
        dropletsRef.current.forEach(droplet => {
          droplet.t += speed;
          if (droplet.t > 1) droplet.t = 0; // Loop
          droplet.mesh.position.lerpVectors(droplet.from, droplet.to, droplet.t);
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
  }, [isSimulating]);

  return (
    <div>
      <div ref={mountRef} style={{ width: '100vw', height: '90vh' }} />
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 2,
        background: 'rgba(255,255,255,0.92)', padding: 14, borderRadius: 10,
        boxShadow: '0 2px 8px #0002', fontFamily: 'Segoe UI, Arial'
      }}>
        <b style={{ fontSize: 20 }}>System Status</b>
        <div style={{ marginTop: 8, fontSize: 16 }}>Water: <span style={{ color: '#3399ff' }}>OK</span></div>
        <button
          style={{ marginTop: 16, padding: '8px 18px', fontSize: 16, borderRadius: 6, background: '#3399ff', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 1px 4px #0001' }}
          onClick={() => setIsSimulating(s => !s)}
        >
          {isSimulating ? 'Stop Simulation' : 'Simulate Water Flow'}
        </button>
      </div>
    </div>
  );
}

export default App;
