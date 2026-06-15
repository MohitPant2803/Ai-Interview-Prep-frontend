import { useState, useEffect, useRef } from 'react';
import { validateApiKey, generateQuestionsList, generateFeedbackReport, generateAdaptiveStepFeedback } from './utils/gemini';

// ==========================================
// CONFIGURATION
// ==========================================
// Google OAuth Client ID loaded from frontend .env file
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "715867474378-ltnnukmq4cjmaffjdei7i98b42poqot5.apps.googleusercontent.com";
// ==========================================

const STEPS = {
  LOGIN: 'LOGIN',
  DASHBOARD: 'DASHBOARD',
  INTERVIEW: 'INTERVIEW',
  REPORT: 'REPORT',
  ADAPTIVE_INTERVIEW: 'ADAPTIVE_INTERVIEW',
};

const PROFILES = [
  { id: 'swe', name: 'Software Engineering', desc: 'DSA, systems, databases, and coding fundamentals.' },
  { id: 'data', name: 'Data Science & Analytics', desc: 'Machine learning, stats, SQL, and analytics.' },
  { id: 'pm', name: 'Product Management', desc: 'Product design, metrics, estimations, and strategy.' },
  { id: 'consulting', name: 'Management Consulting', desc: 'Market entry, pricing cases, and guesstimates.' },
  { id: 'finance', name: 'Quantitative Finance', desc: 'Corporate finance, valuations, and quant math.' },
  { id: 'custom', name: 'Custom Profile', desc: 'Interviewer tailors questions to your custom role.' }
];

