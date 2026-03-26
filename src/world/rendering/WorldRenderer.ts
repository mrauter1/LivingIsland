import * as THREE from "three";
import type {
  PresentationDistrict,
  PresentationRoadEdge,
  PresentationState,
  PresentationUtility,
  RendererFrameInput,
} from "../../simulation/core/contracts";
import type { CameraState, TerrainClass, WeatherState } from "../../types";
import type { RendererLifecycle } from "./contracts";

const GRID_HALF = 64;
const WATER_LEVEL = 0.25;
const TERRAIN_BASE_Y = -5;

type DistrictVisual = {
  fireGroup: THREE.Group;
  id: string;
  material: THREE.MeshStandardMaterial;
  lightMaterial: THREE.MeshBasicMaterial;
};

type ActorKind = "car" | "tram" | "ferry";

type ActorVisual = {
  hover: number;
  kind: ActorKind;
  mesh: THREE.Mesh;
  path: THREE.Vector3[];
  phase: number;
  speed: number;
};

type CloudVisual = {
  altitude: number;
  group: THREE.Group;
  phase: number;
  scale: number;
  speed: number;
  x: number;
  z: number;
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed: string | number): () => number {
  let state = typeof seed === "number" ? seed || 1 : hashString(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967295;
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function terrainColor(terrain: TerrainClass): string {
  switch (terrain) {
    case "coast":
      return "#f0d18c";
    case "forest":
      return "#3d7447";
    case "hills":
      return "#7da06a";
    case "cliff":
      return "#7b6a61";
    default:
      return "#67a35d";
  }
}

function districtColor(type: PresentationDistrict["type"]): string {
  switch (type) {
    case "residential":
      return "#d9f1ff";
    case "commercial":
      return "#ffd37c";
    case "industrial":
      return "#d28d56";
    case "leisure":
      return "#8fe0b7";
    default:
      return "#ffffff";
  }
}

function utilityColor(type: PresentationUtility["type"]): string {
  switch (type) {
    case "power_plant":
      return "#7f8aa5";
    case "water_tower":
      return "#75d5ff";
    case "waste_center":
      return "#8c7a63";
    case "park":
      return "#7bd389";
    case "fire_station":
      return "#ff7f6b";
    default:
      return "#b0b8c5";
  }
}

function surfaceHeight(elevation: number): number {
  return 0.35 + elevation * 12;
}

function worldPosition(x: number, z: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(x - GRID_HALF + 0.5, y, z - GRID_HALF + 0.5);
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }
  material.dispose();
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geometry = child.geometry as THREE.BufferGeometry;
      const material = child.material as THREE.Material | THREE.Material[];
      geometry.dispose();
      disposeMaterial(material);
    }
    if (child instanceof THREE.Line) {
      const geometry = child.geometry as THREE.BufferGeometry;
      const material = child.material as THREE.Material | THREE.Material[];
      geometry.dispose();
      disposeMaterial(material);
    }
    if (child instanceof THREE.Points) {
      const geometry = child.geometry as THREE.BufferGeometry;
      const material = child.material as THREE.Material | THREE.Material[];
      geometry.dispose();
      disposeMaterial(material);
    }
  });
}

function linePathSignature(lines: Array<{ id: string; path: Array<{ x: number; y: number }> }>): string {
  return lines
    .map((line) => `${line.id}:${line.path.map((point) => `${point.x},${point.y}`).join("|")}`)
    .join(";");
}

function districtSignature(districts: PresentationDistrict[]): string {
  return districts
    .map(
      (district) =>
        `${district.id}:${district.type}:${district.level}:${district.blackout ? "1" : "0"}:${district.footprint.x},${district.footprint.y},${district.footprint.width},${district.footprint.height}`,
    )
    .join(";");
}

function utilitySignature(utilities: PresentationUtility[]): string {
  return utilities
    .map(
      (utility) =>
        `${utility.id}:${utility.type}:${utility.footprint.x},${utility.footprint.y},${utility.footprint.width},${utility.footprint.height}`,
    )
    .join(";");
}

function polylineLength(path: THREE.Vector3[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += path[index]!.distanceTo(path[index - 1]!);
  }
  return total;
}

