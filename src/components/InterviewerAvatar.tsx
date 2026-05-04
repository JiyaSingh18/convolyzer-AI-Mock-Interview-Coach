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
        <div className={`relative transition-all duration-300 ${speaking ? 'scale-105' : 'scale-100'}`}>
          <svg
            width="200"
            height="250"
            viewBox="0 0 200 250"
            className="drop-shadow-lg"
          >
            {/* Background gradient circle */}
            <defs>
              <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f3f4f6" />
                <stop offset="100%" stopColor="#e5e7eb" />
              </linearGradient>
              <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fcd34d" />
                <stop offset="50%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
              <linearGradient id="suitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="hairGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
            </defs>
            
            {/* Background circle with shadow */}
            <circle cx="120" cy="120" r="95" fill="url(#bgGradient)" stroke="#d1d5db" strokeWidth="2" />
            <circle cx="120" cy="120" r="95" fill="none" stroke="#9ca3af" strokeWidth="1" opacity="0.3" />
            
            {/* Professional Suit - More detailed */}
            {/* Jacket */}
            <path d="M 50 150 Q 50 140, 60 135 L 180 135 Q 190 140, 190 150 L 190 240 Q 190 250, 180 250 L 60 250 Q 50 250, 50 240 Z" 
                  fill="url(#suitGradient)" />
            
            {/* Jacket lapels */}
            <path d="M 70 150 L 100 140 L 120 150 L 140 140 L 170 150" stroke="#374151" strokeWidth="2" fill="none" />
            
            {/* Inner jacket */}
            <rect x="70" y="150" width="100" height="90" fill="#0f172a" rx="2" />
            
            {/* Professional Tie */}
            <polygon points="105,150 120,220 135,150" fill="#dc2626" />
            <rect x="118" y="150" width="4" height="70" fill="#991b1b" />
            <polygon points="110,150 120,165 130,150" fill="#b91c1c" />
            
            {/* White Shirt Collar */}
            <path d="M 80 150 L 100 145 L 120 150 L 140 145 L 160 150" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <rect x="80" y="150" width="80" height="25" fill="#ffffff" />
            <path d="M 100 145 L 100 175" stroke="#e5e7eb" strokeWidth="1" />
            <path d="M 140 145 L 140 175" stroke="#e5e7eb" strokeWidth="1" />
            
            {/* Realistic Head Shape */}
            <ellipse cx="120" cy="95" rx="42" ry="48" fill="url(#skinGradient)" />
            
            {/* Neck */}
            <rect x="105" y="140" width="30" height="15" fill="url(#skinGradient)" rx="3" />
            
            {/* Professional Hair - More realistic */}
            <path d="M 78 55 Q 75 45, 85 50 Q 95 48, 105 50 Q 115 48, 125 50 Q 135 48, 145 50 Q 155 48, 165 50 Q 175 45, 162 55 Q 160 65, 155 70 Q 150 75, 145 78 Q 140 80, 135 82 Q 130 84, 125 85 Q 120 86, 115 85 Q 110 84, 105 82 Q 100 80, 95 78 Q 90 75, 85 70 Q 80 65, 78 55" 
                  fill="url(#hairGradient)" />
            <path d="M 78 55 Q 80 50, 85 52 Q 90 50, 95 52 Q 100 50, 105 52 Q 110 50, 115 52 Q 120 50, 125 52 Q 130 50, 135 52 Q 140 50, 145 52 Q 150 50, 155 52 Q 160 50, 162 55" 
                  fill="#92400e" opacity="0.7" />
            
            {/* Realistic Eyes */}
            <ellipse cx="105" cy="88" rx="6" ry="8" fill="#ffffff" />
            <ellipse cx="135" cy="88" rx="6" ry="8" fill="#ffffff" />
            <circle cx="105" cy="88" r="4" fill="#1e293b" />
            <circle cx="135" cy="88" r="4" fill="#1e293b" />
            <circle cx="106" cy="87" r="1.5" fill="#ffffff" />
            <circle cx="136" cy="87" r="1.5" fill="#ffffff" />
            
            {/* Eye animation when speaking */}
            {speaking && (
              <>
                <ellipse cx="105" cy="88" rx="4" ry="3" fill="#1e293b" />
                <ellipse cx="135" cy="88" rx="4" ry="3" fill="#1e293b" />
              </>
            )}
            
            {/* Eyebrows */}
            <path d="M 95 80 Q 100 78, 105 79 Q 110 78, 115 80" stroke="#78350f" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 125 80 Q 130 78, 135 79 Q 140 78, 145 80" stroke="#78350f" strokeWidth="2" fill="none" strokeLinecap="round" />
            
            {/* Realistic Nose */}
            <path d="M 120 95 Q 115 100, 118 105 Q 120 103, 122 105 Q 125 100, 120 95" 
                  fill="#f59e0b" opacity="0.6" />
            <path d="M 115 100 Q 120 102, 125 100" stroke="#d97706" strokeWidth="1.5" fill="none" />
            
            {/* Mouth - animated when speaking */}
            {speaking ? (
              <>
                <ellipse cx="120" cy="110" rx="10" ry="6" fill="#1e293b" />
                <ellipse cx="120" cy="110" rx="8" ry="4" fill="#dc2626" />
              </>
            ) : (
              <path d="M 110 110 Q 120 113, 130 110" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            )}
            
            {/* Professional Glasses */}
            <rect x="90" y="82" width="28" height="14" fill="none" stroke="#1e293b" strokeWidth="2.5" rx="3" />
            <rect x="122" y="82" width="28" height="14" fill="none" stroke="#1e293b" strokeWidth="2.5" rx="3" />
            <line x1="118" y1="89" x2="122" y2="89" stroke="#1e293b" strokeWidth="2.5" />
            <line x1="88" y1="85" x2="85" y2="83" stroke="#1e293b" strokeWidth="2" />
            <line x1="152" y1="85" x2="155" y2="83" stroke="#1e293b" strokeWidth="2" />
            
                {/* Shoulders with more detail */}
                <ellipse cx="120" cy="240" rx="60" ry="18" fill="url(#suitGradient)" />
                <ellipse cx="120" cy="240" rx="55" ry="15" fill="#0f172a" />
          </svg>
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

