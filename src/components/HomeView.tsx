import { Monitor, Eye, ArrowRight } from 'lucide-react';

interface HomeViewProps {
  onStartSharing: () => void;
  onWatchScreen: () => void;
}

export function HomeView({ onStartSharing, onWatchScreen }: HomeViewProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-5xl w-full">
        <div className="flex items-center justify-center gap-3 mb-12">
          <img
            src="/logo.svg"
            alt="ScreenShare logo"
            className="w-10 h-10 rounded-xl"
          />
          <span className="text-lg font-semibold tracking-tight">
            ScreenShare
          </span>
        </div>

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
            <Monitor className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
            Share your screen
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              instantly
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            Broadcast your screen to anyone, anywhere. No downloads, no
            accounts, no friction — just a room code.
          </p>
        </div>

        {/* Action cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={onStartSharing}
            className="group relative bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-left hover:border-blue-500/40 hover:bg-slate-900 transition-all duration-300 cursor-pointer"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/10 mb-5">
              <Monitor className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Share my screen</h2>
            <p className="text-sm text-slate-400 mb-4">
              Start broadcasting your screen and get a room code to share with
              others.
            </p>
            <div className="inline-flex items-center gap-2 text-blue-400 text-sm font-medium">
              Start sharing
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={onWatchScreen}
            className="group relative bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-left hover:border-cyan-500/40 hover:bg-slate-900 transition-all duration-300 cursor-pointer"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 mb-5">
              <Eye className="w-6 h-6 text-cyan-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Watch a screen</h2>
            <p className="text-sm text-slate-400 mb-4">
              Enter a room code to view someone else's screen in real time.
            </p>
            <div className="inline-flex items-center gap-2 text-cyan-400 text-sm font-medium">
              Join a session
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        <p className="text-center text-sm text-slate-500 mt-12">
          ScreenShare by <span className="text-slate-300">Asif Nawazi</span>
        </p>
      </div>
    </div>
  );
}
