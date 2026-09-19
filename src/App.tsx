import { useState, useCallback } from 'react';
import { HomeView } from '@/components/HomeView';
import { HostView } from '@/components/HostView';
import { ViewerView } from '@/components/ViewerView';
import { JoinView } from '@/components/JoinView';
import { generateRoomCode } from '@/lib/webrtc';
import type { AppView } from '@/lib/types';

function App() {
  const [view, setView] = useState<AppView>('home');
  const [roomCode, setRoomCode] = useState('');

  const handleStartSharing = useCallback(() => {
    setRoomCode(generateRoomCode());
    setView('host');
  }, []);

  const handleWatchScreen = useCallback(() => {
    setView('join');
  }, []);

  const handleJoin = useCallback((code: string) => {
    setRoomCode(code);
    setView('viewer');
  }, []);

  const handleBack = useCallback(() => {
    setView('home');
    setRoomCode('');
  }, []);

  if (view === 'join') {
    return <JoinView onJoin={handleJoin} onBack={handleBack} />;
  }

  if (view === 'host') {
    return <HostView roomCode={roomCode} onBack={handleBack} />;
  }

  if (view === 'viewer') {
    return <ViewerView roomCode={roomCode} onBack={handleBack} />;
  }

  return (
    <HomeView
      onStartSharing={handleStartSharing}
      onWatchScreen={handleWatchScreen}
    />
  );
}

export default App;