function samplePolyline(path: THREE.Vector3[], progress: number): THREE.Vector3 {
  if (path.length === 0) {
    return new THREE.Vector3();
  }
  if (path.length === 1) {
    return path[0]!.clone();
  }

  const totalLength = polylineLength(path);
  if (totalLength <= 0) {
    return path[0]!.clone();
  }

  let targetDistance = ((progress % 1) + 1) % 1 * totalLength;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]!;
    const end = path[index]!;
    const segmentLength = start.distanceTo(end);
    if (targetDistance <= segmentLength) {
      const localT = segmentLength === 0 ? 0 : targetDistance / segmentLength;
      return start.clone().lerp(end, localT);
    }
    targetDistance -= segmentLength;
  }

  return path[path.length - 1]!.clone();
}

function daylightFactor(dayProgress: number): number {
  const arc = Math.sin((dayProgress - 0.25) * Math.PI * 2);
  return smoothstep(-0.24, 0.32, arc);
}

export class WorldRenderer {
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
  private readonly root = new THREE.Group();
  private readonly terrainGroup = new THREE.Group();
  private readonly roadGroup = new THREE.Group();
  private readonly districtGroup = new THREE.Group();
  private readonly utilityGroup = new THREE.Group();
  private readonly actorGroup = new THREE.Group();
  private readonly cloudGroup = new THREE.Group();
  private readonly weatherGroup = new THREE.Group();
  private readonly ambientLight = new THREE.AmbientLight("#d5e7ff", 1.1);
  private readonly hemisphereLight = new THREE.HemisphereLight("#9ec8ff", "#21402d", 1.35);
  private readonly sun = new THREE.DirectionalLight("#ffe6a8", 2.1);
  private readonly moon = new THREE.DirectionalLight("#7aa2ff", 0.15);
  private waterMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial> | null = null;
  private waterBasePositions: Float32Array | null = null;
  private rainGeometry: THREE.BufferGeometry | null = null;
  private rainBase: Array<{ speed: number; x: number; y: number; z: number }> = [];
  private rainPoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  private districtVisuals = new Map<string, DistrictVisual>();
  private cloudVisuals: CloudVisual[] = [];
  private actorVisuals: ActorVisual[] = [];
  private terrainSignature = "";
  private districtLayoutSignature = "";
  private utilityLayoutSignature = "";
  private roadLayoutSignature = "";
  private tramLayoutSignature = "";
  private ferryLayoutSignature = "";
  private actorSignature = "";
  private heightByTile = new Map<string, number>();
  private ferryEfficiency = 1;
  private trafficAverageCongestion = 0;
  private lifecycle: RendererLifecycle = "idle";

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor("#87cde8");
    container.append(this.renderer.domElement);

    this.scene.add(this.ambientLight);
    this.scene.add(this.hemisphereLight);
    this.scene.add(this.sun);
    this.scene.add(this.moon);
    this.scene.add(this.root);
    this.root.add(this.terrainGroup);
    this.root.add(this.roadGroup);
    this.root.add(this.districtGroup);
    this.root.add(this.utilityGroup);
    this.root.add(this.actorGroup);
    this.root.add(this.cloudGroup);
    this.root.add(this.weatherGroup);

