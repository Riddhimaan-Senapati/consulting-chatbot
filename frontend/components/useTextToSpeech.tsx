import { useRef, useState } from 'react';

export interface UseTextToSpeechOptions {
  // Optionally pass a callback to run when speech ends
  onEnd?: () => void;
  onStart?: () => void;
}

export function useTextToSpeech(options?: UseTextToSpeechOptions) {
  const [speakingId, setSpeakingId] = useState<string | number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = (id: string | number, text: string) => {
    // If already speaking this id, stop
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    // Stop any current speech
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      setSpeakingId(null);
      options?.onEnd?.();
    };
    utterance.onerror = () => {
      setSpeakingId(null);
    };
    utterance.onstart = () => {
      options?.onStart?.();
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeakingId(id);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  };

  return {
    speakingId,
    speak,
    stop,
  };
}
