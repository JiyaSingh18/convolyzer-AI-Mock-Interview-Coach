import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the server directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Get the API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-1.5-flash";

// Default questions for fallback scenarios
function createDefaultQuestions(topic: string, role: string, numQuestions: number = 3, mode: string = 'technical') {
  const isTechnicalMode = mode === 'technical' || mode === 'system_design';
  
  const defaultQuestions = isTechnicalMode ? (() => {
    const topicLower = topic.toLowerCase();
    
    // Kubernetes-specific questions
    if (topicLower.includes('kubernetes') || topicLower.includes('k8s')) {
      return [
        {
          question: `How would you implement a Kubernetes pod scheduler that prioritizes nodes based on CPU and memory availability, while respecting node affinity rules? What's the time complexity of your scheduling algorithm?`,
          purpose: "To assess coding skills, algorithm knowledge, and complexity analysis in Kubernetes context.",
          follow_ups: ["Can you optimize this further?", "How would you handle edge cases like node failures?", "What data structures would you use for efficient node selection?"]
        },
        {
          question: `Design a Kubernetes service discovery mechanism that can handle 10,000 pods with sub-second latency. How would you handle pod failures and network partitions?`,
          purpose: "To evaluate system design skills and architectural thinking for distributed systems.",
          follow_ups: ["What are the potential bottlenecks?", "How would you handle failures?", "What trade-offs would you make between consistency and availability?"]
        },
        {
          question: `Explain how Kubernetes implements rolling updates for deployments. Walk me through the implementation details and how you would optimize it to minimize downtime during updates of a stateful application.`,
          purpose: "To test deep understanding of Kubernetes core concepts and implementation knowledge.",
          follow_ups: ["What are the limitations of rolling updates?", "How would you improve the update process?", "What alternatives exist for zero-downtime deployments?"]
        },
        {
          question: `Debug a Kubernetes cluster where pods are stuck in Pending state. Walk me through your troubleshooting process and the tools you would use.`,
          purpose: "To assess debugging skills, problem-solving approach, and technical troubleshooting in Kubernetes.",
          follow_ups: ["What metrics would you monitor?", "How would you identify the root cause?", "What would be your optimization strategy?"]
        },
        {
          question: `How would you optimize Kubernetes resource quotas to prevent resource starvation while maximizing cluster utilization? What's your approach to dynamic quota allocation?`,
          purpose: "To evaluate resource management knowledge, algorithm design, and understanding of trade-offs.",
          follow_ups: ["What's the time complexity for quota calculations?", "When would you use static vs dynamic quotas?", "How would you test your quota system?"]
        }
      ];
    }
    // React-specific questions
    else if (topicLower.includes('react')) {
      return [
        {
          question: `Implement a React hook that manages complex form state with validation, debouncing, and async submission. What's the time complexity of your validation logic?`,
          purpose: "To assess React hooks knowledge, state management, and algorithm complexity.",
          follow_ups: ["Can you optimize this further?", "How would you handle edge cases?", "What patterns would you use?"]
        },
        {
          question: `Design a React component architecture for a real-time dashboard that updates 100+ widgets every second. How would you optimize re-renders?`,
          purpose: "To evaluate React performance optimization and architectural thinking.",
          follow_ups: ["What are the potential bottlenecks?", "How would you handle failures?", "What trade-offs would you make?"]
        },
        {
          question: `Explain how React's reconciliation algorithm works internally. How would you optimize a component tree with 1000+ nested components?`,
          purpose: "To test deep understanding of React core concepts and implementation knowledge.",
          follow_ups: ["What are the limitations?", "How would you improve it?", "What alternatives exist?"]
        },
        {
          question: `Debug a React application with memory leaks caused by event listeners. What tools would you use and how would you fix it?`,
          purpose: "To assess debugging skills, problem-solving approach, and technical troubleshooting.",
          follow_ups: ["What metrics would you monitor?", "How would you identify the root cause?", "What would be your optimization strategy?"]
        },
        {
          question: `How would you implement a virtual scrolling list in React that can handle 1 million items efficiently? What are the trade-offs?`,
          purpose: "To evaluate performance optimization knowledge, algorithm design, and understanding of trade-offs.",
          follow_ups: ["What's the time complexity for rendering?", "When would you use this vs alternatives?", "How would you test it?"]
        }
      ];
    }
    // Generic technical questions
    else {
      return [
        {
          question: `Implement a function to solve a specific ${topic} problem like performance bottlenecks or scalability issues. What is the time and space complexity?`,
          purpose: "To assess coding skills, algorithm knowledge, and complexity analysis.",
          follow_ups: ["Can you optimize this further?", "How would you handle edge cases?", "What data structures would you use?"]
        },
        {
          question: `How would you design a system using ${topic} to handle 1 million requests per second with 99.9% uptime? Consider performance, reliability, and scalability.`,
          purpose: "To evaluate system design skills and architectural thinking.",
          follow_ups: ["What are the potential bottlenecks?", "How would you handle failures?", "What trade-offs would you make?"]
        },
        {
          question: `Explain how a core ${topic} concept works internally. Walk me through the implementation details and how you would optimize it.`,
          purpose: "To test deep understanding of core concepts and implementation knowledge.",
          follow_ups: ["What are the limitations?", "How would you improve it?", "What alternatives exist?"]
        },
        {
          question: `Debug a production ${topic} deployment failure. Walk me through your troubleshooting process and the tools you would use.`,
          purpose: "To assess debugging skills, problem-solving approach, and technical troubleshooting.",
          follow_ups: ["What metrics would you monitor?", "How would you identify the root cause?", "What would be your optimization strategy?"]
        },
        {
          question: `Design a data structure or algorithm to efficiently handle ${topic} operations. What are the trade-offs?`,
          purpose: "To evaluate data structure knowledge, algorithm design, and understanding of trade-offs.",
          follow_ups: ["What's the time complexity for each operation?", "When would you use this vs alternatives?", "How would you test it?"]
        }
      ];
    }
  })() : [
    {
      question: `Tell me about your experience with ${topic}.`,
      purpose: "To understand the candidate's background and experience with the topic.",
      follow_ups: ["Can you describe a specific challenge you faced?", "What skills did you develop?"]
    },
    {
      question: `What do you consider the most important aspect of ${topic} for a ${role}?`,
      purpose: "To assess the candidate's knowledge and priorities.",
      follow_ups: ["Why do you think that's important?", "How have you applied this in your work?"]
    },
    {
      question: `How do you stay updated with the latest developments in ${topic}?`,
      purpose: "To evaluate the candidate's commitment to continuous learning.",
      follow_ups: ["What resources do you use?", "What recent development interested you most?"]
    },
    {
      question: `Describe a situation where you had to solve a complex problem related to ${topic}.`,
      purpose: "To understand problem-solving skills and application of knowledge.",
      follow_ups: ["What approach did you take?", "What was the outcome?"]
    },
    {
      question: `Where do you see the future of ${topic} heading in the next few years?`,
      purpose: "To assess forward-thinking and awareness of industry trends.",
      follow_ups: ["How are you preparing for these changes?", "What opportunities do you see?"]
    }
  ];
  
  // Return the requested number of questions, cycling through if we need more
  let result = [];
  for (let i = 0; i < numQuestions; i++) {
    result.push(defaultQuestions[i % defaultQuestions.length]);
  }
  return result;
}

