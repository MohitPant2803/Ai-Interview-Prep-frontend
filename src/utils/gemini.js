/**
 * Utility module for interacting with the Gemini API
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Shared helper for calling the Gemini API with retry and backoff.
 * @param {string} apiKey 
 * @param {string} prompt 
 * @param {Object} [generationConfig] 
 * @param {number} [maxRetries=3] 
 * @returns {Promise<any>} Response JSON data
 */
async function callGeminiAPI(apiKey, prompt, generationConfig = {}, maxRetries = 3) {
  let delay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            ...generationConfig
          }
        })
      });

      if (response.ok) {
        return await response.json();
      }

      // Retry on 429 (rate limit) or 503 (service unavailable)
      if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
        console.warn(`Gemini API returned status ${response.status}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || `API returned status code ${response.status}`;
      throw new Error(msg);

    } catch (error) {
      // Retry on network errors
      if (error.name === 'TypeError' && attempt < maxRetries) {
        console.warn(`Gemini API connection error: ${error.message}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
}

/**
 * Checks if the provided Gemini API key is valid by making a simple request
 * @param {string} apiKey 
 * @returns {Promise<Object>} { valid: boolean, error?: string }
 */
export async function validateApiKey(apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, error: 'API Key cannot be empty.' };
  }
  
  try {
    // Optimisation: use GET models.list to validate the API key without consuming generation quota
    const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(listModelsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      return { valid: true };
    } else {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || `API returned status code ${response.status}`;
      return { valid: false, error: msg };
    }
  } catch (error) {
    console.error('API Key validation error:', error);
    return { valid: false, error: error.message || 'Network error: Failed to connect to Gemini API. Check your internet connection.' };
  }
}

/**
 * Generates all 3 questions at the start of the interview
 * @param {string} apiKey 
 * @param {Object} profile - { name, role, details }
 * @param {number} numQuestions
 * @returns {Promise<Array<string>>}
 */
export async function generateQuestionsList(apiKey, profile, numQuestions = 3) {
  const prompt = `You are a professional and supportive interview guide at IIT Kharagpur (IIT KGP).
Generate exactly ${numQuestions} structured, professional, and challenging interview questions for a candidate named "${profile.name}" applying for the role of "${profile.role}".
${profile.details ? `The candidate has the following resume/skills: "${profile.details}"` : ''}

The questions should follow this progression:
1. First question: A welcoming, professional introduction and warm-up question.
2. Intermediate questions (${numQuestions - 2} questions): A mix of deep technical/core questions, problem solving, system design, or engineering design questions exploring their domain.
3. Last question: A challenging behavioral, leadership, or situational problem-solving question.

Each question must be concise and direct (maximum 2 sentences).

You MUST respond with a valid JSON array of exactly ${numQuestions} strings representing these questions. Example format:
[
  "Question 1 text...",
  ...
]`;

  try {
    const data = await callGeminiAPI(apiKey, prompt, {
      temperature: 0.8,
      responseMimeType: 'application/json'
    });

    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error('Empty response from questions list API');

    const list = JSON.parse(jsonText);
    if (!Array.isArray(list) || list.length < numQuestions) {
      throw new Error(`API did not return at least ${numQuestions} questions`);
    }
    return list.slice(0, numQuestions).map(q => q.trim());
  } catch (error) {
    console.error('Error generating questions list:', error);
    // Highly tailored fallback questions
    const fallbacks = [
      `Welcome to your mock interview simulation, ${profile.name}. To begin, could you briefly introduce yourself and tell me why you are interested in the ${profile.role} role?`,
      `Thank you. Can you explain a challenging technical problem you solved recently in a project or assignment, and how you evaluated the trade-offs?`,
      `Let's discuss systems/project design. How would you design a scalable solution for a bottleneck or resource constraint you've encountered?`,
      `Can you talk about a time when you had a disagreement with a team member or mentor? How did you approach the conversation to resolve it?`,
      `If you were given a task with completely ambiguous requirements and a tight deadline, what structured approach would you take to deliver results?`,
      `How do you keep yourself updated with the latest technological developments or research in the ${profile.role} domain?`,
      `Finally, describe a situation where you had to work under a tight deadline or deal with conflicting priorities in a team. How did you manage it?`
    ];
    let resultFallbacks = [];
    if (numQuestions <= 3) {
      resultFallbacks = [fallbacks[0], fallbacks[1], fallbacks[6]];
    } else {
      resultFallbacks.push(fallbacks[0]);
      // Note: If numQuestions > 7, this fallback loop will start repeating the generic placeholder question 
      // since the 'fallbacks' array only contains 7 elements. This is fine as a defensive last resort.
      for (let i = 1; i < numQuestions - 1; i++) {
        resultFallbacks.push(fallbacks[i] || `Could you explain another key project or technical concept listed in your profile?`);
      }
      resultFallbacks.push(fallbacks[6]);
    }
    return resultFallbacks.slice(0, numQuestions).map(q => q.trim());
  }
}

/**
 * Evaluates the full interview transcript and returns a structured feedback report in JSON format
 * @param {string} apiKey 
 * @param {Array} chatHistory 
 * @param {Object} profile 
 * @returns {Promise<Object>}
 */
