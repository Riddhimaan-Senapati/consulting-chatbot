import { useState, useEffect, useCallback } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

/**
 * Custom hook for voice dictation using react-speech-recognition.
 * Returns: {
 *   input: string,
 *   setInput: (val: string) => void,
 *   listening: boolean,
 *   toggleListening: () => void,
 *   browserSupportsSpeechRecognition: boolean,
 *   resetTranscript: () => void
 * }
 */
export function useVoiceDictation(initialValue = '') {
  const [input, setInput] = useState(initialValue);
  const [isListening, setIsListening] = useState(false);
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  // Update input field with transcript when voice input changes
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Toggle voice recognition
  const toggleListening = useCallback(() => {
    if (listening) {
      SpeechRecognition.stopListening();
      setIsListening(false);
    } else {
      SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
      setIsListening(true);
      resetTranscript();
    }
  }, [listening, resetTranscript]);

  return {
    input,
    setInput,
    listening,
    isListening,
    toggleListening,
    browserSupportsSpeechRecognition,
    resetTranscript,
  };
}
