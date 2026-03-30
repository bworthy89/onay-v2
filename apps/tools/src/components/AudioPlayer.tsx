import { useRef, useState, useEffect, useCallback } from 'react';

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface AudioPlayerProps {
  src: string | null;
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => {
        setPlaying(true);
      }).catch((err) => {
        console.error('Playback failed:', err);
        setPlaying(false);
      });
    }
  }, [playing]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress(audio.currentTime / audio.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
  };

  if (!src) {
    return <div className="text-xs text-onay-muted italic">No audio</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={handleEnded}
        preload="metadata"
      />
      <button
        onClick={toggle}
        className="w-8 h-8 flex items-center justify-center rounded bg-onay-card border border-onay-border hover:border-onay-gold text-sm shrink-0"
      >
        {playing ? '||' : '\u25B6'}
      </button>
      <div
        className="flex-1 h-2 bg-onay-border rounded cursor-pointer"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-onay-gold rounded"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="text-xs text-onay-muted w-10 text-right shrink-0">
        {duration > 0 ? formatTime(progress * duration) : '0:00'}
      </span>
    </div>
  );
}
