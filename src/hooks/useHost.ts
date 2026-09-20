import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createPeerConnection, generateClientId } from '@/lib/webrtc';
import type { SignalMessage, ConnectionStatus } from '@/lib/types';

interface ViewerPeer {
  id: string;
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidateInit[];
  offer?: RTCSessionDescriptionInit;
  creatingOffer?: boolean;
  disconnectTimer?: ReturnType<typeof setTimeout>;
}

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

export function useHost(roomCode: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clientIdRef = useRef(generateClientId());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const viewersRef = useRef<Map<string, ViewerPeer>>(new Map());
  const streamRef = useRef<MediaStream | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);

  const removeViewer = useCallback((viewerId: string) => {
    const viewer = viewersRef.current.get(viewerId);
    if (!viewer) return;

    if (viewer.disconnectTimer) {
      clearTimeout(viewer.disconnectTimer);
    }

    viewer.pc.onicecandidate = null;
    viewer.pc.onconnectionstatechange = null;
    viewer.pc.close();
    viewersRef.current.delete(viewerId);
    setViewerCount(viewersRef.current.size);
  }, []);

  const createOfferForViewer = useCallback(async (viewer: ViewerPeer) => {
    const { pc } = viewer;

    if (pc.signalingState === 'closed') return;

    // A duplicate viewer-join can happen when signaling is delayed.
    // If we are already waiting for the answer, re-send the same offer.
    if (
      viewer.offer &&
      pc.localDescription &&
      pc.signalingState === 'have-local-offer'
    ) {
      broadcast(channelRef.current, {
        type: 'offer',
        sdp: viewer.offer,
        from: clientIdRef.current,
        to: viewer.id,
      });
      return;
    }

    // Prevent two retry messages from starting two negotiations concurrently.
    if (viewer.creatingOffer || pc.signalingState !== 'stable') return;

    viewer.creatingOffer = true;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (!pc.localDescription) return;

      viewer.offer = {
        type: pc.localDescription.type,
        sdp: pc.localDescription.sdp ?? '',
      };

      broadcast(channelRef.current, {
        type: 'offer',
        sdp: viewer.offer,
        from: clientIdRef.current,
        to: viewer.id,
      });
    } finally {
      viewer.creatingOffer = false;
    }
  }, []);

  const stopSharingRef = useRef<() => void>(() => {});

  const handleSignal = useCallback(async (message: SignalMessage) => {
    const fromId = message.from;
    if (fromId === clientIdRef.current || stoppedRef.current) return;
    if ('to' in message && message.to !== clientIdRef.current) return;

    try {
      if (message.type === 'viewer-join') {
        let viewer = viewersRef.current.get(fromId);

        if (!viewer) {
          const pc = createPeerConnection();
          viewer = {
            id: fromId,
            pc,
            pendingCandidates: [],
          };

          viewersRef.current.set(fromId, viewer);
          setViewerCount(viewersRef.current.size);

          if (streamRef.current) {
            for (const track of streamRef.current.getTracks()) {
              pc.addTrack(track, streamRef.current);
            }
          }

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              broadcast(channelRef.current, {
                type: 'ice',
                candidate: event.candidate.toJSON(),
                from: clientIdRef.current,
                to: fromId,
              });
            }
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
              if (peer.disconnectTimer) {
                clearTimeout(peer.disconnectTimer);
                peer.disconnectTimer = undefined;
              }
              setStatus('connected');
              return;
            }

            if (pc.connectionState === 'disconnected') {
              if (peer.disconnectTimer) {
                clearTimeout(peer.disconnectTimer);
              }

              peer.disconnectTimer = setTimeout(() => {
                if (pc.connectionState !== 'connected') {
                  removeViewer(fromId);
                }
              }, 10000);
              return;
            }

            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
              removeViewer(fromId);
            }
          };
        }

        const peer = viewer;

        // Always answer/re-answer a join. This closes the important race where
        // the viewer's join or the host's offer is lost on a realtime channel.
        if (streamRef.current) {
          await createOfferForViewer(peer);
        }
        return;
      }

      const viewer = viewersRef.current.get(fromId);
      if (!viewer) return;

      if (message.type === 'answer') {
        if (viewer.pc.signalingState === 'have-local-offer') {
          await viewer.pc.setRemoteDescription(message.sdp);

          for (const candidate of viewer.pendingCandidates.splice(0)) {
            await viewer.pc.addIceCandidate(candidate);
          }
        }
        return;
      }

      if (message.type === 'ice') {
        if (viewer.pc.remoteDescription) {
          await viewer.pc.addIceCandidate(message.candidate);
        } else {
          viewer.pendingCandidates.push(message.candidate);
        }
        return;
      }

      if (message.type === 'viewer-leave') {
        removeViewer(fromId);
      }
    } catch (err) {
      console.error('[host] signaling error', err);
      setError(err instanceof Error ? err.message : 'WebRTC signaling failed');
      removeViewer(fromId);
    }
  }, [createOfferForViewer, removeViewer]);

  const startSharing = useCallback(async () => {
    if (channelRef.current || streamRef.current) return;

    stoppedRef.current = false;
    setError(null);
    setStatus('connecting');

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });

      if (stoppedRef.current) {
        displayStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = displayStream;
      setStream(displayStream);

      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopSharingRef.current();
        };
      }

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
          setStatus('connected');

          // This is only a discovery hint. The viewer also retries its join,
          // so a missed host-ready message cannot deadlock the handshake.
          broadcast(channel, {
            type: 'host-ready',
            from: clientIdRef.current,
          });

          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
          }

          heartbeatRef.current = setInterval(() => {
            if (stoppedRef.current || !channelRef.current) return;

            // Keep discovery alive while nobody is connected. This is useful
            // when the viewer opens the room after the host has subscribed.
            if (viewersRef.current.size === 0) {
              broadcast(channel, {
                type: 'host-ready',
                from: clientIdRef.current,
              });
            } else if (heartbeatRef.current) {
              clearInterval(heartbeatRef.current);
              heartbeatRef.current = null;
            }
          }, 2000);
        }

        if (
          state === 'CHANNEL_ERROR' ||
          state === 'TIMED_OUT' ||
          state === 'CLOSED'
        ) {
          setError(`Realtime channel ${state.toLowerCase()}`);
          setStatus('failed');
        }
      });

    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to start screen sharing'
      );
      setStatus('failed');
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, [handleSignal, roomCode]);

  const stopSharing = useCallback(() => {
    stoppedRef.current = true;

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    for (const viewer of viewersRef.current.values()) {
      if (viewer.disconnectTimer) {
        clearTimeout(viewer.disconnectTimer);
      }
      viewer.pc.close();
    }
    viewersRef.current.clear();
    setViewerCount(0);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);

    const channel = channelRef.current;
    channelRef.current = null;

    if (channel) {
      broadcast(channel, {
        type: 'host-stopped',
        from: clientIdRef.current,
      });
      void supabase.removeChannel(channel);
    }

    setStatus('idle');
  }, []);

  stopSharingRef.current = stopSharing;

  useEffect(() => {
    const viewers = viewersRef.current;

    return () => {
      stoppedRef.current = true;

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }

      for (const viewer of viewers.values()) {
        if (viewer.disconnectTimer) clearTimeout(viewer.disconnectTimer);
        viewer.pc.close();
      }
      viewers.clear();

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  return { stream, status, viewerCount, error, startSharing, stopSharing };
}
