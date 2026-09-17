import * as THREE from 'three';
import { sounds } from './SoundEffects';

/**
 * Interface data status game untuk dikirim ke UI React
 */
export interface GameStats {
  deaths: number;
  isGrounded: boolean;
  playerY: number;
  elapsedTime: number;
  isFinished: boolean;
  hasCheckpoint: boolean;
  checkpointActivatedNotice: boolean;
}

export interface VictoryData {
  timeSeconds: number;
  deaths: number;
  stars: number;
}

/**
 * Kelas Game Utama (DON'T FALL - 3D Engine)
 */
export class DontFallGame {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;
  private clock: THREE.Clock;

  // Objek Player
  private playerGroup: THREE.Group;
  private playerVelocity: THREE.Vector3 = new THREE.Vector3();
  private isGrounded: boolean = false;
  private wasGrounded: boolean = false;
  private readonly playerSize = { width: 0.9, height: 1.6, depth: 0.9 };
  private readonly gravity = -26.0;
  private readonly jumpForce = 11.5;
  private readonly moveSpeed = 9.0;
  private readonly deathHeight = -12.0;

  // Platform dan Bounding Box untuk Deteksi Tabrakan
  private platformBoxes: { mesh: THREE.Mesh; box: THREE.Box3 }[] = [];

  // Checkpoint Object & State
  private checkpointMesh: THREE.Group | null = null;
  private checkpointCrystal: THREE.Mesh | null = null;
  private checkpointLight: THREE.PointLight | null = null;
  private checkpointActive: boolean = false;
  private checkpointPosition = new THREE.Vector3(-3, 2.5, -25);
  private initialSpawnPosition = new THREE.Vector3(0, 2.5, 0);
  private currentRespawnPoint = new THREE.Vector3(0, 2.5, 0);
  private checkpointNoticeTimer: number = 0;

  // Finish Goal Object & State
  private finishGroup: THREE.Group | null = null;
  private finishRings: THREE.Mesh[] = [];
  private finishPosition = new THREE.Vector3(0, 4.0, -43);
  private isFinished: boolean = false;

