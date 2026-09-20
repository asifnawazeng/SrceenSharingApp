import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createPeerConnection, generateClientId } from '@/lib/webrtc';
import type { SignalMessage, ConnectionStatus } from '@/lib/types';

function broadcast(
  channel: ReturnType<typeof supabase.channel> | null,
  message: SignalMessage
) {
  if (!channel) return;
  channel.send({ type: 'broadcast', event: 'signal', payload: message });
}

export function useViewer(roomCode: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const clientIdRef = useRef(generateClientId());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const joinedRef = useRef(false);

  const createViewerPeer = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = createPeerConnection();
    pcRef.current = pc;

    pc.ontrack = (e) => {
      const [incomingStream] = e.streams;
      if (incomingStream) {
        setStream(incomingStream);
        setStatus('connected');
      }
    };

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
        setStatus('disconnected');
      }
    };

    return pc;
  }, []);

  const handleSignal = useCallback(async (message: SignalMessage) => {
    const fromId = message.from;
    if (fromId === clientIdRef.current) return;

    if (message.type === 'host-ready') {
      createViewerPeer();
      if (!joinedRef.current) {
        joinedRef.current = true;
        broadcast(channelRef.current, {
          type: 'viewer-join',
          from: clientIdRef.current,
        });
      }
      return;
    }

    const pc = createViewerPeer();

    if (message.type === 'offer') {
      await pc.setRemoteDescription(message.sdp);
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(candidate);
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      broadcast(channelRef.current, {
        type: 'answer',
        sdp: answer,
        from: clientIdRef.current,
      });
    } else if (message.type === 'ice') {
      if (pc.remoteDescription) {
        await pc.addIceCandidate(message.candidate);
      } else {
        pendingCandidatesRef.current.push(message.candidate);
      }
    } else if (message.type === 'viewer-leave') {
      setStatus('disconnected');
    }
  }, [createViewerPeer]);

  const connect = useCallback(() => {
    if (channelRef.current) return;

    setStatus('connecting');
    setError(null);

    const channel = supabase.channel(`room-${roomCode}`, {
      config: { broadcast: { self: false } },
    });

    channel.on(
      'broadcast',
      { event: 'signal' },
      ({ payload }: { payload: SignalMessage }) => {
        void handleSignal(payload).catch((err) => {
          setError(
            err instanceof Error ? err.message : 'Signaling failed'
          );
          setStatus('failed');
        });
      }
    );

    channelRef.current = channel;
    channel.subscribe((state: string) => {
      if (state === 'SUBSCRIBED') {
        createViewerPeer();
        joinedRef.current = true;
        broadcast(channel, {
          type: 'viewer-join',
          from: clientIdRef.current,
        });
      } else if (
        state === 'CHANNEL_ERROR' ||
        state === 'TIMED_OUT' ||
        state === 'CLOSED'
      ) {
        setError(`Signaling channel ${state.toLowerCase()}`);
        setStatus('failed');
      }
    });
  }, [roomCode, createViewerPeer, handleSignal]);

  const disconnect = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
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

    joinedRef.current = false;
    pendingCandidatesRef.current = [];
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return { stream, status, error, connect, disconnect };
}
