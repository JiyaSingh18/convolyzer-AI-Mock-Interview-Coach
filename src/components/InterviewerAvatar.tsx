import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { loadVoices, pickBestVoice, speakNaturally } from '@/lib/interviewerVoice';

interface InterviewerAvatarProps {
  question: string;
  isSpeaking?: boolean;
  onSpeakingComplete?: () => void;
  autoPlay?: boolean;
}

const InterviewerAvatar: React.FC<InterviewerAvatarProps> = ({
  question,
  isSpeaking: externalIsSpeaking,
  onSpeakingComplete,
  autoPlay = true
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const voicesReadyRef = useRef<Promise<void> | null>(null);
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const onCompleteRef = useRef(onSpeakingComplete);
  onCompleteRef.current = onSpeakingComplete;

  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!hasSpeech) return;
    const synth = window.speechSynthesis;

    // Pick the most natural female voice once the browser has loaded its voice list,
    // and re-pick if the list changes (Chrome loads its Google voices asynchronously).
    const choose = () => {
      const best = pickBestVoice(synth.getVoices());
      if (best && best !== voiceRef.current) {
        voiceRef.current = best;
        console.info(`Interviewer voice: ${best.name} (${best.lang}${best.localService ? '' : ', online'})`);
      }
    };
    voicesReadyRef.current = loadVoices().then(choose);
    synth.addEventListener?.('voiceschanged', choose);

    return () => {
      synth.removeEventListener?.('voiceschanged', choose);
      cancelSpeechRef.current?.();
    };
  }, [hasSpeech]);

  const stopSpeaking = useCallback(() => {
    cancelSpeechRef.current?.();
    cancelSpeechRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speakQuestion = useCallback(async (text: string) => {
    if (!text || isMuted || !hasSpeech) return;
    stopSpeaking();
    let superseded = false;
    // Make sure the chosen voice is loaded before the first sentence is spoken.
    const myCancel = () => { superseded = true; };
    cancelSpeechRef.current = myCancel;
    await voicesReadyRef.current;
    if (superseded || cancelSpeechRef.current !== myCancel) return;

    cancelSpeechRef.current = speakNaturally(text, voiceRef.current, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        onCompleteRef.current?.();
      },
      onError: (error) => {
        console.error('Speech synthesis error:', error);
        setIsSpeaking(false);
      }
    });
  }, [isMuted, hasSpeech, stopSpeaking]);

  useEffect(() => {
    // Stop any previous speech when question changes
    stopSpeaking();

    // Auto-play the question if autoPlay is enabled and question exists
    if (autoPlay && question && !isMuted) {
      const timer = setTimeout(() => {
        speakQuestion(question);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [question, autoPlay, isMuted, speakQuestion, stopSpeaking]);

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (question) {
        speakQuestion(question);
      }
    } else {
      setIsMuted(true);
      stopSpeaking();
    }
  };

  const handleReplay = useCallback(() => {
    if (question) {
      speakQuestion(question);
    }
  }, [question, speakQuestion]);

  const speaking = externalIsSpeaking !== undefined ? externalIsSpeaking : isSpeaking;

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Avatar Container */}
      <div className="relative">
        <div className={`relative transition-all duration-300 ${speaking ? 'scale-105 mb-8' : 'scale-100'}`}>
          <div className="relative w-[200px] h-[200px]">
            {speaking && (
              <span
                className="absolute -inset-1 rounded-full bg-blue-400/40 animate-ping"
                aria-hidden="true"
              />
            )}
            <img
              src="/interviewer.jpg"
              alt="Professional interviewer"
              width={200}
              height={200}
              className={`relative w-[200px] h-[200px] rounded-full object-cover object-center drop-shadow-lg ring-2 transition-all duration-300 ${
                speaking
                  ? 'ring-4 ring-blue-400 shadow-[0_0_24px_rgba(96,165,250,0.55)]'
                  : 'ring-gray-200 dark:ring-gray-600'
              }`}
            />
          </div>
          {speaking && (
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
              <div className="flex space-x-2 items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                <span className="ml-2 text-sm text-blue-600 font-medium">Speaking...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handleToggleMute}
          className={`p-3 rounded-full transition-all hover:scale-110 ${
            isMuted 
              ? 'bg-gray-300 hover:bg-gray-400' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        
        {!speaking && (
          <button
            onClick={handleReplay}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all hover:scale-105 text-sm font-medium"
          >
            Replay Question
          </button>
        )}
      </div>

      {/* Question text display */}
      <div className="max-w-md text-center">
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
          {question}
        </p>
      </div>
    </div>
  );
};

export default InterviewerAvatar;
