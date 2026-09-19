import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createPeerConnection, generateClientId } from '@/lib/webrtc';
import type { SignalMessage, ConnectionStatus } from '@/lib/types';

function broadcast(
  channel: ReturnType<typeof supabase.channel> | null,
  message: SignalMessage
) {
  if (!channel) return;
  void channel.send({
    type: 'broadcast',
    event: 'signal',
    payload: message,
  });
}

export function useViewer(roomCode: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const clientIdRef = useRef(generateClientId());
  const hostIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const joinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectedRef = useRef(false);
  const stoppedRef = useRef(true);

  const sendJoin = useCallback(() => {
    if (!stoppedRef.current && channelRef.current && pcRef.current) {
      broadcast(channelRef.current, {
        type: 'viewer-join',
        from: clientIdRef.current,
      });
    }
  }, []);

  const stopJoinRetry = useCallback(() => {
    if (joinTimerRef.current) {
      clearInterval(joinTimerRef.current);
      joinTimerRef.current = null;
    }
  }, []);

  const createViewerPeer = useCallback(() => {
    if (pcRef.current && pcRef.current.signalingState !== 'closed') {
      return pcRef.current;
    }

    const pc = createPeerConnection();
    pcRef.current = pc;
    connectedRef.current = false;

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;

      if (remoteStream) {
        setStream(remoteStream);
      } else {
        setStream((current) => {
          const next = current ?? new MediaStream();
          next.addTrack(event.track);
          return next;
        });
      }
      setStatus('connected');
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && hostIdRef.current) {
        broadcast(channelRef.current, {
          type: 'ice',
          candidate: event.candidate.toJSON(),
          from: clientIdRef.current,
          to: hostIdRef.current,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[viewer] ICE:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[viewer] PC:', pc.connectionState);

      if (pc.connectionState === 'connected') {
        connectedRef.current = true;
        stopJoinRetry();
        setStatus('connected');
        return;
      }

      if (pc.connectionState === 'disconnected') {
        // ICE "disconnected" is often temporary, so do not tear down the peer.
        setStatus((current) =>
          current === 'connected' ? 'connected' : 'connecting'
        );
        return;
      }

      if (pc.connectionState === 'failed') {
        connectedRef.current = false;
        stopJoinRetry();
        setStatus('failed');
        setError(
          'WebRTC connection failed. The network may require a TURN server.'
        );
        return;
      }

      if (pc.connectionState === 'closed') {
        connectedRef.current = false;
        setStatus('disconnected');
      }
    };

    return pc;
  }, [stopJoinRetry]);

  const handleOffer = useCallback(
    async (
      pc: RTCPeerConnection,
      sdp: RTCSessionDescriptionInit,
      hostId: string
    ) => {
      if (
        connectedRef.current ||
        pc.signalingState === 'closed' ||
        pc.signalingState === 'have-local-offer'
      ) {
        return;
      }

      hostIdRef.current = hostId;
      await pc.setRemoteDescription(sdp);

      for (const candidate of pendingCandidatesRef.current.splice(0)) {
        await pc.addIceCandidate(candidate);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (pc.localDescription && hostIdRef.current === hostId) {
        broadcast(channelRef.current, {
          type: 'answer',
          sdp: {
            type: pc.localDescription.type,
            sdp: pc.localDescription.sdp ?? '',
          },
          from: clientIdRef.current,
          to: hostId,
        });
      }
    },
    []
  );

  const handleSignal = useCallback(
    async (message: SignalMessage) => {
      if (stoppedRef.current || message.from === clientIdRef.current) return;

      try {
        if (message.type === 'host-ready') {
          hostIdRef.current = message.from;
          sendJoin();
          return;
        }

        // Offer/answer/ICE are private to one peer connection. Ignore
        // signaling intended for another viewer in the same room.
        if ('to' in message && message.to !== clientIdRef.current) return;

        if (message.type === 'host-stopped') {
          connectedRef.current = false;
          stopJoinRetry();
          setStream(null);
          setStatus('disconnected');
          return;
        }

        const pc = pcRef.current;
        if (!pc) return;

        if (message.type === 'offer') {
          await handleOffer(pc, message.sdp, message.from);
          return;
        }

        if (message.type === 'ice') {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(message.candidate);
          } else {
            pendingCandidatesRef.current.push(message.candidate);
          }
        }
      } catch (err) {
        console.error('[viewer] signaling error', err);
        connectedRef.current = false;
        setStatus('failed');
        setError(
          err instanceof Error ? err.message : 'WebRTC signaling failed'
        );
      }
    },
    [handleOffer, sendJoin]
  );

  const connect = useCallback(() => {
    if (channelRef.current) return;

    stoppedRef.current = false;
    connectedRef.current = false;
    hostIdRef.current = null;
    setStatus('connecting');
    setError(null);
    setStream(null);
    pendingCandidatesRef.current = [];

    const channel = supabase.channel(`room-${roomCode}`, {
      config: { broadcast: { self: false } },
    });

    channel.on(
      'broadcast',
      { event: 'signal' },
      ({ payload }: { payload: SignalMessage }) => {
        void handleSignal(payload);
      }
    );

    channelRef.current = channel;

    channel.subscribe((state: string) => {
      if (state === 'SUBSCRIBED' && !stoppedRef.current) {
        // Critical ordering:
        // 1. subscribe to signaling
        // 2. create RTCPeerConnection
        // 3. send viewer-join
        //
        // Therefore an offer can never arrive before pcRef.current exists.
        createViewerPeer();
        sendJoin();

        stopJoinRetry();
        joinTimerRef.current = setInterval(() => {
          if (connectedRef.current) {
            stopJoinRetry();
            return;
          }

          // Retry until the actual WebRTC connection is connected. Merely
          // having a peer object does not prove that the offer/answer exchange
          // succeeded.
          sendJoin();
        }, 2000);
      }

      if (
        state === 'CHANNEL_ERROR' ||
        state === 'TIMED_OUT' ||
        state === 'CLOSED'
      ) {
        stopJoinRetry();
        setStatus('failed');
        setError(`Realtime channel ${state.toLowerCase()}`);
      }
    });

  }, [
    createViewerPeer,
    handleSignal,
    roomCode,
    sendJoin,
    stopJoinRetry,
  ]);

  const disconnect = useCallback(() => {
    stoppedRef.current = true;
    connectedRef.current = false;
    stopJoinRetry();

    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    }

    pendingCandidatesRef.current = [];
    hostIdRef.current = null;
    setStream(null);

    const channel = channelRef.current;
    channelRef.current = null;

    if (channel) {
      if (hostIdRef.current) {
        broadcast(channel, {
          type: 'viewer-leave',
          from: clientIdRef.current,
          to: hostIdRef.current,
        });
      }
      void supabase.removeChannel(channel);
    }

    setStatus('idle');
  }, [stopJoinRetry]);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      connectedRef.current = false;
      stopJoinRetry();

      const pc = pcRef.current;
      pcRef.current = null;
      if (pc) pc.close();

      pendingCandidatesRef.current = [];

      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [stopJoinRetry]);

  return { stream, status, error, connect, disconnect };
}
