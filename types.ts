export enum GameState {
  LOGIN = 'LOGIN',
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum ObstacleType {
  STATIC = 'STATIC',
  MOVING = 'MOVING',
  SHIP = 'SHIP',
  SLOW = 'SLOW',
  FUEL = 'FUEL',
  SHOOTER = 'SHOOTER',
  LIFE = 'LIFE',
  TANK = 'TANK',           // Tank enemy that shoots
  MINI_BOSS = 'MINI_BOSS', // Mini boss with health bar
  HELPER_PLANES = 'HELPER_PLANES',  // Power-up: side helper planes
  GUIDED_ROCKET = 'GUIDED_ROCKET',  // Power-up: guided missiles
  SHIELD = 'SHIELD',       // Power-up: temporary shield
  // Gems (5 rarity tiers)
  GEM_COMMON = 'GEM_COMMON',       // White gem - most common
  GEM_UNCOMMON = 'GEM_UNCOMMON',   // Green gem
  GEM_RARE = 'GEM_RARE',           // Blue gem
  GEM_EPIC = 'GEM_EPIC',           // Purple gem
  GEM_LEGENDARY = 'GEM_LEGENDARY', // Gold gem - rarest
  // Spinning enemy
  SPINNER = 'SPINNER',             // Rotates and shoots in rotation direction
  // Bosses
  BOSS_PLANE = 'BOSS_PLANE',       // Big plane boss
  BOSS_BALLOON = 'BOSS_BALLOON',   // Big balloon boss
  BOSS_BEE = 'BOSS_BEE',           // Bee boss
  BOSS_FLY = 'BOSS_FLY'            // Fly boss
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  difficulty: Difficulty;
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  speed?: number;
  type?: ObstacleType;
  vx?: number;
  tilt?: number;
  lastShot?: number;
  health?: number;
  maxHealth?: number;
  rotation?: number;      // For spinning enemies and bosses
}

export interface Projectile extends Entity {
  vx: number;
  vy: number;
  isEnemy: boolean; 
}

export interface Particle extends Entity {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface PowerUp {
  type: 'HELPER_PLANES' | 'GUIDED_ROCKET' | 'SHIELD';
  expiresAt: number;
}

export interface HelperPlane extends Entity {
  side: 'left' | 'right';
  offsetY: number;
  lastShot: number;
}