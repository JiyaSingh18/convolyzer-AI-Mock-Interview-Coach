import React, { useState, useRef } from 'react';
import axios from 'axios';
import { FileText, Upload, AlertTriangle, CheckCircle, Loader2, Download, Sparkles, TrendingUp, Award, Briefcase, GraduationCap, User } from 'lucide-react';

interface ResumeAnalysis {
  overall_score: number;
  summary: string;
  strengths: string[];
  areas_for_improvement: string[];
  sections: {
    contact_info?: { score: number; feedback: string };
    summary?: { score: number; feedback: string };
    experience?: { score: number; feedback: string };
    education?: { score: number; feedback: string };
    skills?: { score: number; feedback: string };
  };
  recommendations: string[];
  ats_compatibility: {
    score: number;
    issues: string[];
    suggestions: string[];
  };
  keyword_analysis: {
    found: string[];
    missing: string[];
    suggestions: string[];
  };
}

const ResumeAnalyzer: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Check file type
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (!validTypes.includes(selectedFile.type)) {
        setError('Please upload a PDF, DOC, DOCX, or TXT file.');
        return;
      }

      // Check file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB.');
        return;
      }

      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError(null);
      setAnalysis(null);

      // Read text from file if it's a text file
      if (selectedFile.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
          setResumeText(e.target?.result as string);
        };
        reader.readAsText(selectedFile);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!file && !resumeText.trim()) {
      setError('Please upload a resume file or paste resume text.');
      return;
    }

    // Validate text length
    if (resumeText.trim() && resumeText.trim().length < 50) {
      setError('Resume text is too short. Please provide at least 50 characters.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      // If file is uploaded, we'll send it to the backend
      if (file) {
        const formData = new FormData();
        formData.append('resume', file);

        const response = await axios.post('/api/analyze-resume', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 60 second timeout for analysis
        });

        if (response.data) {
          setAnalysis(response.data);
        } else {
          throw new Error('No analysis data received from server');
        }
      } else if (resumeText.trim()) {
        // Analyze text directly
        const response = await axios.post('/api/analyze-resume-text', {
          text: resumeText.trim(),
        }, {
          timeout: 60000, // 60 second timeout for analysis
        });

        if (response.data) {
          setAnalysis(response.data);
        } else {
          throw new Error('No analysis data received from server');
        }
      }
    } catch (err: any) {
      console.error('Error analyzing resume:', err);
      
      let errorMessage = 'Failed to analyze resume. Please try again.';
      
      if (err.response) {
        // Server responded with error
        errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
      } else if (err.request) {
        // Request was made but no response received
        errorMessage = 'No response from server. Please check your connection and try again.';
      } else if (err.message) {
        // Error in request setup
        errorMessage = err.message;
      }
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. The resume might be too long. Please try with a shorter resume or wait a moment and try again.';
      }
      
      setError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePasteText = () => {
    navigator.clipboard.readText().then((text) => {
      setResumeText(text);
      setError(null);
    }).catch(() => {
      setError('Failed to read from clipboard. Please paste manually.');
    });
  };

  const renderScoreBar = (score: number, label: string) => {
    const percentage = Math.round(score * 100);
    const colorClass = 
      percentage >= 80 ? 'bg-green-500' :
      percentage >= 60 ? 'bg-yellow-500' :
      'bg-red-500';

    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`${colorClass} h-3 rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent mb-12 text-center hover:scale-105 transition-transform cursor-default">
          <FileText className="inline mr-3" />
          Resume Analyzer
        </h1>

        {error && (
          <div className="retro-card mb-8 p-6 bg-red-50 dark:bg-red-900/20 hover:scale-[1.02] transition-all">
            <div className="flex items-center text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="retro-card p-8 bg-white dark:bg-gray-800 hover:scale-[1.01] transition-all">
            <h2 className="text-2xl font-bold mb-6 flex items-center hover:scale-105 transition-transform cursor-default">
              <Upload className="mr-2" />
              Upload Resume
            </h2>

            <div className="space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                  Upload File (PDF, DOC, DOCX, TXT)
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="retro-button mb-2"
                  >
                    Choose File
                  </button>
                  {fileName && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      Selected: {fileName}
                    </p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">OR</span>
                </div>
              </div>

              {/* Text Input */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                  Paste Resume Text
                </label>
                <textarea
                  value={resumeText}
                  onChange={(e) => {
                    setResumeText(e.target.value);
                    setError(null);
                  }}
                  placeholder="Paste your resume text here..."
                  className="retro-input w-full h-64 text-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-white hover:border-blue-500/50 focus:border-blue-500 transition-colors resize-none"
                />
                <button
                  onClick={handlePasteText}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Paste from Clipboard
                </button>
              </div>

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || (!file && !resumeText.trim())}
                className="retro-button w-full py-3 text-lg hover:scale-105 transition-transform disabled:hover:scale-100 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing Resume...
                  </div>
                ) : (
                  <>
                    <Sparkles className="inline mr-2" />
                    Analyze Resume
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Analysis Results */}
          <div className="space-y-6">
            {analysis ? (
              <>
                {/* Overall Score */}
                <div className="retro-card p-8 bg-white dark:bg-gray-800 hover:scale-[1.02] transition-all">
                  <h2 className="text-2xl font-bold mb-6 flex items-center hover:scale-105 transition-transform cursor-default">
                    <TrendingUp className="mr-2" />
                    Overall Score
                  </h2>
                  <div className="text-center">
                    <div className="text-6xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                      {Math.round(analysis.overall_score * 100)}%
                    </div>
                    <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                      {analysis.summary}
                    </p>
                  </div>
                </div>

                {/* Section Scores */}
                <div className="retro-card p-8 bg-white dark:bg-gray-800 hover:scale-[1.02] transition-all">
                  <h3 className="text-xl font-bold mb-6 hover:scale-105 transition-transform cursor-default">
                    Section Scores
                  </h3>
                  {analysis.sections.contact_info && renderScoreBar(analysis.sections.contact_info.score, 'Contact Information')}
                  {analysis.sections.summary && renderScoreBar(analysis.sections.summary.score, 'Professional Summary')}
                  {analysis.sections.experience && renderScoreBar(analysis.sections.experience.score, 'Experience')}
                  {analysis.sections.education && renderScoreBar(analysis.sections.education.score, 'Education')}
                  {analysis.sections.skills && renderScoreBar(analysis.sections.skills.score, 'Skills')}
                </div>

                {/* Strengths */}
                {analysis.strengths.length > 0 && (
                  <div className="retro-card p-8 bg-white dark:bg-gray-800 hover:scale-[1.02] transition-all">
                    <h3 className="text-xl font-bold mb-4 flex items-center text-green-600 dark:text-green-400 hover:scale-105 transition-transform cursor-default">
                      <CheckCircle className="mr-2" />
                      Strengths
                    </h3>
                    <ul className="list-disc pl-5 space-y-2">
                      {analysis.strengths.map((strength, i) => (
                        <li key={i} className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Areas for Improvement */}
                {analysis.areas_for_improvement.length > 0 && (
                  <div className="retro-card p-8 bg-white dark:bg-gray-800 hover:scale-[1.02] transition-all">
                    <h3 className="text-xl font-bold mb-4 flex items-center text-amber-600 dark:text-amber-400 hover:scale-105 transition-transform cursor-default">
                      <AlertTriangle className="mr-2" />
                      Areas for Improvement
                    </h3>
                    <ul className="list-disc pl-5 space-y-2">
                      {analysis.areas_for_improvement.map((area, i) => (
                        <li key={i} className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ATS Compatibility */}
                {analysis.ats_compatibility && (
                  <div className="retro-card p-8 bg-white dark:bg-gray-800 hover:scale-[1.02] transition-all">
                    <h3 className="text-xl font-bold mb-4 hover:scale-105 transition-transform cursor-default">
                      ATS Compatibility
                    </h3>
                    {renderScoreBar(analysis.ats_compatibility.score, 'ATS Score')}
                    {analysis.ats_compatibility.issues.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-bold mb-2 text-red-600 dark:text-red-400">Issues:</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysis.ats_compatibility.issues.map((issue, i) => (
                            <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.ats_compatibility.suggestions.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-bold mb-2 text-blue-600 dark:text-blue-400">Suggestions:</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {analysis.ats_compatibility.suggestions.map((suggestion, i) => (
                            <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations.length > 0 && (
                  <div className="retro-card p-8 bg-white dark:bg-gray-800 hover:scale-[1.02] transition-all">
                    <h3 className="text-xl font-bold mb-4 flex items-center text-purple-600 dark:text-purple-400 hover:scale-105 transition-transform cursor-default">
                      <Award className="mr-2" />
                      Recommendations
                    </h3>
                    <ul className="list-disc pl-5 space-y-2">
                      {analysis.recommendations.map((rec, i) => (
                        <li key={i} className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="retro-card p-8 bg-white dark:bg-gray-800 hover:scale-[1.01] transition-all text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Upload or paste your resume to get started with analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeAnalyzer;

