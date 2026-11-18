import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

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
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    speechSynthesisRef.current = window.speechSynthesis;
    
    // Load voices (they may not be available immediately)
    const loadVoices = () => {
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.getVoices();
      }
    };
    
    loadVoices();
    // Some browsers load voices asynchronously
    if (speechSynthesisRef.current.onvoiceschanged !== undefined) {
      speechSynthesisRef.current.onvoiceschanged = loadVoices;
    }
    
    return () => {
      // Cleanup: stop any ongoing speech when component unmounts
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  const speakQuestion = useCallback((text: string) => {
    if (!text || isMuted || !speechSynthesisRef.current) return;

    // Cancel any ongoing speech
    speechSynthesisRef.current.cancel();

    // Create a new speech utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice settings for a professional, clear voice
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0; // Normal pitch
    utterance.volume = 1.0; // Full volume

    // Try to find a female voice (professional)
    const voices = speechSynthesisRef.current.getVoices();
    const preferredVoices = [
      'Google UK English Female',
      'Microsoft Zira - English (United States)',
      'Microsoft Jenny - English (United States)',
      'Samantha',
      'Victoria',
      'Karen'
    ];
    
    const selectedVoice = voices.find(voice => 
      preferredVoices.some(pref => voice.name.includes(pref))
    ) || voices.find(voice => voice.lang.startsWith('en') && voice.name.includes('Female')) 
      || voices.find(voice => voice.lang.startsWith('en'));

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Event handlers
    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (onSpeakingComplete) {
        onSpeakingComplete();
      }
    };

    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error);
      setIsSpeaking(false);
    };

    synthRef.current = utterance;
    speechSynthesisRef.current.speak(utterance);
  }, [isMuted, onSpeakingComplete]);

  useEffect(() => {
    // Stop any previous speech when question changes
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
      setIsSpeaking(false);
    }

    // Auto-play the question if autoPlay is enabled and question exists
    if (autoPlay && question && !isMuted) {
      const timer = setTimeout(() => {
        speakQuestion(question);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [question, autoPlay, isMuted, speakQuestion]);

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (question) {
        speakQuestion(question);
      }
    } else {
      setIsMuted(true);
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
        setIsSpeaking(false);
      }
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