    this.sun.position.set(65, 120, 80);
    this.moon.position.set(-90, 80, -70);
    this.camera.position.set(0, 120, 140);
    this.camera.lookAt(0, 0, 0);
    this.scene.fog = new THREE.Fog("#87cde8", 65, 230);
    this.lifecycle = "mounted";
  }

  resize(): void {
    if (this.lifecycle !== "mounted") {
      return;
    }

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render(frame: RendererFrameInput, elapsedMs = 0): void {
    if (this.lifecycle !== "mounted") {
      return;
    }

    const { presentation } = frame;
    const timeSeconds = elapsedMs / 1000;
    this.syncStaticScene(presentation);
    this.ferryEfficiency = presentation.ferryEfficiency;
    this.trafficAverageCongestion = presentation.averageCongestion;
    this.updateEnvironment(presentation.dayProgress, presentation.weather, timeSeconds);
    this.updateDistrictLights(presentation.districts, daylightFactor(presentation.dayProgress));
    this.updateDistrictEffects(presentation.districts, timeSeconds);
    this.updateClouds(timeSeconds, presentation.weather, presentation.dayProgress);
    this.updateActors(timeSeconds);
    this.updateRain(timeSeconds, presentation.weather);
    this.updateCamera(frame.camera, presentation.dayProgress, timeSeconds);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.lifecycle !== "mounted") {
      return;
    }

    this.lifecycle = "disposed";
    if (this.waterMesh) {
      disposeObject3D(this.waterMesh);
    }
    if (this.rainPoints) {
      disposeObject3D(this.rainPoints);
    }
    disposeObject3D(this.root);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  private syncStaticScene(presentation: PresentationState): void {
    const nextTerrainSignature = `${presentation.seed}:${presentation.tiles.length}`;
    if (nextTerrainSignature !== this.terrainSignature) {
      this.rebuildTerrain(presentation);
      this.rebuildClouds(presentation.seed);
      this.terrainSignature = nextTerrainSignature;
    }

    const nextRoadSignature = linePathSignature(presentation.roadEdges);
    if (nextRoadSignature !== this.roadLayoutSignature) {
      this.rebuildRoads(presentation.roadEdges);
      this.roadLayoutSignature = nextRoadSignature;
    }

    const nextDistrictSignature = districtSignature(presentation.districts);
    if (nextDistrictSignature !== this.districtLayoutSignature) {
      this.rebuildDistricts(presentation.seed, presentation.districts);
      this.districtLayoutSignature = nextDistrictSignature;
    }

    const nextUtilitySignature = utilitySignature(presentation.utilities);
    if (nextUtilitySignature !== this.utilityLayoutSignature) {
      this.rebuildUtilities(presentation.utilities);
      this.utilityLayoutSignature = nextUtilitySignature;
    }

    const nextTramSignature = linePathSignature(presentation.tramLines);
    const nextFerrySignature = presentation.ferryRoutes
      .map((route) => `${route.id}:${route.from.x},${route.from.y}:${route.to.x},${route.to.y}`)
      .join(";");
    const nextActorSignature = [
      nextRoadSignature,
      nextTramSignature,
      nextFerrySignature,
      presentation.actors.cars,
      presentation.actors.trams,
      presentation.actors.ferries,
    ].join("|");

    if (
      nextActorSignature !== this.actorSignature ||
      nextTramSignature !== this.tramLayoutSignature ||
      nextFerrySignature !== this.ferryLayoutSignature
    ) {
      this.rebuildActors(presentation);
      this.actorSignature = nextActorSignature;
      this.tramLayoutSignature = nextTramSignature;
      this.ferryLayoutSignature = nextFerrySignature;
    }
  }

  private rebuildTerrain(presentation: PresentationState): void {
    this.heightByTile.clear();

    const previousTerrain = [...this.terrainGroup.children];
    previousTerrain.forEach((child) => {
      this.terrainGroup.remove(child);
      disposeObject3D(child);
    });

    const landTiles = presentation.tiles.filter((tile) => tile.terrain !== "water");
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.92,
      metalness: 0.04,
      vertexColors: true,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, landTiles.length);
    const dummy = new THREE.Object3D();

    landTiles.forEach((tile, index) => {
      const top = surfaceHeight(tile.elevation);
      const height = top - TERRAIN_BASE_Y;
      this.heightByTile.set(`${tile.x},${tile.y}`, top);
      dummy.position.copy(worldPosition(tile.x, tile.y, TERRAIN_BASE_Y + height / 2));
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, new THREE.Color(terrainColor(tile.terrain)));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    this.terrainGroup.add(mesh);

    const waterGeometry = new THREE.PlaneGeometry(170, 170, 48, 48);
    waterGeometry.rotateX(-Math.PI / 2);
    const waterPositionAttribute = waterGeometry.getAttribute("position") as THREE.BufferAttribute;
    this.waterBasePositions = new Float32Array(waterPositionAttribute.array);
    const waterMaterial = new THREE.MeshPhysicalMaterial({
      color: "#2f93ca",
      emissive: new THREE.Color("#0a395d"),
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.96,
      roughness: 0.18,
      metalness: 0.06,
      clearcoat: 0.5,
      clearcoatRoughness: 0.22,
    });
    this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    this.waterMesh.position.y = WATER_LEVEL;
    this.terrainGroup.add(this.waterMesh);
  }

  private rebuildRoads(roadEdges: PresentationRoadEdge[]): void {
    const previousRoads = [...this.roadGroup.children];
    previousRoads.forEach((child) => {
      this.roadGroup.remove(child);
      disposeObject3D(child);
    });

    for (const edge of roadEdges) {
      const curvePoints = edge.path.map((point) => worldPosition(point.x, point.y, this.tileHeight(point.x, point.y) + 0.14));
      if (curvePoints.length < 2) {
        continue;
      }
      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const geometry = new THREE.TubeGeometry(curve, Math.max(10, edge.path.length * 8), 0.2, 8, false);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08 - edge.congestion * 0.07, 0.2, 0.22 + edge.congestion * 0.08),
        roughness: 0.95,
        metalness: 0.05,
      });
      const mesh = new THREE.Mesh(geometry, material);
      this.roadGroup.add(mesh);
    }
  }

  private rebuildDistricts(seed: string, districts: PresentationDistrict[]): void {
    const previousDistricts = [...this.districtGroup.children];
    previousDistricts.forEach((child) => {
      this.districtGroup.remove(child);
      disposeObject3D(child);
    });
    this.districtVisuals.clear();

    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

    for (const district of districts) {
      const rng = createSeededRng(`${seed}:${district.id}`);
      const group = new THREE.Group();
      const footprintCenter = worldPosition(
        district.footprint.x + district.footprint.width / 2 - 0.5,
        district.footprint.y + district.footprint.height / 2 - 0.5,
        this.tileHeight(district.footprint.x, district.footprint.y),
      );
      const padGeometry = new THREE.BoxGeometry(district.footprint.width, 0.22, district.footprint.height);
      const padMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(districtColor(district.type)).multiplyScalar(0.65),
        roughness: 0.96,
        metalness: 0.02,
      });
      const pad = new THREE.Mesh(padGeometry, padMaterial);
      pad.position.set(footprintCenter.x, footprintCenter.y + 0.12, footprintCenter.z);
      group.add(pad);

      const material = new THREE.MeshStandardMaterial({
        color: districtColor(district.type),
        roughness: 0.68,
        metalness: 0.04,
        emissive: new THREE.Color("#ffd79a"),
        emissiveIntensity: 0,
      });
      const lightMaterial = new THREE.MeshBasicMaterial({
        color: "#ffd58a",
        transparent: true,
        opacity: 0,
      });
      const fireGroup = new THREE.Group();
      fireGroup.visible = false;
      for (let flameIndex = 0; flameIndex < 3; flameIndex += 1) {
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.28 + flameIndex * 0.08, 1.2 + flameIndex * 0.28, 6),
          new THREE.MeshStandardMaterial({
            color: flameIndex === 0 ? "#ffd166" : flameIndex === 1 ? "#ff8c42" : "#d1495b",
            emissive: flameIndex === 0 ? "#ffcf70" : "#ff7b32",
            emissiveIntensity: 0.7,
            transparent: true,
            opacity: 0.86,
          }),
        );
        flame.position.set((flameIndex - 1) * 0.42, 1 + flameIndex * 0.35, (flameIndex % 2 === 0 ? -1 : 1) * 0.25);
        flame.userData.basePosition = flame.position.clone();
        fireGroup.add(flame);
      }
      for (let smokeIndex = 0; smokeIndex < 4; smokeIndex += 1) {
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.22 + smokeIndex * 0.08, 8, 8),
          new THREE.MeshStandardMaterial({
            color: "#4d545c",
            transparent: true,
            opacity: 0.34,
            roughness: 1,
            metalness: 0,
          }),
        );
        smoke.position.set((smokeIndex - 1.5) * 0.22, 2.4 + smokeIndex * 0.45, (smokeIndex % 2 === 0 ? -1 : 1) * 0.18);
        smoke.userData.basePosition = smoke.position.clone();
        fireGroup.add(smoke);
      }
      fireGroup.position.set(footprintCenter.x, footprintCenter.y + 0.25, footprintCenter.z);
      group.add(fireGroup);
      const spacing = district.level >= 4 ? 1.35 : 1.55;
      const density = clamp01(0.3 + district.level * 0.1 + district.activity * 0.18);

      for (
        let localX = district.footprint.x + 0.8;
        localX < district.footprint.x + district.footprint.width - 0.4;
        localX += spacing
      ) {
        for (
          let localY = district.footprint.y + 0.8;
          localY < district.footprint.y + district.footprint.height - 0.4;
          localY += spacing
        ) {
          if (rng() > density) {
            continue;
          }
          const width = 0.6 + rng() * 0.5;
          const depth = 0.6 + rng() * 0.5;
          const typeBaseHeight =
            district.type === "commercial" ? 4.2 : district.type === "industrial" ? 2.7 : district.type === "leisure" ? 2.4 : 3.4;
          const height = typeBaseHeight + district.level * (district.type === "commercial" ? 1.7 : 1.15) + rng() * 2.6;
          const x = localX + (rng() - 0.5) * 0.3;
          const z = localY + (rng() - 0.5) * 0.3;
          const ground = this.tileHeight(Math.floor(x), Math.floor(z));

          const building = new THREE.Mesh(boxGeometry, material);
          building.scale.set(width, height, depth);
          building.position.copy(worldPosition(x, z, ground + height / 2 + 0.18));
          group.add(building);

          if (district.level >= 2) {
            const light = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.12, depth * 0.82), lightMaterial);
            light.position.copy(worldPosition(x, z, ground + Math.max(1.6, height - 0.45)));
            group.add(light);
          }
        }
      }

      this.districtGroup.add(group);
      this.districtVisuals.set(district.id, {
        fireGroup,
        id: district.id,
        material,
        lightMaterial,
      });
    }
  }

  private rebuildUtilities(utilities: PresentationUtility[]): void {
    const previousUtilities = [...this.utilityGroup.children];
    previousUtilities.forEach((child) => {
      this.utilityGroup.remove(child);
      disposeObject3D(child);
    });

    for (const utility of utilities) {
      const group = new THREE.Group();
      const ground = this.tileHeight(utility.footprint.x, utility.footprint.y);
      const center = worldPosition(
        utility.footprint.x + utility.footprint.width / 2 - 0.5,
        utility.footprint.y + utility.footprint.height / 2 - 0.5,
        ground,
      );
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(utility.footprint.width, 0.5, utility.footprint.height),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(utilityColor(utility.type)).multiplyScalar(0.72),
          roughness: 0.92,
          metalness: 0.04,
        }),
      );
      base.position.set(center.x, center.y + 0.25, center.z);
      group.add(base);

      const bodyHeight =
        utility.type === "water_tower" ? 5.5 : utility.type === "power_plant" ? 4.2 : utility.type === "fire_station" ? 2.8 : 2.2;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(1.8, utility.footprint.width - 0.8), bodyHeight, Math.max(1.8, utility.footprint.height - 0.8)),
        new THREE.MeshStandardMaterial({
          color: utilityColor(utility.type),
          roughness: 0.78,
          metalness: utility.type === "water_tower" ? 0.18 : 0.05,
        }),
      );
      body.position.set(center.x, center.y + 0.5 + bodyHeight / 2, center.z);
      group.add(body);

      if (utility.type === "water_tower") {
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.7, 4.5, 12),
          new THREE.MeshStandardMaterial({ color: "#cdefff", roughness: 0.52, metalness: 0.22 }),
        );
        tower.position.set(center.x, center.y + 5.2, center.z);
        group.add(tower);
      }

      if (utility.type === "power_plant") {
        for (const offset of [-0.8, 0.8]) {
          const stack = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.32, 5.8, 10),
            new THREE.MeshStandardMaterial({ color: "#b5bfd1", roughness: 0.8, metalness: 0.12 }),
          );
          stack.position.set(center.x + offset, center.y + 5.2, center.z - 0.8);
          group.add(stack);
        }
      }

      this.utilityGroup.add(group);
    }
  }

  private rebuildClouds(seed: string): void {
    const previousClouds = [...this.cloudGroup.children];
    previousClouds.forEach((child) => {
      this.cloudGroup.remove(child);
      disposeObject3D(child);
    });
    this.cloudVisuals = [];

    const rng = createSeededRng(`${seed}:clouds`);
    const puffGeometry = new THREE.SphereGeometry(1, 12, 12);

    for (let index = 0; index < 13; index += 1) {
      const group = new THREE.Group();
      const scale = 2.8 + rng() * 2.9;
      const material = new THREE.MeshStandardMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.78,
        roughness: 1,
        metalness: 0,
      });

      for (let puffIndex = 0; puffIndex < 4; puffIndex += 1) {
        const puff = new THREE.Mesh(puffGeometry, material);
        puff.position.set((rng() - 0.5) * 2.8, (rng() - 0.5) * 0.8, (rng() - 0.5) * 1.7);
        puff.scale.set(1.2 + rng() * 0.8, 0.7 + rng() * 0.35, 0.9 + rng() * 0.6);
        group.add(puff);
      }

      this.cloudGroup.add(group);
      this.cloudVisuals.push({
        altitude: 26 + rng() * 12,
        group,
        phase: rng(),
        scale,
        speed: 1.5 + rng() * 1.8,
        x: -90 + rng() * 180,
        z: -85 + rng() * 170,
      });
    }
  }

  private rebuildActors(presentation: PresentationState): void {
    const previousActors = [...this.actorGroup.children];
    previousActors.forEach((child) => {
      this.actorGroup.remove(child);
      disposeObject3D(child);
    });
    this.actorVisuals = [];

    const carPaths = presentation.roadEdges
      .filter((edge) => edge.path.length >= 2)
      .flatMap((edge) => {
        const points = edge.path.map((point) => worldPosition(point.x, point.y, this.tileHeight(point.x, point.y) + 0.34));
        if (points.length < 2) {
          return [];
        }
        return [points];
      });
    const tramPaths = presentation.tramLines
      .filter((line) => line.path.length >= 2)
      .map((line) => line.path.map((point) => worldPosition(point.x, point.y, this.tileHeight(point.x, point.y) + 0.46)));
    const ferryPaths = presentation.ferryRoutes.map((route) => [
      worldPosition(route.from.x, route.from.y, WATER_LEVEL + 0.36),
      worldPosition((route.from.x + route.to.x) / 2, (route.from.y + route.to.y) / 2, WATER_LEVEL + 0.48),
      worldPosition(route.to.x, route.to.y, WATER_LEVEL + 0.36),
    ]);

    this.spawnActors("car", Math.min(20, Math.max(0, presentation.actors.cars)), carPaths, "#f8f4ed");
    this.spawnActors("tram", Math.min(4, Math.max(0, presentation.actors.trams)), tramPaths, "#ffd166");
    this.spawnActors("ferry", Math.min(3, Math.max(0, presentation.actors.ferries)), ferryPaths, "#f5fbff");
  }

  private spawnActors(kind: ActorKind, count: number, paths: THREE.Vector3[][], color: string): void {
    if (count <= 0 || paths.length === 0) {
      return;
    }

    const geometry =
      kind === "ferry"
        ? new THREE.BoxGeometry(1.2, 0.28, 0.6)
        : kind === "tram"
          ? new THREE.BoxGeometry(0.95, 0.32, 0.42)
          : new THREE.BoxGeometry(0.34, 0.22, 0.18);

    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color,
          emissive: kind === "car" ? new THREE.Color("#f6c46b") : new THREE.Color("#231c0f"),
          emissiveIntensity: kind === "car" ? 0.35 : 0.1,
          roughness: 0.55,
          metalness: kind === "tram" ? 0.18 : 0.04,
        }),
      );
      this.actorGroup.add(mesh);
      this.actorVisuals.push({
        hover: kind === "ferry" ? 0.05 : 0,
        kind,
        mesh,
        path: paths[index % paths.length]!,
        phase: (index / Math.max(1, count)) % 1,
        speed: kind === "car" ? 0.16 + (index % 5) * 0.018 : kind === "tram" ? 0.06 : 0.028,
      });
    }
  }

  private updateEnvironment(dayProgress: number, weather: WeatherState, timeSeconds: number): void {
    const daylight = daylightFactor(dayProgress);
    const night = 1 - daylight;
    const storminess = weather === "storm" ? 1 : weather === "rain" ? 0.58 : weather === "cloudy" ? 0.32 : weather === "fog" ? 0.18 : 0;
    const sunArc = (dayProgress - 0.25) * Math.PI * 2;
    const sunY = Math.sin(sunArc);
    const sunX = Math.cos(sunArc);

    this.sun.intensity = 0.3 + daylight * 2.2 - storminess * 0.55;
    this.sun.color.set(lerp(new THREE.Color("#ffb56b").getHex(), new THREE.Color("#fff1c6").getHex(), daylight));
    this.sun.position.set(110 * sunX, 36 + 105 * Math.max(0.1, sunY + 0.25), 95 * Math.sin(sunArc * 0.78));

    this.moon.intensity = 0.08 + night * 0.55;
    this.moon.position.set(-this.sun.position.x * 0.7, 28 + night * 55, -this.sun.position.z * 0.7);
    this.ambientLight.intensity = 0.32 + daylight * 0.95 - storminess * 0.12;
    this.hemisphereLight.intensity = 0.65 + daylight * 0.9 - storminess * 0.18;

    const skyTop = new THREE.Color("#0f2547")
      .lerp(new THREE.Color("#4da1d8"), daylight)
      .lerp(new THREE.Color("#3f5770"), storminess);
    const skyHorizon = new THREE.Color("#ed9562")
      .lerp(new THREE.Color("#bfe8ff"), daylight)
      .lerp(new THREE.Color("#6d7c8f"), storminess);

    this.scene.background = skyTop.clone().lerp(skyHorizon, 0.35 + 0.1 * Math.sin(timeSeconds * 0.08));
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(this.scene.background);
      this.scene.fog.near = weather === "fog" ? 20 : 65;
      this.scene.fog.far = weather === "storm" ? 175 : weather === "fog" ? 120 : 230;
    }

    if (this.waterMesh && this.waterBasePositions) {
      const positionAttribute = this.waterMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const array = positionAttribute.array as Float32Array;
      for (let index = 0; index < array.length; index += 3) {
        const baseX = this.waterBasePositions[index] ?? 0;
        const baseY = this.waterBasePositions[index + 1] ?? WATER_LEVEL;
        const baseZ = this.waterBasePositions[index + 2] ?? 0;
        const wave =
          Math.sin(baseX * 0.16 + timeSeconds * (weather === "storm" ? 2.2 : 1.2)) * 0.14 +
          Math.cos(baseZ * 0.13 + timeSeconds * 1.5) * 0.1;
        array[index] = baseX;
        array[index + 1] = baseY + wave * (weather === "storm" ? 1.7 : weather === "rain" ? 1.25 : 0.9);
        array[index + 2] = baseZ;
      }
      positionAttribute.needsUpdate = true;
      this.waterMesh.geometry.computeVertexNormals();
      this.waterMesh.material.color.set(
        weather === "storm" ? "#235e8d" : weather === "rain" ? "#287faf" : daylight < 0.25 ? "#1d5f86" : "#35a4d8",
      );
      this.waterMesh.material.emissiveIntensity = 0.2 + night * 0.42;
    }
  }

  private updateDistrictLights(districts: PresentationDistrict[], daylight: number): void {
    const night = 1 - daylight;
    for (const district of districts) {
      const visual = this.districtVisuals.get(district.id);
      if (!visual) {
        continue;
      }
      visual.material.color.set(
        new THREE.Color(districtColor(district.type)).multiplyScalar(
          0.48 + district.saturation * 0.26 + district.activity * 0.16 + district.efficiency * 0.18,
        ),
      );
      visual.material.emissiveIntensity = district.blackout ? 0.02 : night * (0.3 + district.level * 0.17);
      visual.lightMaterial.opacity = district.blackout ? 0 : night * (0.08 + district.level * 0.12);
      visual.fireGroup.visible = district.onFire;
    }
  }

  private updateDistrictEffects(districts: PresentationDistrict[], timeSeconds: number): void {
    for (const district of districts) {
      const visual = this.districtVisuals.get(district.id);
      if (!visual || !district.onFire) {
        continue;
      }

      visual.fireGroup.children.forEach((child, index) => {
        const basePosition = child.userData.basePosition as THREE.Vector3 | undefined;
        if (basePosition) {
          child.position.copy(basePosition);
        }
        if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) {
          return;
        }
        const material = child.material as THREE.MeshStandardMaterial;
        if (child.geometry instanceof THREE.ConeGeometry) {
          child.position.y += Math.sin(timeSeconds * (3 + index * 0.4) + index) * 0.04;
          child.scale.y = 0.9 + Math.sin(timeSeconds * (5 + index)) * 0.18;
          material.emissiveIntensity = 0.7 + Math.sin(timeSeconds * (7 + index * 0.5)) * 0.2;
        } else {
          child.position.y += Math.sin(timeSeconds * (2.1 + index * 0.25) + index) * 0.08;
          child.position.x += Math.sin(timeSeconds * (1.8 + index * 0.3) + index) * 0.01;
          material.opacity = 0.22 + Math.sin(timeSeconds * (2.5 + index * 0.2)) * 0.06;
        }
      });
    }
  }

  private updateClouds(timeSeconds: number, weather: WeatherState, dayProgress: number): void {
    const daylight = daylightFactor(dayProgress);
    const opacityMultiplier = weather === "storm" ? 1 : weather === "cloudy" ? 0.82 : weather === "fog" ? 0.65 : 0.55;
    for (const cloud of this.cloudVisuals) {
      const x = ((cloud.x + timeSeconds * cloud.speed * 8 + cloud.phase * 120 + 95) % 190) - 95;
      cloud.group.position.set(x, cloud.altitude, cloud.z + Math.sin(timeSeconds * 0.12 + cloud.phase * Math.PI * 2) * 4);
      cloud.group.scale.setScalar(cloud.scale);
      cloud.group.rotation.y = timeSeconds * 0.02 + cloud.phase;

      for (const child of cloud.group.children) {
        if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) {
          continue;
        }
        const material = child.material as THREE.MeshStandardMaterial;
        material.opacity = opacityMultiplier;
        material.color.set(
          weather === "storm" ? "#7c8793" : weather === "fog" ? "#d8e0e8" : daylight < 0.2 ? "#c1cad4" : "#ffffff",
        );
      }
    }
  }

  private updateActors(timeSeconds: number): void {
    for (const actor of this.actorVisuals) {
      const slowdown =
        actor.kind === "car"
          ? 1 - clamp01(this.trafficAverageCongestion * 0.7)
          : actor.kind === "tram"
            ? 1 - clamp01(this.trafficAverageCongestion * 0.3)
            : this.ferryEfficiency;
      const travel = actor.phase + timeSeconds * actor.speed * Math.max(0.18, slowdown);
      const point = samplePolyline(actor.path, travel);
      const lookAhead = samplePolyline(actor.path, travel + 0.005);
      actor.mesh.position.copy(point);
      actor.mesh.position.y += actor.hover + Math.sin(timeSeconds * 2.4 + actor.phase * Math.PI * 2) * (actor.kind === "ferry" ? 0.07 : 0);
      actor.mesh.lookAt(lookAhead);
    }
  }

  private updateRain(timeSeconds: number, weather: WeatherState): void {
    if (!this.rainPoints) {
      this.createRainSystem();
    }
    if (!this.rainPoints || !this.rainGeometry) {
      return;
    }

    const active = weather === "rain" || weather === "storm";
    this.rainPoints.visible = active;
    if (!active) {
      return;
    }

    const positionAttribute = this.rainGeometry.getAttribute("position") as THREE.BufferAttribute;
    const positions = positionAttribute.array as Float32Array;
    const fallSpan = weather === "storm" ? 38 : 30;
    const drift = weather === "storm" ? 0.55 : 0.24;
    this.rainBase.forEach((drop, index) => {
      const y = drop.y - ((timeSeconds * drop.speed * 11) % fallSpan);
      const wrappedY = y < 2 ? y + fallSpan : y;
      positions[index * 3] = drop.x + Math.sin(timeSeconds * 0.8 + drop.z) * drift;
      positions[index * 3 + 1] = wrappedY;
      positions[index * 3 + 2] = drop.z + Math.cos(timeSeconds * 0.7 + drop.x) * drift;
    });
    positionAttribute.needsUpdate = true;
    this.rainPoints.material.opacity = weather === "storm" ? 0.8 : 0.58;
  }

  private updateCamera(camera: CameraState, dayProgress: number, timeSeconds: number): void {
    const distance = camera.distance;
    const yaw = camera.cinematic ? camera.yaw + timeSeconds * 0.05 : camera.yaw;
    const pitchY = Math.sin(camera.pitch) * distance;
    const pitchXZ = Math.cos(camera.pitch) * distance;
    const orbitX = Math.cos(yaw) * pitchXZ;
    const orbitZ = Math.sin(yaw) * pitchXZ;
    const targetY = camera.target.y + 8 + Math.sin(dayProgress * Math.PI * 2) * 0.6;
    this.camera.position.set(camera.target.x - GRID_HALF + orbitX, targetY + pitchY, camera.target.z - GRID_HALF + orbitZ);
    this.camera.lookAt(new THREE.Vector3(camera.target.x - GRID_HALF, targetY, camera.target.z - GRID_HALF));
  }

  private createRainSystem(): void {
    const geometry = new THREE.BufferGeometry();
    const rng = createSeededRng("starter-rain");
    const positions = new Float32Array(360 * 3);
    this.rainBase = [];

    for (let index = 0; index < 360; index += 1) {
      const x = -78 + rng() * 156;
      const y = 12 + rng() * 36;
      const z = -78 + rng() * 156;
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;
      this.rainBase.push({
        speed: 0.7 + rng() * 0.9,
        x,
        y,
        z,
      });
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: "#d5efff",
      size: 0.22,
      transparent: true,
      opacity: 0.62,
    });
    this.rainGeometry = geometry;
    this.rainPoints = new THREE.Points(geometry, material);
    this.rainPoints.visible = false;
    this.weatherGroup.add(this.rainPoints);
  }

  private tileHeight(x: number, y: number): number {
    return this.heightByTile.get(`${Math.floor(x)},${Math.floor(y)}`) ?? WATER_LEVEL;
  }
}