// Helper to safely generate content with error handling
async function generateSafely(generationFn: Function) {
  try {
    return await generationFn();
  } catch (error) {
    console.error("Error during generation:", error);
    return null;
  }
}

/**
 * Generates a set of interview questions based on topic, role, and mode
 * @param topic The topic of the interview
 * @param role The role being interviewed for
 * @param mode The interview mode (technical, behavioral, etc.)
 * @param numQuestions Number of questions to generate (default: 3)
 * @returns An object containing opening questions
 */
export async function generateInterviewQuestions(topic: string, role: string, mode: string, numQuestions: number = 3) {
  console.log(`Using model: ${MODEL_NAME} with v1 API`);
  console.log(`Using API key: ${GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 10) + '...' : 'none'}`);
  console.log(`Generating ${numQuestions} questions for topic: ${topic}, role: ${role}, mode: ${mode}`);
  
  // Validate numQuestions
  if (!numQuestions || isNaN(numQuestions) || numQuestions < 1 || numQuestions > 10) {
    console.warn(`Invalid numQuestions: ${numQuestions}, using default of 3`);
    numQuestions = 3;
  }

  try {
    // Check if API key is available
    if (!GEMINI_API_KEY) {
      console.warn("No Gemini API key found. Using default questions.");
      const fallbackQuestions = createDefaultQuestions(topic, role, numQuestions, mode);
      return {
        interview_questions: {
          opening_questions: fallbackQuestions
        }
      };
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const generationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    };

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      }
    ];

    // Create a structured prompt that ensures EXACTLY numQuestions questions
    // For technical mode, generate deep technical questions
    const isTechnicalMode = mode === 'technical' || mode === 'system_design';
    
    const technicalPromptInstructions = isTechnicalMode ? `
CRITICAL: For technical interviews, generate DEEP, HANDS-ON technical questions that test:
- Specific technical knowledge and implementation details
- Problem-solving with code/algorithms/architecture
- Understanding of core concepts, data structures, algorithms
- Real-world technical scenarios and edge cases
- System design, scalability, performance considerations
- Debugging and troubleshooting skills

AVOID generic questions like:
- "Tell me about your experience with X"
- "How do you stay updated with X"
- "What is your experience with X"
- "Describe your background in X"

INSTEAD, ask questions like:
- "Implement a function that does X with Y constraints"
- "How would you design a system to handle X at scale?"
- "Explain the time complexity of algorithm X and optimize it"
- "What happens when X occurs in system Y? How would you debug it?"
- "Design a data structure to efficiently handle X operations"
- "How would you optimize X for better performance?"

Make questions specific, technical, and require deep knowledge.` : '';

    const prompt = isTechnicalMode ? `You are generating technical interview questions for a ${role} position about ${topic}.

CRITICAL REQUIREMENTS - READ CAREFULLY:
1. Generate EXACTLY ${numQuestions} DEEP TECHNICAL questions
2. These MUST be hands-on coding/implementation/system design questions
3. ABSOLUTELY FORBIDDEN - DO NOT generate generic questions like:
   - "Tell me about your experience with ${topic}"
   - "How do you stay updated with ${topic}"
   - "What is your experience with ${topic}"
   - "Describe your background in ${topic}"
   - "What do you know about ${topic}"
   - Any question starting with "Tell me about", "How do you", "What is your experience"

4. ABSOLUTELY FORBIDDEN - DO NOT use placeholders like [specific X], [requirement], [problem], [scenario], [operation], [concept], [algorithm]. 
   You MUST provide COMPLETE, SPECIFIC questions with actual technical details filled in.

5. REQUIRED - Generate questions that:
   - Ask for code implementation: "Implement a function/algorithm to [ACTUAL SPECIFIC TASK]"
   - Ask for system design: "Design a system to handle [ACTUAL SPECIFIC REQUIREMENT]"
   - Ask for problem-solving: "How would you solve [ACTUAL SPECIFIC PROBLEM] with [ACTUAL CONSTRAINTS]?"
   - Ask for technical deep-dives: "Explain how [ACTUAL SPECIFIC CONCEPT/ALGORITHM] works internally and optimize it"
   - Ask for debugging: "How would you debug and fix [ACTUAL SPECIFIC ISSUE]?"
   - Ask for optimization: "Optimize [ACTUAL SPECIFIC ALGORITHM/DATA STRUCTURE] for [ACTUAL SPECIFIC GOAL]"
   - Require specific technical knowledge and coding skills
   - Test understanding of algorithms, data structures, complexity analysis
   - Test system design, scalability, performance considerations

6. Make questions SPECIFIC to ${topic} - use actual technical concepts, tools, frameworks, or problems related to ${topic}.
   For example, if ${topic} is "Kubernetes", ask about actual Kubernetes concepts like:
   - Pod scheduling algorithms
   - Service discovery mechanisms
   - Resource quotas and limits
   - Deployment strategies (rolling updates, blue-green)
   - ConfigMaps and Secrets management
   - Network policies
   - Persistent volumes
   - etc.

7. Each question must be COMPLETE and READY TO ASK - no placeholders, no brackets, no [specific X] text.

Example GOOD questions for ${topic} (create similar questions but specific to ${topic}):
${topic.toLowerCase().includes('kubernetes') || topic.toLowerCase().includes('k8s') ? `
- "How would you implement a Kubernetes pod scheduler that prioritizes nodes based on CPU and memory availability, while respecting node affinity rules? What's the time complexity of your scheduling algorithm?"
- "Design a Kubernetes service discovery mechanism that can handle 10,000 pods with sub-second latency. How would you handle pod failures and network partitions?"
- "Explain how Kubernetes implements rolling updates for deployments. How would you optimize it to minimize downtime during updates of a stateful application?"
- "Debug a Kubernetes cluster where pods are stuck in Pending state. Walk me through your troubleshooting process and the tools you would use."
- "How would you optimize Kubernetes resource quotas to prevent resource starvation while maximizing cluster utilization?"` :
topic.toLowerCase().includes('react') || topic.toLowerCase().includes('frontend') ? `
- "Implement a React hook that manages complex form state with validation, debouncing, and async submission. What's the time complexity of your validation logic?"
- "Design a React component architecture for a real-time dashboard that updates 100+ widgets every second. How would you optimize re-renders?"
- "Explain how React's reconciliation algorithm works. How would you optimize a component tree with 1000+ nested components?"
- "Debug a React application with memory leaks caused by event listeners. What tools would you use and how would you fix it?"
- "How would you implement a virtual scrolling list in React that can handle 1 million items efficiently?"` :
topic.toLowerCase().includes('node') || topic.toLowerCase().includes('backend') ? `
- "Implement a Node.js function that processes 1 million JSON records concurrently with rate limiting. What's the time and space complexity?"
- "Design a Node.js microservices architecture that can handle 100,000 requests per second. How would you handle service discovery and load balancing?"
- "Explain how Node.js event loop handles async operations. How would you optimize a CPU-intensive task in a Node.js application?"
- "Debug a Node.js application with memory leaks in a production environment. What profiling tools would you use and what would you look for?"
- "How would you implement a distributed caching layer in Node.js that ensures data consistency across multiple instances?"` :
topic.toLowerCase().includes('python') ? `
- "Implement a Python function that finds the longest common subsequence between two strings using dynamic programming. What's the time and space complexity? How would you optimize it?"
- "Design a Python-based distributed task queue system that can handle 1 million tasks per hour. How would you ensure task reliability and handle failures?"
- "Explain how Python's GIL (Global Interpreter Lock) affects multithreading. How would you optimize a CPU-bound Python application?"
- "Debug a Python application with memory leaks caused by circular references. What tools would you use and how would you fix it?"
- "How would you optimize a Python data processing pipeline that processes 10GB of CSV files daily?"` :
`
- "Implement a function to solve a specific ${topic} problem. Provide the complete algorithm with time and space complexity analysis."
- "Design a system using ${topic} that can handle high-scale requirements. Explain your architecture and trade-offs."
- "Explain how a core ${topic} concept works internally. How would you optimize it for better performance?"
- "Debug a production ${topic} issue. Walk me through your troubleshooting methodology."
- "How would you optimize a ${topic} implementation for better scalability and performance?"`}

Format your response as valid JSON with this exact structure:
{
  "interview_questions": {
    "opening_questions": [
      {
        "question": "The complete, specific technical question with NO placeholders",
        "purpose": "What technical skill/knowledge this tests",
        "follow_ups": ["Technical follow-up 1", "Technical follow-up 2"]
      },
      ... EXACTLY ${numQuestions - 1} MORE COMPLETE TECHNICAL QUESTIONS ...
    ]
  }
}

Return ONLY the JSON object. No explanations, no markdown, no code blocks.` : `Generate EXACTLY ${numQuestions} interview questions for a ${role} about ${topic}. 
This is a ${mode} style interview.

Your response MUST include EXACTLY ${numQuestions} questions.

Format your response as valid JSON with this exact structure:
{
  "interview_questions": {
    "opening_questions": [
      {
        "question": "The full text of the question",
        "purpose": "Brief explanation of what this question aims to assess",
        "follow_ups": ["Follow-up question 1", "Follow-up question 2"]
      },
      ... EXACTLY ${numQuestions - 1} MORE QUESTIONS ...
    ]
  }
}

Ensure questions are:
- Open-ended (not yes/no)
- Relevant to the ${topic} topic 
- Appropriate for the ${role} role
- Challenging but fair
- EXACTLY ${numQuestions} questions total

DO NOT include any explanations or text outside of the JSON structure.`;

    console.log("Sending question generation request to Gemini");
    
    // Use generateSafely to handle potential errors
    const result = await generateSafely(() => model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings
    }));

    if (!result || !result.response) {
      console.warn("Invalid response from Gemini API. Using default questions.");
      return {
        interview_questions: {
          opening_questions: createDefaultQuestions(topic, role, numQuestions, mode)
        }
      };
    }

    const responseText = result.response.text();
    console.log("Raw Gemini response:", responseText);
    
    try {
      // Look for and extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      
      const parsedResponse = JSON.parse(jsonString);
      
      // Validate the response structure
      if (!parsedResponse.interview_questions || 
          !Array.isArray(parsedResponse.interview_questions.opening_questions) ||
          parsedResponse.interview_questions.opening_questions.length === 0) {
        console.warn("Invalid question format from Gemini API. Using default questions.");
        return {
          interview_questions: {
            opening_questions: createDefaultQuestions(topic, role, numQuestions, mode)
          }
        };
      }
      
      // Check if we got the right number of questions
      const generatedQuestions = parsedResponse.interview_questions.opening_questions;
      
      // Create a new array with the exact number of questions needed
      let finalQuestions = [];
      
      if (generatedQuestions.length >= numQuestions) {
        // If we have enough questions, just take what we need
        finalQuestions = generatedQuestions.slice(0, numQuestions);
      } else {
        // If we don't have enough, use what we have and add defaults
        finalQuestions = [
          ...generatedQuestions,
          ...createDefaultQuestions(topic, role, numQuestions - generatedQuestions.length, mode)
        ];
      }
      
      // Ensure each question has the required fields and filter out questions with placeholders
      finalQuestions = finalQuestions.map((q: { question?: string; purpose?: string; follow_ups?: string[] }) => {
        let questionText = q.question || `Tell me about your experience with ${topic}.`;
        
        // If in technical mode, aggressively replace ALL placeholders with specific content
        if (isTechnicalMode) {
          const topicLower = topic.toLowerCase();
          
          // Replace ALL bracket patterns - be very aggressive
          // First, replace [specific X] patterns
          questionText = questionText.replace(/\[specific\s+([^\]]+)\]/gi, (match, p1) => {
            const content = p1.toLowerCase();
            
            // Kubernetes-specific replacements
            if (topicLower.includes('kubernetes') || topicLower.includes('k8s')) {
              if (content.includes('problem')) {
                return 'pod scheduling conflicts or resource quota exhaustion';
              } else if (content.includes('requirement') || content.includes('task')) {
                return 'handling 10,000 pods with sub-second service discovery';
              } else if (content.includes('scenario') || content.includes('situation')) {
                return 'a production Kubernetes cluster where pods are stuck in Pending state';
              } else {
                return 'Kubernetes pod lifecycle management or service mesh configuration';
              }
            }
            // React-specific
            else if (topicLower.includes('react')) {
              if (content.includes('problem')) {
                return 'memory leaks caused by event listeners in React components';
              } else {
                return 'React component re-rendering optimization';
              }
            }
            // Node.js-specific
            else if (topicLower.includes('node')) {
              if (content.includes('problem')) {
                return 'memory leaks in a Node.js application processing large JSON files';
              } else {
                return 'Node.js event loop optimization';
              }
            }
            // Python-specific
            else if (topicLower.includes('python')) {
              if (content.includes('problem')) {
                return 'circular reference memory leaks in Python applications';
              } else {
                return 'Python GIL (Global Interpreter Lock) optimization';
              }
            }
            // Generic fallback
            else {
              if (content.includes('problem')) {
                return `a specific ${topic} problem like performance bottlenecks or scalability issues`;
              } else if (content.includes('requirement')) {
                return `handling 1 million requests per second with 99.9% uptime`;
              } else {
                return `a specific ${topic} ${p1}`;
              }
            }
          });
          
          // Replace ALL other bracket patterns - catch everything
          questionText = questionText.replace(/\[([^\]]+)\]/g, (match, p1) => {
            const content = p1.toLowerCase();
            if (topicLower.includes('kubernetes') || topicLower.includes('k8s')) {
              if (content.includes('problem') || content.includes('issue')) {
                return 'pod scheduling conflicts or resource quota exhaustion';
              } else if (content.includes('requirement') || content.includes('task')) {
                return 'handling 10,000 pods with sub-second service discovery';
              } else if (content.includes('scenario') || content.includes('situation')) {
                return 'a production Kubernetes deployment failure';
              } else {
                return `Kubernetes ${p1}`;
              }
            } else {
              return `a specific ${topic} ${p1}`;
            }
          });
          
          // Replace any remaining generic placeholders
          questionText = questionText.replace(/\[requirement\]/gi, `handling high traffic with low latency`);
          questionText = questionText.replace(/\[problem\]/gi, `a specific ${topic} problem`);
          questionText = questionText.replace(/\[scenario\]/gi, `a production ${topic} issue`);
          questionText = questionText.replace(/\[operation\]/gi, `data processing operations`);
          questionText = questionText.replace(/\[concept\]/gi, `core ${topic} concept`);
          questionText = questionText.replace(/\[algorithm\]/gi, `optimization algorithm`);
          questionText = questionText.replace(/\[X\]/g, topic);
          questionText = questionText.replace(/\[Y\]/g, `specific constraints`);
        }
        
        return {
          question: questionText,
          purpose: q.purpose || "To understand the candidate's knowledge and experience.",
          follow_ups: Array.isArray(q.follow_ups) ? q.follow_ups : 
            ["Can you elaborate on that?", "What specific skills did you use?"]
        };
      });
      
      // Filter out questions that still contain placeholders or are too generic
      if (isTechnicalMode) {
        const validQuestions: any[] = [];
        const invalidQuestions: any[] = [];
        
        finalQuestions.forEach((q: { question: string }) => {
          const question = q.question.toLowerCase();
          // Check for remaining placeholders
          const hasPlaceholders = /\[.*\]/.test(q.question);
          
          // Check for generic patterns
          const genericPatterns = [
            /tell me about your experience/i,
            /how do you stay updated/i,
            /what is your experience/i,
            /describe your background/i,
            /what do you know about/i
          ];
          const isGeneric = genericPatterns.some(pattern => pattern.test(question));
          
          if (hasPlaceholders || isGeneric) {
            console.warn('Rejecting question:', { 
              question: q.question, 
              reason: hasPlaceholders ? 'has placeholders' : 'is generic' 
            });
            invalidQuestions.push(q);
          } else {
            validQuestions.push(q);
          }
        });
        
        // If we have invalid questions, replace them with technical defaults
        if (invalidQuestions.length > 0) {
          console.log(`Replacing ${invalidQuestions.length} invalid questions with technical defaults`);
          const technicalDefaults = createDefaultQuestions(topic, role, invalidQuestions.length, mode);
          finalQuestions = [...validQuestions, ...technicalDefaults];
        } else {
          finalQuestions = validQuestions;
        }
        
        // Ensure we have the right number of questions
        if (finalQuestions.length < numQuestions) {
          const needed = numQuestions - finalQuestions.length;
          const additionalDefaults = createDefaultQuestions(topic, role, needed, mode);
          finalQuestions = [...finalQuestions, ...additionalDefaults];
        } else if (finalQuestions.length > numQuestions) {
          finalQuestions = finalQuestions.slice(0, numQuestions);
        }
      }
      
      console.log(`Successfully prepared ${finalQuestions.length} questions for ${topic}`);
      
      return {
        interview_questions: {
          opening_questions: finalQuestions
        }
      };
      
    } catch (parseError) {
      console.error("Error parsing Gemini response:", parseError);
      return {
        interview_questions: {
          opening_questions: createDefaultQuestions(topic, role, numQuestions, mode)
        }
      };
    }
  } catch (error) {
    console.error("Error generating interview questions:", error);
    return {
      interview_questions: {
        opening_questions: createDefaultQuestions(topic, role, numQuestions, mode)
      }
    };
  }
} 