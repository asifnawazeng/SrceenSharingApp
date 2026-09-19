import { useState } from 'react';
import { Eye, ArrowLeft } from 'lucide-react';

interface JoinViewProps {
  onJoin: (roomCode: string) => void;
  onBack: () => void;
}

export function JoinView({ onJoin, onBack }: JoinViewProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError('Room code must be 6 characters');
      return;
    }
    setError('');
    onJoin(trimmed);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-6">
          <Eye className="w-8 h-8 text-cyan-400" />
        </div>

        <h2 className="text-3xl font-bold mb-3">Join a screen session</h2>
        <p className="text-slate-400 mb-8">
          Enter the 6-character room code provided by the person sharing their
          screen.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">
              Room Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().slice(0, 6));
                setError('');
              }}
              placeholder="ABC123"
              autoFocus
              maxLength={6}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-5 py-4 text-center text-3xl font-bold tracking-[0.3em] text-cyan-400 placeholder-slate-700 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={code.trim().length !== 6}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium px-6 py-3.5 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            Join Session
          </button>
        </form>
      </div>
    </div>
  );
}