const BEHAVIORAL_MODULES = [
  {
    id: 'self_intro',
    title: 'Self Introduction',
    desc: 'Practice summarizing your background, achievements, and goals in a professional elevator pitch.',
    questions: [
      'Tell me about yourself.',
      'Walk me through your resume.',
      'Introduce yourself in 2 minutes.',
      'Tell me something not on your resume.'
    ],
    followups: [
      'You mentioned X. Can you elaborate?',
      'Why did you choose this field?',
      'What has been your biggest learning at IIT KGP?'
    ]
  },
  {
    id: 'family',
    title: 'Family Background',
    desc: 'Handle personal background and influences questions with structured and poised answers.',
    questions: [
      'Tell me about your family.',
      'What do your parents do?',
      'How has your family influenced your career choices?'
    ],
    followups: [
      'Did your upbringing shape your work ethic?',
      'What values did you learn from your family?'
    ]
  },
  {
    id: 'strengths_weaknesses',
    title: 'Strengths & Weaknesses',
    desc: 'Calibrate your weaknesses to be developmental, and articulate your strengths with examples.',
    questions: [
      'What are your strengths?',
      'What is your biggest weakness?',
      'How are you working on improving it?'
    ],
    followups: [
      'Can you give an example?',
      'How has this affected your work?'
    ]
  },
  {
    id: 'leadership',
    title: 'Leadership & Conflict',
    desc: 'Demonstrate leadership, project management, and team resolution skills under pressure.',
    questions: [
      'Describe a situation where you led a team.',
      'Have you handled conflicts in a team?',
      'Tell me about a difficult teammate.'
    ],
    followups: [
      'What would you do differently now?',
      'How did you measure success?'
    ]
  },
  {
    id: 'failure',
    title: 'Failure & Challenges',
    desc: 'Talk about mistakes, setbacks, and recoveries using constructive, growth mindsets.',
    questions: [
      'Tell me about a failure.',
      'Describe a time you missed a deadline.',
      'Tell me about a setback.'
    ],
    followups: [
      'What did you learn?',
      'How did you recover?'
    ]
  },
  {
    id: 'projects',
    title: 'Projects (CV-Aware)',
    desc: 'Explain system design, architectural choices, technical tradeoffs, and individual contributions.',
    questions: [
      'Explain this project.'
    ],
    followups: [
      'Why did you choose this approach?',
      'What challenges did you face?',
      'What would you improve?',
      'What was your exact contribution?'
    ]
  },
  {
    id: 'internship',
    title: 'Internship Experience',
    desc: 'Articulate the impact, technology stack, and outcomes of your internship experiences.',
    questions: [
      'Tell me about your internship.',
      'What was your biggest impact?',
      'Describe a challenging task.'
    ],
    followups: [
      'What metrics improved?',
      'What technologies did you use?',
      'What would you do differently?'
    ]
  },
  {
    id: 'clubs_pors',
    title: 'Clubs, PORs & Activities',
    desc: 'Showcase teamwork, event coordination, and organizational responsibilities at IIT Kharagpur.',
    questions: [
      'Tell me about your role in your club or POR.',
      'What was your biggest achievement?',
      'Describe an event you organized.'
    ],
    followups: [
      'How did you manage conflicts?',
      'What leadership skills did you develop?'
    ]
  },
  {
    id: 'motivation',
    title: 'Career Motivation',
    desc: 'Explain your career choices, technical domain selection, and professional long-term vision.',
    questions: [
      'Why this role?',
      'Why software engineering?',
      'Where do you see yourself in 5 years?'
    ],
    followups: [
      'Why not another domain?',
      'What excites you about this industry?'
    ]
  },
  {
    id: 'company',
    title: 'Company-Specific Motivation',
    desc: 'Align your preparation, values, and knowledge with the company target and profile.',
    questions: [
      'Why our company?',
      'Why should we hire you?',
      'What do you know about us?'
    ],
    followups: [
      'Which product interests you?',
      'How do your skills align?'
    ]
  }
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

// Helper function for sending authenticated backend requests
async function apiRequest(url, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const config = {
    method,
    headers,
  };
  if (body) {
    config.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE_URL}${url}`, config);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}

// Isolated waveform component to prevent App.jsx root re-renders on every animation tick
function AudioWaveform({ isSpeaking }) {
  const [bars, setBars] = useState([8, 12, 6, 10, 4, 14, 8, 5]);

  useEffect(() => {
    let interval;
    if (isSpeaking) {
      interval = setInterval(() => {
        setBars(prev => prev.map(() => Math.floor(Math.random() * 20) + 4));
      }, 100);
    } else {
      setBars([6, 6, 6, 6, 6, 6, 6, 6]);
    }
    return () => clearInterval(interval);
  }, [isSpeaking]);

  return (
    <div className="waveform-box" style={{ opacity: isSpeaking ? 1 : 0, transition: 'opacity 0.2s ease', visibility: isSpeaking ? 'visible' : 'hidden' }}>
      {bars.map((val, idx) => (
        <span
          key={idx}
          className="waveform-bar"
          style={{ height: `${val}px` }}
        />
      ))}
    </div>
  );
}

// Isolated configuration modal component to prevent root re-renders on every keystroke in CV text area
function ConfigureInterviewModal({
  isOpen,
  onClose,
  initialProfile,
  initialLength,
  initialCvText,
  profiles,
  onStart,
  isAdaptive = false
}) {
  const [selectedProfile, setSelectedProfile] = useState(initialProfile);
  const [interviewLength, setInterviewLength] = useState(initialLength);
  const [tempCvText, setTempCvText] = useState(initialCvText);

  // Sync state if initial variables change
  useEffect(() => {
    if (isOpen) {
      setSelectedProfile(initialProfile);
      setInterviewLength(initialLength);
      setTempCvText(initialCvText);
    }
  }, [isOpen, initialProfile, initialLength, initialCvText]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3 className="modal-title">{isAdaptive ? 'Configure Adaptive Prep' : 'Configure Mock Interview'}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        
        <div className="modal-body">
          {/* Target Profile Selector */}
          <div className="form-group">
            <label>Select Target Interview Profile</label>
            <div className="profile-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`profile-card ${selectedProfile.id === p.id ? 'active' : ''}`}
                  onClick={() => setSelectedProfile(p)}
                  style={{ padding: '1rem', borderRadius: '8px' }}
                >
                  <h3 style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>{p.name}</h3>
                  <p style={{ fontSize: '0.75rem', lineHeight: '1.4' }}>{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Interview Length Selector */}
          {!isAdaptive && (
            <div className="form-group">
              <label>Select Interview Length</label>
              <div className="profile-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
                {[
                  { id: 'small', label: 'Small (~20mins)' },
                  { id: 'medium', label: 'Medium (~40mins)' },
                  { id: 'long', label: 'Long (~60mins)' }
                ].map((len) => (
                  <button
                    key={len.id}
                    type="button"
                    className={`profile-card ${interviewLength === len.id ? 'active' : ''}`}
                    onClick={() => setInterviewLength(len.id)}
                    style={{ padding: '1rem', borderRadius: '8px', textAlign: 'center' }}
                  >
                    <h3 style={{ fontSize: '0.9rem', margin: 0 }}>{len.label}</h3>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resume Text Config */}
          <div className="form-group" style={{ margin: '0' }}>
            <label htmlFor="temp-cv-input">Resume Details / CV Profile Text</label>
            <textarea
              id="temp-cv-input"
              className="form-input form-textarea"
              style={{ minHeight: '160px', fontSize: '0.88rem' }}
              placeholder="Paste your CV text. Copy-paste directly or convert your CV to a text description using Gemini or GPT first..."
              value={tempCvText}
              onChange={(e) => setTempCvText(e.target.value)}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.45rem', lineHeight: '1.4' }}>
              To customize the simulation questions to your experiences, please provide your CV text. 
              You can choose to use this text for this interview round only, or save it as your default CV in your profile.
            </p>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => onStart(selectedProfile, interviewLength, tempCvText, false)}
          >
            Use For This Round Only
          </button>
          <button 
            className="btn" 
            onClick={() => onStart(selectedProfile, interviewLength, tempCvText, true)}
          >
            Save to Profile & Start
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Authentication & Session State
  const [token, setToken] = useState(localStorage.getItem('auth_token') || '');
  const [user, setUser] = useState(null);
  const [reportsHistory, setReportsHistory] = useState([]);
  const [cumulativeReport, setCumulativeReport] = useState(null);
  
  // Navigation & Identity
  const [step, setStep] = useState(localStorage.getItem('auth_token') ? STEPS.LOGIN : STEPS.DASHBOARD);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(PROFILES[0]);
  const [customDetails, setCustomDetails] = useState('');
  const [questionsList, setQuestionsList] = useState([]);
  const [interviewLength, setInterviewLength] = useState('small'); // 'small' | 'medium' | 'long'
  
  // Dashboard UI state
  const [dashboardTab, setDashboardTab] = useState('cumulative'); // 'cumulative' | 'history' | 'profile' | 'adaptive'
  const [activeHistoryReport, setActiveHistoryReport] = useState(null);
  const [showCvModal, setShowCvModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [tempCvText, setTempCvText] = useState('');
  
  // Adaptive Prep States
  const [selectedAdaptiveModule, setSelectedAdaptiveModule] = useState(null);
  const [adaptiveStepFeedback, setAdaptiveStepFeedback] = useState(null);
  const [isAdaptiveStepLoading, setIsAdaptiveStepLoading] = useState(false);
  const [adaptiveQuestionCount, setAdaptiveQuestionCount] = useState(0);
  const [showAdaptiveModal, setShowAdaptiveModal] = useState(false);
  const [selectedAdaptiveModuleForConfig, setSelectedAdaptiveModuleForConfig] = useState(null);
  
  // Interview Run States
  const [isApiValidating, setIsApiValidating] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [candidateResponseText, setCandidateResponseText] = useState('');
  const [followupsAskedCount, setFollowupsAskedCount] = useState(0);
  const [isLastQuestionFollowup, setIsLastQuestionFollowup] = useState(false);
  
  // Webcam & Audio Visualizer
  const [webcamActive, setWebcamActive] = useState(false);
  
  // Evaluation Report
  const [report, setReport] = useState(null);
  
  // Refs for Speech API & Hardware
  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const chatHistoryRef = useRef([]);
  const isAISpeakingRef = useRef(false);
  const isInterviewActiveRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');

  // Sync ref for immediate access in callbacks
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  useEffect(() => {
    isAISpeakingRef.current = isAISpeaking;
  }, [isAISpeaking]);

  // Bind video element to camera stream when element mounts
  useEffect(() => {
    if (webcamActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [webcamActive]);

  // Sync session on mount / token change
  useEffect(() => {
    if (token) {
      loadUserProfile();
    } else {
      setStep(STEPS.DASHBOARD);
    }
  }, [token]);

  const loadUserProfile = async () => {
    try {
      // Get profile details
      const profileData = await apiRequest('/api/profile', 'GET', null, token);
      setUser(profileData);
      setName(profileData.name || '');
      setApiKey(profileData.geminiApiKey || '');
      setCustomDetails(profileData.resumeText || '');
      setCumulativeReport(profileData.cumulativeReport || null);

      // Get reports history
      const historyData = await apiRequest('/api/reports', 'GET', null, token);
      setReportsHistory(historyData.reports || []);
      
      setStep(STEPS.DASHBOARD);
    } catch (err) {
      console.error('Failed to load profile, logging out:', err);
      handleLogout();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken('');
    setUser(null);
    setReportsHistory([]);
    setCumulativeReport(null);
    setStep(STEPS.DASHBOARD);
  };

  // Google Identity Services OAuth callback initialization
  useEffect(() => {
    if (step === STEPS.LOGIN || showLoginModal) {
      const initGsi = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
          });
          const containerId = showLoginModal ? 'google-signin-btn-modal' : 'google-signin-btn';
          const targetEl = document.getElementById(containerId);
          if (targetEl) {
            window.google.accounts.id.renderButton(
              targetEl,
              { theme: 'outline', size: 'large', width: 280 }
            );
          }
        }
      };

      if (window.google) {
        initGsi();
      } else {
        const interval = setInterval(() => {
          if (window.google) {
            initGsi();
            clearInterval(interval);
          }
        }, 500);
        return () => clearInterval(interval);
      }
    }
  }, [step, showLoginModal]);

  const handleGoogleCredentialResponse = async (response) => {
    try {
      setIsApiValidating(true);
      setApiError('');
      const authResult = await apiRequest('/api/auth/google', 'POST', { credential: response.credential });
      localStorage.setItem('auth_token', authResult.token);
      setToken(authResult.token);
      setShowLoginModal(false);
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      setApiError(err.message || 'Google Authentication failed. Please try again.');
      setIsApiValidating(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!token) {
      alert("Please log in to save your API Key and Resume permanently to your profile.");
      setShowLoginModal(true);
      return;
    }
    setIsApiValidating(true);
    setApiError('');
    try {
      if (apiKey && apiKey.trim() !== '') {
        const checkKey = await validateApiKey(apiKey);
        if (!checkKey.valid) {
          throw new Error(checkKey.error || 'Invalid Gemini API key.');
        }
      }

      const response = await apiRequest('/api/profile', 'POST', {
        geminiApiKey: apiKey,
        resumeText: customDetails
      }, token);

      setUser(response.profile);
      alert('Profile settings updated successfully!');
    } catch (err) {
      console.error(err);
      setApiError(err.message || 'Failed to update profile settings.');
    } finally {
      setIsApiValidating(false);
    }
  };

  // Start interview click showing CV Confirmation modal
  const handleStartInterviewClick = () => {
    if (!token) {
      alert("Please log in to start a mock interview round and save your feedback reports.");
      setShowLoginModal(true);
      return;
    }
    if (!apiKey || apiKey.trim() === '') {
      alert("Please enter and save your Gemini API Key in Profile Settings before starting an interview.");
      setDashboardTab('profile');
      return;
    }
    setShowCvModal(true);
  };

  const handleStartInterviewClickWithOptions = async (modalProfile, modalLength, modalCvText, saveToProfile) => {
    setSelectedProfile(modalProfile);
    setInterviewLength(modalLength);
    setTempCvText(modalCvText); // Sync root state for final assessment report details
    
    if (saveToProfile) {
      setIsApiValidating(true);
      try {
        const response = await apiRequest('/api/profile', 'POST', {
          geminiApiKey: apiKey,
          resumeText: modalCvText
        }, token);
        setUser(response.profile);
        setCustomDetails(modalCvText);
      } catch (err) {
        console.error('Failed to save CV text to profile:', err);
        alert('Could not save CV to profile permanently: ' + err.message + '. Starting session with temporary CV.');
      } finally {
        setIsApiValidating(false);
      }
    }
    
    startInterviewSession(modalCvText, modalLength);
  };

  const handleStartAdaptiveClickWithOptions = async (modalProfile, modalLength, modalCvText, saveToProfile) => {
    setShowAdaptiveModal(false);
    setSelectedProfile(modalProfile);
    setTempCvText(modalCvText);
    
    if (saveToProfile) {
      setIsApiValidating(true);
      try {
        const response = await apiRequest('/api/profile', 'POST', {
          geminiApiKey: apiKey,
          resumeText: modalCvText
        }, token);
        setUser(response.profile);
        setCustomDetails(modalCvText);
      } catch (err) {
        console.error('Failed to save CV text to profile:', err);
      } finally {
        setIsApiValidating(false);
      }
    }
    
    startAdaptiveSession(selectedAdaptiveModuleForConfig, modalProfile, modalCvText);
    setSelectedAdaptiveModuleForConfig(null);
  };



  // Clean up video stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Speech Recognition Instantiation
  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.lastFinalText = ''; // Track final text for this session

    rec.onresult = (event) => {
      let currentSessionFinal = '';
      let currentSessionInterim = '';

      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentSessionFinal += event.results[i][0].transcript + ' ';
        } else {
          currentSessionInterim += event.results[i][0].transcript;
        }
      }

      rec.lastFinalText = currentSessionFinal;
      const spokenContent = currentSessionFinal + currentSessionInterim;

      // Interruption logic: If candidate speaks mid-speech of the AI interviewer
      if (spokenContent.trim().length > 3 && isAISpeakingRef.current) {
        console.log('Interruption detected!');
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        setIsAISpeaking(false);
        setIsInterrupted(true);
      }

      const combinedText = (accumulatedTranscriptRef.current + ' ' + spokenContent).trim().replace(/\s+/g, ' ');
      if (combinedText) {
        setCandidateResponseText(combinedText);
      }
    };

    rec.onend = () => {
      // Keep listening and accumulate if in interview mode
      if (recognitionRef.current === rec && isInterviewActiveRef.current) {
        if (rec.lastFinalText) {
          accumulatedTranscriptRef.current = (accumulatedTranscriptRef.current + ' ' + rec.lastFinalText).trim().replace(/\s+/g, ' ');
        }
        try {
          rec.start();
        } catch (e) {
          // ignore already started error
        }
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }
  };

  // TTS helper
  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Attempt to select a professional, deep/male or mature sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const googleVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Natural'));
    if (googleVoice) {
      utterance.voice = googleVoice;
    }
    
    utterance.rate = 1.05; // slightly faster for realistic flow
    
    utterance.onstart = () => {
      setIsAISpeaking(true);
      setIsInterrupted(false);
    };

    utterance.onend = () => {
      setIsAISpeaking(false);
    };

    utterance.onerror = () => {
      setIsAISpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Hardware Initialization (Webcam)
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      setWebcamActive(true);
    } catch (err) {
      console.error('Failed to access webcam:', err);
      setWebcamActive(false);
    }
  };

  const stopHardware = () => {
    isInterviewActiveRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setWebcamActive(false);
  };

  const startInterviewSession = async (interviewCvText, currentLength) => {
    setShowCvModal(false);
    isInterviewActiveRef.current = true;
    setStep(STEPS.INTERVIEW);
    setChatHistory([]);
    setQuestionCount(0);
    setCandidateResponseText('');
    setFollowupsAskedCount(0);
    setIsLastQuestionFollowup(false);
    setIsAILoading(true);

    // Promptly start webcam
    await startWebcam();

    // Trigger initial question list generation
    try {
      const lengthMap = {
        'small': 3,
        'medium': 5,
        'long': 7
      };
      const numQuestions = lengthMap[currentLength] || 3;

      const list = await generateQuestionsList(apiKey, {
        name,
        role: selectedProfile.name,
        details: interviewCvText
      }, numQuestions);
      
      setQuestionsList(list);
      
      const firstQuestion = list[0];
      const newHistory = [
        { role: 'model', parts: [{ text: firstQuestion }] }
      ];
      setChatHistory(newHistory);
      setQuestionCount(1);
      setIsAILoading(false);
      speakText(firstQuestion);
      
      // Start listening
      initSpeechRecognition();
    } catch (error) {
      console.error(error);
      setIsAILoading(false);
    }
  };

  const submitResponse = async () => {
    if (isAILoading) return;
    
    // Stop and clear the current recognition to reset buffers
    if (recognitionRef.current) {
      const tempRec = recognitionRef.current;
      recognitionRef.current = null; // Set to null before aborting to avoid race condition in onend callback
      try {
        tempRec.abort();
      } catch (e) {
        // ignore
      }
    }
    accumulatedTranscriptRef.current = ''; // Reset accumulated buffer for next question
    
    const responseText = candidateResponseText.trim() || "(No verbal reply captured)";
    
    // Build context showing if candidate interrupted the interviewer
    const userMessageContent = isInterrupted 
      ? `[Candidate Interrupted Mid-Question] ${responseText}`
      : responseText;

    const updatedHistory = [
      ...chatHistory,
      { role: 'user', parts: [{ text: userMessageContent }] }
    ];

    setChatHistory(updatedHistory);
    setCandidateResponseText('');
    setIsInterrupted(false);
    
    // Cancel any current TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (isLastQuestionFollowup) {
      setIsLastQuestionFollowup(false);
      if (questionCount >= questionsList.length) {
        // Transition to generating report
        setIsAILoading(true);
        setStep(STEPS.REPORT);
        stopHardware();
        
        try {
          const interviewCvText = tempCvText;
          const resultReport = await generateFeedbackReport(apiKey, updatedHistory, {
            name,
            role: selectedProfile.name,
            details: interviewCvText
          });
          setReport(resultReport);

          // SAVE REPORT TO BACKEND (Triggers Standard/Cumulative report generation on Express)
          if (token) {
            const saveResult = await apiRequest('/api/reports', 'POST', {
              reportData: {
                role: selectedProfile.name,
                overallScore: resultReport.overallScore,
                metrics: resultReport.metrics,
                executiveSummary: resultReport.executiveSummary,
                methodology: resultReport.methodology,
                keyFindings: resultReport.keyFindings,
                detailedFeedback: resultReport.detailedFeedback,
                insightsPatterns: resultReport.insightsPatterns,
                recommendations: resultReport.recommendations,
                limitations: resultReport.limitations,
                conclusion: resultReport.conclusion,
                chatHistory: updatedHistory
              }
            }, token);

            setReportsHistory(saveResult.reports || []);
            setCumulativeReport(saveResult.cumulativeReport || null);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setIsAILoading(false);
        }
      } else {
        // Ask next primary question with a smooth transition
        const transitions = [
          "Got it, thank you. Let's move to our next question.",
          "Understood. Thanks for sharing that context. Shifting back, let's talk about the next area.",
          "That makes sense. Shifting our focus back, let's discuss this:",
          "Appreciate the detailed follow-up. Let's move to the next topic."
        ];
        const transitionPhrase = transitions[Math.floor(Math.random() * transitions.length)];
        const rawNextQ = questionsList[questionCount];
        const nextQuestion = `${transitionPhrase} ${rawNextQ}`;

        setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: nextQuestion }] }]);
        setQuestionCount(prev => prev + 1);
        speakText(nextQuestion);
        initSpeechRecognition();
      }
    } else {
      // The candidate just answered a primary question. Check if we should ask a follow-up
      const totalPrimary = questionsList.length;
      let isFollowupTurn = false;
      if (totalPrimary <= 3) {
        isFollowupTurn = (questionCount === 1 || questionCount === 2);
      } else if (totalPrimary === 5) {
        isFollowupTurn = (questionCount === 2 || questionCount === 4);
      } else {
        isFollowupTurn = (questionCount === 3 || questionCount === 5);
      }

      if (followupsAskedCount < 2 && isFollowupTurn) {
        setIsAILoading(true);
        try {
          const lastQuestionText = chatHistory[chatHistory.length - 1]?.parts[0]?.text || "";
          const genAIPrompt = `You are a professional mock interviewer for the role: ${selectedProfile.name}.
The candidate just answered your question: "${lastQuestionText}"
Their response was: "${responseText}"

Acknowledge their response conversationally and ask exactly one relevant follow-up question to probe deeper into their response.
Keep your response short and natural (1-2 sentences max).
Do not include any introductory remarks, metadata, or choices. Return ONLY the follow-up question text itself.`;

          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: genAIPrompt }] }]
            })
          });
          if (response.ok) {
            const data = await response.json();
            const followupText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (followupText) {
              setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: followupText }] }]);
              setFollowupsAskedCount(prev => prev + 1);
              setIsLastQuestionFollowup(true);
              setIsAILoading(false);
              speakText(followupText);
              initSpeechRecognition();
              return; // Halt primary flow to ask follow-up
            }
          }
        } catch (err) {
          console.error("Failed to generate follow-up question, falling back to primary:", err);
        }
      }

      // If we don't ask a follow-up, move to next primary
      if (questionCount >= questionsList.length) {
        // Transition to generating report
        setIsAILoading(true);
        setStep(STEPS.REPORT);
        stopHardware();
        
        try {
          const interviewCvText = tempCvText;
          const resultReport = await generateFeedbackReport(apiKey, updatedHistory, {
            name,
            role: selectedProfile.name,
            details: interviewCvText
          });
          setReport(resultReport);

          // SAVE REPORT TO BACKEND
          if (token) {
            const saveResult = await apiRequest('/api/reports', 'POST', {
              reportData: {
                role: selectedProfile.name,
                overallScore: resultReport.overallScore,
                metrics: resultReport.metrics,
                executiveSummary: resultReport.executiveSummary,
                methodology: resultReport.methodology,
                keyFindings: resultReport.keyFindings,
                detailedFeedback: resultReport.detailedFeedback,
                insightsPatterns: resultReport.insightsPatterns,
                recommendations: resultReport.recommendations,
                limitations: resultReport.limitations,
                conclusion: resultReport.conclusion,
                chatHistory: updatedHistory
              }
            }, token);

            setReportsHistory(saveResult.reports || []);
            setCumulativeReport(saveResult.cumulativeReport || null);
          }
        } catch (error) {
          console.error(error);
        } finally {
          setIsAILoading(false);
        }
      } else {
        // Ask next primary question with acknowledgment transition
        const transitions = [
          "Got it, thank you. Let's move to the next question.",
          "That makes sense. Moving forward, my next question is:",
          "Appreciate the explanation. Shifting focus, let's talk about this:",
          "I see. That's a clear perspective. Next, let's discuss:"
        ];
        const transitionPhrase = transitions[Math.floor(Math.random() * transitions.length)];
        const rawNextQ = questionsList[questionCount];
        const nextQuestion = `${transitionPhrase} ${rawNextQ}`;

        setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: nextQuestion }] }]);
        setQuestionCount(prev => prev + 1);
        speakText(nextQuestion);
        initSpeechRecognition();
      }
    }
  };

  const startAdaptiveSession = async (moduleItem, targetProfile, confirmedCvText) => {
    if (!apiKey || apiKey.trim() === '') {
      alert("Please enter and save your Gemini API Key in Profile Settings before starting a session.");
      setDashboardTab('profile');
      return;
    }
    
    setSelectedAdaptiveModule(moduleItem);
    setAdaptiveStepFeedback(null);
    setIsAdaptiveStepLoading(true);
    setChatHistory([]);
    setAdaptiveQuestionCount(0);
    setCandidateResponseText('');
    isInterviewActiveRef.current = true;
    setStep(STEPS.ADAPTIVE_INTERVIEW);

    // Promptly start webcam
    await startWebcam();

    // Select the first question dynamically from CV text
    let firstQuestion = "";
    const cvText = confirmedCvText || customDetails || "";
    const profileName = targetProfile?.name || selectedProfile?.name || "General Profile";
    
    if (cvText.trim()) {
      try {
        const genAIPrompt = `You are a mock placement interviewer for a ${profileName} role.
Given the candidate's CV/Resume text:
"${cvText}"

We are starting a behavioral/technical mock interview practice module focused on: "${moduleItem.title}" (${moduleItem.desc}).
Generate exactly one customized starting question for this candidate. The question must:
1. Directly relate to their CV details, projects, internships, leadership roles, or background if applicable.
2. Be tailored to the ${profileName} context.
3. If the module is personal (like Self Introduction, Strengths/Weaknesses, or Motivation), tie it to their background or their experiences at IIT Kharagpur.
4. Sound natural, professional, and conversational.
5. Be 1-2 direct sentences max.

Do not include any introductory remarks, metadata, or multiple choices. Return ONLY the question text itself.`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: genAIPrompt }] }]
          })
        });
        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) firstQuestion = text.trim();
        }
      } catch (err) {
        console.error(`Error generating CV-aware question for ${moduleItem.title}, falling back:`, err);
      }
    }

    if (!firstQuestion) {
      // Pick one primary question randomly from the questions list as a fallback
      const questions = moduleItem.questions;
      firstQuestion = questions[Math.floor(Math.random() * questions.length)];
    }

    const firstMsg = { role: 'model', parts: [{ text: firstQuestion }] };
    setChatHistory([firstMsg]);
    setAdaptiveQuestionCount(1);
    setIsAdaptiveStepLoading(false);
    speakText(firstQuestion);
    
    // Start listening
    initSpeechRecognition();
  };

  const submitAdaptiveResponse = async () => {
    if (isAdaptiveStepLoading) return;
    
    // Stop recording
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
    accumulatedTranscriptRef.current = '';

    const responseText = candidateResponseText.trim() || "(No verbal reply captured)";
    
    const userMessageContent = isInterrupted 
      ? `[Candidate Interrupted Mid-Question] ${responseText}`
      : responseText;

    const updatedHistory = [
      ...chatHistory,
      { role: 'user', parts: [{ text: userMessageContent }] }
    ];

    setChatHistory(updatedHistory);
    setCandidateResponseText('');
    setIsInterrupted(false);
    
    // Cancel any current TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsAdaptiveStepLoading(true);

    try {
      const result = await generateAdaptiveStepFeedback(
        apiKey,
        selectedAdaptiveModule.title,
        updatedHistory,
        customDetails,
        name,
        selectedProfile.name
      );

      setAdaptiveStepFeedback(result.feedback);

      if (result.shouldEnd || !result.nextQuestion || adaptiveQuestionCount >= 4) {
        // Conclude the practice session
        setAdaptiveQuestionCount(prev => prev + 1);
        setIsAdaptiveStepLoading(false);
        speakText("That concludes this preparation module. I have compiled your feedback. Feel free to review it and finish whenever you are ready.");
        
        // Save this module assessment to backend reports history
        try {
          const mockReport = {
            role: `Adaptive Prep: ${selectedAdaptiveModule.title}`,
            overallScore: result.feedback.scores ? Math.round((result.feedback.scores.communication + result.feedback.scores.clarity + result.feedback.scores.technicalDepth + result.feedback.scores.confidence) * 2.5) : 75,
            metrics: {
              technicalDepth: (result.feedback.scores?.technicalDepth || 7) * 10,
              communicationClarity: (result.feedback.scores?.communication || 7) * 10,
              problemSolving: (result.feedback.scores?.clarity || 7) * 10,
              poiseAndStructure: (result.feedback.scores?.confidence || 7) * 10
            },
            executiveSummary: result.feedback.suggestedAnswer ? `Suggested response improvement: ${result.feedback.suggestedAnswer.substring(0, 150)}...` : "Adaptive prep feedback generated.",
            methodology: `Evaluated candidate performance on ${selectedAdaptiveModule.title} questions dynamically.`,
            keyFindings: result.feedback.strengths || ["Participated actively in the module."],
            detailedFeedback: updatedHistory.filter(m => m.role === 'model').map((m, idx) => {
              const u = updatedHistory.find((x, i) => i > updatedHistory.indexOf(m) && x.role === 'user');
              return {
                question: m.parts[0].text,
                answer: u ? u.parts[0].text : "(No verbal response captured)",
                whatWasFound: "Answer evaluated.",
                whyItMatters: "Reflects communication poise.",
                implications: "Adaptive prep practice.",
                confidenceLevel: "High",
                score: 75
              };
            }),
            insightsPatterns: "Active practice round.",
            recommendations: result.feedback.improvements || [],
            limitations: "Self-paced single-module simulation.",
            conclusion: "Practice session completed successfully."
          };
          
          const saveResult = await apiRequest('/api/reports', 'POST', {
            reportData: mockReport
          }, token);
          setReportsHistory(saveResult.reports || []);
          setCumulativeReport(saveResult.cumulativeReport || null);
        } catch (errSave) {
          console.error("Failed to auto-save adaptive practice module:", errSave);
        }

      } else {
        // Continue with the next question
        const nextQMsg = { role: 'model', parts: [{ text: result.nextQuestion }] };
        setChatHistory(prev => [...prev, nextQMsg]);
        setAdaptiveQuestionCount(prev => prev + 1);
        setIsAdaptiveStepLoading(false);
        speakText(result.nextQuestion);
        
        // Start listening again
        initSpeechRecognition();
      }

    } catch (err) {
      console.error("Error submitting adaptive response:", err);
      setIsAdaptiveStepLoading(false);
      alert("Failed to analyze response. Returning to dashboard.");
      stopHardware();
      setStep(STEPS.DASHBOARD);
    }
  };

  const handleFinishAdaptiveSession = () => {
    stopHardware();
    setStep(STEPS.DASHBOARD);
    setSelectedAdaptiveModule(null);
    setAdaptiveStepFeedback(null);
    setAdaptiveQuestionCount(0);
  };

  const handleEndInterviewEarly = async () => {
    setIsAILoading(true);
    setStep(STEPS.REPORT);
    stopHardware();
    
    try {
      const interviewCvText = tempCvText;
      const resultReport = await generateFeedbackReport(apiKey, chatHistory, {
        name,
        role: selectedProfile.name,
        details: interviewCvText
      });
      setReport(resultReport);

      // SAVE REPORT TO BACKEND
      const saveResult = await apiRequest('/api/reports', 'POST', {
        reportData: {
          role: selectedProfile.name,
          overallScore: resultReport.overallScore,
          metrics: resultReport.metrics,
          executiveSummary: resultReport.executiveSummary,
          methodology: resultReport.methodology,
          keyFindings: resultReport.keyFindings,
          detailedFeedback: resultReport.detailedFeedback,
          insightsPatterns: resultReport.insightsPatterns,
          recommendations: resultReport.recommendations,
          limitations: resultReport.limitations,
          conclusion: resultReport.conclusion,
          chatHistory: chatHistory
        }
      }, token);

      setReportsHistory(saveResult.reports || []);
      setCumulativeReport(saveResult.cumulativeReport || null);
    } catch (err) {
      console.error('Failed to generate report early:', err);
    } finally {
      setIsAILoading(false);
    }
  };

  const handleRestart = () => {
    stopHardware();
    accumulatedTranscriptRef.current = '';
    setStep(STEPS.DASHBOARD);
    setReport(null);
    setChatHistory([]);
    setQuestionCount(0);
    setCandidateResponseText('');
  };

  // ==========================================
  // RENDER BLOCKS
  // ==========================================

  // Dashboard - Standard / Cumulative Report Tab
  const renderCumulativeReportTab = () => {
    if (!token) {
      return (
        <div className="empty-state" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
          <h3>Standard Cumulative Report</h3>
          <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0.75rem auto 1.75rem auto', lineHeight: '1.6' }}>
            Standard cumulative reports track your performance metrics across all interview rounds. Log in with your student community account to view details.
          </p>
          <button className="btn" onClick={() => setShowLoginModal(true)}>
            Login to Account
          </button>
        </div>
      );
    }

    if (!cumulativeReport) {
      return (
        <div className="empty-state">
          <h3>No Performance Data Found</h3>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            You haven't completed any mock interviews yet. Start your first session to build your cumulative preparation performance report.
          </p>
          <button className="btn" style={{ marginTop: '2rem' }} onClick={handleStartInterviewClick}>
            Start Your First Interview
          </button>
        </div>
      );
    }

    return (
      <div>
        <div className="report-header-sec" style={{ marginBottom: '2rem' }}>
          <h2 className="title-large" style={{ fontSize: '2.0rem' }}>Standard Cumulative Report</h2>
          <p style={{ color: 'var(--text-secondary)' }}>A synthesis of your performance across all completed interviews.</p>
        </div>

        <div className="report-grid">
          {/* Details (Left) */}
          <div>
            <div className="form-card summary-card" style={{ marginBottom: '2rem' }}>
              <h4 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-accent)' }}>Cumulative Executive Summary</h4>
              <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>{cumulativeReport.executiveSummary}</p>
            </div>

            <div className="form-card" style={{ marginBottom: '2rem' }}>
              <h4 className="title-medium" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Assessment Methodology</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{cumulativeReport.methodology}</p>
            </div>

            <div className="form-card" style={{ marginBottom: '2rem' }}>
              <h4 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Recurring Assessor Findings</h4>
              <div>
                {cumulativeReport.keyFindings?.map((find, i) => (
                  <div key={i} className="list-item" style={{ marginBottom: '0.75rem' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-accent)' }}>
                      <line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                    <span style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>{find}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-card" style={{ marginBottom: '2rem' }}>
              <h4 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Observed Insights & Cognitive Patterns</h4>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{cumulativeReport.insightsPatterns}</p>
            </div>

            <div className="form-card" style={{ marginBottom: '2rem' }}>
              <h4 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Actionable Cumulative Recommendations</h4>
              <div>
                {cumulativeReport.recommendations?.map((rec, i) => (
                  <div key={i} className="list-item" style={{ marginBottom: '0.75rem' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--success)' }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-card" style={{ marginBottom: '2rem' }}>
              <h4 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Cumulative Conclusion</h4>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{cumulativeReport.conclusion}</p>
            </div>
          </div>

          {/* Scoring panel (Right) */}
          <div className="score-panel" style={{ position: 'sticky', top: '2rem' }}>
            <h4 className="title-medium" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontWeight: '500' }}>Cumulative Performance Score</h4>
            
            <div className="radial-score">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="60" fill="transparent" stroke="var(--border-muted)" strokeWidth="8" />
                <circle
                  cx="70"
                  cy="70"
                  r="60"
                  fill="transparent"
                  stroke={cumulativeReport.overallScore >= 75 ? 'var(--success)' : cumulativeReport.overallScore >= 50 ? 'var(--warning)' : 'var(--error)'}
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 60}
                  strokeDashoffset={2 * Math.PI * 60 * (1 - (cumulativeReport.overallScore || 0) / 100)}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                />
              </svg>
              <div className="score-text">
                <span className="score-num">{cumulativeReport.overallScore || 0}</span>
                <span className="score-denom">Percent</span>
              </div>
            </div>
            
            <div className="competence-metrics" style={{ width: '100%', marginTop: '2rem', textAlign: 'left' }}>
              <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: '600' }}>Aggregated Competencies</h5>
              
              {[
                { label: 'Technical Depth', val: cumulativeReport.metrics?.technicalDepth || 70, color: 'var(--text-accent)' },
                { label: 'Communication Clarity', val: cumulativeReport.metrics?.communicationClarity || 70, color: 'var(--success)' },
                { label: 'Problem Solving', val: cumulativeReport.metrics?.problemSolving || 70, color: 'var(--warning)' },
                { label: 'Poise & Structure', val: cumulativeReport.metrics?.poiseAndStructure || 70, color: 'var(--error)' }
              ].map((met, i) => (
                <div key={i} className="metric-row" style={{ marginBottom: '1.25rem' }}>
                  <div className="flex-between" style={{ marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{met.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: '600' }}>{met.val}/100</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${met.val}%`, backgroundColor: met.color, borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)', width: '100%', margin: '1.5rem 0' }} />
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Cumulative assessment metrics reflect long-term interview readiness trends across SWE, PM, Consulting, and Finance rounds.
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Dashboard - Session History Tab
  const renderHistoryTab = () => {
    if (!token) {
      return (
        <div className="empty-state" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
          <h3>Session History Logs</h3>
          <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0.75rem auto 1.75rem auto', lineHeight: '1.6' }}>
            Access all your past McKinsey-grade mock interview transcripts and feedback reports in one place. Log in to sync history.
          </p>
          <button className="btn" onClick={() => setShowLoginModal(true)}>
            Login to Account
          </button>
        </div>
      );
    }

    if (reportsHistory.length === 0) {
      return (
        <div className="empty-state">
          <h3>No Interview History</h3>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            You haven't completed any mock interviews yet. Complete your first session to save reports to history.
          </p>
        </div>
      );
    }

    return (
      <div>
        <div className="report-header-sec" style={{ marginBottom: '2rem' }}>
          <h2 className="title-large" style={{ fontSize: '2.0rem' }}>Interview History</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Review your detailed report for each individual mock round.</p>
        </div>

        <div className="history-list">
          {reportsHistory.map((rep, idx) => {
            const dateStr = new Date(rep.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            
            const scoreClass = rep.overallScore >= 75 ? 'excellent' : rep.overallScore >= 50 ? 'average' : 'poor';

            return (
              <div key={rep._id || idx} className="history-card">
                <div className="history-info">
                  <h3>{rep.role} Round</h3>
                  <div className="history-date">Completed on {dateStr}</div>
                </div>
                <div className="history-score-badge">
                  <span className={`score-badge ${scoreClass}`}>Score: {rep.overallScore}/100</span>
                  <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => setActiveHistoryReport(rep)}>
                    View Report
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Dashboard - Profile Settings Tab
  const renderProfileTab = () => {
    return (
      <div className="form-card">
        <h2 className="title-medium" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Profile Settings</h2>
        
        {apiError && (
          <div className="error-message" style={{ marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{apiError}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="key-input">Gemini API Key</label>
          <input
            id="key-input"
            type="password"
            className="form-input"
            placeholder="AIzaSy..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Enter your personal Gemini API key. This key is used to generate personalized questions and score assessments.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="cv-input">Saved Resume / CV Text</label>
          <textarea
            id="cv-input"
            className="form-input form-textarea"
            style={{ minHeight: '180px' }}
            placeholder="Ask ChatGPT or Gemini: 'Summarize my CV/Resume PDF into a comprehensive text description of my skills, projects, and experiences' and paste the plain text here..."
            value={customDetails}
            onChange={(e) => setCustomDetails(e.target.value)}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Pasting your CV text helps target the interview. You can edit this text right before starting any individual mock session.
          </p>
        </div>

        <div className="actions-row">
          <button className="btn" onClick={handleSaveProfile} disabled={isApiValidating}>
            {isApiValidating ? 'Saving Settings...' : 'Save Profile Settings'}
          </button>
        </div>
      </div>
    );
  };

  // Dashboard - Adaptive Prep Tab
  const renderAdaptivePrepTab = () => {
    return (
      <div>
        <div className="report-header-sec" style={{ marginBottom: '2rem' }}>
          <h2 className="title-large" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Adaptive Behavioral Prep</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Practice real, conversational interview simulations question-by-question. The AI drills deeper with dynamic follow-ups based on your CV details and answers, providing instant grading and response improvements after every turn.
          </p>
        </div>

        <div className="profile-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {BEHAVIORAL_MODULES.map((mod) => (
            <div 
              key={mod.id} 
              className="profile-card"
              style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem', cursor: 'default' }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '0.50rem' }}>{mod.title}</h3>
                <p style={{ fontSize: '0.82rem', lineHeight: '1.45', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  {mod.desc}
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', fontSize: '0.85rem', padding: '0.65rem' }}
                onClick={() => {
                  if (!token) {
                    alert("Please log in to practice adaptive modules and save your scoring history.");
                    setShowLoginModal(true);
                    return;
                  }
                  setSelectedAdaptiveModuleForConfig(mod);
                  setShowAdaptiveModal(true);
                }}
              >
                Practice Module
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Pre-interview CV confirmation Modal
  const renderCvModal = () => {
    return (
      <ConfigureInterviewModal
        isOpen={showCvModal}
        onClose={() => setShowCvModal(false)}
        initialProfile={selectedProfile}
        initialLength={interviewLength}
        initialCvText={customDetails}
        profiles={PROFILES}
        isLoggedIn={!!token}
        onStart={handleStartInterviewClickWithOptions}
      />
    );
  };

  // Pre-adaptive CV confirmation Modal
  const renderAdaptiveModal = () => {
    return (
      <ConfigureInterviewModal
        isOpen={showAdaptiveModal}
        onClose={() => {
          setShowAdaptiveModal(false);
          setSelectedAdaptiveModuleForConfig(null);
        }}
        initialProfile={selectedProfile}
        initialLength="small"
        initialCvText={customDetails}
        profiles={PROFILES}
        isAdaptive={true}
        isLoggedIn={!!token}
        onStart={handleStartAdaptiveClickWithOptions}
      />
    );
  };

  // Google Sign-In Login Modal for Guests
  const renderLoginModal = () => {
    return (
      <div className="modal-overlay">
        <div className="modal-container" style={{ maxWidth: '420px', padding: '2.5rem 2rem', textAlign: 'center' }}>
          <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0, justifyContent: 'center', position: 'relative' }}>
            <h3 className="modal-title" style={{ fontSize: '1.4rem' }}>Log in to KGP Interview Prep</h3>
            <button className="modal-close-btn" style={{ position: 'absolute', right: 0, top: 0 }} onClick={() => setShowLoginModal(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          
          <div className="modal-body" style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '2rem' }}>
              Authenticate with your student account to automatically save report history, track cumulative competency grids, and personalize conversational simulations.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <div id="google-signin-btn-modal"></div>
            </div>

            {apiError && (
              <div className="error-message" style={{ justifyContent: 'center', marginTop: '1rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{apiError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Past Assessment Report Details Modal
  const renderPastReportModal = () => {
    const rep = activeHistoryReport;
    if (!rep) return null;

    return (
      <div className="modal-overlay">
        <div className="modal-container" style={{ maxWidth: '850px', maxHeight: '85vh' }}>
          <div className="modal-header">
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.25rem' }}>Interview Assessment Report</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Role: {rep.role} • Completed on {new Date(rep.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button className="modal-close-btn" onClick={() => setActiveHistoryReport(null)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          
          <div className="modal-body">
            <div className="report-grid" style={{ gridTemplateColumns: '1.25fr 0.75fr', gap: '2rem' }}>
              {/* Detailed Breakdown */}
              <div>
                <div className="form-card summary-card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
                  <h4 className="title-medium" style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-accent)' }}>Executive Summary</h4>
                  <p style={{ fontSize: '0.92rem', lineHeight: '1.6' }}>{rep.executiveSummary}</p>
                </div>

                <div className="form-card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
                  <h4 className="title-medium" style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Methodology</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{rep.methodology}</p>
                </div>

                <div className="form-card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
                  <h4 className="title-medium" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Key Findings</h4>
                  <div>
                    {rep.keyFindings?.map((find, i) => (
                      <div key={i} className="list-item" style={{ marginBottom: '0.5rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-accent)' }}>
                          <line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/>
                        </svg>
                        <span style={{ fontSize: '0.88rem' }}>{find}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="qa-review-sec" style={{ marginBottom: '1.5rem' }}>
                  <h3 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Detailed Answer Analysis</h3>
                  {rep.detailedFeedback?.map((item, idx) => (
                    <div key={idx} className="qa-item" style={{ marginBottom: '1rem', borderRadius: '6px' }}>
                      <div className="qa-header" style={{ padding: '0.85rem 1.25rem' }}>
                        <span className="qa-title" style={{ fontSize: '0.75rem' }}>QUESTION {idx + 1}</span>
                        <span className="qa-score" style={{ fontSize: '0.75rem' }}>Score: {item.score}/100</span>
                      </div>
                      <div className="qa-body" style={{ padding: '1.25rem' }}>
                        <div className="qa-text-group" style={{ marginBottom: '1rem' }}>
                          <div className="qa-label" style={{ fontSize: '0.65rem' }}>Interviewer Query</div>
                          <div className="qa-value" style={{ fontSize: '0.85rem', fontWeight: '500' }}>{item.question}</div>
                        </div>
                        <div className="qa-text-group" style={{ marginBottom: '1rem' }}>
                          <div className="qa-label" style={{ fontSize: '0.65rem' }}>Your Response</div>
                          <div className="qa-value" style={{ fontSize: '0.85rem', fontStyle: item.answer.includes('[Candidate Interrupted') ? 'italic' : 'normal' }}>{item.answer}</div>
                        </div>
                        <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)', margin: '0.85rem 0' }} />
                        <div className="qa-text-group" style={{ marginBottom: '0.5rem' }}>
                          <div className="qa-label" style={{ fontSize: '0.65rem', color: 'var(--success)' }}>What was found</div>
                          <div className="qa-value" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.whatWasFound}</div>
                        </div>
                        <div className="qa-text-group" style={{ marginBottom: '0.5rem' }}>
                          <div className="qa-label" style={{ fontSize: '0.65rem', color: 'var(--warning)' }}>Why it matters</div>
                          <div className="qa-value" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.whyItMatters}</div>
                        </div>
                        <div className="qa-text-group" style={{ marginBottom: '0.5rem' }}>
                          <div className="qa-label" style={{ fontSize: '0.65rem', color: 'var(--text-accent)' }}>Potential Implications</div>
                          <div className="qa-value" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.implications}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="form-card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
                  <h4 className="title-medium" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Insights & Cognitive Patterns</h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{rep.insightsPatterns}</p>
                </div>

                <div className="form-card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
                  <h4 className="title-medium" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Recommendations</h4>
                  <div>
                    {rep.recommendations?.map((rec, i) => (
                      <div key={i} className="list-item" style={{ marginBottom: '0.5rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--success)' }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span style={{ fontSize: '0.88rem' }}>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-card" style={{ marginBottom: '1.5rem', padding: '1.75rem' }}>
                  <h4 className="title-medium" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Limitations</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{rep.limitations}</p>
                </div>

                <div className="form-card" style={{ padding: '1.75rem' }}>
                  <h4 className="title-medium" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Assessor Conclusion</h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{rep.conclusion}</p>
                </div>
              </div>

              {/* Side Dashboard Score */}
              <div>
                <div className="score-panel" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
                  <h4 className="title-medium" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Overall Score</h4>
                  <div className="radial-score" style={{ transform: 'scale(0.85)', margin: '-0.75rem 0' }}>
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r="60" fill="transparent" stroke="var(--border-muted)" strokeWidth="8" />
                      <circle
                        cx="70"
                        cy="70"
                        r="60"
                        fill="transparent"
                        stroke={rep.overallScore >= 75 ? 'var(--success)' : rep.overallScore >= 50 ? 'var(--warning)' : 'var(--error)'}
                        strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 60}
                        strokeDashoffset={2 * Math.PI * 60 * (1 - (rep.overallScore || 0) / 100)}
                        strokeLinecap="round"
                        transform="rotate(-90 70 70)"
                      />
                    </svg>
                    <div className="score-text">
                      <span className="score-num">{rep.overallScore || 0}</span>
                      <span className="score-denom">Percent</span>
                    </div>
                  </div>

                  <div className="competence-metrics" style={{ width: '100%', marginTop: '1rem' }}>
                    {[
                      { label: 'Technical Depth', val: rep.metrics?.technicalDepth || 70, color: 'var(--text-accent)' },
                      { label: 'Communication Clarity', val: rep.metrics?.communicationClarity || 70, color: 'var(--success)' },
                      { label: 'Problem Solving', val: rep.metrics?.problemSolving || 70, color: 'var(--warning)' },
                      { label: 'Poise & Structure', val: rep.metrics?.poiseAndStructure || 70, color: 'var(--error)' }
                    ].map((met, i) => (
                      <div key={i} className="metric-row" style={{ marginBottom: '1rem' }}>
                        <div className="flex-between" style={{ marginBottom: '0.25rem', fontSize: '0.78rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{met.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: '600' }}>{met.val}/100</span>
                        </div>
                        <div style={{ height: '5px', backgroundColor: 'var(--bg-secondary)', borderRadius: '2.5px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${met.val}%`, backgroundColor: met.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button className="btn" onClick={() => setActiveHistoryReport(null)}>
              Close Report
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Main Return Block directing to active step view
  if (step === STEPS.LOGIN) {
    return (
      <div className="app-wrapper">
        <header>
          <div className="brand">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
            <span>KGP Interview Prep</span>
            <span className="brand-sub">• Peer Prep Community</span>
          </div>
        </header>
        <main>
          <div className="login-grid">
            <div className="form-card login-card">
              <h1 className="title-large" style={{ fontSize: '2.2rem' }}>Prepare Smarter. Interview Better.</h1>
              <p className="subtitle" style={{ margin: '0 auto 2rem auto' }}>
                Access interview experiences, curated resources, and structured preparation paths designed for IIT Kharagpur students.
              </p>
              
              <div className="google-auth-container">
                <div id="google-signin-btn"></div>
                
                {GOOGLE_CLIENT_ID.startsWith("your-google") && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.5rem' }}>
                    Note: Developers need to configure the Google Client ID in <code>src/App.jsx</code> and <code>backend/.env</code> to make Google OAuth work.
                  </p>
                )}

                {apiError && (
                  <div className="error-message" style={{ justifyContent: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>{apiError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (step === STEPS.DASHBOARD) {
    return (
      <div className="app-wrapper">
        <header>
          <div className="flex-between">
            <div className="brand">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                <line x1="6" y1="6" x2="6.01" y2="6"/>
                <line x1="6" y1="18" x2="6.01" y2="18"/>
              </svg>
              <span>KGP Interview Prep</span>
              <span className="brand-sub">• Peer Prep Community</span>
            </div>
            
            {token ? (
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }} onClick={handleLogout}>
                Logout
              </button>
            ) : (
              <button className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }} onClick={() => setShowLoginModal(true)}>
                Login
              </button>
            )}
          </div>
        </header>

        <main>
          <div className="dashboard-layout">
            {/* Sidebar */}
            <aside className="dashboard-sidebar">
              <div className="dashboard-user-profile">
                {user?.picture ? (
                  <img src={user.picture} alt="Profile" className="dashboard-avatar" referrerPolicy="no-referrer" />
                ) : (
                  <div className="dashboard-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {name.charAt(0) || 'U'}
                  </div>
                )}
                <div className="dashboard-user-name">{name}</div>
                <div className="dashboard-user-email">{user?.email}</div>
              </div>
              <div className="dashboard-nav">
                <button 
                  className={`dashboard-nav-btn ${dashboardTab === 'cumulative' ? 'active' : ''}`}
                  onClick={() => setDashboardTab('cumulative')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                  Standard Report
                </button>
                <button 
                  className={`dashboard-nav-btn ${dashboardTab === 'history' ? 'active' : ''}`}
                  onClick={() => setDashboardTab('history')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                  Session History
                </button>
                <button 
                  className={`dashboard-nav-btn ${dashboardTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setDashboardTab('profile')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Profile Settings
                </button>
                <button 
                  className={`dashboard-nav-btn ${dashboardTab === 'adaptive' ? 'active' : ''}`}
                  onClick={() => setDashboardTab('adaptive')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Adaptive Prep
                </button>
              </div>

              <button 
                className="btn" 
                style={{ width: '100%', marginTop: '1rem' }} 
                onClick={handleStartInterviewClick}
              >
                Start Interview
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </aside>

            {/* Main Content Area */}
            <section className="dashboard-content">
              {dashboardTab === 'cumulative' && renderCumulativeReportTab()}
              {dashboardTab === 'history' && renderHistoryTab()}
              {dashboardTab === 'profile' && renderProfileTab()}
              {dashboardTab === 'adaptive' && renderAdaptivePrepTab()}
            </section>
          </div>

          {showCvModal && renderCvModal()}
          {showAdaptiveModal && renderAdaptiveModal()}
          {showLoginModal && renderLoginModal()}
          {activeHistoryReport && renderPastReportModal()}
        </main>
      </div>
    );
  }

  if (step === STEPS.ADAPTIVE_INTERVIEW) {
    const isCompleted = adaptiveQuestionCount >= 4 || (adaptiveStepFeedback && !chatHistory[chatHistory.length - 1]?.parts[0]?.text);
    return (
      <div className="app-wrapper">
        <header>
          <div className="brand">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
            <span>KGP Interview Prep</span>
            <span className="brand-sub">• Peer Prep Community</span>
          </div>
        </header>

        <main>
          <div className="meeting-layout" style={{ gap: '1.5rem' }}>
            {/* STAGE AREA (LEFT) */}
            <div className="stage-container" style={{ flex: '1.1' }}>
              <div className="stage-header">
                <span className="room-title">ADAPTIVE-PREP-{selectedAdaptiveModule?.title.toUpperCase()}</span>
                <div className="live-indicator">
                  <span className="live-dot" />
                  <span>PRACTICE LIVE</span>
                </div>
              </div>
              
              <div className="interviewer-viewport">
                {/* Silhouette SVG Avatar */}
                <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={`interviewer-graphic ${isAISpeaking ? 'speaking' : ''}`}>
                  <circle cx="100" cy="100" r="96" fill="#0b0b0d" stroke="#27272a" strokeWidth="1.5"/>
                  <circle cx="100" cy="80" r="28" fill="#27272a"/>
                  <path d="M52 145C52 124 72 114 100 114C128 114 148 124 148 145" stroke="#27272a" strokeWidth="6" strokeLinecap="round"/>
                </svg>

                {/* Animated Speech Soundwave */}
                <AudioWaveform isSpeaking={isAISpeaking} />

                {/* Local Camera Overlay */}
                <div className={`local-cam-feed ${!webcamActive ? 'no-video' : ''}`}>
                  {webcamActive ? (
                    <video ref={videoRef} autoPlay playsInline muted />
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '4px' }}>
                        <path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
                      </svg>
                      <div>Camera Off</div>
                    </div>
                  )}
                  <div className="local-cam-label">Candidate (You)</div>
                </div>
              </div>
            </div>

            {/* SIDEBAR CONSOLE & FEEDBACK PANEL (RIGHT) */}
            <div className="console-container" style={{ flex: '1.4', display: 'flex', flexDirection: 'column' }}>
              <div className="console-header">
                <h3>Adaptive Module Practice</h3>
                <span className="question-counter" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                  Turn: {Math.min(adaptiveQuestionCount, 4)} / 4
                </span>
              </div>

              {/* Viewport combining chat and instant step feedback */}
              <div className="transcript-viewport" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                
                {/* Loader for API analysis */}
                {isAdaptiveStepLoading && (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
                    <p style={{ fontSize: '0.85rem' }}>Student Mentor agent is analyzing your response and preparing feedback...</p>
                  </div>
                )}

                {/* Latest Question & History */}
                {!isAdaptiveStepLoading && chatHistory.length > 0 && (
                  <div className="transcript-message" style={{ marginBottom: '1.5rem', borderLeft: '2px solid var(--text-accent)', paddingLeft: '0.85rem' }}>
                    <span className="msg-sender interviewer" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Interviewer (Question)
                    </span>
                    <p style={{ fontSize: '0.95rem', fontWeight: '500', marginTop: '0.25rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                      {chatHistory[chatHistory.length - 1]?.role === 'model' 
                        ? chatHistory[chatHistory.length - 1]?.parts[0]?.text 
                        : chatHistory[chatHistory.length - 2]?.parts[0]?.text}
                    </p>
                  </div>
                )}

                {/* Instant Step Feedback Dashboard */}
                {!isAdaptiveStepLoading && adaptiveStepFeedback && (
                  <div className="feedback-step-card animate-fadeIn" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-muted)', borderRadius: '10px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.92rem', textTransform: 'uppercase', color: 'var(--accent-teal)', fontWeight: '600', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      Instant Response Evaluation
                    </h4>

                    {/* Scores Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem', marginBottom: '1.5rem' }}>
                      {adaptiveStepFeedback.scores && Object.entries(adaptiveStepFeedback.scores).map(([key, val]) => (
                        <div key={key} style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-muted)', padding: '0.65rem 0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {key === 'communication' ? 'Comm' : key === 'technicalDepth' ? 'Tech' : key}
                          </div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>{val}/10</div>
                        </div>
                      ))}
                    </div>

                    {/* Strengths & Improvements */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div>
                        <h5 style={{ fontSize: '0.8rem', color: 'var(--success)', textTransform: 'uppercase', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Key Strengths
                        </h5>
                        <ul style={{ paddingLeft: '1.1rem', margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {adaptiveStepFeedback.strengths?.map((str, idx) => (
                            <li key={idx} style={{ marginBottom: '0.25rem' }}>{str}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h5 style={{ fontSize: '0.8rem', color: 'var(--warning)', textTransform: 'uppercase', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          Growth Areas
                        </h5>
                        <ul style={{ paddingLeft: '1.1rem', margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {adaptiveStepFeedback.improvements?.map((imp, idx) => (
                            <li key={idx} style={{ marginBottom: '0.25rem' }}>{imp}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Suggested Better Answer */}
                    <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
                      <h5 style={{ fontSize: '0.8rem', color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                        Refined Response Suggestion
                      </h5>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.5', backgroundColor: 'var(--bg-primary)', padding: '0.85rem 1rem', borderRadius: '6px', borderLeft: '3px solid var(--accent-indigo)' }}>
                        "{adaptiveStepFeedback.suggestedAnswer}"
                      </p>
                    </div>

                    {/* Follow-up Risk Areas */}
                    {adaptiveStepFeedback.riskAreas && adaptiveStepFeedback.riskAreas.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-muted)', paddingTop: '1rem' }}>
                        <h5 style={{ fontSize: '0.8rem', color: 'var(--error)', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                          Next Probable Triggers / Risk Areas
                        </h5>
                        <ul style={{ paddingLeft: '1.1rem', margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {adaptiveStepFeedback.riskAreas.map((risk, idx) => (
                            <li key={idx} style={{ marginBottom: '0.25rem' }}>{risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Input Area */}
              {!isCompleted && (
                <div style={{ padding: '0 1.25rem', borderTop: '1px solid var(--border-muted)', paddingTop: '1rem' }}>
                  <div className="stage-input-status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
                    <span className="rec-indicator" style={{ display: 'flex', height: '8px', width: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                      {isAISpeaking ? 'Interviewer is speaking...' : 'Listening. Speak or type your answer below'}
                    </span>
                  </div>
                  <textarea
                    className="form-input"
                    style={{ height: '70px', fontSize: '0.85rem', resize: 'none' }}
                    placeholder="Your answer will be captured automatically as you speak, or you can type here..."
                    value={candidateResponseText}
                    onChange={(e) => setCandidateResponseText(e.target.value)}
                    disabled={isAdaptiveStepLoading || isAISpeaking}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitAdaptiveResponse();
                      }
                    }}
                  />
                </div>
              )}

              {/* Controls */}
              <div className="meeting-controls" style={{ borderTop: '1px solid var(--border-muted)', padding: '1rem 1.25rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleFinishAdaptiveSession}
                  disabled={isAdaptiveStepLoading}
                >
                  {isCompleted ? 'Return to Dashboard' : 'End Early'}
                </button>
                
                {!isCompleted && (
                  <button
                    className="btn"
                    onClick={submitAdaptiveResponse}
                    disabled={isAdaptiveStepLoading || isAISpeaking || !candidateResponseText.trim()}
                  >
                    Submit Answer
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (step === STEPS.INTERVIEW) {
    return (
      <div className="app-wrapper">
        <header>
          <div className="brand">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
            <span>KGP Interview Prep</span>
            <span className="brand-sub">• Peer Prep Community</span>
          </div>
        </header>

        <main>
          <div className="meeting-layout">
            {/* STAGE AREA (LEFT) */}
            <div className="stage-container">
              <div className="stage-header">
                <span className="room-title">IIT-KGP-PREP-{selectedProfile.id.toUpperCase()}-ROUND</span>
                <div className="live-indicator">
                  <span className="live-dot" />
                  <span>REC LIVE</span>
                </div>
              </div>
              
              <div className="interviewer-viewport">
                {/* Silhouette SVG Avatar */}
                <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={`interviewer-graphic ${isAISpeaking ? 'speaking' : ''}`}>
                  <circle cx="100" cy="100" r="96" fill="#0b0b0d" stroke="#27272a" strokeWidth="1.5"/>
                  <circle cx="100" cy="80" r="28" fill="#27272a"/>
                  <path d="M52 145C52 124 72 114 100 114C128 114 148 124 148 145" stroke="#27272a" strokeWidth="6" strokeLinecap="round"/>
                </svg>

                {/* Animated Speech Soundwave */}
                <AudioWaveform isSpeaking={isAISpeaking} />

                {/* Local Camera Overlay */}
                <div className={`local-cam-feed ${!webcamActive ? 'no-video' : ''}`}>
                  {webcamActive ? (
                    <video ref={videoRef} autoPlay playsInline muted />
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '4px' }}>
                        <path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>
                      </svg>
                      <div>Camera Off</div>
                    </div>
                  )}
                  <div className="local-cam-label">Candidate (You)</div>
                </div>
              </div>
            </div>

            {/* SIDEBAR CONSOLE (RIGHT) */}
            <div className="console-container">
              <div className="console-header">
                <h3>Interview Transcript</h3>
                <span className="question-counter">Q: {questionCount} / {questionsList.length}</span>
              </div>

              <div className="transcript-viewport">
                {isAILoading && chatHistory.length === 0 && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Initializing secure connection to AI Interviewer...
                  </div>
                )}

                {chatHistory.map((msg, index) => (
                  <div key={index} className="transcript-message">
                    <span className={`msg-sender ${msg.role === 'model' ? 'interviewer' : 'candidate'}`}>
                      {msg.role === 'model' ? 'Interviewer' : `${name} (Candidate)`}
                    </span>
                    <p className={`msg-text ${msg.parts[0].text.includes('[Candidate Interrupted') ? 'interrupted' : ''}`}>
                      {msg.parts[0].text}
                    </p>
                  </div>
                ))}

                {isAILoading && chatHistory.length > 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    Interviewer is evaluating your response and preparing the next query...
                  </div>
                )}
              </div>

              {/* Status Indicator Banner */}
              <div className="status-ticker">
                <span className={`status-dot ${isAISpeaking || isAILoading ? '' : 'active'}`} />
                <span>
                  {isAILoading
                    ? 'AI is thinking...'
                    : isAISpeaking
                    ? 'Interviewer is speaking (Talk to interrupt)'
                    : isInterrupted
                    ? 'Interrupted! Speak your answer now'
                    : 'Listening. Speak your answer or edit below'}
                </span>
              </div>

              {/* User Response Area */}
              <div style={{ padding: '1.25rem 1.25rem 0 1.25rem' }}>
                <textarea
                  className="form-input"
                  style={{ height: '70px', fontSize: '0.85rem', resize: 'none' }}
                  placeholder="Your answer will appear here as you speak. You can also edit it manually before submitting..."
                  value={candidateResponseText}
                  onChange={(e) => setCandidateResponseText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitResponse();
                    }
                  }}
                  disabled={isAILoading}
                />
              </div>

              {/* Controls */}
              <div className="meeting-controls">
                <button
                  className="btn btn-secondary"
                  onClick={handleEndInterviewEarly}
                  disabled={isAILoading}
                >
                  End Session
                </button>
                <button
                  className="btn"
                  onClick={submitResponse}
                  disabled={isAILoading || (!candidateResponseText.trim() && !isAILoading)}
                >
                  Submit Answer
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (step === STEPS.REPORT) {
    return (
      <div className="app-wrapper">
        <header>
          <div className="brand">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/>
              <line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
            <span>KGP Interview Prep</span>
            <span className="brand-sub">• Peer Prep Community</span>
          </div>
        </header>

        <main>
          {isAILoading ? (
            <div style={{ padding: '4rem 0', textAlign: 'center' }}>
              <h2 className="title-medium" style={{ marginBottom: '1rem' }}>Generating Interview Assessment</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto' }}>
                The Student Mentor agent is analyzing your technical depth, interruption recovery, and verbal structuring. This takes up to 10 seconds...
              </p>
            </div>
          ) : (
            <div>
              <div className="report-header-sec">
                <h2 className="title-large">Interview Assessment Report</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Interview Profile: {selectedProfile.name} for candidate {name}</p>
              </div>

              <div className="report-grid">
                {/* Detailed Analysis (Left) */}
                <div>
                  {/* Executive Summary */}
                  <div className="form-card summary-card" style={{ marginBottom: '2rem' }}>
                    <h4 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-accent)' }}>Executive Summary</h4>
                    <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>{report?.executiveSummary}</p>
                  </div>

                  {/* Methodology */}
                  <div className="form-card" style={{ marginBottom: '2rem' }}>
                    <h4 className="title-medium" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Methodology & Assessment Rubrics</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{report?.methodology}</p>
                  </div>

                  {/* Key Findings */}
                  <div className="form-card" style={{ marginBottom: '2rem' }}>
                    <h4 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Key Assessor Findings</h4>
                    <div>
                      {report?.keyFindings?.map((find, i) => (
                        <div key={i} className="list-item" style={{ marginBottom: '0.75rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-accent)' }}>
                            <line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/>
                          </svg>
                          <span style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>{find}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Detailed Analysis (Question-by-Question) */}
                  <div className="qa-review-sec" style={{ marginBottom: '2rem' }}>
                    <h3 className="title-medium" style={{ marginBottom: '1.25rem' }}>Detailed Answer Analysis</h3>
                    {report?.detailedFeedback?.map((item, idx) => (
                      <div key={idx} className="qa-item" style={{ marginBottom: '1.5rem', borderRadius: '8px' }}>
                        <div className="qa-header">
                          <span className="qa-title">QUESTION {idx + 1}</span>
                          <span className="qa-score">Competence Score: {item.score}/100</span>
                        </div>
                        <div className="qa-body">
                          <div className="qa-text-group">
                            <div className="qa-label">Interviewer Query</div>
                            <div className="qa-value" style={{ fontWeight: '500' }}>{item.question}</div>
                          </div>
                          <div className="qa-text-group">
                            <div className="qa-label">Your Response</div>
                            <div className="qa-value" style={{ color: 'var(--text-primary)', fontStyle: item.answer.includes('[Candidate Interrupted') ? 'italic' : 'normal' }}>{item.answer}</div>
                          </div>

                          <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)', margin: '1.25rem 0' }} />

                          <div className="qa-text-group">
                            <div className="qa-label" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              What was found
                            </div>
                            <div className="qa-value" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{item.whatWasFound}</div>
                          </div>

                          <div className="qa-text-group">
                            <div className="qa-label" style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                              </svg>
                              Why it matters
                            </div>
                            <div className="qa-value" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{item.whyItMatters}</div>
                          </div>

                          <div className="qa-text-group">
                            <div className="qa-label" style={{ color: 'var(--text-accent)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                              </svg>
                              Potential Implications
                            </div>
                            <div className="qa-value" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{item.implications}</div>
                          </div>

                          <div className="qa-text-group" style={{ backgroundColor: 'var(--bg-primary)', padding: '0.75rem 1rem', borderRadius: '6px', borderLeft: '2px solid var(--border-focus)', marginTop: '1rem' }}>
                            <div className="qa-label" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Assessor Confidence & Assessment Limitations</div>
                            <div className="qa-value" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{item.confidenceLevel}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Insights & Patterns */}
                  <div className="form-card" style={{ marginBottom: '2rem' }}>
                    <h4 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Observed Insights & Cognitive Patterns</h4>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{report?.insightsPatterns}</p>
                  </div>

                  {/* Recommendations */}
                  <div className="form-card" style={{ marginBottom: '2rem' }}>
                    <h4 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Actionable Assessment Recommendations</h4>
                    <div>
                      {report?.recommendations?.map((rec, i) => (
                        <div key={i} className="list-item" style={{ marginBottom: '0.75rem' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--success)' }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <span style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Limitations & Constraints */}
                  <div className="form-card" style={{ marginBottom: '2rem', borderLeft: '3px solid var(--border-focus)' }}>
                    <h4 className="title-medium" style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Session Assessment Limitations</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{report?.limitations}</p>
                  </div>

                  {/* Conclusion */}
                  <div className="form-card" style={{ marginBottom: '2rem', borderTop: '2px solid var(--border-muted)' }}>
                    <h4 className="title-medium" style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>Assessor Conclusion</h4>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{report?.conclusion}</p>
                  </div>

                  <div className="actions-row" style={{ marginTop: '2.5rem' }}>
                    <button onClick={handleRestart} className="btn">
                      Return to Dashboard
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Summary Dashboard Column (Right) */}
                <div className="score-panel" style={{ position: 'sticky', top: '2rem' }}>
                  <h4 className="title-medium" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontWeight: '500' }}>Overall Performance Score</h4>
                  
                  <div className="radial-score">
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r="60" fill="transparent" stroke="var(--border-muted)" strokeWidth="8" />
                      <circle
                        cx="70"
                        cy="70"
                        r="60"
                        fill="transparent"
                        stroke={report?.overallScore >= 75 ? 'var(--success)' : report?.overallScore >= 50 ? 'var(--warning)' : 'var(--error)'}
                        strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 60}
                        strokeDashoffset={2 * Math.PI * 60 * (1 - (report?.overallScore || 0) / 100)}
                        strokeLinecap="round"
                        transform="rotate(-90 70 70)"
                      />
                    </svg>
                    <div className="score-text">
                      <span className="score-num">{report?.overallScore || 0}</span>
                      <span className="score-denom">Percent</span>
                    </div>
                  </div>
                  
                  <div className="competence-metrics" style={{ width: '100%', marginTop: '2rem', textAlign: 'left' }}>
                    <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: '600' }}>Core Competencies</h5>
                    
                    {[
                      { label: 'Technical Depth', val: report?.metrics?.technicalDepth || 70, color: 'var(--text-accent)' },
                      { label: 'Communication Clarity', val: report?.metrics?.communicationClarity || 70, color: 'var(--success)' },
                      { label: 'Problem Solving', val: report?.metrics?.problemSolving || 70, color: 'var(--warning)' },
                      { label: 'Poise & Structure', val: report?.metrics?.poiseAndStructure || 70, color: 'var(--error)' }
                    ].map((met, i) => (
                      <div key={i} className="metric-row" style={{ marginBottom: '1.25rem' }}>
                        <div className="flex-between" style={{ marginBottom: '0.35rem', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{met.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: '600' }}>{met.val}/100</span>
                        </div>
                        <div style={{ height: '6px', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${met.val}%`, backgroundColor: met.color, borderRadius: '3px' }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)', width: '100%', margin: '1.5rem 0' }} />
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Grading scale calibrated in alignment with peer performance levels across the IIT Kharagpur student community.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return null;
}
