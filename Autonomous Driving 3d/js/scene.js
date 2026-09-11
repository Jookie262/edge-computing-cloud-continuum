/* 3D scene: Three.js autonomous-driving demo for Edge Computing / V2X / Cloud Continuum */
const Scene = (function () {
  let renderer, scene, camera, controls;
  let car, pedestrian, pedestrianHead, v2xTower, cloudDC, packetMesh, bgPacketMesh;
  let collisionRing, successRing, brakeSign, detectionSign, brakeLightL, brakeLightR;
  let followCam = true;
  let collisionTriggered = false;
  const activeTweens = [];

  const OBSTACLE_Z = 48;
  const ROAD_START_X_OFFSET = 0;
  const APPROACH_START_Z = -34; // where the car begins, before it "sees" the child
  const APPROACH_SPEED = 14;    // scene units/sec while just cruising, pre-detection
  let V2X_POS, CLOUD_POS;

  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
  function easeLinear(t) { return t; }

  function addTween({ duration, onUpdate, onComplete, easing }) {
    activeTweens.push({
      start: performance.now(),
      duration: Math.max(1, duration * 1000),
      onUpdate,
      onComplete,
      easing: easing || easeLinear,
    });
  }

  function buildRenderer() {
    const canvas = document.getElementById('scene');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
  }

  function buildScene() {
    scene = new THREE.Scene();
    const skyColor = 0x0a1020;
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, 40, 180);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(-14, 10, -16);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enabled = false;
    controls.target.set(0, 2, 20);
    controls.update();

    const hemi = new THREE.HemisphereLight(0x9fc7ff, 0x0a0f18, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(-20, 40, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    scene.add(sun);

    buildGround();
    buildCar();
    buildBrakeSign();
    buildPedestrian();
    buildV2xTower();
    buildCloudDatacenter();
    buildPackets();
    buildEffectRings();
  }

  function buildGround() {
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0d1522, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const roadGeo = new THREE.PlaneGeometry(8, 200);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1b2436, roughness: 0.9 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, 60);
    road.receiveShadow = true;
    scene.add(road);

    const dashMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x222222 });
    for (let z = -10; z < 150; z += 6) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2.5), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, z);
      scene.add(dash);
    }
  }

  function buildCar() {
    car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3ddc97, metalness: 0.4, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 3.6), bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    car.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.8), new THREE.MeshStandardMaterial({ color: 0x102030, metalness: 0.2, roughness: 0.2 }));
    cabin.position.set(0, 1.1, -0.2);
    cabin.castShadow = true;
    car.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const wheelPositions = [
      [-1, 0.4, 1.2], [1, 0.4, 1.2], [-1, 0.4, -1.2], [1, 0.4, -1.2],
    ];
    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      wheel.castShadow = true;
      car.add(wheel);
    });

    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffcc, emissiveIntensity: 1.5 });
    [-0.7, 0.7].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), headlightMat);
      hl.position.set(x, 0.6, 1.85);
      car.add(hl);
    });

    const brakeMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0x330000, emissiveIntensity: 0.3 });
    brakeLightL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), brakeMat);
    brakeLightL.position.set(-0.7, 0.6, -1.85);
    car.add(brakeLightL);
    brakeLightR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), brakeMat.clone());
    brakeLightR.position.set(0.7, 0.6, -1.85);
    car.add(brakeLightR);

    car.position.set(ROAD_START_X_OFFSET, 0, APPROACH_START_Z);
    scene.add(car);
  }

  function makeTextSprite(text, { bg = '#ff6b6b', fg = '#0b0f18' } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    const r = 28;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(canvas.width, 0, canvas.width, canvas.height, r);
    ctx.arcTo(canvas.width, canvas.height, 0, canvas.height, r);
    ctx.arcTo(0, canvas.height, 0, 0, r);
    ctx.arcTo(0, 0, canvas.width, 0, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // shrink the font until the text fits comfortably inside the sign's rounded panel
    const maxTextWidth = canvas.width - 48;
    let fontSize = 84;
    do {
      ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
      fontSize -= 4;
    } while (ctx.measureText(text).width > maxTextWidth && fontSize > 28);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 6);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4.4, 1.4, 1);
    return sprite;
  }

  function buildBrakeSign() {
    brakeSign = makeTextSprite('🛑 BRAKING!');
    brakeSign.visible = false;
    brakeSign.renderOrder = 999;
    scene.add(brakeSign);

    detectionSign = makeTextSprite('👀 Child spotted!', { bg: '#ffd166' });
    detectionSign.visible = false;
    detectionSign.renderOrder = 999;
    scene.add(detectionSign);
  }

  function buildPedestrian() {
    pedestrian = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffb703 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 1.1, 12), bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;
    pedestrian.add(body);

    pedestrianHead = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffe0a3 }));
    pedestrianHead.position.y = 1.75;
    pedestrianHead.castShadow = true;
    pedestrian.add(pedestrianHead);

    pedestrian.position.set(1, 0, OBSTACLE_Z);
    scene.add(pedestrian);
  }

  function buildV2xTower() {
    v2xTower = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 9, 10), new THREE.MeshStandardMaterial({ color: 0x555f75 }));
    pole.position.y = 4.5;
    pole.castShadow = true;
    v2xTower.add(pole);

    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x4f9dff, emissive: 0x1c3f7a, emissiveIntensity: 0.6 }));
    box.position.y = 9.2;
    box.castShadow = true;
    v2xTower.add(box);

    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x9fc7ff, side: THREE.DoubleSide }));
    dish.rotation.x = Math.PI;
    dish.position.set(0, 8.3, 0.8);
    v2xTower.add(dish);

    const beacon = new THREE.PointLight(0x4f9dff, 1.2, 12);
    beacon.position.y = 9.8;
    v2xTower.add(beacon);

    v2xTower.position.set(9, 0, 20);
    scene.add(v2xTower);
    V2X_POS = v2xTower.position.clone().add(new THREE.Vector3(0, 9, 0));
  }

  function buildCloudDatacenter() {
    cloudDC = new THREE.Group();
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x1f2738, emissive: 0x2a3f6a, emissiveIntensity: 0.4 });
    for (let i = 0; i < 5; i++) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3 + Math.random(), 2.4), rackMat);
      rack.position.set((i - 2) * 3, rack.geometry.parameters.height / 2, Math.random() * 2);
      rack.castShadow = true;
      cloudDC.add(rack);
    }
    // fluffy "cloud" icon floating above the datacenter
    const puffMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf4, emissive: 0x334, emissiveIntensity: 0.2 });
    const puffPositions = [[0, 6.4, 0, 2.2], [1.6, 6.0, 0, 1.6], [-1.6, 6.0, 0, 1.6], [0.6, 7.1, 0, 1.3], [-0.6, 7.1, 0, 1.3]];
    puffPositions.forEach(([x, y, z, r]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), puffMat);
      puff.position.set(x, y, z);
      cloudDC.add(puff);
    });

    const glow = new THREE.PointLight(0x8fb8ff, 1.5, 40);
    glow.position.y = 8;
    cloudDC.add(glow);

    cloudDC.position.set(-16, 0, 165);
    scene.add(cloudDC);
    CLOUD_POS = cloudDC.position.clone().add(new THREE.Vector3(0, 7, 0));
  }

  function buildPackets() {
    const geo = new THREE.SphereGeometry(0.35, 12, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 1.4 });
    packetMesh = new THREE.Mesh(geo, mat);
    packetMesh.visible = false;
    scene.add(packetMesh);

    const bgMat = new THREE.MeshStandardMaterial({ color: 0x8fd3ff, emissive: 0x4f9dff, emissiveIntensity: 1.2 });
    bgPacketMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), bgMat);
    bgPacketMesh.visible = false;
    scene.add(bgPacketMesh);
  }

  function buildEffectRings() {
    collisionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    collisionRing.rotation.x = -Math.PI / 2;
    scene.add(collisionRing);

    successRing = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.6, 24),
      new THREE.MeshBasicMaterial({ color: 0x3ddc97, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    successRing.rotation.x = -Math.PI / 2;
    scene.add(successRing);
  }

  function triggerCollisionEffect() {
    collisionRing.position.set(pedestrian.position.x, 0.05, pedestrian.position.z);
    collisionRing.scale.set(1, 1, 1);
    collisionRing.material.opacity = 1;
    addTween({
      duration: 0.9,
      easing: easeOutQuad,
      onUpdate: (t) => {
        const s = 1 + t * 10;
        collisionRing.scale.set(s, s, s);
        collisionRing.material.opacity = 1 - t;
      },
    });
    pedestrianHead.material.color.set(0xff6b6b);
  }

  function triggerSuccessEffect() {
    successRing.position.set(car.position.x, 0.05, car.position.z);
    successRing.scale.set(1, 1, 1);
    successRing.material.opacity = 1;
    addTween({
      duration: 1.0,
      easing: easeOutQuad,
      onUpdate: (t) => {
        const s = 1 + t * 6;
        successRing.scale.set(s, s, s);
        successRing.material.opacity = 1 - t;
      },
    });
  }

  function showBrakeSign() {
    brakeSign.visible = true;
    brakeSign.position.set(car.position.x, 3.2, car.position.z);
    [brakeLightL, brakeLightR].forEach((l) => {
      l.material.color.set(0xff2020);
      l.material.emissive.set(0xff2020);
      l.material.emissiveIntensity = 2.2;
    });
    addTween({
      duration: 0.35,
      easing: easeOutQuad,
      onUpdate: (t) => {
        const s = 1 + Math.sin(t * Math.PI) * 0.35;
        brakeSign.scale.set(4.4 * s, 1.4 * s, 1);
      },
    });
  }

  function hideBrakeSign() {
    brakeSign.visible = false;
    [brakeLightL, brakeLightR].forEach((l) => {
      l.material.color.set(0x330000);
      l.material.emissive.set(0x330000);
      l.material.emissiveIntensity = 0.3;
    });
  }

  function showDetectionSign() {
    detectionSign.visible = true;
    detectionSign.position.set(car.position.x, 3.2, car.position.z);
    addTween({
      duration: 0.35,
      easing: easeOutQuad,
      onUpdate: (t) => {
        const s = 1 + Math.sin(t * Math.PI) * 0.35;
        detectionSign.scale.set(4.8 * s, 1.4 * s, 1);
      },
    });
  }

  function hideDetectionSign() {
    detectionSign.visible = false;
  }

  function spawnBackgroundLearningStream() {
    bgPacketMesh.visible = true;
    const from = new THREE.Vector3(car.position.x, 1.4, car.position.z);
    const to = CLOUD_POS.clone();
    addTween({
      duration: 3.2,
      easing: easeLinear,
      onUpdate: (t) => {
        const pos = from.clone().lerp(to, t);
        pos.y += Math.sin(t * Math.PI) * 10;
        bgPacketMesh.position.copy(pos);
      },
      onComplete: () => { bgPacketMesh.visible = false; },
    });
  }

  function updateFollowCam() {
    const behind = new THREE.Vector3(car.position.x - 6, car.position.y + 5, car.position.z - 9);
    camera.position.lerp(behind, 0.05);
    const lookAt = new THREE.Vector3(car.position.x, car.position.y + 1.2, car.position.z + 8);
    camera.lookAt(lookAt);
  }

  function tick() {
    requestAnimationFrame(tick);
    const now = performance.now();
    for (let i = activeTweens.length - 1; i >= 0; i--) {
      const tw = activeTweens[i];
      let t = (now - tw.start) / tw.duration;
      if (t > 1) t = 1;
      tw.onUpdate(tw.easing(t));
      if (t >= 1) {
        activeTweens.splice(i, 1);
        tw.onComplete && tw.onComplete();
      }
    }
    if (followCam) updateFollowCam();
    else controls.update();
    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function init() {
    buildRenderer();
    buildScene();
    window.addEventListener('resize', onResize);
    tick();
  }

  function resetScene() {
    activeTweens.length = 0;
    car.position.set(ROAD_START_X_OFFSET, 0, APPROACH_START_Z);
    packetMesh.visible = false;
    bgPacketMesh.visible = false;
    collisionRing.material.opacity = 0;
    successRing.material.opacity = 0;
    pedestrianHead.material.color.set(0xffe0a3);
    collisionTriggered = false;
    hideBrakeSign();
    hideDetectionSign();
  }

  function setFreeCamera(enabled) {
    followCam = !enabled;
    controls.enabled = enabled;
  }

  function playScenario(opts, onDone) {
    const { archKey, reactionDistance, brakingDistance, isSafe, visualWaitDuration, brakeDuration, onBrakeStart, onDetect } = opts;
    const nodeTarget = archKey === 'cloud' ? CLOUD_POS : V2X_POS;

    // Phase 0: the car simply drives, before it has any idea a child is nearby.
    const approachStartZ = car.position.z;
    const approachDistance = 0 - approachStartZ;
    addTween({
      duration: approachDistance / APPROACH_SPEED,
      easing: easeLinear,
      onUpdate: (t) => { car.position.z = approachStartZ + approachDistance * t; },
      onComplete: () => {
        showDetectionSign();
        onDetect && onDetect();
        setTimeout(() => {
          hideDetectionSign();
          runReactionAndBrake();
        }, 500);
      },
    });

    function runReactionAndBrake() {
      const carStartZ = car.position.z;
      packetMesh.visible = true;
      if (archKey === 'continuum') spawnBackgroundLearningStream();

      addTween({
        duration: visualWaitDuration,
        easing: easeLinear,
        onUpdate: (t) => {
          car.position.z = carStartZ + reactionDistance * t;
          let arcT, from, to;
          const carTop = new THREE.Vector3(car.position.x, 1.4, car.position.z);
          if (t < 0.5) { arcT = t / 0.5; from = carTop; to = nodeTarget; }
          else { arcT = (t - 0.5) / 0.5; from = nodeTarget; to = carTop; }
          const pos = from.clone().lerp(to, arcT);
          pos.y += Math.sin(arcT * Math.PI) * 5;
          packetMesh.position.copy(pos);
        },
        onComplete: () => {
          packetMesh.visible = false;
          showBrakeSign();
          onBrakeStart && onBrakeStart();
          const brakeStartZ = car.position.z;
          addTween({
            duration: brakeDuration,
            easing: easeOutQuad,
            onUpdate: (t) => {
              car.position.z = brakeStartZ + brakingDistance * t;
              brakeSign.position.set(car.position.x, 3.2, car.position.z);
              if (!isSafe && !collisionTriggered && car.position.z >= OBSTACLE_Z) {
                collisionTriggered = true;
                triggerCollisionEffect();
              }
            },
            onComplete: () => {
              hideBrakeSign();
              if (isSafe) triggerSuccessEffect();
              onDone && onDone();
            },
          });
        },
      });
    }
  }

  return { init, resetScene, playScenario, setFreeCamera };
})();

