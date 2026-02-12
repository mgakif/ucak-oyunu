export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum ObstacleType {
  STATIC = 'STATIC', // Dağ (Vurulamaz, Anında Öldürür)
  MOVING = 'MOVING', // Helikopter (Vurulabilir)
  SHIP = 'SHIP',     // Gemi (Vurulabilir, Ateş eder)
  SLOW = 'SLOW',     // Petrol (Yavaşlatıcı)
  FUEL = 'FUEL',     // Yakıt İstasyonu
  SHOOTER = 'SHOOTER', // Tank (Ateş eden)
  LIFE = 'LIFE'      // Ekstra Can
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
  vx?: number; // Yatay hız
  tilt?: number; // Uçak yatış açısı
  lastShot?: number; // Son ateş etme zamanı
}

export interface Projectile extends Entity {
  vx: number;
  vy: number;
  isEnemy: boolean; // Düşman mermisi mi?
}

export interface Particle extends Entity {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}