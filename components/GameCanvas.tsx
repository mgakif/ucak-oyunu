import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Entity, Particle, ObstacleType, Projectile } from '../types';
import { Play, RotateCcw, Trophy, AlertTriangle, Volume2, VolumeX, Crosshair, Heart, Fuel } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  score: number;
  setScore: (score: number) => void;
  highScore: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  setGameState, 
  score, 
  setScore,
  highScore 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const [isMuted, setIsMuted] = useState(false);
  
  // Game State Refs
  const playerRef = useRef<Entity>({ x: 0, y: 0, width: 40, height: 40, color: '#e2e8f0', tilt: 0, lastShot: 0 });
  const livesRef = useRef<number>(3);
  const fuelRef = useRef<number>(100);
  const invulnerableUntilRef = useRef<number>(0);

  const obstaclesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  
  const speedRef = useRef<number>(3); // Game scroll speed
  const baseScrollSpeedRef = useRef<number>(3);
  const playerSpeedMultiplierRef = useRef<number>(1);
  
  const riverOffsetRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);

  // Constants
  const RIVER_WIDTH_PERCENT = 0.7; // Nehri biraz genişletelim
  const PLAYER_XY_SPEED = 5;
  const SPAWN_RATE = 60;
  const PROJECTILE_SPEED = 12;
  const PLAYER_FIRE_RATE = 150; // ms
  const ENEMY_FIRE_RATE = 2000; // ms
  const FUEL_CONSUMPTION_RATE = 0.06; // Biraz daha hızlı yakıt tükensin
  const FUEL_REFILL_RATE = 1.2; 
  
  const frameCountRef = useRef<number>(0);

  // Toggle Mute
  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    soundManager.setMute(newState);
  };

  // Initialize Game
  const resetGame = useCallback(async () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    await soundManager.init();
    soundManager.startMusic();
    
    playerRef.current = {
      x: canvas.width / 2 - 20,
      y: canvas.height - 100,
      width: 40, // Jet width
      height: 40, // Jet height
      color: '#e2e8f0',
      tilt: 0,
      lastShot: 0
    };
    
    livesRef.current = 3;
    fuelRef.current = 100;
    invulnerableUntilRef.current = 0;
    
    obstaclesRef.current = [];
    particlesRef.current = [];
    projectilesRef.current = [];
    scoreRef.current = 0;
    speedRef.current = 3;
    baseScrollSpeedRef.current = 3;
    playerSpeedMultiplierRef.current = 1;
    frameCountRef.current = 0;
    setScore(0);
  }, [setScore]);

  // Respawn Player after death (if lives > 0)
  const respawnPlayer = () => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      playerRef.current.x = canvas.width / 2 - 20;
      playerRef.current.y = canvas.height - 100;
      playerRef.current.vx = 0;
      playerRef.current.tilt = 0;
      invulnerableUntilRef.current = Date.now() + 2000; // 2 seconds invulnerability
      projectilesRef.current = []; // Clear bullets for safety
      speedRef.current = 3; // Reset speed slightly
  };

  // Trigger Instant Game Over
  const triggerGameOver = () => {
      soundManager.stopMusic();
      soundManager.playGameOver();
      setGameState(GameState.GAME_OVER);
  };

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Game Loop
  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const now = Date.now();

    if (gameState === GameState.PLAYING) {
      // --- 1. MOVEMENT & INPUTS ---
      const isUp = keysPressed.current['ArrowUp'] || keysPressed.current['KeyW'];
      const isDown = keysPressed.current['ArrowDown'] || keysPressed.current['KeyS'];
      const isLeft = keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA'];
      const isRight = keysPressed.current['ArrowRight'] || keysPressed.current['KeyD'];
      const isShooting = keysPressed.current['Space'];

      // Sound
      const isMoving = isUp || isDown || isLeft || isRight;
      soundManager.updateEnginePitch(speedRef.current + (isUp ? 2 : 0), isMoving);
      soundManager.setMusicIntensity(speedRef.current);

      // Fuel Consumption
      if (fuelRef.current > 0) {
          fuelRef.current -= FUEL_CONSUMPTION_RATE * (isUp ? 1.5 : 1.0);
      } else {
           handlePlayerDeath();
      }

      // Player Fire Logic
      if (isShooting && now - (playerRef.current.lastShot || 0) > PLAYER_FIRE_RATE) {
          projectilesRef.current.push({
              x: playerRef.current.x + playerRef.current.width / 2 - 3,
              y: playerRef.current.y,
              width: 6,
              height: 12,
              color: '#facc15', // Yellow
              vx: 0,
              vy: -PROJECTILE_SPEED,
              isEnemy: false
          });
          playerRef.current.lastShot = now;
          soundManager.playShoot();
      }

      // Speed Recovery
      if (playerSpeedMultiplierRef.current < 1) {
        playerSpeedMultiplierRef.current += 0.005;
        if (playerSpeedMultiplierRef.current > 1) playerSpeedMultiplierRef.current = 1;
      }

      const moveSpeed = PLAYER_XY_SPEED * playerSpeedMultiplierRef.current;

      // Vertical Movement (Scroll Speed)
      let targetScrollSpeed = baseScrollSpeedRef.current;
      if (isUp) {
          playerRef.current.y -= moveSpeed;
          targetScrollSpeed = baseScrollSpeedRef.current * 2.0;
      } else if (isDown) {
          playerRef.current.y += moveSpeed;
          targetScrollSpeed = baseScrollSpeedRef.current * 0.5;
      }
      speedRef.current += (targetScrollSpeed - speedRef.current) * 0.1;

      // Horizontal Movement & Tilt
      let targetTilt = 0;
      if (isLeft) {
        playerRef.current.x -= moveSpeed;
        targetTilt = -0.3; // Uçak yatışı
      }
      if (isRight) {
        playerRef.current.x += moveSpeed;
        targetTilt = 0.3;
      }
      const currentTilt = playerRef.current.tilt || 0;
      playerRef.current.tilt = currentTilt + (targetTilt - currentTilt) * 0.1;

      // --- 2. CONSTRAINTS ---
      const riverX = (canvas.width * (1 - RIVER_WIDTH_PERCENT)) / 2;
      const riverRight = canvas.width - riverX;
      
      if (playerRef.current.x < riverX) playerRef.current.x = riverX;
      if (playerRef.current.x + playerRef.current.width > riverRight) playerRef.current.x = riverRight - playerRef.current.width;
      
      if (playerRef.current.y < 20) playerRef.current.y = 20;
      if (playerRef.current.y + playerRef.current.height > canvas.height - 20) {
          playerRef.current.y = canvas.height - 20 - playerRef.current.height;
          if (!isDown) speedRef.current = Math.max(speedRef.current, baseScrollSpeedRef.current);
      }

      // --- 3. WORLD UPDATES ---
      riverOffsetRef.current = (riverOffsetRef.current + speedRef.current) % 40;
      
      frameCountRef.current++;
      if (frameCountRef.current % 600 === 0 && baseScrollSpeedRef.current < 12) {
        baseScrollSpeedRef.current += 0.5;
      }

      // SPAWN LOGIC
      const dynamicSpawnRate = Math.max(20, Math.floor(SPAWN_RATE / (speedRef.current / 3)));
      
      if (frameCountRef.current % dynamicSpawnRate === 0) {
        const difficultyLevel = Math.floor(frameCountRef.current / 600);
        const typeRoll = Math.random();
        
        let type = ObstacleType.MOVING; 
        let color = '#4b5563';
        let obsWidth = 40;
        let obsHeight = 40;
        let vx = 0;
        let spawnX = 0;

        // Ensure spawning inside river for ships/helis, on banks for shooters
        const riverAvailableWidth = riverRight - riverX - obsWidth;

        // EXTRA LIFE: 2%
        if (typeRoll < 0.02) {
             type = ObstacleType.LIFE;
             color = '#ef4444';
             obsWidth = 30; obsHeight = 30;
             spawnX = riverX + Math.random() * riverAvailableWidth;
        }
        // Fuel: 10%
        else if (typeRoll < 0.12) {
            type = ObstacleType.FUEL;
            color = '#f59e0b'; 
            obsWidth = 40; obsHeight = 60; 
            spawnX = riverX + Math.random() * riverAvailableWidth;
        } 
        // Oil (Slow): 5%
        else if (difficultyLevel >= 1 && typeRoll < 0.17) {
            type = ObstacleType.SLOW;
            color = '#7e22ce';
            obsWidth = 50 + Math.random() * 20;
            spawnX = riverX + Math.random() * riverAvailableWidth;
        } 
        // Ships: 25%
        else if (typeRoll < 0.42) {
             type = ObstacleType.SHIP;
             color = '#1e40af'; 
             obsWidth = 30; obsHeight = 60;
             vx = (Math.random() - 0.5) * 0.5;
             spawnX = riverX + Math.random() * riverAvailableWidth;
        }
        // Helicopters: 20%
        else if (typeRoll < 0.62) {
            type = ObstacleType.MOVING;
            color = '#be123c';
            obsWidth = 40; obsHeight = 40;
            vx = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2);
            spawnX = riverX + Math.random() * riverAvailableWidth;
        } 
        // Enemy Jets (Fast Moving): 10% (New Enemy)
        else if (difficultyLevel >= 2 && typeRoll < 0.72) {
             type = ObstacleType.MOVING; // Reusing MOVING type but fast
             color = '#000000'; // Black Jet
             obsWidth = 30; obsHeight = 30;
             vx = (Math.random() > 0.5 ? 1 : -1) * 3; // Fast strafe
             spawnX = riverX + Math.random() * riverAvailableWidth;
        }
        // Tanks (Shooters): 20% (On River Banks)
        else {
            type = ObstacleType.SHOOTER;
            color = '#15803d';
            obsWidth = 35; obsHeight = 35;
            if (Math.random() > 0.5) {
                spawnX = Math.random() * (riverX - obsWidth - 10); // Sol kıyı
            } else {
                spawnX = riverRight + 10 + Math.random() * (canvas.width - riverRight - obsWidth - 10); // Sağ kıyı
            }
        }

        obstaclesRef.current.push({
          x: spawnX,
          y: -100,
          width: obsWidth,
          height: obsHeight,
          color: color,
          type: type,
          vx: vx,
          lastShot: 0
        });
      }

      // --- 4. PROJECTILES UPDATE ---
      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
          const proj = projectilesRef.current[i];
          if (!proj) continue; // Safety Check

          proj.x += proj.vx;
          proj.y += proj.vy;

          if (proj.y < -50 || proj.y > canvas.height + 50 || proj.x < 0 || proj.x > canvas.width) {
              projectilesRef.current.splice(i, 1);
              continue;
          }

          // Player Bullet Hits
          if (!proj.isEnemy) {
              let hit = false;
              for (let j = obstaclesRef.current.length - 1; j >= 0; j--) {
                  const obs = obstaclesRef.current[j];
                  if (!obs) continue; // Safety Check

                  if (
                      proj.x < obs.x + obs.width &&
                      proj.x + proj.width > obs.x &&
                      proj.y < obs.y + obs.height &&
                      proj.y + proj.height > obs.y
                  ) {
                      hit = true;
                      if (obs.type === ObstacleType.STATIC) {
                          createExplosion(proj.x, proj.y, '#fbbf24', 5);
                      } else if (obs.type === ObstacleType.FUEL) {
                          createExplosion(proj.x, proj.y, '#f59e0b', 5);
                          scoreRef.current += 25; 
                          setScore(scoreRef.current);
                          obstaclesRef.current.splice(j, 1);
                      } else if (obs.type === ObstacleType.LIFE) {
                          createExplosion(proj.x, proj.y, '#ef4444', 5);
                          obstaclesRef.current.splice(j, 1);
                      } else if (obs.type !== ObstacleType.SLOW) {
                          // Enemy hit
                          createExplosion(obs.x + obs.width/2, obs.y + obs.height/2, '#ef4444', 15);
                          soundManager.playExplosion();
                          scoreRef.current += (obs.type === ObstacleType.SHOOTER || obs.type === ObstacleType.SHIP ? 100 : 50);
                          setScore(scoreRef.current);
                          obstaclesRef.current.splice(j, 1);
                      }
                      break; 
                  }
              }
              if (hit) {
                  projectilesRef.current.splice(i, 1);
              }
          } 
          // Enemy Bullet Hits Player
          else {
              if (
                  playerRef.current &&
                  proj.x < playerRef.current.x + playerRef.current.width - 5 &&
                  proj.x + proj.width > playerRef.current.x + 5 &&
                  proj.y < playerRef.current.y + playerRef.current.height - 5 &&
                  proj.y + proj.height > playerRef.current.y + 5
              ) {
                  if (now > invulnerableUntilRef.current) {
                      handlePlayerDeath();
                  }
              }
          }
      }

      // --- 5. OBSTACLE UPDATE & COLLISION ---
      for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const obs = obstaclesRef.current[i];
        if (!obs) continue; // Safety Check

        obs.y += speedRef.current;

        // Move Moving Obstacles
        if ((obs.type === ObstacleType.MOVING || obs.type === ObstacleType.SHIP) && obs.vx) {
            obs.x += obs.vx;
            // Bounce off river banks
            if (obs.x <= riverX || obs.x + obs.width >= riverRight) {
                obs.vx *= -1;
            }
        }

        // ENEMY AI
        if (obs.type === ObstacleType.SHOOTER || obs.type === ObstacleType.SHIP) {
            if (obs.y > 0 && obs.y < canvas.height - 100) { 
                if (now - (obs.lastShot || 0) > ENEMY_FIRE_RATE) {
                    const dx = (playerRef.current.x + playerRef.current.width/2) - (obs.x + obs.width/2);
                    const dy = (playerRef.current.y + playerRef.current.height/2) - (obs.y + obs.height/2);
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    const speed = 5;
                    projectilesRef.current.push({
                        x: obs.x + obs.width/2,
                        y: obs.y + obs.height/2,
                        width: 8,
                        height: 8,
                        color: '#dc2626',
                        vx: (dx/dist) * speed,
                        vy: (dy/dist) * speed,
                        isEnemy: true
                    });
                    
                    obs.lastShot = now;
                }
            }
        }

        // Collision Check
        const hitBoxPadding = 5;
        const isColliding = 
          playerRef.current &&
          playerRef.current.x + hitBoxPadding < obs.x + obs.width &&
          playerRef.current.x + playerRef.current.width - hitBoxPadding > obs.x &&
          playerRef.current.y + hitBoxPadding < obs.y + obs.height &&
          playerRef.current.y + playerRef.current.height - hitBoxPadding > obs.y;

        if (isColliding) {
            if (obs.type === ObstacleType.FUEL) {
                if (fuelRef.current < 100) {
                    fuelRef.current = Math.min(100, fuelRef.current + FUEL_REFILL_RATE);
                    soundManager.playRefuel(); 
                }
            } else if (obs.type === ObstacleType.LIFE) {
                soundManager.playOneUp();
                livesRef.current = Math.min(5, livesRef.current + 1);
                createExplosion(obs.x + obs.width/2, obs.y + obs.height/2, '#ef4444', 10);
                obstaclesRef.current.splice(i, 1);
                continue;
            } else if (obs.type === ObstacleType.SLOW) {
                if (playerSpeedMultiplierRef.current > 0.4) {
                    soundManager.playSludge();
                    playerSpeedMultiplierRef.current = 0.3;
                    createExplosion(playerRef.current.x, playerRef.current.y, '#a855f7', 5);
                }
            } else {
                // Enemy Collision
                if (now > invulnerableUntilRef.current) {
                    handlePlayerDeath();
                    // Destroy enemy on impact
                    createExplosion(obs.x, obs.y, obs.color);
                    obstaclesRef.current.splice(i, 1); 
                    continue; 
                }
            }
        }

        if (obs.y > canvas.height) {
          obstaclesRef.current.splice(i, 1);
          if (obs.type !== ObstacleType.FUEL && obs.type !== ObstacleType.LIFE) {
             scoreRef.current += Math.floor(10 * (speedRef.current / 3));
             setScore(scoreRef.current);
          }
        }
      }

      // Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        if (!p) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }
      
      // JET TRAILS
      if (frameCountRef.current % 2 === 0 && now > invulnerableUntilRef.current) {
          const isSlowed = playerSpeedMultiplierRef.current < 0.8;
          const centerX = playerRef.current.x + playerRef.current.width / 2;
          const bottomY = playerRef.current.y + playerRef.current.height;
          
          particlesRef.current.push({
              x: centerX + (Math.random() - 0.5) * 4,
              y: bottomY - 5,
              width: isSlowed ? 5 : 4,
              height: isSlowed ? 5 : 4,
              color: isSlowed ? 'rgba(100, 100, 100, 0.5)' : (isUp ? 'rgba(255, 150, 50, 0.8)' : 'rgba(255, 255, 255, 0.5)'),
              vx: (Math.random() - 0.5) * 1.5,
              vy: Math.random() * 4 + (speedRef.current / 2),
              life: 10,
              maxLife: 10
          });
      }
    }

    // --- 6. DRAWING ---
    // Background: Green Land
    ctx.fillStyle = '#064e3b'; // Dark Green
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const riverX = (canvas.width * (1 - RIVER_WIDTH_PERCENT)) / 2;
    const riverW = canvas.width * RIVER_WIDTH_PERCENT;
    
    // River Gradient
    const gradient = ctx.createLinearGradient(riverX, 0, riverX + riverW, 0);
    gradient.addColorStop(0, '#1e3a8a');
    gradient.addColorStop(0.5, '#2563eb');
    gradient.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = gradient;
    ctx.fillRect(riverX, 0, riverW, canvas.height);

    // River Animation Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    for (let i = -40; i < canvas.height; i += 40) {
        const y = i + riverOffsetRef.current;
        ctx.beginPath();
        ctx.moveTo(riverX, y);
        ctx.lineTo(riverX + riverW, y);
        ctx.stroke();
    }

    // Draw Obstacles & Enemies
    obstaclesRef.current.forEach(obs => {
        if (!obs) return;

        if (obs.type === ObstacleType.SLOW) {
            // Oil Spill
            ctx.fillStyle = '#1e1b4b'; // Darker oil
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.ellipse(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/2, obs.height/3, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 1.0;

        } else if (obs.type === ObstacleType.FUEL) {
            // Fuel Station
            ctx.fillStyle = '#b45309'; 
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            
            ctx.fillStyle = obs.color; 
            const segmentHeight = (obs.height - 10) / 4;
            
            ctx.font = 'bold 10px monospace';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            
            for(let k=0; k<4; k++) {
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(obs.x + 2, obs.y + 2 + (k * (segmentHeight + 2)), obs.width - 4, segmentHeight);
                ctx.fillStyle = '#78350f';
                if (k === 1) ctx.fillText("FUEL", obs.x + obs.width/2, obs.y + 2 + (k * (segmentHeight + 2)) + 12);
            }

        } else if (obs.type === ObstacleType.LIFE) {
            // HEART
            ctx.fillStyle = obs.color;
            ctx.beginPath();
            const topCurveHeight = obs.height * 0.3;
            ctx.moveTo(obs.x + obs.width / 2, obs.y + topCurveHeight);
            ctx.bezierCurveTo(obs.x + obs.width / 2, obs.y, obs.x, obs.y, obs.x, obs.y + topCurveHeight);
            ctx.bezierCurveTo(obs.x, obs.y + (obs.height + topCurveHeight) / 2, obs.x + obs.width / 2, obs.y + (obs.height + topCurveHeight) / 2, obs.x + obs.width / 2, obs.y + obs.height);
            ctx.bezierCurveTo(obs.x + obs.width / 2, obs.y + (obs.height + topCurveHeight) / 2, obs.x + obs.width, obs.y + (obs.height + topCurveHeight) / 2, obs.x + obs.width, obs.y + topCurveHeight);
            ctx.bezierCurveTo(obs.x + obs.width, obs.y, obs.x + obs.width / 2, obs.y, obs.x + obs.width / 2, obs.y + topCurveHeight);
            ctx.fill();

        } else if (obs.type === ObstacleType.MOVING) {
            // HELICOPTER or ENEMY JET
            if (obs.color === '#000000') {
                 // ENEMY JET (Black)
                 ctx.fillStyle = '#111';
                 ctx.beginPath();
                 // Triangle shape pointing down
                 ctx.moveTo(obs.x + obs.width/2, obs.y + obs.height); 
                 ctx.lineTo(obs.x + obs.width, obs.y);
                 ctx.lineTo(obs.x, obs.y);
                 ctx.fill();
                 // Red cockpit
                 ctx.fillStyle = '#991b1b';
                 ctx.fillRect(obs.x + obs.width/2 - 2, obs.y + 2, 4, 6);
            } else {
                // HELICOPTER
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(obs.x + obs.width/2 + 10, obs.y + obs.height/2 + 10, obs.width/2, obs.height/3, 0, 0, Math.PI*2);
                ctx.fill();

                // Body
                ctx.fillStyle = obs.color;
                ctx.beginPath();
                ctx.ellipse(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/2, obs.height/3, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.fillRect(obs.x + obs.width/2 - 2, obs.y - 10, 4, obs.height/2);
                ctx.fillStyle = '#1f2937';
                ctx.fillRect(obs.x, obs.y + obs.height/2 - 2, obs.width, 4);
                // Rotor animation
                if (frameCountRef.current % 4 < 2) {
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.beginPath();
                    ctx.ellipse(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/1.8, obs.height/1.8, 0, 0, Math.PI*2);
                    ctx.fill();
                }
            }

        } else if (obs.type === ObstacleType.SHIP) {
            // SHIP
            ctx.fillStyle = '#52525b'; // Hull
            ctx.beginPath();
            ctx.moveTo(obs.x + obs.width/2, obs.y + obs.height); 
            ctx.lineTo(obs.x + obs.width, obs.y + obs.height * 0.8);
            ctx.lineTo(obs.x + obs.width, obs.y + obs.height * 0.2);
            ctx.lineTo(obs.x + obs.width/2, obs.y); 
            ctx.lineTo(obs.x, obs.y + obs.height * 0.2);
            ctx.lineTo(obs.x, obs.y + obs.height * 0.8);
            ctx.closePath();
            ctx.fill();
            // Deck
            ctx.fillStyle = obs.color;
            ctx.fillRect(obs.x + obs.width * 0.2, obs.y + obs.height * 0.3, obs.width * 0.6, obs.height * 0.4);
            // Bridge
            ctx.fillStyle = '#e4e4e7';
            ctx.fillRect(obs.x + obs.width * 0.3, obs.y + obs.height * 0.6, obs.width * 0.4, obs.height * 0.15);

        } else if (obs.type === ObstacleType.SHOOTER) {
            // TANK (Land)
            ctx.fillStyle = obs.color;
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.fillStyle = '#064e3b';
            ctx.beginPath();
            ctx.arc(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/3, 0, Math.PI*2);
            ctx.fill();
            const dx = (playerRef.current.x + playerRef.current.width/2) - (obs.x + obs.width/2);
            const dy = (playerRef.current.y + playerRef.current.height/2) - (obs.y + obs.height/2);
            const angle = Math.atan2(dy, dx);
            ctx.save();
            ctx.translate(obs.x + obs.width/2, obs.y + obs.height/2);
            ctx.rotate(angle);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, -3, obs.width/1.2, 6);
            ctx.restore();
        }
    });

    // Draw Projectiles
    projectilesRef.current.forEach(proj => {
        if (!proj) return;
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        if (proj.isEnemy) {
            ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
        } else {
            ctx.rect(proj.x, proj.y, proj.width, proj.height);
        }
        ctx.fill();
    });

    // Draw Player: JET FIGHTER
    const isInvulnerable = now < invulnerableUntilRef.current;
    if (gameState !== GameState.GAME_OVER && (!isInvulnerable || Math.floor(now / 100) % 2 === 0)) {
        const { x, y, width, height, tilt, color } = playerRef.current;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(tilt || 0);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(10, -height/2 + 20);
        ctx.lineTo(width/2 + 10, height/2 + 10);
        ctx.lineTo(0 + 10, height/2 - 10 + 10);
        ctx.lineTo(-width/2 + 10, height/2 + 10);
        ctx.fill();

        // Fuselage
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -height/2); // Nose
        ctx.lineTo(width/2, height/2); // Right Wing tip
        ctx.lineTo(0, height/2 - 10); // Tail notch
        ctx.lineTo(-width/2, height/2); // Left Wing tip
        ctx.closePath();
        ctx.fill();

        // Cockpit
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.moveTo(0, -height/4);
        ctx.lineTo(width/6, 0);
        ctx.lineTo(0, height/6);
        ctx.lineTo(-width/6, 0);
        ctx.fill();

        // Red stripes
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-width/4, height/4, width/8, height/4);
        ctx.fillRect(width/8, height/4, width/8, height/4);

        ctx.restore();

        if (playerSpeedMultiplierRef.current < 0.9) {
            ctx.fillStyle = '#ef4444';
            ctx.font = '10px monospace';
            ctx.fillText('!', x + width/2 - 2, y - 10);
        }
    }

    particlesRef.current.forEach(p => {
        if (!p) return;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.globalAlpha = 1.0;
    });

    requestRef.current = requestAnimationFrame(loop);
  }, [gameState, setScore, setGameState]);

  const handlePlayerDeath = () => {
      soundManager.playExplosion();
      createExplosion(playerRef.current.x, playerRef.current.y, '#3b82f6', 30);
      
      livesRef.current -= 1;
      
      if (livesRef.current <= 0) {
          triggerGameOver();
      } else {
          if (fuelRef.current <= 0) fuelRef.current = 100;
          respawnPlayer();
      }
  };

  const createExplosion = (x: number, y: number, color: string, count: number = 20) => {
      for(let i=0; i<count; i++) {
          particlesRef.current.push({
              x: x,
              y: y,
              width: 6,
              height: 6,
              color: color,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              life: 40 + Math.random() * 20,
              maxLife: 60
          });
      }
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
           canvasRef.current.width = canvasRef.current.parentElement.clientWidth;
           canvasRef.current.height = canvasRef.current.parentElement.clientHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [gameState]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  useEffect(() => {
      if (gameState === GameState.PLAYING && score === 0) {
          resetGame();
      }
  }, [gameState, score, resetGame]);

  useEffect(() => {
      return () => {
          soundManager.stopMusic();
      };
  }, []);

  return (
    <div className="relative w-full h-full bg-gray-900 overflow-hidden flex justify-center shadow-2xl border-x-4 border-gray-800">
      <canvas ref={canvasRef} className="block bg-gray-900" />
      
      {/* Sound Control */}
      <button 
        onClick={toggleMute}
        className="absolute top-4 right-4 z-20 p-2 bg-gray-800/80 rounded-full text-white hover:bg-gray-700 transition"
        title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
      >
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {/* UI Overlay */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-10 p-6 text-center">
            <h1 className="pixel-font text-3xl md:text-5xl text-yellow-400 mb-8 drop-shadow-[0_4px_0_rgba(0,0,0,1)] animate-pulse leading-relaxed">
                NEHİR AKINCISI
            </h1>
            <p className="text-gray-300 mb-8 max-w-md text-sm md:text-base leading-relaxed space-y-2">
                <span className="block font-bold text-white text-lg">GÖREV RAPORU:</span>
                <span className="block text-gray-400">WASD / YÖN TUŞLARI ile uç.</span>
                <span className="block text-red-400">SPACE / BOŞLUK tuşu ile ATEŞ ET!</span>
                <hr className="border-gray-700 w-1/2 mx-auto"/>
                <div className="grid grid-cols-2 gap-4 text-xs text-left px-8">
                     <div className="text-red-400">💥 ÇARPIŞMA = -1 CAN</div>
                     <div>🚁 <span className="text-blue-300">Düşmanları Vur</span></div>
                     <div>⛽ <span className="text-yellow-400 font-bold">Yakıt Al</span></div>
                     <div>❤️ <span className="text-pink-400 font-bold">Ekstra Can Topla</span></div>
                </div>
            </p>
            <button 
                onClick={() => setGameState(GameState.PLAYING)}
                className="mt-6 group relative px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded-lg shadow-lg transform transition hover:scale-105 active:scale-95 flex items-center gap-3"
            >
                <Play className="w-6 h-6 fill-current" />
                <span>OPERASYONU BAŞLAT</span>
                <div className="absolute inset-0 rounded-lg border-2 border-white/20 group-hover:border-white/40"></div>
            </button>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80 backdrop-blur-md z-10 p-6 text-center animate-in fade-in duration-300">
            <h2 className="pixel-font text-4xl text-white mb-2">UÇAK DÜŞTÜ</h2>
            <div className="text-6xl font-bold text-yellow-300 mb-6 font-mono">{score}</div>
            
            <div className="flex flex-col gap-2 mb-8 text-gray-200">
                <span className="flex items-center gap-2 justify-center">
                    <Trophy className="w-4 h-4 text-yellow-500" /> 
                    En Yüksek: {Math.max(score, highScore)}
                </span>
            </div>

            <button 
                onClick={() => {
                    setScore(0);
                    setGameState(GameState.PLAYING);
                }}
                className="px-8 py-3 bg-white text-red-900 hover:bg-gray-100 font-bold text-lg rounded-full shadow-xl transform transition hover:scale-105 active:scale-95 flex items-center gap-2"
            >
                <RotateCcw className="w-5 h-5" />
                TEKRAR DENE
            </button>
        </div>
      )}
      
      {/* In-game HUD */}
      {gameState === GameState.PLAYING && (
          <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none flex flex-col gap-2">
              {/* Top Row: Score and Highscore */}
              <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                      <span className="text-xs text-blue-200 uppercase font-bold tracking-wider">SKOR</span>
                      <span className="text-2xl font-mono font-bold text-white drop-shadow-md">{score}</span>
                  </div>
                  
                  {/* Lives & Warnings */}
                  <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-1">
                          {[...Array(Math.min(5, livesRef.current))].map((_, i) => (
                              <Heart 
                                  key={i} 
                                  className={`w-6 h-6 fill-red-500 text-red-600`} 
                              />
                          ))}
                          {livesRef.current > 5 && <span className="text-white font-bold text-lg">+</span>}
                      </div>
                      <div className={`transition-opacity duration-300 ${playerSpeedMultiplierRef.current < 0.9 ? 'opacity-100' : 'opacity-0'}`}>
                         <span className="text-purple-400 font-bold animate-pulse flex items-center gap-1 bg-black/50 px-2 rounded text-xs">
                            <AlertTriangle className="w-3 h-3" /> STALL!
                         </span>
                      </div>
                  </div>

                  <div className="flex flex-col items-end">
                      <span className="text-xs text-yellow-200 uppercase font-bold tracking-wider">REKOR</span>
                      <span className="text-xl font-mono font-bold text-yellow-100 drop-shadow-md">{Math.max(score, highScore)}</span>
                  </div>
              </div>

              {/* Bottom Row (of HUD): Fuel Gauge */}
              <div className="w-full max-w-md mx-auto bg-gray-800/80 rounded-full h-6 border-2 border-gray-600 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 via-yellow-500 to-green-500 transition-all duration-200"
                       style={{ width: `${fuelRef.current}%` }}></div>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md tracking-wider gap-2">
                       <Fuel className="w-3 h-3" /> FUEL {Math.floor(fuelRef.current)}%
                  </div>
              </div>
          </div>
      )}
      
      {/* Mobile Shoot Button & Controls */}
      {gameState === GameState.PLAYING && (
        <>
            <div className="absolute bottom-10 right-8 md:hidden z-20">
                <button 
                    className="w-20 h-20 bg-red-600/80 rounded-full border-4 border-red-400 flex items-center justify-center active:bg-red-500 shadow-lg"
                    onTouchStart={(e) => { e.preventDefault(); keysPressed.current['Space'] = true; }}
                    onTouchEnd={(e) => { e.preventDefault(); keysPressed.current['Space'] = false; }}
                >
                    <Crosshair className="text-white w-10 h-10" />
                </button>
            </div>
            
            <div className="absolute bottom-8 left-8 flex gap-4 md:hidden pointer-events-none opacity-50 flex-col items-center">
                 <div className="flex gap-4">
                    <div className="w-12 h-12 border-2 border-white rounded-full flex items-center justify-center bg-black/20">
                        <span className="text-xl font-bold">⬆️</span>
                    </div>
                 </div>
                 <div className="flex gap-12">
                    <div className="w-12 h-12 border-2 border-white rounded-full flex items-center justify-center bg-black/20">
                        <span className="text-xl font-bold">⬅️</span>
                    </div>
                    <div className="w-12 h-12 border-2 border-white rounded-full flex items-center justify-center bg-black/20">
                        <span className="text-xl font-bold">➡️</span>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="w-12 h-12 border-2 border-white rounded-full flex items-center justify-center bg-black/20">
                        <span className="text-xl font-bold">⬇️</span>
                    </div>
                 </div>
            </div>
        </>
      )}
      
      {/* Mobile Touch Controls Overlay (Invisible) */}
      {gameState === GameState.PLAYING && (
         <div className="absolute inset-0 md:hidden z-0 grid grid-rows-3 grid-cols-3 pointer-events-auto">
             <div className="col-start-1 col-span-2 row-start-1 active:bg-white/5"
                  onTouchStart={() => keysPressed.current['ArrowUp'] = true}
                  onTouchEnd={() => keysPressed.current['ArrowUp'] = false}></div>
             
             <div className="col-start-1 row-start-2 active:bg-white/5"
                  onTouchStart={() => keysPressed.current['ArrowLeft'] = true}
                  onTouchEnd={() => keysPressed.current['ArrowLeft'] = false}></div>
             
             <div className="col-start-2 row-start-2 active:bg-white/5"
                   onTouchStart={() => keysPressed.current['ArrowRight'] = true}
                   onTouchEnd={() => keysPressed.current['ArrowRight'] = false}></div>
             
             <div className="col-start-1 col-span-2 row-start-3 active:bg-white/5"
                   onTouchStart={() => keysPressed.current['ArrowDown'] = true}
                   onTouchEnd={() => keysPressed.current['ArrowDown'] = false}></div>
         </div>
      )}
    </div>
  );
};

export default GameCanvas;