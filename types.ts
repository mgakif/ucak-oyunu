export enum GameState {
  LOGIN = 'LOGIN',
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
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
  HELPER_PLANES = 'HELPER_PLANES',  // Power-up: side helper planes
  GUIDED_ROCKET = 'GUIDED_ROCKET',  // Power-up: guided missiles
  SHIELD = 'SHIELD'        // Power-up: temporary shield
}

export interface LeaderboardEntry {
  username: string;
  score: number;
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