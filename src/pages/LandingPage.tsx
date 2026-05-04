import React from 'react';
import { Link } from 'react-router-dom';
import { Mic, UserSquare2, FileQuestion } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen text-center py-12">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="mb-8">
          <h1 className="text-8xl font-bold relative">
            <span className="relative z-10 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
              CONVO
            </span>
            <span className="relative z-10 text-retro-yellow drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] border-b-4 border-retro-yellow">
              LYZER
            </span>
          </h1>
        </div>
        
        <p className="text-2xl text-white mb-12 max-w-2xl mx-auto text-center font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
          Your ultimate interview preparation companion powered by advanced AI
        </p>

        {/* Main features */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-12">
          <FeatureCard
            to="/analyser"
            icon={<div className="animate-pulse"><Mic size={48} className="animate-bounce" /></div>}
            title="Interview Response Analyzer"
            description="Analyze mock interview responses with AI-powered feedback"
          />
          <FeatureCard
            to="/practice"
            icon={<div className="animate-pulse"><UserSquare2 size={48} className="animate-bounce delay-150" /></div>}
            title="Interview Practice"
            description="Practice your interviewing skills with AI feedback"
          />
          <FeatureCard
            to="/generator"
            icon={<div className="animate-pulse"><FileQuestion size={48} className="animate-bounce delay-300" /></div>}
            title="Question Generator"
            description="Generate smart interview questions instantly"
          />
        </div>

      </div>
    </div>
  );
};

const FeatureCard = ({ to, icon, title, description }: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <Link
    to={to}
    className="retro-card bg-white dark:bg-gray-800 p-8 transform hover:scale-[1.02] transition-all duration-300"
  >
    <div className="text-pink-500 dark:text-pink-400 mb-6 group-hover:scale-110 transition-transform duration-300">
      {icon}
    </div>
    <h3 className="text-2xl font-bold mb-3 text-gray-800 dark:text-gray-200">{title}</h3>
    <p className="text-gray-600 dark:text-gray-300">{description}</p>
  </Link>
);

export default LandingPage;