export async function generateFeedbackReport(apiKey, chatHistory, profile) {
  const evaluationPrompt = `You are an expert student mentor and peer reviewer representing the IIT Kharagpur campus community, partnering with experienced student mentors to evaluate candidate readiness.
Analyze the following interview transcript and generate an exhaustive, detailed, and professional performance evaluation report.
Candidate Name: ${profile.name}
Role Interviewed For: ${profile.role}
Resume Details: ${profile.details || 'None provided'}

Analyze the conversation flow and answers given. Assess technical depth, problem-solving skills, communication clarity, and poise. Do not write a generic summary. Be honest, rigorous, and highly analytical.

You MUST respond with a valid JSON object matching the following structure exactly:
{
  "overallScore": 85, // A score out of 100 based on standard KGP student community rubrics
  "metrics": {
    "technicalDepth": 80, // score out of 100
    "communicationClarity": 85, // score out of 100
    "problemSolving": 75, // score out of 100
    "poiseAndStructure": 90 // score out of 100
  },
  "executiveSummary": "A highly detailed, 2-3 sentence overview analyzing the candidate's absolute suitability for the target role, explaining high-level strengths and growth areas.",
  "methodology": "Explain the rubrics and methodology used to evaluate this transcript (such as STAR method structure, depth checks, and poise under simulated interruption).",
  "keyFindings": [
    "Detailed finding 1 (e.g. Demonstrates solid proficiency in technical databases but lacks confidence in detailing tradeoffs)",
    "Detailed finding 2 (e.g. Highly structured verbal presentation, structured using logical frameworks)"
  ],
  "detailedFeedback": [
    {
      "question": "The interviewer's question",
      "answer": "The candidate's answer",
      "whatWasFound": "A detailed assessment of what the candidate actually expressed. Point out specific elements they answered correctly and key parameters they omitted.",
      "whyItMatters": "Why this specific core competence or concept is absolutely critical to demonstrate for the target role.",
      "implications": "What this answer implies about the candidate's capacity to perform under real-world pressure or corporate expectations.",
      "confidenceLevel": "Describe the assessor's confidence in this specific answer assessment (e.g., High - clear and complete verbal articulation, or Medium - brief answer leaves minor ambiguity) and any limitations.",
      "score": 80 // score out of 100
    }
  ],
  "insightsPatterns": "Examine overall communication patterns, behavioral trends, cognitive loops, and recurring strengths/weaknesses observed across all 3 answers.",
  "recommendations": [
    "Actionable, technical recommendation 1 with concrete steps (e.g. Study OS deadlock prevention algorithms and practise writing mutex logic)",
    "Actionable, behavioral recommendation 2 (e.g. Practise pacing answers to 90 seconds to avoid rushed conclusions)"
  ],
  "limitations": "Detail any limitations of this specific AI simulation (such as voice-to-text spelling errors, lack of non-verbal body language analysis, and restricted time constraints).",
  "conclusion": "Final assessment verdict and strategic preparation outlook for the candidate."
}

Here is the complete interview transcript:
${JSON.stringify(chatHistory, null, 2)}`;

  try {
    const data = await callGeminiAPI(apiKey, evaluationPrompt, {
      temperature: 0.2,
      responseMimeType: 'application/json',
      maxOutputTokens: 8192
    });

    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error('Empty response from report API');

    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Error generating feedback report:', error);
    // Return a fallback object matching the new expanded structure so the UI doesn't crash
    const detailedFeedback = [];
    for (let i = 0; i < chatHistory.length; i++) {
      const msg = chatHistory[i];
      if (msg.role === 'model') {
        let userMsgText = "(No verbal response captured)";
        for (let j = i + 1; j < chatHistory.length; j++) {
          if (chatHistory[j].role === 'user') {
            userMsgText = chatHistory[j].parts?.[0]?.text || userMsgText;
            break;
          }
        }
        detailedFeedback.push({
          question: msg.parts?.[0]?.text || '',
          answer: userMsgText,
          whatWasFound: "Successfully recorded answer transcript.",
          whyItMatters: "Every response reflects your core interview preparation progress.",
          implications: "Manual review is recommended due to an automated parsing limit.",
          confidenceLevel: "Medium - evaluated from raw text transcripts.",
          score: 70
        });
      }
    }

    return {
      overallScore: 70,
      metrics: {
        technicalDepth: 70,
        communicationClarity: 75,
        problemSolving: 68,
        poiseAndStructure: 72
      },
      executiveSummary: "We encountered an issue parsing the feedback automatically, but your transcript is saved. Overall, you showed solid knowledge, but could improve depth in technical responses.",
      methodology: "Simulated evaluation rubric assessing communication, technical content, and problem solving based on Web Speech transcription.",
      keyFindings: [
        "Participated in the interview process actively",
        "Communicated technical background",
        "API evaluation parsed with errors"
      ],
      detailedFeedback,
      insightsPatterns: "The transcript shows active engagement, but automated sentiment and competence indicators failed to process due to a connection or formatting issue.",
      recommendations: [
        "Review your transcript text in the sidebar manually",
        "Ensure your internet connection is stable and try again"
      ],
      limitations: "This assessment was generated using fallback data due to a failure to parse the model's raw JSON feedback response.",
      conclusion: "Mock session completed. Recommend self-evaluating against the saved transcript logs."
    };
  }
}

