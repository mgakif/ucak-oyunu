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
  const requestRef = useRef<number>(null);
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
  const speedRef = useRef<number>(3);
  const baseScrollSpeedRef = useRef<number>(3);
  const playerSpeedMultiplierRef = useRef<number>(1);
  const riverOffsetRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);

  // Constants
  const RIVER_WIDTH_PERCENT = 0.7; 
  const PLAYER_XY_SPEED = 5;
  const SPAWN_RATE = 60;
  const PROJECTILE_SPEED = 12;
  const PLAYER_FIRE_RATE = 150;
  const ENEMY_FIRE_RATE = 2000;
  const FUEL_CONSUMPTION_RATE = 0.06; 
  const FUEL_REFILL_RATE = 1.2; 

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    soundManager.setMute(newState);
  };

  const createExplosion = useCallback((x: number, y: number, color: string, count: number = 20) => {
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
  }, []);

  const triggerGameOver = useCallback(() => {
    soundManager.stopMusic();
    soundManager.playGameOver();
    setGameState(GameState.GAME_OVER);
  }, [setGameState]);

  const respawnPlayer = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    playerRef.current.x = canvas.width / 2 - 20;
    playerRef.current.y = canvas.height - 100;
    playerRef.current.vx = 0;
    playerRef.current.tilt = 0;
    invulnerableUntilRef.current = Date.now() + 2000; 
    projectilesRef.current = []; 
    speedRef.current = 3; 
  }, []);

  const handlePlayerDeath = useCallback(() => {
    soundManager.playExplosion();
    createExplosion(playerRef.current.x, playerRef.current.y, '#3b82f6', 30);
    
    livesRef.current -= 1;
    
    if (livesRef.current <= 0) {
      triggerGameOver();
    } else {
      if (fuelRef.current <= 0) fuelRef.current = 100;
      respawnPlayer();
    }
  }, [createExplosion, triggerGameOver, respawnPlayer]);

  const resetGame = useCallback(async () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    await soundManager.init();
    soundManager.startMusic();
    
    playerRef.current = {
      x: canvas.width / 2 - 20,
      y: canvas.height - 100,
      width: 40,
      height: 40,
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const now = Date.now();

    if (gameState === GameState.PLAYING) {
      // 1. INPUTS
      const isUp = keysPressed.current['ArrowUp'] || keysPressed.current['KeyW'];
      const isDown = keysPressed.current['ArrowDown'] || keysPressed.current['KeyS'];
      const isLeft = keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA'];
      const isRight = keysPressed.current['ArrowRight'] || keysPressed.current['KeyD'];
      const isShooting = keysPressed.current['Space'];

      const isMoving = isUp || isDown || isLeft || isRight;
      soundManager.updateEnginePitch(speedRef.current + (isUp ? 2 : 0), isMoving);
      soundManager.setMusicIntensity(speedRef.current);

      if (fuelRef.current > 0) {
        fuelRef.current -= FUEL_CONSUMPTION_RATE * (isUp ? 1.5 : 1.0);
      } else {
        handlePlayerDeath();
      }

      if (isShooting && now - (playerRef.current.lastShot || 0) > PLAYER_FIRE_RATE) {
        projectilesRef.current.push({
          x: playerRef.current.x + playerRef.current.width / 2 - 3,
          y: playerRef.current.y,
          width: 6,
          height: 12,
          color: '#facc15', 
          vx: 0,
          vy: -PROJECTILE_SPEED,
          isEnemy: false
        });
        playerRef.current.lastShot = now;
        soundManager.playShoot();
      }

      if (playerSpeedMultiplierRef.current < 1) {
        playerSpeedMultiplierRef.current += 0.005;
      }

      const moveSpeed = PLAYER_XY_SPEED * playerSpeedMultiplierRef.current;

      let targetScrollSpeed = baseScrollSpeedRef.current;
      if (isUp) {
        playerRef.current.y -= moveSpeed;
        targetScrollSpeed = baseScrollSpeedRef.current * 2.0;
      } else if (isDown) {
        playerRef.current.y += moveSpeed;
        targetScrollSpeed = baseScrollSpeedRef.current * 0.5;
      }
      speedRef.current += (targetScrollSpeed - speedRef.current) * 0.1;

      let targetTilt = 0;
      if (isLeft) {
        playerRef.current.x -= moveSpeed;
        targetTilt = -0.3; 
      }
      if (isRight) {
        playerRef.current.x += moveSpeed;
        targetTilt = 0.3;
      }
      const currentTilt = playerRef.current.tilt || 0;
      playerRef.current.tilt = currentTilt + (targetTilt - currentTilt) * 0.1;

      // 2. CONSTRAINTS
      const riverX = (canvas.width * (1 - RIVER_WIDTH_PERCENT)) / 2;
      const riverRight = canvas.width - riverX;
      
      if (now > invulnerableUntilRef.current) {
        if (playerRef.current.x < riverX || playerRef.current.x + playerRef.current.width > riverRight) {
          handlePlayerDeath();
        }
      }
      
      if (playerRef.current.y < 20) playerRef.current.y = 20;
      if (playerRef.current.y + playerRef.current.height > canvas.height - 20) {
        playerRef.current.y = canvas.height - 20 - playerRef.current.height;
      }

      // 3. WORLD UPDATES
      riverOffsetRef.current = (riverOffsetRef.current + speedRef.current) % 40;
      frameCountRef.current++;
      if (frameCountRef.current % 600 === 0 && baseScrollSpeedRef.current < 12) {
        baseScrollSpeedRef.current += 0.5;
      }

      const dynamicSpawnRate = Math.max(20, Math.floor(SPAWN_RATE / (speedRef.current / 3)));
      if (frameCountRef.current % dynamicSpawnRate === 0) {
        const difficultyLevel = Math.floor(frameCountRef.current / 600);
        const typeRoll = Math.random();
        let spawnData: Partial<Entity> | null = null;
        const riverAvailableWidth = riverRight - riverX - 40;

        if (typeRoll < 0.02) {
          spawnData = { type: ObstacleType.LIFE, color: '#ef4444', width: 30, height: 30, x: riverX + Math.random() * riverAvailableWidth };
        } else if (typeRoll < 0.12) {
          spawnData = { type: ObstacleType.FUEL, color: '#f59e0b', width: 40, height: 60, x: riverX + Math.random() * riverAvailableWidth };
        } else if (difficultyLevel >= 1 && typeRoll < 0.17) {
          spawnData = { type: ObstacleType.SLOW, color: '#7e22ce', width: 60, height: 40, x: riverX + Math.random() * (riverRight - riverX - 60) };
        } else if (difficultyLevel >= 1 && typeRoll < 0.25) {
          spawnData = { type: ObstacleType.STATIC, color: '#064e3b', width: 100, height: 180, x: (canvas.width / 2) - 50 + (Math.random() - 0.5) * 60 };
        } else if (typeRoll < 0.50) {
          spawnData = { type: ObstacleType.SHIP, color: '#1e40af', width: 30, height: 60, vx: (Math.random() - 0.5) * 0.5, x: riverX + Math.random() * riverAvailableWidth };
        } else if (typeRoll < 0.70) {
          spawnData = { type: ObstacleType.MOVING, color: '#be123c', width: 40, height: 40, vx: (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 2), x: riverX + Math.random() * riverAvailableWidth };
        } else if (difficultyLevel >= 2 && typeRoll < 0.80) {
          spawnData = { type: ObstacleType.MOVING, color: '#000000', width: 30, height: 30, vx: (Math.random() > 0.5 ? 1 : -1) * 3, x: riverX + Math.random() * riverAvailableWidth };
        } else if (typeRoll < 0.84) { 
          const tX = Math.random() > 0.5 ? Math.random() * (riverX - 45) : riverRight + 10 + Math.random() * (canvas.width - riverRight - 45);
          spawnData = { type: ObstacleType.SHOOTER, color: '#15803d', width: 35, height: 35, x: tX };
        }

        if (spawnData) {
          obstaclesRef.current.push({
            x: spawnData.x!,
            y: -250,
            width: spawnData.width!,
            height: spawnData.height!,
            color: spawnData.color!,
            type: spawnData.type,
            vx: spawnData.vx || 0,
            lastShot: 0
          });
        }
      }

      // 4. PROJECTILES
      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const proj = projectilesRef.current[i];
        if (!proj) continue;
        proj.x += proj.vx;
        proj.y += proj.vy;

        if (proj.y < -50 || proj.y > canvas.height + 50 || proj.x < 0 || proj.x > canvas.width) {
          projectilesRef.current.splice(i, 1);
          continue;
        }

        if (!proj.isEnemy) {
          let hit = false;
          for (let j = obstaclesRef.current.length - 1; j >= 0; j--) {
            const obs = obstaclesRef.current[j];
            if (!obs) continue;
            if (proj.x < obs.x + obs.width && proj.x + proj.width > obs.x && proj.y < obs.y + obs.height && proj.y + proj.height > obs.y) {
              hit = true;
              if (obs.type === ObstacleType.STATIC) {
                createExplosion(proj.x, proj.y, '#064e3b', 3);
              } else if (obs.type === ObstacleType.FUEL) {
                createExplosion(proj.x, proj.y, '#f59e0b', 5);
                scoreRef.current += 25; 
                setScore(scoreRef.current);
                obstaclesRef.current.splice(j, 1);
              } else if (obs.type === ObstacleType.LIFE) {
                createExplosion(proj.x, proj.y, '#ef4444', 5);
                obstaclesRef.current.splice(j, 1);
              } else if (obs.type !== ObstacleType.SLOW) {
                createExplosion(obs.x + obs.width/2, obs.y + obs.height/2, '#ef4444', 15);
                soundManager.playExplosion();
                scoreRef.current += (obs.type === ObstacleType.SHOOTER || obs.type === ObstacleType.SHIP ? 100 : 50);
                setScore(scoreRef.current);
                obstaclesRef.current.splice(j, 1);
              }
              break; 
            }
          }
          if (hit) projectilesRef.current.splice(i, 1);
        } else {
          if (now > invulnerableUntilRef.current && proj.x < playerRef.current.x + playerRef.current.width - 5 && proj.x + proj.width > playerRef.current.x + 5 && proj.y < playerRef.current.y + playerRef.current.height - 5 && proj.y + proj.height > playerRef.current.y + 5) {
            handlePlayerDeath();
          }
        }
      }

      // 5. OBSTACLES & COLLISIONS
      for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const obs = obstaclesRef.current[i];
        if (!obs) continue;
        obs.y += speedRef.current;

        if ((obs.type === ObstacleType.MOVING || obs.type === ObstacleType.SHIP) && obs.vx) {
          obs.x += obs.vx;
          if (obs.x <= riverX || obs.x + obs.width >= riverRight) obs.vx *= -1;
        }

        if ((obs.type === ObstacleType.SHOOTER || obs.type === ObstacleType.SHIP) && obs.y > 0 && obs.y < canvas.height - 100) {
          if (now - (obs.lastShot || 0) > ENEMY_FIRE_RATE) {
            const dx = (playerRef.current.x + playerRef.current.width/2) - (obs.x + obs.width/2);
            const dy = (playerRef.current.y + playerRef.current.height/2) - (obs.y + obs.height/2);
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            projectilesRef.current.push({
              x: obs.x + obs.width/2, y: obs.y + obs.height/2, width: 8, height: 8, color: '#dc2626',
              vx: (dx/dist) * 5, vy: (dy/dist) * 5, isEnemy: true
            });
            obs.lastShot = now;
          }
        }

        const isColliding = playerRef.current.x + 5 < obs.x + obs.width && playerRef.current.x + playerRef.current.width - 5 > obs.x && playerRef.current.y + 5 < obs.y + obs.height && playerRef.current.y + playerRef.current.height - 5 > obs.y;
        if (isColliding) {
          if (obs.type === ObstacleType.FUEL) {
            fuelRef.current = Math.min(100, fuelRef.current + FUEL_REFILL_RATE);
            soundManager.playRefuel();
          } else if (obs.type === ObstacleType.LIFE) {
            soundManager.playOneUp();
            livesRef.current = Math.min(5, livesRef.current + 1);
            obstaclesRef.current.splice(i, 1);
            continue;
          } else if (obs.type === ObstacleType.SLOW) {
            playerSpeedMultiplierRef.current = 0.3;
          } else if (now > invulnerableUntilRef.current) {
            handlePlayerDeath();
            if (obs.type !== ObstacleType.STATIC) obstaclesRef.current.splice(i, 1);
            continue;
          }
        }

        if (obs.y > canvas.height + 250) {
          obstaclesRef.current.splice(i, 1);
          if (obs.type !== ObstacleType.FUEL && obs.type !== ObstacleType.LIFE && obs.type !== ObstacleType.STATIC) {
            scoreRef.current += Math.floor(10 * (speedRef.current / 3));
            setScore(scoreRef.current);
          }
        }
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        if (!p) continue;
        p.x += p.vx; p.y += p.vy; p.life--;
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }
    }

    // 6. DRAWING
    ctx.fillStyle = '#064e3b'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const riverX = (canvas.width * (1 - RIVER_WIDTH_PERCENT)) / 2;
    const riverW = canvas.width * RIVER_WIDTH_PERCENT;
    const gradient = ctx.createLinearGradient(riverX, 0, riverX + riverW, 0);
    gradient.addColorStop(0, '#1e3a8a'); gradient.addColorStop(0.5, '#2563eb'); gradient.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = gradient;
    ctx.fillRect(riverX, 0, riverW, canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    for (let i = -40; i < canvas.height; i += 40) {
      const y = i + riverOffsetRef.current;
      ctx.beginPath(); ctx.moveTo(riverX, y); ctx.lineTo(riverX + riverW, y); ctx.stroke();
    }

    obstaclesRef.current.forEach(obs => {
      if (!obs) return;
      if (obs.type === ObstacleType.STATIC) {
        ctx.fillStyle = obs.color; ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 3; ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
      } else if (obs.type === ObstacleType.SLOW) {
        ctx.fillStyle = '#1e1b4b'; ctx.globalAlpha = 0.7; ctx.beginPath();
        ctx.ellipse(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/2, obs.height/3, 0, 0, Math.PI*2);
        ctx.fill(); ctx.globalAlpha = 1.0;
      } else if (obs.type === ObstacleType.FUEL) {
        ctx.fillStyle = '#b45309'; ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillStyle = '#fbbf24'; ctx.fillRect(obs.x + 2, obs.y + 15, obs.width - 4, obs.height - 30);
        ctx.fillStyle = 'white'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
        ctx.fillText("FUEL", obs.x + obs.width/2, obs.y + obs.height/2 + 5);
      } else if (obs.type === ObstacleType.LIFE) {
        ctx.fillStyle = obs.color; ctx.beginPath();
        const th = obs.height * 0.3;
        ctx.moveTo(obs.x + obs.width/2, obs.y + th);
        ctx.bezierCurveTo(obs.x + obs.width/2, obs.y, obs.x, obs.y, obs.x, obs.y + th);
        ctx.bezierCurveTo(obs.x, obs.y + (obs.height + th)/2, obs.x + obs.width/2, obs.y + (obs.height + th)/2, obs.x + obs.width/2, obs.y + obs.height);
        ctx.bezierCurveTo(obs.x + obs.width/2, obs.y + (obs.height + th)/2, obs.x + obs.width, obs.y + (obs.height + th)/2, obs.x + obs.width, obs.y + th);
        ctx.bezierCurveTo(obs.x + obs.width, obs.y, obs.x + obs.width/2, obs.y, obs.x + obs.width/2, obs.y + th);
        ctx.fill();
      } else if (obs.type === ObstacleType.MOVING) {
        ctx.fillStyle = obs.color;
        if (obs.color === '#000000') {
          ctx.beginPath(); ctx.moveTo(obs.x + obs.width/2, obs.y + obs.height); ctx.lineTo(obs.x + obs.width, obs.y); ctx.lineTo(obs.x, obs.y); ctx.fill();
        } else {
          ctx.beginPath(); ctx.ellipse(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/2, obs.height/3, 0, 0, Math.PI*2); ctx.fill();
          ctx.fillRect(obs.x + obs.width/2 - 2, obs.y - 10, 4, obs.height/2);
        }
      } else if (obs.type === ObstacleType.SHIP) {
        ctx.fillStyle = '#52525b'; ctx.beginPath();
        ctx.moveTo(obs.x + obs.width/2, obs.y + obs.height); ctx.lineTo(obs.x + obs.width, obs.y + obs.height * 0.8); ctx.lineTo(obs.x + obs.width, obs.y + obs.height * 0.2); ctx.lineTo(obs.x + obs.width/2, obs.y); ctx.lineTo(obs.x, obs.y + obs.height * 0.2); ctx.lineTo(obs.x, obs.y + obs.height * 0.8);
        ctx.fill(); ctx.fillStyle = obs.color; ctx.fillRect(obs.x + obs.width * 0.2, obs.y + obs.height * 0.3, obs.width * 0.6, obs.height * 0.4);
      } else if (obs.type === ObstacleType.SHOOTER) {
        ctx.fillStyle = obs.color; ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillStyle = '#064e3b'; ctx.beginPath(); ctx.arc(obs.x + obs.width/2, obs.y + obs.height/2, obs.width/3, 0, Math.PI*2); ctx.fill();
      }
    });

    projectilesRef.current.forEach(proj => {
      if (!proj) return;
      ctx.fillStyle = proj.color; ctx.beginPath();
      if (proj.isEnemy) ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
      else ctx.rect(proj.x, proj.y, proj.width, proj.height);
      ctx.fill();
    });

    const isInvulnerable = now < invulnerableUntilRef.current;
    if (gameState !== GameState.GAME_OVER && (!isInvulnerable || Math.floor(now / 100) % 2 === 0)) {
      ctx.save();
      ctx.translate(playerRef.current.x + playerRef.current.width/2, playerRef.current.y + playerRef.current.height/2);
      ctx.rotate(playerRef.current.tilt || 0);
      ctx.fillStyle = playerRef.current.color;
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(20, 20); ctx.lineTo(0, 10); ctx.lineTo(-20, 20); ctx.fill();
      ctx.restore();
    }

    particlesRef.current.forEach(p => {
      if (!p) return;
      ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.width, p.height); ctx.globalAlpha = 1.0;
    });

    requestRef.current = requestAnimationFrame(loop);
  }, [gameState, setScore, handlePlayerDeath, createExplosion]);

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
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [loop]);

  useEffect(() => {
    if (gameState === GameState.PLAYING && score === 0) resetGame();
  }, [gameState, score, resetGame]);

  return (
    <div className="relative w-full h-full bg-gray-900 overflow-hidden flex justify-center shadow-2xl border-x-4 border-gray-800">
      <canvas ref={canvasRef} className="block bg-gray-900" />
      <button onClick={toggleMute} className="absolute top-4 right-4 z-20 p-2 bg-gray-800/80 rounded-full text-white">
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-10 p-6 text-center">
            <h1 className="pixel-font text-3xl md:text-5xl text-yellow-400 mb-8 leading-relaxed">NEHİR AKINCISI</h1>
            <p className="text-gray-300 mb-8 max-w-md text-sm leading-relaxed space-y-2">
                <span className="block font-bold text-white text-lg">GÖREV RAPORU:</span>
                <span className="block text-gray-400">WASD / YÖN TUŞLARI ile uç. SPACE ile ateş et.</span>
                <span className="block text-red-400">DİKKAT: Kıyıya çarpmak ölümcüldür!</span>
            </p>
            <button onClick={() => setGameState(GameState.PLAYING)} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded-lg flex items-center gap-3">
                <Play className="w-6 h-6 fill-current" /><span>BAŞLA</span>
            </button>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80 z-10 p-6 text-center animate-in fade-in">
            <h2 className="pixel-font text-4xl text-white mb-2">UÇAK DÜŞTÜ</h2>
            <div className="text-6xl font-bold text-yellow-300 mb-6 font-mono">{score}</div>
            <button onClick={() => { setScore(0); setGameState(GameState.PLAYING); }} className="px-8 py-3 bg-white text-red-900 font-bold text-lg rounded-full flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />TEKRAR
            </button>
        </div>
      )}
      
      {gameState === GameState.PLAYING && (
          <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none flex flex-col gap-2">
              <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                      <span className="text-xs text-blue-200 uppercase font-bold">SKOR</span>
                      <span className="text-2xl font-mono font-bold text-white">{score}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                      <div className="flex gap-1">
                          {[...Array(Math.max(0, Math.min(5, livesRef.current)))].map((_, i) => (
                              <Heart key={i} className="w-6 h-6 fill-red-500 text-red-600" />
                          ))}
                      </div>
                  </div>
                  <div className="flex flex-col items-end">
                      <span className="text-xs text-yellow-200 uppercase font-bold">REKOR</span>
                      <span className="text-xl font-mono font-bold text-yellow-100">{Math.max(score, highScore)}</span>
                  </div>
              </div>
              <div className="w-full max-w-md mx-auto bg-gray-800/80 rounded-full h-4 border border-gray-600 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-600 to-green-500 transition-all duration-200" style={{ width: `${Math.max(0, fuelRef.current)}%` }}></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default GameCanvas;