import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createPeerConnection, generateClientId } from '@/lib/webrtc';
import type { SignalMessage, ConnectionStatus } from '@/lib/types';

interface ViewerPeer {
  id: string;
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
}

function broadcast(
  channel: ReturnType<typeof supabase.channel> | null,
  message: SignalMessage
) {
  if (!channel) return;
  channel.send({ type: 'broadcast', event: 'signal', payload: message });
}

export function useHost(roomCode: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const clientIdRef = useRef(generateClientId());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const viewersRef = useRef<Map<string, ViewerPeer>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);

  const stopSharingRef = useRef<() => void>(() => {});

  const handleSignal = useCallback(async (message: SignalMessage) => {
    const fromId = message.from;
    if (fromId === clientIdRef.current) return;

    let viewer = viewersRef.current.get(fromId);

    if (message.type === 'viewer-join') {
      if (viewer) return;
      const pc = createPeerConnection();
      viewer = { id: fromId, pc, pendingCandidates: [] };
      viewersRef.current.set(fromId, viewer);
      setViewerCount(viewersRef.current.size);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, streamRef.current!);
        });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          broadcast(channelRef.current, {
            type: 'ice',
            candidate: e.candidate.toJSON(),
            from: clientIdRef.current,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setStatus('connected');
        }
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          const v = viewersRef.current.get(fromId);
          if (v) {
            v.pc.close();
            viewersRef.current.delete(fromId);
            setViewerCount(viewersRef.current.size);
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      broadcast(channelRef.current, {
        type: 'offer',
        sdp: offer,
        from: clientIdRef.current,
      });
      return;
    }

    if (!viewer) return;

    if (message.type === 'answer') {
      await viewer.pc.setRemoteDescription(message.sdp);
      for (const candidate of viewer.pendingCandidates) {
        await viewer.pc.addIceCandidate(candidate);
      }
      viewer.pendingCandidates = [];
    } else if (message.type === 'ice') {
      if (viewer.pc.remoteDescription) {
        await viewer.pc.addIceCandidate(message.candidate);
      } else {
        viewer.pendingCandidates.push(message.candidate);
      }
    } else if (message.type === 'viewer-leave') {
      viewer.pc.close();
      viewersRef.current.delete(fromId);
      setViewerCount(viewersRef.current.size);
    }
  }, []);

  const startSharing = useCallback(async () => {
    try {
      setError(null);
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      streamRef.current = displayStream;
      setStream(displayStream);
      setStatus('connecting');

      displayStream.getVideoTracks()[0].onended = () => {
        stopSharingRef.current();
      };

      const channel = supabase.channel(`room-${roomCode}`, {
        config: { broadcast: { self: false } },
      });

      channel.on(
        'broadcast',
        { event: 'signal' },
        ({ payload }: { payload: SignalMessage }) => {
          handleSignal(payload);
        }
      );

      channel.subscribe((state: string) => {
        if (state === 'SUBSCRIBED') {
          broadcast(channel, {
            type: 'host-ready',
            from: clientIdRef.current,
          });
        }
      });

      channelRef.current = channel;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to start screen sharing'
      );
      setStatus('failed');
    }
  }, [roomCode, handleSignal]);

  const stopSharing = useCallback(() => {
    viewersRef.current.forEach((viewer) => {
      viewer.pc.close();
    });
    viewersRef.current.clear();
    setViewerCount(0);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);

    if (channelRef.current) {
      broadcast(channelRef.current, {
        type: 'viewer-leave',
        from: clientIdRef.current,
      });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setStatus('idle');
  }, []);

  stopSharingRef.current = stopSharing;

  useEffect(() => {
    const viewers = viewersRef.current;

    return () => {
      viewers.forEach((v) => v.pc.close());
      viewers.clear();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return { stream, status, viewerCount, error, startSharing, stopSharing };
}