  // Input Keyboard
  private keys: { [key: string]: boolean } = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
  };

  // Status & Timer Game
  private deaths: number = 0;
  private elapsedTime: number = 0;
  private isPaused: boolean = false;

  // Callbacks ke UI
  private onStatsChange?: (stats: GameStats) => void;
  private onVictory?: (data: VictoryData) => void;
  private onDeath?: (deaths: number, atCheckpoint: boolean) => void;

  constructor(
    container: HTMLElement,
    callbacks?: {
      onStatsChange?: (stats: GameStats) => void;
      onVictory?: (data: VictoryData) => void;
      onDeath?: (deaths: number, atCheckpoint: boolean) => void;
    }
  ) {
    this.container = container;
    this.onStatsChange = callbacks?.onStatsChange;
    this.onVictory = callbacks?.onVictory;
    this.onDeath = callbacks?.onDeath;
    this.clock = new THREE.Clock();

    // 1. Inisialisasi Dunia 3D
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d1a);
    this.scene.fog = new THREE.FogExp2(0x0a0d1a, 0.022);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 5, 9);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 2. Setup Pencahayaan
    this.setupLighting();

    // 3. Bangun Level Platform
    this.buildLevel();

    // 4. Tambahkan Objek Checkpoint
    this.setupCheckpoint();

    // 5. Tambahkan Objek Finish Portal
    this.setupFinishPortal();

    // 6. Buat Karakter Player
    this.playerGroup = this.createPlayer();
    this.scene.add(this.playerGroup);
    this.respawnPlayer(false);

    // 7. Grid Kosmik di Bawah
    this.setupCosmicGrid();

    // 8. Event Listener
    this.setupEvents();

    // 9. Mulai Loop Game
    this.animate = this.animate.bind(this);
    this.clock.start();
    this.animate();
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0x8ba2c4, 0.85);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x4f46e5, 0x0f172a, 0.65);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    sunLight.position.set(18, 28, 14);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 90;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);
  }

  private createPlayer(): THREE.Group {
    const group = new THREE.Group();

    // Badan kapsul robot
    const bodyGeometry = new THREE.CapsuleGeometry(0.42, 0.76, 8, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.25,
      metalness: 0.2,
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    bodyMesh.position.y = 0.8;
    group.add(bodyMesh);

    // Visor hitam
    const visorGeo = new THREE.BoxGeometry(0.48, 0.2, 0.25);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x030712 });
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.position.set(0, 1.05, 0.32);
    group.add(visorMesh);

    // Lampu mata neon
    const eyeLightGeo = new THREE.BoxGeometry(0.36, 0.08, 0.05);
    const eyeLightMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
    const eyeMesh = new THREE.Mesh(eyeLightGeo, eyeLightMat);
    eyeMesh.position.set(0, 1.05, 0.44);
    group.add(eyeMesh);

    // Cincin energi hover
    const ringGeo = new THREE.TorusGeometry(0.38, 0.04, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.7,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.15;
    group.add(ringMesh);

    return group;
  }

  private buildLevel(): void {
    const platformsData = [
      // Platform 1: Start
      { x: 0, y: 0, z: 0, w: 8, h: 1, d: 8, color: 0x1e293b, accent: 0x38bdf8 },
      // Platform 2: Gap pertama
      { x: 0, y: 0.4, z: -9, w: 5, h: 1, d: 5, color: 0x1e293b, accent: 0xa855f7 },
      // Platform 3: Serong kanan
      { x: 4, y: 1.2, z: -17, w: 4.5, h: 1, d: 4.5, color: 0x1e293b, accent: 0x06b6d4 },
      // Platform 4: Tempat Checkpoint (Serong kiri)
      { x: -3, y: 2.0, z: -25, w: 5.5, h: 1, d: 5.5, color: 0x1e293b, accent: 0x10b981 },
      // Platform 5: Lompatan presisi kecil
      { x: 0, y: 2.8, z: -33, w: 3.2, h: 1, d: 3.2, color: 0x1e293b, accent: 0xf59e0b },
      // Platform 6: Finish Platform
      { x: 0, y: 3.5, z: -43, w: 7.5, h: 1, d: 7.5, color: 0x1e293b, accent: 0x22c55e },
    ];

    platformsData.forEach((p, index) => {
      const group = new THREE.Group();

      const geo = new THREE.BoxGeometry(p.w, p.h, p.d);
      const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: 0.45,
        metalness: 0.15,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Garis Neon atas
      const edgeGeo = new THREE.BoxGeometry(p.w + 0.06, 0.1, p.d + 0.06);
      const edgeMat = new THREE.MeshStandardMaterial({
        color: p.accent,
        emissive: p.accent,
        emissiveIntensity: 0.65,
      });
      const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      edgeMesh.position.y = p.h / 2 - 0.05;
      group.add(edgeMesh);

      // Start Pad visual indicator
      if (index === 0) {
        const startPad = new THREE.Mesh(
          new THREE.CylinderGeometry(2, 2, 0.06, 28),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1, emissiveIntensity: 0.5 })
        );
        startPad.position.y = p.h / 2 + 0.03;
        group.add(startPad);
      }

      group.position.set(p.x, p.y, p.z);
      this.scene.add(group);

      const boundingBox = new THREE.Box3().setFromObject(mesh);
      boundingBox.translate(new THREE.Vector3(p.x, p.y, p.z));
      this.platformBoxes.push({ mesh, box: boundingBox });
    });
  }

  /**
   * Checkpoint 3D Totem dengan Kristal Melayang dan Cahaya Emissive
   */
  private setupCheckpoint(): void {
    const cpGroup = new THREE.Group();

    // Tiang penyangga kiri dan kanan
    const pylonGeo = new THREE.CylinderGeometry(0.12, 0.16, 2.2, 12);
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.3 });

    const leftPylon = new THREE.Mesh(pylonGeo, pylonMat);
    leftPylon.position.set(-0.9, 1.1, 0);
    leftPylon.castShadow = true;
    cpGroup.add(leftPylon);

    const rightPylon = new THREE.Mesh(pylonGeo, pylonMat);
    rightPylon.position.set(0.9, 1.1, 0);
    rightPylon.castShadow = true;
    cpGroup.add(rightPylon);

    // Dudukan cincin neon di bawah
    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.06, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.8 })
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.08;
    cpGroup.add(baseRing);

    // Kristal Melayang (Octahedron)
    const crystalGeo = new THREE.OctahedronGeometry(0.48, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Awalnya oranye/amber (Belum aktif)
      emissive: 0xf59e0b,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.3,
    });
    this.checkpointCrystal = new THREE.Mesh(crystalGeo, crystalMat);
    this.checkpointCrystal.position.y = 1.4;
    this.checkpointCrystal.castShadow = true;
    cpGroup.add(this.checkpointCrystal);

    // Lampu titik Checkpoint
    this.checkpointLight = new THREE.PointLight(0xf59e0b, 1.2, 5);
    this.checkpointLight.position.y = 1.4;
    cpGroup.add(this.checkpointLight);

    cpGroup.position.copy(this.checkpointPosition);
    this.scene.add(cpGroup);
    this.checkpointMesh = cpGroup;
  }

  /**
   * Portal Gerbang Finish dengan Cincin Holografik dan Pilar Cahaya
   */
  private setupFinishPortal(): void {
    const portalGroup = new THREE.Group();

    // Pad dasar bundar finish
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.1, 32),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x22c55e, emissiveIntensity: 0.6 })
    );
    pad.position.y = 0.05;
    portalGroup.add(pad);

    // Cincin Luar Berputar
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.08, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x4ade80, emissiveIntensity: 0.8 })
    );
    ring1.position.y = 2.0;
    portalGroup.add(ring1);
    this.finishRings.push(ring1);

    // Cincin Dalam Berputar ke arah sebaliknya
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.06, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.8 })
    );
    ring2.position.y = 2.0;
    portalGroup.add(ring2);
    this.finishRings.push(ring2);

    // Pilar Cahaya Tegak ke Langit (Beacon of Light)
    const beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 20, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 10;
    portalGroup.add(beam);

    portalGroup.position.copy(this.finishPosition);
    this.scene.add(portalGroup);
    this.finishGroup = portalGroup;
  }

  private setupCosmicGrid(): void {
    const gridHelper = new THREE.GridHelper(140, 70, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -10;
    this.scene.add(gridHelper);
  }

  private setupEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('resize', this.handleResize);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.isFinished) return;

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'Space':
        if (this.isGrounded) {
          this.playerVelocity.y = this.jumpForce;
          this.isGrounded = false;
          sounds.playJump();
        }
        this.keys.jump = true;
        e.preventDefault();
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'Space':
        this.keys.jump = false;
        break;
    }
  };

  private handleResize = (): void => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  /**
   * Respawn karakter ke titik aktif (bisa start awal atau checkpoint)
   */
  public respawnPlayer(forceStart: boolean = false): void {
    if (forceStart) {
      this.currentRespawnPoint.copy(this.initialSpawnPosition);
    }
    this.playerGroup.position.copy(this.currentRespawnPoint);
    this.playerVelocity.set(0, 0, 0);
    this.isGrounded = false;
    this.playerGroup.rotation.y = 0;
  }

  /**
   * Reset seluruh sesi game dari awal
   */
  public restartLevel(): void {
    this.deaths = 0;
    this.elapsedTime = 0;
    this.isFinished = false;
    this.checkpointActive = false;
    this.currentRespawnPoint.copy(this.initialSpawnPosition);

    // Kembalikan visual checkpoint ke warna oranye
    if (this.checkpointCrystal && this.checkpointLight) {
      (this.checkpointCrystal.material as THREE.MeshStandardMaterial).color.setHex(0xf59e0b);
      (this.checkpointCrystal.material as THREE.MeshStandardMaterial).emissive.setHex(0xf59e0b);
      this.checkpointLight.color.setHex(0xf59e0b);
    }

    this.respawnPlayer(true);
  }

  private updatePlayer(deltaTime: number): void {
    if (this.isFinished) return;

    // Tambah waktu gameplay
    this.elapsedTime += deltaTime;

    if (this.checkpointNoticeTimer > 0) {
      this.checkpointNoticeTimer -= deltaTime;
    }

    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.z -= 1;
    if (this.keys.backward) moveDir.z += 1;
    if (this.keys.left) moveDir.x -= 1;
    if (this.keys.right) moveDir.x += 1;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      this.playerGroup.rotation.y = targetRotation;
      this.playerGroup.position.x += moveDir.x * this.moveSpeed * deltaTime;
      this.playerGroup.position.z += moveDir.z * this.moveSpeed * deltaTime;
    }

    // Terapkan gravitasi
    this.playerVelocity.y += this.gravity * deltaTime;
    this.playerGroup.position.y += this.playerVelocity.y * deltaTime;

    // Periksa Collision dengan platform
    this.checkPlatformCollisions();

    // Periksa Checkpoint Collision
    this.checkCheckpointTrigger();

    // Periksa Finish Goal Trigger
    this.checkFinishTrigger();

    // Fall Detection
    if (this.playerGroup.position.y < this.deathHeight) {
      this.deaths++;
      sounds.playDeath();
      const atCheckpoint = this.checkpointActive;
      this.respawnPlayer(false);
      if (this.onDeath) {
        this.onDeath(this.deaths, atCheckpoint);
      }
    }

    // Update status ke React
    if (this.onStatsChange) {
      this.onStatsChange({
        deaths: this.deaths,
        isGrounded: this.isGrounded,
        playerY: this.playerGroup.position.y,
        elapsedTime: this.elapsedTime,
        isFinished: this.isFinished,
        hasCheckpoint: this.checkpointActive,
        checkpointActivatedNotice: this.checkpointNoticeTimer > 0,
      });
    }
  }

  private checkPlatformCollisions(): void {
    const playerPos = this.playerGroup.position;
    const halfWidth = this.playerSize.width / 2;
    const halfDepth = this.playerSize.depth / 2;

    this.wasGrounded = this.isGrounded;
    let onGroundNow = false;

    for (const { box } of this.platformBoxes) {
      const withinX = playerPos.x + halfWidth > box.min.x && playerPos.x - halfWidth < box.max.x;
      const withinZ = playerPos.z + halfDepth > box.min.z && playerPos.z - halfDepth < box.max.z;

      if (withinX && withinZ) {
        const platformTop = box.max.y;
        if (this.playerVelocity.y <= 0 && playerPos.y <= platformTop + 0.25 && playerPos.y >= platformTop - 0.6) {
          playerPos.y = platformTop;
          this.playerVelocity.y = 0;
          this.isGrounded = true;
          onGroundNow = true;

          // Sound effect mendarat jika baru saja jatuh dari udara
          if (!this.wasGrounded) {
            sounds.playLand();
          }
          break;
        }
      }
    }

    if (!onGroundNow && this.isGrounded && this.playerVelocity.y <= 0) {
      this.isGrounded = false;
    }
  }

  /**
   * Deteksi jika pemain mencapai Checkpoint
   */
  private checkCheckpointTrigger(): void {
    if (this.checkpointActive) return;

    const dist = this.playerGroup.position.distanceTo(this.checkpointPosition);
    if (dist < 2.5) {
      this.checkpointActive = true;
      this.currentRespawnPoint.set(this.checkpointPosition.x, this.checkpointPosition.y + 0.5, this.checkpointPosition.z);
      this.checkpointNoticeTimer = 2.5; // Tampilkan notifikasi selama 2.5 detik

      // Ubah warna kristal menjadi cyan/emerald bersinar
      if (this.checkpointCrystal && this.checkpointLight) {
        (this.checkpointCrystal.material as THREE.MeshStandardMaterial).color.setHex(0x10b981);
        (this.checkpointCrystal.material as THREE.MeshStandardMaterial).emissive.setHex(0x34d399);
        (this.checkpointCrystal.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9;
        this.checkpointLight.color.setHex(0x34d399);
        this.checkpointLight.intensity = 2.0;
      }

      sounds.playCheckpoint();
    }
  }

  /**
   * Deteksi jika pemain mencapai garis finish
   */
  private checkFinishTrigger(): void {
    if (this.isFinished) return;

    const dist = this.playerGroup.position.distanceTo(this.finishPosition);
    if (dist < 2.4 && this.isGrounded) {
      this.isFinished = true;

      // Hitung rating bintang
      let stars = 1;
      if (this.deaths === 0 && this.elapsedTime < 35) {
        stars = 3;
      } else if (this.deaths <= 2 && this.elapsedTime < 60) {
        stars = 2;
      }

      sounds.playVictory();

      if (this.onVictory) {
        this.onVictory({
          timeSeconds: this.elapsedTime,
          deaths: this.deaths,
          stars,
        });
      }
    }
  }

  /**
   * Animasi rotasi checkpoint kristal dan portal finish
   */
  private updateWorldObjects(time: number): void {
    // Animasi mengambang & rotasi kristal checkpoint
    if (this.checkpointCrystal) {
      this.checkpointCrystal.rotation.y += 0.03;
      this.checkpointCrystal.rotation.x = Math.sin(time * 2) * 0.15;
      this.checkpointCrystal.position.y = 1.35 + Math.sin(time * 3) * 0.12;
    }

    // Animasi putaran cincin portal finish
    if (this.finishRings.length >= 2) {
      this.finishRings[0].rotation.z += 0.025;
      this.finishRings[0].rotation.y += 0.015;
      this.finishRings[1].rotation.z -= 0.035;
      this.finishRings[1].rotation.x += 0.02;
    }
  }

  private updateCamera(deltaTime: number): void {
    const cameraOffset = new THREE.Vector3(0, 4.2, 7.8);
    const targetCameraPos = this.playerGroup.position.clone().add(cameraOffset);
    this.camera.position.lerp(targetCameraPos, 0.12);

    const lookTarget = this.playerGroup.position.clone().add(new THREE.Vector3(0, 1.2, -1.0));
    this.camera.lookAt(lookTarget);
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const deltaTime = Math.min(this.clock.getDelta(), 0.05);
    const elapsedTime = this.clock.getElapsedTime();

    this.updatePlayer(deltaTime);
    this.updateWorldObjects(elapsedTime);
    this.updateCamera(deltaTime);

    this.renderer.render(this.scene, this.camera);
  }

  public setKey(key: 'forward' | 'backward' | 'left' | 'right' | 'jump', value: boolean): void {
    this.keys[key] = value;
    if (key === 'jump' && value && this.isGrounded && !this.isFinished) {
      this.playerVelocity.y = this.jumpForce;
      this.isGrounded = false;
      sounds.playJump();
    }
  }

  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('resize', this.handleResize);

    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
