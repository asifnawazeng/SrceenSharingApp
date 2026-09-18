import { useEffect, useRef, useState } from 'react';
import {
  Monitor,
  Users,
  Copy,
  Check,
  Square,
  ArrowLeft,
  Radio,
} from 'lucide-react';
import { useHost } from '@/hooks/useHost';

interface HostViewProps {
  roomCode: string;
  onBack: () => void;
}

export function HostView({ roomCode, onBack }: HostViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { stream, status, viewerCount, error, startSharing, stopSharing } =
    useHost(roomCode);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSharing = status !== 'idle';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto w-full">
        <button
          onClick={() => {
            stopSharing();
            onBack();
          }}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium tabular-nums">
              {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
            </span>
          </div>
          {isSharing && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
              <Radio className="w-4 h-4 text-red-400 animate-pulse" />
              <span className="text-sm font-medium text-red-400">LIVE</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {!isSharing ? (
          /* Start sharing prompt */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
                <Monitor className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl font-semibold mb-3">
                Ready to share your screen
              </h2>
              <p className="text-slate-400 mb-6">
                Your room code is ready. Click below to start broadcasting.
              </p>

              {/* Room code display */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                  Room Code
                </p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-bold tracking-[0.3em] text-blue-400">
                    {roomCode}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm mb-4">{error}</p>
              )}

              <button
                onClick={startSharing}
                className="w-full bg-blue-500 hover:bg-blue-400 text-white font-medium px-6 py-3 rounded-xl transition-colors cursor-pointer"
              >
                Start Sharing
              </button>
            </div>
          </div>
        ) : (
          /* Sharing view */
          <div className="flex-1 flex flex-col gap-6">
            {/* Video preview */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative min-h-[300px]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              {status === 'connecting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Starting stream...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controls bar */}
            <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs uppercase tracking-wider text-slate-500">
                  Code
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-[0.2em] text-blue-400">
                    {roomCode}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={stopSharing}
                className="inline-flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                <Square className="w-4 h-4" />
                Stop Sharing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
