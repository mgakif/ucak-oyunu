import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState } from './types';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Load high score from local storage
  useEffect(() => {
    const stored = localStorage.getItem('nehir-akincisi-highscore');
    if (stored) {
      setHighScore(parseInt(stored, 10));
    }
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('nehir-akincisi-highscore', score.toString());
    }
  }, [score, highScore]);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-950 p-0 md:p-4 lg:p-8">
      
      <div className="w-full max-w-lg h-full max-h-[900px] bg-black rounded-xl overflow-hidden shadow-2xl relative border-4 border-gray-800 ring-4 ring-black">
        {/* CRT Scanline Effect Overlay (CSS only visual) */}
        <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]"></div>
        
        <GameCanvas 
          gameState={gameState} 
          setGameState={setGameState}
          score={score}
          setScore={setScore}
          highScore={highScore}
        />
        
        {/* Footer info for desktop */}
        <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-gray-500 font-mono hidden md:block">
           v1.1.0 • JET UPDATE
        </div>
      </div>
      
      <div className="mt-4 text-gray-400 text-xs md:text-sm hidden md:block text-center">
        <p className="mb-1">
            <span className="text-white font-bold bg-gray-800 px-2 py-1 rounded">WASD</span> veya <span className="text-white font-bold bg-gray-800 px-2 py-1 rounded">YÖN TUŞLARI</span>
        </p>
        <p className="text-gray-500">
            Yukarı tuşu hızlandırır, aşağı tuşu yavaşlatır.
        </p>
      </div>
    </div>
  );
};

export default App;