/**
 * Evaluates the latest answer in an adaptive conversational step and generates feedback + the next question
 */
export async function generateAdaptiveStepFeedback(apiKey, moduleName, chatHistory, cvText, candidateName, profileName) {
  const prompt = `You are a professional student mentor and senior interviewer at IIT Kharagpur (IIT KGP).
You are conducting an adaptive, conversational behavioral interview for a candidate named "${candidateName}" who is preparing for the role "${profileName}".
We are currently practicing the specific preparation module: "${moduleName}".

Candidate's Resume/CV Context:
"${cvText || 'None provided'}"

Here is the conversation history so far:
${JSON.stringify(chatHistory, null, 2)}

Your goals:
1. Act as a realistic interviewer.
2. Evaluate the candidate's last answer in the transcript.
3. Determine whether to ask an adaptive follow-up question or conclude this session.
   - Limit the total number of questions in this practice module to 4 (1 primary question + at most 3 follow-ups).
   - If the candidate's answer is strong or we've reached the limit, you can transition to ending the session (shouldEnd: true).
   - If the candidate's answer is weak, or they mention something interesting, generate an adaptive, conversational follow-up question (shouldEnd: false).
4. Provide structured feedback for their *latest answer* only.

You MUST respond with a valid JSON object matching the following structure exactly:
{
  "feedback": {
    "scores": {
      "communication": 8, // score out of 10
      "clarity": 8,       // score out of 10
      "technicalDepth": 7,// score out of 10
      "confidence": 9     // score out of 10
    },
    "strengths": [
      "Point 1...",
      "Point 2..."
    ],
    "improvements": [
      "Point 1...",
      "Point 2..."
    ],
    "suggestedAnswer": "A highly refined, professional version of the candidate's answer that preserves their core ideas and style, but sounds polished, structured, and quantifies impact.",
    "riskAreas": [
      "Likely follow-up question 1...",
      "Likely follow-up question 2..."
    ]
  },
  "nextQuestion": "Your conversational follow-up question here (maximum 2 sentences). Set to null if shouldEnd is true.",
  "shouldEnd": false // true if the module session is complete
}`;

  try {
    const data = await callGeminiAPI(apiKey, prompt, {
      temperature: 0.8,
      responseMimeType: 'application/json'
    });

    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error('Empty response from adaptive feedback API');

    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Error generating adaptive step feedback:', error);
    // Propagate the error to be handled explicitly by the caller in the UI
    throw error;
  }
}

/**
 * Generates the first question for an adaptive mock interview session
 * @param {string} apiKey
 * @param {Object} moduleItem
 * @param {string} cvText
 * @param {string} profileName
 * @returns {Promise<string>}
 */
export async function generateAdaptiveStartQuestion(apiKey, moduleItem, cvText, profileName) {
  const exampleAreas = moduleItem.questions ? moduleItem.questions.join('; ') : '';

  const prompt = `You are a mock placement interviewer for a ${profileName} role.
${cvText.trim() ? `Candidate's CV/Resume text:\n"${cvText}"` : 'No CV text was provided, so ask a general but role-appropriate question.'}

We are starting a behavioral/technical mock interview practice module focused on: "${moduleItem.title}" (${moduleItem.desc}).
${exampleAreas ? `Example areas/topics this module typically covers: ${exampleAreas}.` : ''}

Generate exactly one customized starting question for this candidate. The question must:
1. Directly relate to their CV details, projects, internships, leadership roles, or background if applicable.
2. Be tailored to the ${profileName} context.
3. If the module is personal (like Self Introduction, Strengths/Weaknesses, or Motivation), tie it to their background or their experiences at IIT Kharagpur if appropriate.
4. Sound natural, professional, and conversational.
5. Be 1-2 direct sentences max.

Do not include any introductory remarks, metadata, or multiple choices. Return ONLY the question text itself.`;

  try {
    const data = await callGeminiAPI(apiKey, prompt, {
      temperature: 0.8
    });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text.trim();
  } catch (error) {
    console.warn(`Failed to generate initial question with CV prompt, trying fallback simple prompt...`, error);
    // Fallback simple prompt
    const fallbackPrompt = `You are a mock placement interviewer for a ${profileName} role.
We are starting a behavioral/technical mock interview practice module focused on: "${moduleItem.title}" (${moduleItem.desc}).
${exampleAreas ? `Example areas/topics this module typically covers: ${exampleAreas}.` : ''}

Generate exactly one starting question for this module. The question must:
1. Be tailored to the ${profileName} context.
2. Sound natural, professional, and conversational.
3. Be 1-2 direct sentences max.

Do not include any introductory remarks, metadata, or multiple choices. Return ONLY the question text itself.`;

    const data = await callGeminiAPI(apiKey, fallbackPrompt, {
      temperature: 0.8
    });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from fallback Gemini call');
    return text.trim();
  }
}
