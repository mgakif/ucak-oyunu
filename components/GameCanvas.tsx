import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Entity, Particle, ObstacleType, Projectile, LeaderboardEntry, PowerUp, HelperPlane } from '../types';
import { Play, RotateCcw, Volume2, VolumeX, Heart, Globe, Shield } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  score: number;
  setScore: (score: number) => void;
  highScore: number;
  username: string;
  leaderboard: LeaderboardEntry[];
  playerRank: number | null;
  onLogin: (name: string) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  setGameState, 
  score, 
  setScore,
  username,
  leaderboard,
  playerRank,
  onLogin
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [activeShield, setActiveShield] = useState(false);
  const [activeHelpers, setActiveHelpers] = useState(false);
  const [activeGuidedRockets, setActiveGuidedRockets] = useState(false);
  
  const playerRef = useRef<Entity>({ x: 0, y: 0, width: 40, height: 40, color: '#f8fafc', tilt: 0, lastShot: 0 });
  const livesRef = useRef<number>(3);
  const fuelRef = useRef<number>(100);
  const invulnerableUntilRef = useRef<number>(0);
  const obstaclesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const speedRef = useRef<number>(3);
  const baseScrollSpeedRef = useRef<number>(3);
  const riverOffsetRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const activePowerUpsRef = useRef<PowerUp[]>([]);
  const helperPlanesRef = useRef<HelperPlane[]>([]);
  const shieldActiveRef = useRef<number>(0); // Timestamp when shield expires

  const RIVER_WIDTH_PERCENT = 0.7; 
  const PLAYER_XY_SPEED = 5;
  const SPAWN_RATE = 60;
  const PROJECTILE_SPEED = 12;
  const PLAYER_FIRE_RATE = 150;
  const FUEL_CONSUMPTION_RATE = 0.06; 

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    soundManager.setMute(newState);
  };

  // --- PIXEL SPRITE RENDERING HELPERS ---
  
  const drawPixelSprite = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, grid: string[][]) => {
    grid.forEach((row, rowIndex) => {
      row.forEach((color, colIndex) => {
        if (color !== 'T') { // 'T' is transparent
          ctx.fillStyle = color;
          ctx.fillRect(x + colIndex * size, y + rowIndex * size, size, size);
        }
      });
    });
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number) => {
    ctx.save();
    ctx.translate(x + 20, y + 20);
    ctx.rotate(tilt);
    
    // Motor Ateşi
    if (frameCountRef.current % 4 < 2) {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-6, 15, 12, 12 + Math.random() * 8);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-3, 15, 6, 6 + Math.random() * 4);
    }

    // Uçak Sprite (8x8 Grid)
    const pMain = '#cbd5e1';
    const pDark = '#64748b';
    const pGlass = '#38bdf8';
    const pRed = '#ef4444';
    const T = 'T';

    const planeGrid = [
      [T, T, T, pDark, pDark, T, T, T],
      [T, T, T, pMain, pMain, T, T, T],
      [T, pDark, pDark, pMain, pMain, pDark, pDark, T],
      [pRed, pMain, pMain, pGlass, pGlass, pMain, pMain, pRed],
      [pDark, pMain, pMain, pMain, pMain, pMain, pMain, pDark],
      [T, T, T, pMain, pMain, T, T, T],
      [T, T, pDark, pMain, pMain, pDark, T, T],
      [T, pRed, pRed, pRed, pRed, pRed, pRed, T]
    ];
    drawPixelSprite(ctx, -20, -20, 5, planeGrid);
    ctx.restore();
  };

  const drawShipSprite = (ctx: CanvasRenderingContext2D, obs: Entity) => {
    const B = '#1e3a8a'; // Blue
    const L = '#3b82f6'; // Light Blue
    const W = '#ffffff'; // White
    const T = 'T';

    const shipGrid = [
      [T, T, B, B, B, B, T, T],
      [T, B, B, L, L, B, B, T],
      [B, B, L, L, L, L, B, B],
      [B, L, W, L, L, W, L, B],
      [B, L, L, L, L, L, L, B],
      [B, B, B, B, B, B, B, B],
      [T, B, B, B, B, B, B, T],
      [T, T, B, B, B, B, T, T]
    ];
    drawPixelSprite(ctx, obs.x, obs.y, 5, shipGrid);
  };

  const drawFuelSprite = (ctx: CanvasRenderingContext2D, obs: Entity) => {
    const R = '#b91c1c';
    const LR = '#ef4444';
    const W = '#ffffff';
    const T = 'T';

    const fuelGrid = [
      [T, R, R, R, R, T],
      [R, R, LR, LR, R, R],
      [R, LR, W, T, LR, R],
      [R, LR, W, W, LR, R],
      [R, LR, W, T, LR, R],
      [R, LR, LR, LR, LR, R],
      [R, R, R, R, R, R]
    ];
    drawPixelSprite(ctx, obs.x, obs.y, 6, fuelGrid);
  };

  const drawHeartSprite = (ctx: CanvasRenderingContext2D, obs: Entity) => {
    const R = '#dc2626'; // Dark red
    const P = '#f87171'; // Pink/light red
    const T = 'T';

    const heartGrid = [
      [T, P, P, T, P, P, T],
      [P, R, R, P, R, R, P],
      [P, R, R, R, R, R, P],
      [P, R, R, R, R, R, P],
      [T, P, R, R, R, P, T],
      [T, T, P, R, P, T, T],
      [T, T, T, P, T, T, T]
    ];
    drawPixelSprite(ctx, obs.x + 5, obs.y + 5, 5, heartGrid);
  };

  const drawTankSprite = (ctx: CanvasRenderingContext2D, obs: Entity) => {
    const G = '#065f46'; // Dark green
    const LG = '#10b981'; // Light green
    const D = '#1f2937'; // Dark gray
    const T = 'T';

    const tankGrid = [
      [T, T, G, G, G, T, T],
      [T, G, LG, LG, LG, G, T],
      [G, LG, D, D, D, LG, G],
      [G, G, G, G, G, G, G],
      [D, D, D, D, D, D, D],
      [T, D, T, D, T, D, T]
    ];
    drawPixelSprite(ctx, obs.x + 3, obs.y + 7, 5, tankGrid);
  };

  const drawHelperPlanesPowerUp = (ctx: CanvasRenderingContext2D, obs: Entity) => {
    const B = '#3b82f6'; // Blue
    const Y = '#fbbf24'; // Yellow
    const T = 'T';

    const powerUpGrid = [
      [T, B, B, T, B, B, T],
      [B, B, B, B, B, B, B],
      [Y, Y, Y, Y, Y, Y, Y],
      [B, B, B, B, B, B, B],
      [T, B, B, T, B, B, T]
    ];
    drawPixelSprite(ctx, obs.x + 5, obs.y + 10, 5, powerUpGrid);
  };

  const drawGuidedRocketPowerUp = (ctx: CanvasRenderingContext2D, obs: Entity) => {
    const R = '#ef4444'; // Red
    const G = '#6b7280'; // Gray
    const Y = '#fbbf24'; // Yellow
    const T = 'T';

    const rocketGrid = [
      [T, T, R, T, T],
      [T, R, R, R, T],
      [R, R, G, R, R],
      [T, G, G, G, T],
      [T, Y, G, Y, T],
      [T, T, Y, T, T]
    ];
    drawPixelSprite(ctx, obs.x + 10, obs.y + 5, 5, rocketGrid);
  };

  const drawShieldPowerUp = (ctx: CanvasRenderingContext2D, obs: Entity) => {
    const C = '#06b6d4'; // Cyan
    const LC = '#67e8f9'; // Light cyan
    const T = 'T';

    const shieldGrid = [
      [T, T, C, C, C, T, T],
      [T, C, LC, LC, LC, C, T],
      [C, LC, C, LC, C, LC, C],
      [C, LC, LC, LC, LC, LC, C],
      [C, LC, C, LC, C, LC, C],
      [T, C, LC, LC, LC, C, T],
      [T, T, C, C, C, T, T]
    ];
    drawPixelSprite(ctx, obs.x + 5, obs.y + 5, 5, shieldGrid);
  };

  const drawMiniPlane = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const B = '#3b82f6'; // Blue
    const W = '#ffffff'; // White
    const T = 'T';

    const miniPlaneGrid = [
      [T, B, T],
      [B, W, B],
      [B, B, B]
    ];
    drawPixelSprite(ctx, x, y, 4, miniPlaneGrid);
  };

  const drawMiniBoss = (ctx: CanvasRenderingContext2D, obs: Entity) => {
    const D = '#7c2d12'; // Dark red/brown
    const R = '#dc2626'; // Red
    const O = '#ea580c'; // Orange
    const Y = '#facc15'; // Yellow
    const G = '#6b7280'; // Gray
    const T = 'T';

    const bossGrid = [
      [T, T, T, D, D, D, D, T, T, T],
      [T, T, D, R, R, R, R, D, T, T],
      [T, D, R, O, Y, Y, O, R, D, T],
      [D, R, R, Y, G, G, Y, R, R, D],
      [D, R, O, Y, G, G, Y, O, R, D],
      [D, R, R, R, R, R, R, R, R, D],
      [T, D, R, R, R, R, R, R, D, T],
      [T, T, D, D, R, R, D, D, T, T],
      [T, T, T, D, D, D, D, T, T, T]
    ];
    drawPixelSprite(ctx, obs.x - 10, obs.y - 5, 6, bossGrid);

    // Draw health bar
    if (obs.health && obs.maxHealth) {
      const barWidth = 50;
      const barHeight = 4;
      const healthPercent = obs.health / obs.maxHealth;

      // Background
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(obs.x - 5, obs.y - 15, barWidth, barHeight);

      // Health
      ctx.fillStyle = healthPercent > 0.5 ? '#10b981' : (healthPercent > 0.25 ? '#f59e0b' : '#ef4444');
      ctx.fillRect(obs.x - 5, obs.y - 15, barWidth * healthPercent, barHeight);

      // Border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(obs.x - 5, obs.y - 15, barWidth, barHeight);
    }
  };

  // --- GAME LOGIC ---

  const createExplosion = useCallback((x: number, y: number, color: string, count: number = 20) => {
    for(let i=0; i<count; i++) {
      particlesRef.current.push({
        x: x + 20, y: y + 20, width: 4 + Math.random() * 4, height: 4 + Math.random() * 4, color: color,
        vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
        life: 40 + Math.random() * 20, maxLife: 60
      });
    }
  }, []);

  const triggerGameOver = useCallback(() => {
    soundManager.stopMusic();
    soundManager.playGameOver();
    setGameState(GameState.GAME_OVER);
  }, [setGameState]);

  const handlePlayerDeath = useCallback(() => {
    soundManager.playExplosion();
    createExplosion(playerRef.current.x, playerRef.current.y, '#f97316', 40);
    livesRef.current -= 1;
    if (livesRef.current <= 0) {
      triggerGameOver();
    } else {
      playerRef.current.x = (canvasRef.current?.width || 0) / 2 - 20;
      playerRef.current.y = (canvasRef.current?.height || 0) - 100;
      invulnerableUntilRef.current = Date.now() + 2000;
      fuelRef.current = 100;
    }
  }, [createExplosion, triggerGameOver]);

  const resetGame = useCallback(async () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    await soundManager.init();
    soundManager.startMusic();
    playerRef.current = { x: canvas.width / 2 - 20, y: canvas.height - 100, width: 40, height: 40, color: '#f8fafc', tilt: 0, lastShot: 0 };
    livesRef.current = 3; fuelRef.current = 100; scoreRef.current = 0;
    obstaclesRef.current = []; projectilesRef.current = []; particlesRef.current = [];
    activePowerUpsRef.current = []; helperPlanesRef.current = []; shieldActiveRef.current = 0;
    setScore(0);
  }, [setScore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current[e.code] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current[e.code] = false;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== GameState.PLAYING) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const now = Date.now();

    // Input Handling
    const isUp = keysPressed.current['ArrowUp'] || keysPressed.current['KeyW'];
    const isDown = keysPressed.current['ArrowDown'] || keysPressed.current['KeyS'];
    const isLeft = keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA'];
    const isRight = keysPressed.current['ArrowRight'] || keysPressed.current['KeyD'];
    const isShooting = keysPressed.current['Space'];

    // Movement & Speed
    if (isUp) playerRef.current.y -= PLAYER_XY_SPEED;
    if (isDown) playerRef.current.y += PLAYER_XY_SPEED;
    if (isLeft) playerRef.current.x -= PLAYER_XY_SPEED;
    if (isRight) playerRef.current.x += PLAYER_XY_SPEED;

    // Clamp player position to canvas bounds
    playerRef.current.y = Math.max(0, Math.min(canvas.height - 40, playerRef.current.y));

    playerRef.current.tilt = isLeft ? -0.2 : (isRight ? 0.2 : 0);

    // Increase difficulty every 10,000 points
    const difficultyMultiplier = 1 + Math.floor(scoreRef.current / 10000) * 0.2;
    baseScrollSpeedRef.current = 3 * difficultyMultiplier;
    speedRef.current = (isUp ? 6 : (isDown ? 1.5 : 3)) * difficultyMultiplier;
    
    // Shoot
    if (isShooting && now - (playerRef.current.lastShot || 0) > PLAYER_FIRE_RATE) {
      // Player shoots
      projectilesRef.current.push({
        x: playerRef.current.x + 18, y: playerRef.current.y,
        width: 4, height: 12, color: '#fde047', vx: 0, vy: -PROJECTILE_SPEED, isEnemy: false
      });
      playerRef.current.lastShot = now;
      soundManager.playShoot();

      // Helper planes shoot when player shoots
      helperPlanesRef.current.forEach((helper) => {
        if (now - helper.lastShot > PLAYER_FIRE_RATE) {
          projectilesRef.current.push({
            x: helper.x + 4, y: helper.y,
            width: 3, height: 8, color: '#3b82f6', vx: 0, vy: -PROJECTILE_SPEED, isEnemy: false
          });
          helper.lastShot = now;
        }
      });
    }

    // Update Helper Planes positions
    helperPlanesRef.current.forEach((helper, idx) => {
      const xOffset = helper.side === 'left' ? -25 : 65;
      helper.x = playerRef.current.x + xOffset;
      helper.y = playerRef.current.y + helper.offsetY;
    });

    // Clean up expired power-ups
    activePowerUpsRef.current = activePowerUpsRef.current.filter(pu => pu.expiresAt > now);
    if (!activePowerUpsRef.current.find(pu => pu.type === 'HELPER_PLANES')) {
      helperPlanesRef.current = [];
    }

    // Update power-up states for HUD
    setActiveShield(now < shieldActiveRef.current);
    setActiveHelpers(helperPlanesRef.current.length > 0);
    setActiveGuidedRockets(!!activePowerUpsRef.current.find(pu => pu.type === 'GUIDED_ROCKET'));

    // Fuel Consumption
    fuelRef.current -= FUEL_CONSUMPTION_RATE * (speedRef.current / 3);
    if (fuelRef.current <= 0) handlePlayerDeath();

    // River Bounds
    const riverX = (canvas.width * (1 - RIVER_WIDTH_PERCENT)) / 2;
    const riverRight = canvas.width - riverX;
    if (now > invulnerableUntilRef.current && (playerRef.current.x < riverX || playerRef.current.x + 40 > riverRight)) {
      handlePlayerDeath();
    }

    // Spawning
    frameCountRef.current++;
    if (frameCountRef.current % SPAWN_RATE === 0) {
      const typeRoll = Math.random();
      const spawnX = riverX + 10 + Math.random() * (riverRight - riverX - 50);
      let type = ObstacleType.SHIP;
      let health = undefined;
      let maxHealth = undefined;

      // Collectibles and power-ups
      if (typeRoll < 0.08) type = ObstacleType.FUEL;
      else if (typeRoll < 0.12) type = ObstacleType.LIFE;
      else if (typeRoll < 0.15) type = ObstacleType.HELPER_PLANES;
      else if (typeRoll < 0.18) type = ObstacleType.GUIDED_ROCKET;
      else if (typeRoll < 0.21) type = ObstacleType.SHIELD;
      // Enemies
      else if (typeRoll < 0.83) type = ObstacleType.SHIP;
      else if (typeRoll < 0.90) type = ObstacleType.TANK;
      else {
        // Mini boss - spawn every ~10 enemies
        type = ObstacleType.MINI_BOSS;
        health = 5;
        maxHealth = 5;
      }

      obstaclesRef.current.push({
        x: spawnX,
        y: -100,
        width: 40,
        height: 40,
        color: '',
        type,
        vx: (Math.random()-0.5)*2,
        lastShot: 0,
        health,
        maxHealth
      });
    }

    // Update Entities
    obstaclesRef.current.forEach((obs, i) => {
      obs.y += speedRef.current;
      obs.x += obs.vx || 0;
      if (obs.x < riverX || obs.x + 40 > riverRight) obs.vx = -(obs.vx || 0);

      // Tanks shoot at player
      if (obs.type === ObstacleType.TANK && obs.y > 0 && obs.y < canvas.height - 100) {
        if (now - (obs.lastShot || 0) > 2000) {
          const dx = playerRef.current.x - obs.x;
          const dy = playerRef.current.y - obs.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          projectilesRef.current.push({
            x: obs.x + 20, y: obs.y + 20,
            width: 6, height: 6, color: '#ef4444',
            vx: (dx / dist) * 8, vy: (dy / dist) * 8, isEnemy: true
          });
          obs.lastShot = now;
          soundManager.playShoot();
        }
      }

      // Mini bosses shoot more frequently
      if (obs.type === ObstacleType.MINI_BOSS && obs.y > 0 && obs.y < canvas.height - 100) {
        if (now - (obs.lastShot || 0) > 1000) {
          const dx = playerRef.current.x - obs.x;
          const dy = playerRef.current.y - obs.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Shoot 2 projectiles in a spread pattern
          for (let i = 0; i < 2; i++) {
            const angle = Math.atan2(dy, dx) + (i - 0.5) * 0.3;
            projectilesRef.current.push({
              x: obs.x + 20, y: obs.y + 20,
              width: 8, height: 8, color: '#dc2626',
              vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10, isEnemy: true
            });
          }
          obs.lastShot = now;
          soundManager.playShoot();
        }
      }

      // Collision
      if (Math.abs(playerRef.current.x - obs.x) < 30 && Math.abs(playerRef.current.y - obs.y) < 30) {
        if (obs.type === ObstacleType.FUEL) {
          fuelRef.current = Math.min(100, fuelRef.current + 30);
          soundManager.playCollect();
          obstaclesRef.current.splice(i, 1);
        } else if (obs.type === ObstacleType.LIFE) {
          livesRef.current = Math.min(5, livesRef.current + 1);
          soundManager.playOneUp();
          obstaclesRef.current.splice(i, 1);
        } else if (obs.type === ObstacleType.HELPER_PLANES) {
          // Add or extend helper planes (max 4)
          const existingHelperPowerUp = activePowerUpsRef.current.find(pu => pu.type === 'HELPER_PLANES');
          if (existingHelperPowerUp) {
            // Extend duration
            existingHelperPowerUp.expiresAt = Math.max(existingHelperPowerUp.expiresAt, now) + 15000;
          } else {
            activePowerUpsRef.current.push({ type: 'HELPER_PLANES', expiresAt: now + 15000 });
          }

          // Add helpers if less than 4
          if (helperPlanesRef.current.length < 4) {
            const newHelpers = [];
            const currentCount = helperPlanesRef.current.length;

            if (currentCount === 0) {
              newHelpers.push(
                { x: 0, y: 0, width: 12, height: 12, color: '#3b82f6', side: 'left' as const, offsetY: -30, lastShot: 0 },
                { x: 0, y: 0, width: 12, height: 12, color: '#3b82f6', side: 'right' as const, offsetY: -30, lastShot: 0 }
              );
            } else if (currentCount === 2) {
              newHelpers.push(
                { x: 0, y: 0, width: 12, height: 12, color: '#3b82f6', side: 'left' as const, offsetY: -50, lastShot: 0 },
                { x: 0, y: 0, width: 12, height: 12, color: '#3b82f6', side: 'right' as const, offsetY: -50, lastShot: 0 }
              );
            }

            helperPlanesRef.current.push(...newHelpers);
          }

          soundManager.playCollect();
          obstaclesRef.current.splice(i, 1);
        } else if (obs.type === ObstacleType.GUIDED_ROCKET) {
          activePowerUpsRef.current.push({ type: 'GUIDED_ROCKET', expiresAt: now + 20000 });
          soundManager.playCollect();
          obstaclesRef.current.splice(i, 1);
        } else if (obs.type === ObstacleType.SHIELD) {
          shieldActiveRef.current = now + 10000;
          soundManager.playCollect();
          obstaclesRef.current.splice(i, 1);
        } else if (now > invulnerableUntilRef.current && now > shieldActiveRef.current) {
          handlePlayerDeath();
        }
      }
      if (obs.y > canvas.height + 100) obstaclesRef.current.splice(i, 1);
    });

    projectilesRef.current.forEach((p, pi) => {
      // Guided rocket tracking
      const hasGuidedRocket = activePowerUpsRef.current.find(pu => pu.type === 'GUIDED_ROCKET');
      if (!p.isEnemy && hasGuidedRocket && p.color === '#fde047') {
        const enemies = obstaclesRef.current.filter(o =>
          o.type === ObstacleType.SHIP || o.type === ObstacleType.TANK || o.type === ObstacleType.MINI_BOSS
        );
        if (enemies.length > 0) {
          let closest = enemies[0];
          let minDist = Infinity;
          enemies.forEach(e => {
            const dist = Math.sqrt((e.x - p.x) ** 2 + (e.y - p.y) ** 2);
            if (dist < minDist) {
              minDist = dist;
              closest = e;
            }
          });
          const dx = closest.x - p.x;
          const dy = closest.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            p.vx = (dx / dist) * 3;
            p.vy = (dy / dist) * PROJECTILE_SPEED;
          }
        }
      }

      p.y += p.vy;
      p.x += p.vx;

      // Enemy projectiles hit player
      if (p.isEnemy && Math.abs(p.x - playerRef.current.x) < 30 && Math.abs(p.y - playerRef.current.y) < 30) {
        if (now > invulnerableUntilRef.current && now > shieldActiveRef.current) {
          handlePlayerDeath();
        }
        projectilesRef.current.splice(pi, 1);
        return;
      }

      // Player projectiles hit obstacles
      if (!p.isEnemy) {
        obstaclesRef.current.forEach((obs, oi) => {
          if (Math.abs(p.x - obs.x) < 30 && Math.abs(p.y - obs.y) < 30) {
            projectilesRef.current.splice(pi, 1);

            // Mini boss has health
            if (obs.type === ObstacleType.MINI_BOSS && obs.health) {
              obs.health -= 1;
              createExplosion(obs.x, obs.y, '#f97316', 5);
              if (obs.health <= 0) {
                createExplosion(obs.x, obs.y, '#dc2626', 30);
                obstaclesRef.current.splice(oi, 1);
                scoreRef.current += 500; // More points for mini boss
                setScore(scoreRef.current);
                soundManager.playExplosion();
              }
            } else {
              createExplosion(obs.x, obs.y, '#f97316', 15);
              obstaclesRef.current.splice(oi, 1);
              // Only award points for destroying enemies, not collectibles
              if (obs.type !== ObstacleType.FUEL && obs.type !== ObstacleType.LIFE &&
                  obs.type !== ObstacleType.HELPER_PLANES && obs.type !== ObstacleType.GUIDED_ROCKET &&
                  obs.type !== ObstacleType.SHIELD) {
                scoreRef.current += 100;
                setScore(scoreRef.current);
              }
              soundManager.playExplosion();
            }
          }
        });
      }

      // Remove off-screen projectiles
      if (p.y < -50 || p.y > canvas.height + 50 || p.x < -50 || p.x > canvas.width + 50) {
        projectilesRef.current.splice(pi, 1);
      }
    });

    // --- DRAWING ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Banks & Water
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, riverX, canvas.height);
    ctx.fillRect(riverRight, 0, riverX, canvas.height);
    ctx.fillStyle = '#1e40af';
    ctx.fillRect(riverX, 0, riverRight - riverX, canvas.height);

    // River flow lines
    riverOffsetRef.current = (riverOffsetRef.current + speedRef.current) % 100;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    for(let i=0; i<10; i++) {
      const yPos = (i * 150 + riverOffsetRef.current * 2) % canvas.height;
      ctx.beginPath(); ctx.moveTo(riverX + 20, yPos); ctx.lineTo(riverRight - 20, yPos); ctx.stroke();
    }

    // Draw Entities
    obstaclesRef.current.forEach(obs => {
      if (obs.type === ObstacleType.FUEL) drawFuelSprite(ctx, obs);
      else if (obs.type === ObstacleType.LIFE) drawHeartSprite(ctx, obs);
      else if (obs.type === ObstacleType.TANK) drawTankSprite(ctx, obs);
      else if (obs.type === ObstacleType.MINI_BOSS) drawMiniBoss(ctx, obs);
      else if (obs.type === ObstacleType.HELPER_PLANES) drawHelperPlanesPowerUp(ctx, obs);
      else if (obs.type === ObstacleType.GUIDED_ROCKET) drawGuidedRocketPowerUp(ctx, obs);
      else if (obs.type === ObstacleType.SHIELD) drawShieldPowerUp(ctx, obs);
      else drawShipSprite(ctx, obs);
    });

    projectilesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.width, p.height);
    });

    particlesRef.current.forEach((p, i) => {
      p.x += p.vx; p.y += p.vy; p.life--;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(p.x, p.y, p.width, p.height);
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    });
    ctx.globalAlpha = 1;

    // Player
    if (now > invulnerableUntilRef.current || Math.floor(now/100) % 2 === 0) {
      // Draw shield
      if (now < shieldActiveRef.current) {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(playerRef.current.x + 20, playerRef.current.y + 20, 35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(playerRef.current.x + 20, playerRef.current.y + 20, 32, 0, Math.PI * 2);
        ctx.stroke();
      }

      drawPlayer(ctx, playerRef.current.x, playerRef.current.y, playerRef.current.tilt || 0);

      // Draw helper planes
      helperPlanesRef.current.forEach(helper => {
        drawMiniPlane(ctx, helper.x, helper.y);
      });
    }

    requestRef.current = requestAnimationFrame(loop);
  }, [gameState, setScore, handlePlayerDeath, createExplosion, setActiveShield, setActiveHelpers, setActiveGuidedRockets]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
        canvasRef.current.height = canvasRef.current.parentElement.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize); handleResize();
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  useEffect(() => { if (gameState === GameState.PLAYING && score === 0) resetGame(); }, [gameState, score, resetGame]);

  return (
    <div className="relative w-full h-full bg-gray-950 overflow-hidden flex justify-center shadow-2xl border-x-4 border-gray-900">
      <canvas ref={canvasRef} className="block bg-gray-900" />
      
      <button onClick={toggleMute} className="absolute top-4 right-4 z-40 p-2 bg-gray-800/80 rounded-full text-white">
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {gameState === GameState.LOGIN && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-30 p-8 text-center">
            <h1 className="pixel-font text-2xl text-green-500 mb-4 animate-pulse">TERMINAL_LOGIN</h1>
            <div className="w-full max-w-xs space-y-4">
              <input 
                autoFocus
                type="text"
                placeholder="USER_NAME"
                maxLength={12}
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && onLogin(loginInput)}
                className="w-full bg-black border-2 border-green-900 p-4 text-center pixel-font text-green-400 focus:border-green-500 outline-none"
              />
              <button onClick={() => onLogin(loginInput)} className="w-full py-4 bg-green-900 text-black pixel-font hover:bg-green-500">ACCESS_GRANTED</button>
            </div>
        </div>
      )}

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-4 text-center">
            <h1 className="pixel-font text-2xl text-yellow-500 mb-8">NEHİR AKINCISI</h1>
            <div className="w-full max-w-xs bg-gray-900/50 border-2 border-yellow-900/30 p-4 mb-8 rounded">
               <h2 className="pixel-font text-[10px] text-yellow-600 mb-4 flex items-center justify-center gap-2"><Globe size={14} /> LİDERLER</h2>
               <div className="space-y-2">
                 {leaderboard.map((entry, i) => (
                   <div key={i} className="flex justify-between text-xs font-mono">
                      <span className="text-gray-400">{i+1}. {entry.username}</span>
                      <span className="text-white">{entry.score}</span>
                   </div>
                 ))}
               </div>
            </div>
            <button onClick={() => setGameState(GameState.PLAYING)} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white pixel-font text-sm flex items-center gap-3 transition">
                <Play className="w-4 h-4 fill-current" /><span>BAŞLA</span>
            </button>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 z-30 p-6 text-center">
            <h2 className="pixel-font text-3xl text-white mb-4">UÇAK DÜŞTÜ</h2>
            <div className="text-6xl font-bold text-yellow-300 font-mono mb-8">{score}</div>
            {playerRank && <div className="text-xl text-yellow-400 pixel-font mb-8">SIRALAMA: #{playerRank}</div>}
            <button onClick={() => { setScore(0); setGameState(GameState.PLAYING); }} className="px-8 py-4 bg-white text-red-900 pixel-font text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />TEKRAR
            </button>
        </div>
      )}
      
      {gameState === GameState.PLAYING && (
          <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none flex flex-col gap-2 z-20">
              <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                      <span className="text-[10px] text-blue-200 pixel-font">SCORE</span>
                      <span className="text-2xl font-mono font-bold text-white">{score}</span>
                  </div>
                  <div className="flex gap-1">
                      {[...Array(Math.max(0, Math.min(5, livesRef.current)))].map((_, i) => <Heart key={i} className="w-5 h-5 fill-red-500 text-red-600" />)}
                  </div>
              </div>
              <div className="w-full max-w-md mx-auto bg-gray-800/80 rounded-full h-3 border border-gray-600 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-600 to-green-500 transition-all duration-200" style={{ width: `${fuelRef.current}%` }}></div>
              </div>
              <div className="flex justify-center gap-2 mt-1">
                  {activeShield && (
                      <div className="bg-cyan-900/80 border border-cyan-500 px-2 py-1 rounded flex items-center gap-1">
                          <Shield className="w-3 h-3 text-cyan-400" />
                          <span className="text-[8px] text-cyan-300 pixel-font">SHIELD</span>
                      </div>
                  )}
                  {activeHelpers && (
                      <div className="bg-blue-900/80 border border-blue-500 px-2 py-1 rounded">
                          <span className="text-[8px] text-blue-300 pixel-font">HELPERS</span>
                      </div>
                  )}
                  {activeGuidedRockets && (
                      <div className="bg-red-900/80 border border-red-500 px-2 py-1 rounded">
                          <span className="text-[8px] text-red-300 pixel-font">GUIDED</span>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default GameCanvas;