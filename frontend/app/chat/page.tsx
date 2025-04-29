'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
// Added PanelLeftClose and PanelRightClose for the sidebar toggle button
import { Bot, Send, Home, Mic, MicOff, Volume2, VolumeX, Copy, Check, Download, RefreshCw, ListTodo, PanelLeftClose, PanelRightClose } from "lucide-react";
import { useTextToSpeech } from "@/components/useTextToSpeech";
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ThemeToggle } from "@/components/ui/theme-toggle";
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import fileDownload from "js-file-download";
import { useVoiceDictation } from "@/components/useVoiceDictation";



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
  const [isLoading, setIsLoading] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // State for sidebar visibility
  const { speakingId, speak, stop } = useTextToSpeech();

  const {
    input,
    setInput,
    listening,
    toggleListening,
    browserSupportsSpeechRecognition
  } = useVoiceDictation('');

  // Update input field with transcript when voice input changes
  useEffect(() => {
    if (input) {
      setInput(input);
    }
  }, [input]);

  // Handle voice send
  const handleVoiceSend = () => {
    if (input.trim()) {
      handleSend();
    }
  }

  const handleDownload = async () => {
    // send get request "/download" to get collection from database

    try{
      const response = await fetch('http://127.0.0.1:8001/download', {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf'
      }
      });
      // response contains pdf file
      const blob = await response.blob();
      fileDownload(blob, "Consultation.pdf");

    }catch(error){
      console.log(error);
    }

  };

  const handleRerun = async (botMessageIndex: number) => {
    if (isLoading || botMessageIndex <= 0) return;
    setIsLoading(true);
    const userMessageIndex = botMessageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex]?.type !== 'user') {
      setIsLoading(false);
      return;
    }
    const userMessageToRerun = messages[userMessageIndex];
    const historyForApi = messages.slice(0, userMessageIndex).map(msg => [
      msg.type === 'user' ? 'human' : 'ai',
      msg.content
    ] as [string, string]);
    historyForApi.push(['human', userMessageToRerun.content]);
    try {
      const response = await fetch('http://127.0.0.1:8001/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: historyForApi,
          user_input: userMessageToRerun.content
        }),
      });
      if (!response.ok) {
        throw new Error('API request failed');
      }
      const data: AnalysisResponse = await response.json();
      setMessages(prev => {
        const uM = [...prev];
        if (botMessageIndex < uM.length && uM[botMessageIndex].type === 'bot') {
          uM[botMessageIndex] = { type: 'bot', content: data.response, isSpeaking: false };
        } else {
          console.error("Rerun index mismatch");
        }
        return uM;
      });
    } catch (err: any) {
      console.error('Rerun Error:', err);
    } finally {
      setIsLoading(false);
    }
  }

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
      const response = await fetch('http://127.0.0.1:8001/analyze', {
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
  }

  const toggleSpeech = (index: number, text: string) => {
    if (speakingId === index) {
      stop();
    } else {
      speak(index, text);
    }
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

  const handleDownloadMessage = (content: string) => {
    try {
      // Create blob and download link
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'message.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download message:', err);
    }
  };

  // Function to toggle sidebar visibility
  const toggleSidebar = () => setIsSidebarVisible(!isSidebarVisible);

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
    <div className="flex h-screen bg-background overflow-hidden"> {/* Added overflow-hidden to prevent main scroll */}
      {/* Sidebar */}
      {/* Added transition classes and conditional width/padding/border */}
      <div className={`bg-card flex-shrink-0 transition-all duration-300 ease-in-out ${isSidebarVisible ? 'w-64 p-4 border-r' : 'w-0 p-0 border-r-0 overflow-hidden'}`}>
        {/* Wrap content for smooth fade */}
        <div className={`transition-opacity duration-200 ${isSidebarVisible ? 'opacity-100' : 'opacity-0 delay-100'}`}>
            <div className="flex items-center gap-2 mb-8">
              <Bot className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold whitespace-nowrap">AnalyticAI</span> {/* Added whitespace-nowrap */}
            </div>
            <div className="flex flex-col gap-4">
              <ThemeToggle />

              <Link href="/">
                <Button variant="outline" className="w-full flex items-center justify-start h-12 px-4 gap-2">
                  <Home className="h-5 w-5" />
                  <span className="whitespace-nowrap">Back to Home</span> {/* Added whitespace-nowrap */}
                </Button>
              </Link>
              <Link href="/plans">
                <Button variant="outline" className="w-full flex items-center justify-start h-12 px-4 gap-2">
                  <ListTodo className="h-5 w-5" />
                  <span className="whitespace-nowrap">Plans Board</span> {/* Added whitespace-nowrap */}
                </Button>
              </Link>
              <Button variant="outline" className="w-full flex items-center justify-start h-12 px-4 gap-2" onClick={handleDownload}>
                <Download className="h-5 w-5" />
                <span className="whitespace-nowrap">Download Chat</span> {/* Added whitespace-nowrap */}
              </Button>
            </div>
        </div>
      </div>

      {/* Main Chat Area */}
      {/* Added relative positioning for the toggle button */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Sidebar Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="absolute top-4 left-4 z-10 bg-card hover:bg-accent rounded-full shadow" // Positioned button
          title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
        >
          {/* Toggle icon based on sidebar visibility */}
          {isSidebarVisible ? <PanelLeftClose className="h-5 w-5" /> : <PanelRightClose className="h-5 w-5" />}
        </Button>

        {/* Chat Messages */}
        {/* Increased padding-top (pt-16) to prevent content from hiding under the button */}
        <div className="flex-1 overflow-y-auto p-4 pt-16 w-full">
          <div className="max-w-[1000px] mx-auto">
          {messages.map((message, idx) => (
            <div
              key={idx}
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
                      h3: ({node, children, ...props}: {
                        node?: any;
                        children?: React.ReactNode;
                        [key: string]: any;
                      }) => {
                        const content = children?.toString() || '';
                        // Always render the Sources section
                        return <h3 className="text-md font-bold mt-3 mb-1" {...props}>{children}</h3>;
                      },
                      ul: ({node, ...props}) => <ul className="list-disc pl-6 my-2" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-2" {...props} />,
                      li: ({node, children, ...props}: {
                        node?: any;
                        children?: React.ReactNode;
                        [key: string]: any;
                      }) => {
                        return <li className="my-0.5" {...props}>{children}</li>;
                      },
                      p: ({node, children, ...props}: {
                        node?: any;
                        children?: React.ReactNode;
                        [key: string]: any;
                      }) => {
                        return <p className="my-1.5" {...props}>{children}</p>;
                      },
                      a: ({node, href, children, ...props}) => {
                        if (!href) return <>{children}</>;
                        return (
                          <a
                            href={href}
                            className="text-blue-500 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      },
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

                {/* Action buttons for bot messages */}
                {message.type === 'bot' && (
                  <div className="flex justify-end mt-3 gap-2 border-t pt-2 border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(message.content, idx)}
                      className="p-1 h-8 w-8 rounded-full"
                      title="Copy to clipboard"
                    >
                      {copiedIndex === idx ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadMessage(message.content)}
                      className="p-1 h-8 w-8 rounded-full"
                      title="Download message"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {idx > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRerun(idx)}
                        className="p-1 h-8 w-8 rounded-full"
                        title="Rerun this query"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <button
                      className={`ml-2 p-1 rounded ${speakingId === idx ? 'bg-primary text-white' : 'hover:bg-muted'} transition`}
                      onClick={() => toggleSpeech(idx, message.content)}
                      title={speakingId === idx ? 'Stop speaking' : 'Speak message'}
                    >
                      {speakingId === idx ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-muted text-muted-foreground p-3 px-4 rounded-lg shadow-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm">AnalyticAI is thinking...</span>
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
            <div className="flex flex-col gap-2">
              {browserSupportsSpeechRecognition && (
                <Button
                  onClick={toggleListening}
                  variant="outline"
                  className={`p-2 ${listening ? 'bg-primary text-primary-foreground' : ''}`}
                  title={listening ? "Stop voice input" : "Start voice input"}
                >
                  {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
              )}
              <Button
                onClick={handleSend}
                className="p-2"
                disabled={isLoading}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
          {listening && (
            <div className="mt-2 text-sm text-muted-foreground max-w-[1000px] mx-auto flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <span>Listening... {input && `"${input}"`}</span>
              </div>
              {input && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleVoiceSend}
                  className="text-xs"
                >
                  Send voice message
                </Button>
              )}
            </div>
          )}
          {!browserSupportsSpeechRecognition && (
            <div className="mt-2 text-sm text-muted-foreground max-w-[1000px] mx-auto">
              <span>Voice input is not supported in your browser. Try using Chrome for the best experience.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}