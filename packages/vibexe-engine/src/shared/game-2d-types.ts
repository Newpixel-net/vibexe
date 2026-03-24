/**
 * 2D Game Engine Types — Feature Bank & Engine API interfaces
 *
 * Used by:
 * - Feature Bank system (server-side snippet storage & validation)
 * - Engine runtime (namespace system type safety)
 * - AI code generation (documentation & config validation)
 */

// ---------------------------------------------------------------------------
// Feature Bank Types
// ---------------------------------------------------------------------------

export interface FeatureParameter {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'color' | 'select';
  default: any;
  min?: number;
  max?: number;
  description: string;
  options?: string[];
}

export interface GameFeature {
  id: string;                          // unique slug: "double-jump"
  name: string;                        // "Double Jump"
  description: string;                 // "Allows player to jump again mid-air"
  category: string;                    // "Mechanics/Movement"
  type: 'instruction' | 'condition' | 'event';
  engine: '2d' | '3d' | 'shared';
  version: string;                     // semver
  keywords: string[];                  // ["jump", "air", "movement", "platformer"]
  parameters: FeatureParameter[];
  dependencies: string[];              // other feature IDs this requires
  genres: string[];                    // ["platformer", "runner"]
  code: string;                        // TypeScript implementation
}

export interface FeatureRuntime {
  id: string;
  init(engine: any, config: Record<string, any>): void;
  update?(engine: any, dt: number): void;
  destroy?(): void;
  onEvent?(event: string, data: any): void;
}

// ---------------------------------------------------------------------------
// Engine API Config Types
// ---------------------------------------------------------------------------

export interface SpawnConfig {
  scale?: number;
  tint?: number;
  alpha?: number;
  anchor?: { x: number; y: number };
  rotation?: number;
  zIndex?: number;
}

export interface PlayerConfig extends SpawnConfig {
  speed?: number;
  jumpForce?: number;
  health?: number;
  lives?: number;
  width?: number;
  height?: number;
}

export interface EnemyConfig extends SpawnConfig {
  type?: string;
  health?: number;
  speed?: number;
  damage?: number;
  width?: number;
  height?: number;
  ai?: 'patrol' | 'chase' | 'fly' | 'shoot' | 'boss';
}

export interface PlatformConfig extends SpawnConfig {
  isOneWay?: boolean;
  isMoving?: boolean;
  moveSpeed?: number;
  movePoints?: Array<{ x: number; y: number }>;
  isBreakable?: boolean;
  texture?: string;
}

export interface ProjectileConfig extends SpawnConfig {
  speed?: number;
  damage?: number;
  lifetime?: number;
  gravity?: boolean;
}

export interface CoinConfig extends SpawnConfig {
  value?: number;
  magnetRange?: number;
  bobSpeed?: number;
}

export interface TextConfig {
  fontFamily?: string;
  fontSize?: number;
  fill?: number | string;
  stroke?: { color: number; width: number };
  align?: 'left' | 'center' | 'right';
  wordWrap?: boolean;
  wordWrapWidth?: number;
}

// ---------------------------------------------------------------------------
// UI Config Types
// ---------------------------------------------------------------------------

export interface HealthBarConfig {
  width?: number;
  height?: number;
  maxHealth?: number;
  color?: number;
  bgColor?: number;
  borderColor?: number;
  showText?: boolean;
  style?: 'bar' | 'hearts';
}

export interface ScoreConfig {
  prefix?: string;
  fontSize?: number;
  color?: number;
  juiceOnChange?: boolean;
}

export interface TimerConfig {
  seconds?: number;
  countDown?: boolean;
  fontSize?: number;
  color?: number;
  urgencyColor?: number;
  urgencyThreshold?: number;
}

// ---------------------------------------------------------------------------
// Camera Config Types
// ---------------------------------------------------------------------------

export interface CameraFollowConfig {
  smoothing?: number;
  deadZoneX?: number;
  deadZoneY?: number;
  offsetX?: number;
  offsetY?: number;
}

// ---------------------------------------------------------------------------
// Physics Config Types
// ---------------------------------------------------------------------------

export interface PhysicsBodyConfig {
  width?: number;
  height?: number;
  mass?: number;
  friction?: number;
  bounce?: number;
  isStatic?: boolean;
  isOneWay?: boolean;
  isSensor?: boolean;
  tag?: string;
}

// ---------------------------------------------------------------------------
// Effects Config Types
// ---------------------------------------------------------------------------

export type AmbientType = 'fireflies' | 'embers' | 'dust' | 'leaves' | 'pollen';

export type GameTheme = 'nature' | 'dark' | 'space' | 'cartoon' | 'mountain'
  | 'forest' | 'underwater' | 'volcanic' | 'desert' | 'urban';

// ---------------------------------------------------------------------------
// Game Specification (AI-generated JSON output)
// ---------------------------------------------------------------------------

export interface GameSpec {
  theme: string;
  genre: string;
  features: Array<{
    id: string;
    config: Record<string, any>;
  }>;
  assets: Record<string, string>;
  layout: {
    worldWidth: number;
    worldHeight: number;
    platformCount?: number;
    coinCount?: number;
    enemyCount?: number;
  };
  wiring: Array<{
    event: string;
    actions: string[];
  }>;
}
