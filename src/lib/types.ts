export type SignalMessage =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; from: string; to: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; from: string; to: string }
  | { type: 'ice'; candidate: RTCIceCandidateInit; from: string; to: string }
  | { type: 'viewer-join'; from: string }
  | { type: 'host-ready'; from: string }
  | { type: 'viewer-leave'; from: string };

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed';

export type AppView = 'home' | 'join' | 'host' | 'viewer';
