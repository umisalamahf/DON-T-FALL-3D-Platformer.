/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { DontFallGame, GameStats, VictoryData } from './game/DontFallGame';
import { sounds } from './game/SoundEffects';
import {
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trophy,
  Timer,
  Volume2,
  VolumeX,
  Sparkles,
  Flag,
  Star,
  CheckCircle2,
} from 'lucide-react';

// Format detik ke format menit:detik.milidetik (00:00.0)
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  const mStr = mins < 10 ? `0${mins}` : `${mins}`;
  const sStr = secs < 10 ? `0${secs}` : `${secs}`;
  return `${mStr}:${sStr}.${ms}`;
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<DontFallGame | null>(null);

  const [stats, setStats] = useState<GameStats>({
    deaths: 0,
    isGrounded: true,
    playerY: 0,
    elapsedTime: 0,
    isFinished: false,
    hasCheckpoint: false,
    checkpointActivatedNotice: false,
  });

  const [bestTime, setBestTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('dont_fall_best_time');
    return saved ? parseFloat(saved) : null;
  });

  const [victoryData, setVictoryData] = useState<VictoryData | null>(null);
  const [isNewBestTime, setIsNewBestTime] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [deathAlert, setDeathAlert] = useState<{ show: boolean; atCheckpoint: boolean }>({
    show: false,
    atCheckpoint: false,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const game = new DontFallGame(containerRef.current, {
      onStatsChange: (newStats) => {
        setStats({ ...newStats });
      },
      onVictory: (data) => {
        setVictoryData(data);

        // Periksa & simpan Best Time ke localStorage
        const previousBest = localStorage.getItem('dont_fall_best_time');
        const prevBestNum = previousBest ? parseFloat(previousBest) : null;

        if (prevBestNum === null || data.timeSeconds < prevBestNum) {
          localStorage.setItem('dont_fall_best_time', data.timeSeconds.toString());
          setBestTime(data.timeSeconds);
          setIsNewBestTime(true);
        } else {
          setIsNewBestTime(false);
        }
      },
      onDeath: (deathsCount, atCheckpoint) => {
        setDeathAlert({ show: true, atCheckpoint });
        setTimeout(() => {
          setDeathAlert({ show: false, atCheckpoint: false });
        }, 1800);
      },
    });

    gameRef.current = game;

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    sounds.enabled = !next;
  };

  const handleRestart = () => {
    setVictoryData(null);
    setIsNewBestTime(false);
    gameRef.current?.restartLevel();
  };

  const handleRespawnCheckpoint = () => {
    gameRef.current?.respawnPlayer(false);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0a0d1a] text-white select-none font-sans">
      {/* 3D Canvas Scene */}
      <div id="game-canvas-container" ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Header & HUD */}
      <header className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 flex items-center justify-between pointer-events-none z-10">
        {/* Game Title & Level Badge */}
        <div className="flex items-center gap-3 bg-slate-900/85 backdrop-blur-md px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-700/60 shadow-xl">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#38bdf8]" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-wider text-white">DON'T FALL</h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                LVL 01
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-400">Training Ground</p>
          </div>
        </div>

        {/* HUD Counters (Timer, Best Time, Deaths, Checkpoint, Audio) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Timer */}
          <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-3 sm:px-3.5 py-2 rounded-xl border border-slate-700/60 shadow-lg">
            <Timer className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">TIME:</span>
            <span className="text-xs sm:text-sm font-mono font-bold text-cyan-300 w-16 text-right">
              {formatTime(stats.elapsedTime)}
            </span>
          </div>

          {/* Best Time (jika sudah ada di localStorage) */}
          {bestTime !== null && (
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/60 shadow-lg">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] text-slate-400 font-medium">BEST:</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-amber-300">{formatTime(bestTime)}</span>
            </div>
          )}

          {/* Deaths Counter */}
          <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-3 sm:px-3.5 py-2 rounded-xl border border-slate-700/60 shadow-lg">
            <span className="text-[11px] text-slate-400 font-medium">DEATHS:</span>
            <span className="text-xs sm:text-sm font-bold text-rose-400">{stats.deaths}</span>
          </div>

          {/* Checkpoint Status Pill */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/60">
            <Flag className={`w-3.5 h-3.5 ${stats.hasCheckpoint ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-bold text-slate-400">CP:</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                stats.hasCheckpoint
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {stats.hasCheckpoint ? 'SAVED' : 'NONE'}
            </span>
          </div>

          {/* Audio Toggle Button */}
          <button
            id="btn-toggle-sound"
            onClick={toggleSound}
            className="pointer-events-auto p-2 sm:p-2.5 bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition-colors shadow-lg active:scale-95 cursor-pointer"
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Restart Level Button */}
          <button
            id="btn-restart-level"
            onClick={handleRestart}
            className="pointer-events-auto flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-xl border border-slate-700/70 transition-colors shadow-lg active:scale-95 text-xs font-medium cursor-pointer"
            title="Restart Level"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Restart</span>
          </button>
        </div>
      </header>

      {/* Checkpoint Activated Floating Toast Notification */}
      {stats.checkpointActivatedNotice && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 backdrop-blur-md px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.35)] animate-bounce pointer-events-none">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold tracking-wider">CHECKPOINT ACTIVATED!</span>
        </div>
      )}

      {/* Death Alert Notification Banner */}
      {deathAlert.show && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-rose-950/90 text-rose-300 border border-rose-500/50 backdrop-blur-md px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(244,63,94,0.35)] pointer-events-none">
          <span className="text-xs font-bold tracking-wider">
            {deathAlert.atCheckpoint ? 'YOU FELL! Respawned at Checkpoint' : 'YOU FELL! Respawned at Start Platform'}
          </span>
        </div>
      )}

      {/* Victory Modal Overlay */}
      {victoryData && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-30 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
            {/* Ambient decorative glow */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-44 h-44 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 mb-3 shadow-lg">
              <Trophy className="w-8 h-8" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">LEVEL COMPLETE!</h2>
            <p className="text-xs text-slate-400 mt-1">You reached the finish portal safely</p>

            {/* Stars Rating Display */}
            <div className="flex items-center justify-center gap-2 my-4">
              {[1, 2, 3].map((starIndex) => (
                <Star
                  key={starIndex}
                  className={`w-8 h-8 ${
                    starIndex <= victoryData.stars
                      ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_#f59e0b]'
                      : 'text-slate-700'
                  }`}
                />
              ))}
            </div>

            <p className="text-xs font-semibold text-cyan-300 mb-5">
              {victoryData.stars === 3
                ? '★★★ Flawless Run! Speedmaster!'
                : victoryData.stars === 2
                ? '★★☆ Great Platforming!'
                : '★☆☆ Completed! Try for 3 Stars!'}
            </p>

            {/* Stats Breakdown Box */}
            <div className="grid grid-cols-2 gap-2.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800 mb-6 text-left">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">FINISH TIME</p>
                <p className="text-lg font-mono font-bold text-white">{formatTime(victoryData.timeSeconds)}</p>
              </div>

              <div>
                <p className="text-[11px] text-slate-400 font-medium">TOTAL DEATHS</p>
                <p className="text-lg font-bold text-rose-400">{victoryData.deaths}</p>
              </div>

              <div className="col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">PERSONAL BEST:</span>
                <div className="flex items-center gap-2">
                  {isNewBestTime && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      NEW RECORD!
                    </span>
                  )}
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {bestTime !== null ? formatTime(bestTime) : formatTime(victoryData.timeSeconds)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                id="btn-victory-replay"
                onClick={handleRestart}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl text-xs sm:text-sm tracking-wide shadow-lg shadow-cyan-900/30 transition-all active:scale-95 cursor-pointer"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Center: Keyboard Guide */}
      <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-5 bg-slate-900/85 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-700/70 shadow-2xl pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="px-2 py-1 bg-slate-800 text-cyan-300 font-mono text-xs rounded border border-slate-700 shadow-sm font-bold">W</span>
            <span className="px-2 py-1 bg-slate-800 text-cyan-300 font-mono text-xs rounded border border-slate-700 shadow-sm font-bold">A</span>
            <span className="px-2 py-1 bg-slate-800 text-cyan-300 font-mono text-xs rounded border border-slate-700 shadow-sm font-bold">S</span>
            <span className="px-2 py-1 bg-slate-800 text-cyan-300 font-mono text-xs rounded border border-slate-700 shadow-sm font-bold">D</span>
          </div>
          <span className="text-xs text-slate-300 font-medium ml-1">Move</span>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1 bg-slate-800 text-emerald-400 font-mono text-xs rounded border border-slate-700 shadow-sm font-bold">
            SPACE
          </span>
          <span className="text-xs text-slate-300 font-medium">Jump</span>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="text-amber-400 font-medium">Checkpoint:</span>
          <span>Reach the floating crystal totem to save progress!</span>
        </div>
      </footer>

      {/* On-Screen Mobile Touch Controls */}
      <nav aria-label="Mobile and touch controls" className="absolute bottom-5 left-5 md:hidden flex flex-col items-center gap-1.5">
        <button
          id="btn-move-forward"
          className="w-12 h-12 bg-slate-800/80 active:bg-cyan-600 rounded-xl flex items-center justify-center border border-slate-700 text-slate-200"
          onTouchStart={() => gameRef.current?.setKey('forward', true)}
          onTouchEnd={() => gameRef.current?.setKey('forward', false)}
          onMouseDown={() => gameRef.current?.setKey('forward', true)}
          onMouseUp={() => gameRef.current?.setKey('forward', false)}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
        <div className="flex gap-1.5">
          <button
            id="btn-move-left"
            className="w-12 h-12 bg-slate-800/80 active:bg-cyan-600 rounded-xl flex items-center justify-center border border-slate-700 text-slate-200"
            onTouchStart={() => gameRef.current?.setKey('left', true)}
            onTouchEnd={() => gameRef.current?.setKey('left', false)}
            onMouseDown={() => gameRef.current?.setKey('left', true)}
            onMouseUp={() => gameRef.current?.setKey('left', false)}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            id="btn-move-back"
            className="w-12 h-12 bg-slate-800/80 active:bg-cyan-600 rounded-xl flex items-center justify-center border border-slate-700 text-slate-200"
            onTouchStart={() => gameRef.current?.setKey('backward', true)}
            onTouchEnd={() => gameRef.current?.setKey('backward', false)}
            onMouseDown={() => gameRef.current?.setKey('backward', true)}
            onMouseUp={() => gameRef.current?.setKey('backward', false)}
          >
            <ArrowDown className="w-5 h-5" />
          </button>
          <button
            id="btn-move-right"
            className="w-12 h-12 bg-slate-800/80 active:bg-cyan-600 rounded-xl flex items-center justify-center border border-slate-700 text-slate-200"
            onTouchStart={() => gameRef.current?.setKey('right', true)}
            onTouchEnd={() => gameRef.current?.setKey('right', false)}
            onMouseDown={() => gameRef.current?.setKey('right', true)}
            onMouseUp={() => gameRef.current?.setKey('right', false)}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* On-Screen Jump Button (Mobile) */}
      <div className="absolute bottom-6 right-6 md:hidden">
        <button
          id="btn-jump"
          className="w-16 h-16 bg-emerald-600/90 active:bg-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-400/50 text-white font-bold shadow-lg shadow-emerald-900/40 text-xs tracking-wider"
          onTouchStart={() => gameRef.current?.setKey('jump', true)}
          onTouchEnd={() => gameRef.current?.setKey('jump', false)}
          onMouseDown={() => gameRef.current?.setKey('jump', true)}
          onMouseUp={() => gameRef.current?.setKey('jump', false)}
        >
          JUMP
        </button>
      </div>
    </main>
  );
}
