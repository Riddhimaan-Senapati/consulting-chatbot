'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Bot, Send, Home, Mic, MicOff, Volume2, VolumeX, Copy, Check } from "lucide-react";
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ThemeToggle } from "@/components/ui/theme-toggle";
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

interface Message {
  type: 'user' | 'bot';
  content: string;
  isSpeaking?: boolean;
}

// API response interface to match backend structure
interface AnalysisResponse {
  response: string;
  full_history: [string, string][];
}

export default function Chat() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      type: 'bot',
      content: 'Hello! I can help you with SWOT, TOWS, and PESTLE analysis. What would you like to analyze today?',
      isSpeaking: false
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();

  // Update input field with transcript when voice input changes
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Toggle voice recognition
  const toggleListening = () => {
    if (listening) {
      SpeechRecognition.stopListening();
      setIsListening(false);
    } else {
      SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
      setIsListening(true);
      resetTranscript();
    }
  };

  // Handle voice send
  const handleVoiceSend = () => {
    if (transcript.trim()) {
      handleSend();
      resetTranscript();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Add user message to chat
    const userMessage = { type: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Convert messages to the format expected by the backend
      const apiMessages = messages.map(msg => [
        msg.type === 'user' ? 'human' : 'ai', 
        msg.content
      ]);
      
      // Add the new user message
      apiMessages.push(['human', userMessage.content]);

      // Call the backend API
      const response = await fetch('http://127.0.0.1:8000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          user_input: userMessage.content
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data: AnalysisResponse = await response.json();
      
      // Add bot response to chat
      setMessages(prev => [...prev, {
        type: 'bot',
        content: data.response,
        isSpeaking: false
      }]);
    } catch (error) {
      console.error('Error calling API:', error);
      // Add error message to chat
      setMessages(prev => [...prev, {
        type: 'bot',
        content: "Sorry, I encountered an error while processing your request. Please try again.",
        isSpeaking: false
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpeech = (index: number) => {
    // If this message is already speaking, stop it
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        // Make sure to mark all messages as not speaking
        newMessages.forEach(msg => {
          msg.isSpeaking = false;
        });
        return newMessages;
      });
      return;
    }
    
    // Otherwise, stop any current speech and start this one
    window.speechSynthesis.cancel();
    
    setMessages(prevMessages => {
      const newMessages = [...prevMessages];
      
      // Mark all messages as not speaking
      newMessages.forEach(msg => {
        msg.isSpeaking = false;
      });
      
      // Mark this message as speaking
      const message = newMessages[index];
      message.isSpeaking = true;
      
      // Create and configure the utterance
      const utterance = new SpeechSynthesisUtterance(message.content);
      
      // Try to get a good voice
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        // Try to find a good English voice
        const preferredVoice = voices.find(voice => 
          voice.lang === 'en-US' || 
          voice.name.includes('English') ||
          voice.name.includes('Google')
        );
        utterance.voice = preferredVoice || voices[0];
      }
      
      // Set rate and pitch to normal values
      utterance.rate = 1;
      utterance.pitch = 1;
      
      // When speech ends, update the speaking state
      utterance.onend = () => {
        setSpeakingIndex(null);
        setMessages(prev => {
          const updatedMessages = [...prev];
          updatedMessages.forEach(msg => {
            msg.isSpeaking = false;
          });
          return updatedMessages;
        });
      };
      
      // Handle errors
      utterance.onerror = () => {
        setSpeakingIndex(null);
        setMessages(prev => {
          const updatedMessages = [...prev];
          updatedMessages.forEach(msg => {
            msg.isSpeaking = false;
          });
          return updatedMessages;
        });
      };
      
      // Start speaking and update the speaking index
      window.speechSynthesis.speak(utterance);
      setSpeakingIndex(index);
      
      return newMessages;
    });
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      // Strip markdown formatting before copying
      const tempElement = document.createElement('div');
      tempElement.innerHTML = content;
      const textContent = tempElement.textContent || tempElement.innerText || content;
      
      await navigator.clipboard.writeText(textContent);
      setCopiedIndex(index);
      
      // Reset the copied status after 2 seconds
      setTimeout(() => {
        setCopiedIndex(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Mark component as mounted to avoid SSR hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Only render the full component after client-side hydration
  if (!mounted) {
    return <div className="flex h-screen items-center justify-center bg-background">
      <div className="animate-pulse">Loading...</div>
    </div>;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r p-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-8">
          <Bot className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">AnalyticAI</span>
        </div>
        <div className="flex flex-col gap-4">
          <ThemeToggle />
          <Link href="/">
            <Button variant="outline" className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 w-full">
          <div className="max-w-[1000px] mx-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
              >
                <div
                  className={`max-w-[90%] md:max-w-[70%] p-4 rounded-lg overflow-hidden ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.type === 'bot' ? 'bg-accent/30 text-foreground border border-border' : 'bg-secondary text-secondary-foreground'
                  }`}
                  style={{ wordBreak: 'break-word' }}
                >
                  <div className="prose prose-sm dark:prose-invert prose-headings:my-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-4 mb-2" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-md font-bold mt-3 mb-1" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-6 my-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-2" {...props} />,
                        li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                        p: ({node, ...props}) => <p className="my-1.5" {...props} />,
                        a: ({node, ...props}) => <a className="text-blue-500 hover:underline" {...props} />,
                        table: ({node, ...props}) => (
                          <div className="overflow-x-auto my-2 border border-border rounded">
                            <table className="min-w-full border-collapse text-sm" {...props} />
                          </div>
                        ),
                        thead: ({node, ...props}) => <thead className="bg-muted/50" {...props} />,
                        th: ({node, ...props}) => <th className="border border-border p-2 text-left font-semibold" {...props} />,
                        td: ({node, ...props}) => <td className="border border-border p-2 whitespace-normal break-words" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary/30 pl-4 italic my-2" {...props} />,
                        code: ({node, className, children, ...props}: {
                          node?: any;
                          className?: string;
                          children?: React.ReactNode;
                          [key: string]: any;
                        }) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match && !className;
                          return !isInline ? (
                            <div className="overflow-auto my-2 max-w-full rounded bg-muted/70 p-1">
                              <pre className={`${match ? 'language-' + match[1] : ''} text-sm p-2`}>
                                <code className={className} {...props}>{children}</code>
                              </pre>
                            </div>
                          ) : (
                            <code className="bg-muted/70 text-sm px-1.5 py-0.5 rounded font-mono" {...props}>{children}</code>
                          );
                        },
                        hr: ({node, ...props}) => <hr className="my-4 border-t border-border" {...props} />,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  {message.type === 'bot' && (
                    <div className="flex justify-end mt-2 gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(message.content, index)}
                        className="p-1"
                        title="Copy to clipboard"
                      >
                        {copiedIndex === index ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSpeech(index)}
                        className="p-1"
                        title={message.isSpeaking ? "Stop speaking" : "Speak this message"}
                      >
                        {message.isSpeaking ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-secondary text-secondary-foreground max-w-[80%] p-4 rounded-lg">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t p-4 w-full">
          <div className="flex gap-4 max-w-[1000px] mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message... (Markdown supported)"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 min-h-[60px] p-2 rounded-md border resize-none"
              rows={2}
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={isLoading} className="flex-shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}