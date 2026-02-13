import React, { useState, useEffect, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, LeaderboardEntry } from './types';
import { createClient } from '@supabase/supabase-js';

// Supabase yapılandırması kontrolü
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Vercel veya yerel ortamda değişkenler tanımlı değilse istemciyi oluşturma
const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LOGIN);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [username, setUsername] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerRank, setPlayerRank] = useState<number | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('username, score')
        .order('score', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      if (data) setLeaderboard(data);
    } catch (err) {
      console.warn("Liderlik tablosu henüz hazır değil veya tablo oluşturulmamış.");
    }
  }, []);

  const saveScoreToSupabase = useCallback(async (finalScore: number) => {
    if (!supabase || !username || finalScore <= 0) return;
    
    try {
      // Skoru gönder
      const { error: insertError } = await supabase
        .from('leaderboard')
        .insert([{ username, score: finalScore }]);
      
      if (insertError) throw insertError;

      // Sıralamayı al
      const { count } = await supabase
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .gt('score', finalScore);
      
      if (count !== null) {
        setPlayerRank(count + 1);
      }
      
      fetchLeaderboard();
    } catch (err) {
      console.error("Skor kaydedilirken bir hata oluştu:", err);
    }
  }, [username, fetchLeaderboard]);

  useEffect(() => {
    const savedUser = localStorage.getItem('nehir-akincisi-user');
    if (savedUser) {
      setUsername(savedUser);
      setGameState(GameState.MENU);
      if (supabase) fetchLeaderboard();
    }
  }, [fetchLeaderboard]);

  const handleLogin = (name: string) => {
    if (name.length >= 3 && name.length <= 12) {
      const sanitized = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      setUsername(sanitized);
      localStorage.setItem('nehir-akincisi-user', sanitized);
      setGameState(GameState.MENU);
      if (supabase) fetchLeaderboard();
    }
  };

  useEffect(() => {
    if (gameState === GameState.GAME_OVER) {
      saveScoreToSupabase(score);
    }
    if (gameState === GameState.MENU) {
      if (supabase) fetchLeaderboard();
    }
  }, [gameState, score, fetchLeaderboard, saveScoreToSupabase]);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-950 p-0 md:p-4 lg:p-8">
      
      <div className="w-full max-w-lg h-full max-h-[900px] bg-black rounded-xl overflow-hidden shadow-2xl relative border-4 border-gray-800 ring-4 ring-black crt-overlay">
        {/* CRT Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,3px_100%]"></div>
        
        <GameCanvas 
          gameState={gameState} 
          setGameState={setGameState}
          score={score}
          setScore={setScore}
          highScore={highScore}
          username={username}
          leaderboard={leaderboard}
          playerRank={playerRank}
          onLogin={handleLogin}
        />
        
        <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-gray-500 font-mono hidden md:block z-20">
           {username ? `PILOT: ${username}` : 'v1.2.0 • ONLINE STATUS'}
           {!supabase && <span className="ml-2 text-red-500 animate-pulse">• OFFLINE (NO DB)</span>}
           {supabase && <span className="ml-2 text-green-500">• LIVE SERVER</span>}
        </div>
      </div>
      
      <div className="mt-4 text-gray-400 text-xs md:text-sm hidden md:block text-center">
        {!supabase ? (
          <p className="bg-red-900/20 text-red-400 px-4 py-1 rounded-full border border-red-900/50">
            ⚠️ Veritabanı bağlı değil. Liderlik tablosu çalışmayacak. Vercel Environment Variables ayarlarını kontrol edin.
          </p>
        ) : (
          <p className="mb-1 text-gray-500 italic">
            "Sadece en cesurlar liderlik tablosuna girebilir."
          </p>
        )}
      </div>
    </div>
  );
};

export default App;