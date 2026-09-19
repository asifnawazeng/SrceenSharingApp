import { useEffect, useRef, useState } from 'react';
import {
  Eye,
  ArrowLeft,
  Maximize,
  Minimize,
  Loader2,
  WifiOff,
} from 'lucide-react';
import { useViewer } from '@/hooks/useViewer';
import type { ConnectionStatus } from '@/lib/types';

interface ViewerViewProps {
  roomCode: string;
  onBack: () => void;
}

export function ViewerView({ roomCode, onBack }: ViewerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { stream, status, error, connect, disconnect } = useViewer(roomCode);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Connect on mount and tear down on unmount. This is deliberately a single
  // symmetric effect: React StrictMode mounts, unmounts and remounts in
  // development, and a one-shot "already connected" guard would leave the
  // remount permanently disconnected — with the WebSocket aborted mid-handshake
  // ("closed before the connection is established").
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const statusDisplay = getStatusDisplay(status);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto w-full">
        <button
          onClick={() => {
            onBack();
          }}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
          {status === 'connected' ? (
            <div className="w-2 h-2 rounded-full bg-green-400" />
          ) : status === 'connecting' ? (
            <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
          ) : status === 'disconnected' || status === 'failed' ? (
            <WifiOff className="w-3 h-3 text-red-400" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-slate-600" />
          )}
          <span className="text-sm font-medium">{statusDisplay}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Video container */}
        <div
          ref={containerRef}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative min-h-[300px] flex items-center justify-center"
        >
          {stream ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              <button
                onClick={toggleFullscreen}
                className="absolute top-4 right-4 p-2.5 rounded-lg bg-slate-950/60 backdrop-blur-sm hover:bg-slate-950/80 transition-colors"
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5 text-white" />
                ) : (
                  <Maximize className="w-5 h-5 text-white" />
                )}
              </button>
            </>
          ) : (
            <div className="text-center">
              {status === 'connecting' ? (
                <>
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800/50 mb-4">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Connecting...</h3>
                  <p className="text-sm text-slate-400">
                    Waiting for host to start sharing
                  </p>
                </>
              ) : status === 'disconnected' || status === 'failed' ? (
                <>
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
                    <WifiOff className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Stream ended
                  </h3>
                  <p className="text-sm text-slate-400 mb-5">
                    The host has stopped sharing or the connection was lost.
                  </p>
                  <button
                    onClick={() => {
                      disconnect();
                      setTimeout(() => connect(), 100);
                    }}
                    className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    Reconnect
                  </button>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800/50 mb-4">
                    <Eye className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Joining room {roomCode}
                  </h3>
                  <p className="text-sm text-slate-400">
                    Looking for the host...
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm mt-4 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

function getStatusDisplay(status: ConnectionStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'connecting':
      return 'Connecting';
    case 'connected':
      return 'Connected';
    case 'disconnected':
      return 'Disconnected';
    case 'failed':
      return 'Failed';
  }
}
