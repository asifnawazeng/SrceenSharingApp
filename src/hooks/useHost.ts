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
            to: fromId,
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
        to: fromId,
      });
      return;
    }

    if (!viewer) return;
    if (
      (message.type === 'answer' || message.type === 'ice') &&
      message.to !== clientIdRef.current
    ) {
      return;
    }

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
      if (!window.isSecureContext) {
        throw new Error(
          'Screen sharing requires HTTPS. Open the deployed app using its https:// URL.'
        );
      }

      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error(
          'This mobile browser does not support screen sharing. Try the latest Chrome on Android or Safari on iOS 17.2 or later.'
        );
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        // Mobile browsers generally reject system-audio capture. Audio can be
        // added later only when the browser explicitly supports it.
        audio: false,
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
          broadcast(channel, {
            type: 'host-ready',
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
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError(
            'Screen sharing was cancelled or blocked. Allow screen capture when prompted and try again.'
          );
        } else if (err.name === 'NotSupportedError') {
          setError(
            'This browser cannot share a mobile screen. Try the latest Chrome on Android or Safari on iOS 17.2 or later.'
          );
        } else if (err.name === 'InvalidStateError') {
          setError(
            'Screen sharing must start from the button. Return to this page and tap Start Sharing again.'
          );
        } else {
          setError(`Unable to capture this screen (${err.name}).`);
        }
      } else {
        setError(
          err instanceof Error ? err.message : 'Failed to start screen sharing'
        );
      }
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
