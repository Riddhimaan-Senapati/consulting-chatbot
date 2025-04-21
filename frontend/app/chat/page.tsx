'use client';

// Keep necessary imports
import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Bot, Send, Home, Mic, MicOff, Volume2, VolumeX, Copy, Check, Download, RefreshCw } from "lucide-react";
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ThemeToggle } from "@/components/ui/theme-toggle";
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import fileDownload from "js-file-download";
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  type: 'user' | 'bot';
  content: string;
  isSpeaking?: boolean;
}

interface AnalysisResponse {
  id?: string;
  response: string;
  full_history: [string, string][];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001';

export default function Chat() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { type: 'bot', content: 'Hello! I can help you with SWOT, TOWS, and PESTLE analysis. What would you like to analyze today?', isSpeaking: false }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeechReady, setIsSpeechReady] = useState(false);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();

  // --- Effects ---
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (listening && transcript) { setInput(transcript); } }, [transcript, listening]);

  useEffect(() => {
      const loadVoices = () => {
        if (!window.speechSynthesis) { setIsSpeechReady(false); return; }
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          setVoices(availableVoices); setIsSpeechReady(true);
           window.speechSynthesis.removeEventListener('voiceschanged', loadVoices); // Safe to remove now
        }
      };
      if(window.speechSynthesis){ // Ensure API exists before adding listener
          window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
          loadVoices(); // Attempt initial load
      } else {
          console.warn("Speech synthesis not supported.");
      }
      return () => { // Cleanup
        if(window.speechSynthesis) {
             window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
        }
      };
    }, []);

  useEffect(() => { setMounted(true); }, []);

  // --- Microphone Handling ---
  const toggleListening = () => { /* ... (no changes needed from previous version) ... */
    if (!browserSupportsSpeechRecognition) { setError("Voice recognition not supported."); return; }
    if (!isMicrophoneAvailable) { setError("Microphone not available/permitted."); return; }
    if (listening) {
      SpeechRecognition.stopListening(); setIsListening(false);
    } else {
      resetTranscript(); setInput('');
      SpeechRecognition.startListening({ continuous: true, language: 'en-US' }); setIsListening(true);
    }
   };

  const handleVoiceSend = () => { /* ... (no changes needed from previous version) ... */
    const trimmedTranscript = transcript.trim();
    if (trimmedTranscript && !isLoading) {
      const finalTranscript = trimmedTranscript;
      handleSend(finalTranscript);
      SpeechRecognition.stopListening(); setIsListening(false);
      resetTranscript();
    } else if (!trimmedTranscript) {
      SpeechRecognition.stopListening(); setIsListening(false);
    }
  };

  // --- API and Message Handling ---
  const handleDownload = async () => { /* ... (keep previous working version) ... */
    setError(null); try { const response = await fetch(`${API_BASE_URL}/download?format=pdf`, { method: 'GET', headers: { 'Accept': 'application/pdf' } }); if (!response.ok) { const e = await response.text(); throw new Error(`DL ${response.status}: ${e||''}`); } let f = "Consultation.pdf"; const d = response.headers.get('content-disposition'); if (d?.includes('attachment')) { const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(d); if (m?.[1]) { f = m[1].replace(/['"]/g,''); } } const b = await response.blob(); fileDownload(b, f); } catch (err:any) { console.error('DL err:', err); setError(`DL failed: ${err.message}`); }
  };

  const handleSend = async (directInput?: string) => { /* ... (keep previous working version) ... */
    const messageToSend = (directInput ?? input).trim(); if (!messageToSend || isLoading) return; setError(null); const userMessage: Message = { type: 'user', content: messageToSend }; setMessages(prev => [...prev, userMessage]); if (!directInput) { setInput(''); } setIsLoading(true); const historyForApi = messages.map(msg => [msg.type === 'user' ? 'human' : 'ai', msg.content] as [string, string]); historyForApi.push(['human', messageToSend]); try { const response = await fetch(`${API_BASE_URL}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify({ messages: historyForApi, user_input: messageToSend }), }); if (!response.ok) { let eMsg = `API ${response.status}`; try { const eD = await response.json(); eMsg += ` - ${eD.detail||JSON.stringify(eD)}`; } catch { const tE = await response.text(); eMsg += ` - ${tE}`; } throw new Error(eMsg); } const data: AnalysisResponse = await response.json(); setMessages(prev => [...prev, { type: 'bot', content: data.response, isSpeaking: false }]); } catch (err:any) { console.error('API Error:', err); const eC = `Error: ${err.message||'Request failed'}`; setError(eC); setMessages(prev => [...prev, { type: 'bot', content: eC, isSpeaking: false }]); } finally { setIsLoading(false); }
  };

  const handleRerun = async (botMessageIndex: number) => { /* ... (keep previous working version) ... */
    if (isLoading || botMessageIndex <= 0) return; setError(null); setIsLoading(true); const userMessageIndex = botMessageIndex - 1; if (userMessageIndex < 0 || messages[userMessageIndex]?.type !== 'user') { setError("Cannot rerun."); setIsLoading(false); return; } const userMessageToRerun = messages[userMessageIndex]; const historyForApi = messages.slice(0, userMessageIndex).map(msg => [ msg.type === 'user' ? 'human' : 'ai', msg.content] as [string, string]); historyForApi.push(['human', userMessageToRerun.content]); try { const response = await fetch(`${API_BASE_URL}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify({ messages: historyForApi, user_input: userMessageToRerun.content }), }); if (!response.ok) { let eMsg = `Rerun ${response.status}`; try {const eD=await response.json();eMsg+=` - ${eD.detail||JSON.stringify(eD)}`;} catch{const tE=await response.text();eMsg+=` - ${tE}`;}; throw new Error(eMsg); } const data: AnalysisResponse = await response.json(); setMessages(prev => { const uM = [...prev]; if (botMessageIndex < uM.length && uM[botMessageIndex].type === 'bot') { uM[botMessageIndex] = { type: 'bot', content: data.response, isSpeaking: false }; } else { console.error("Rerun index mismatch"); } return uM; }); } catch (err: any) { console.error('Rerun Error:', err); setError(`Rerun failed: ${err.message}`); } finally { setIsLoading(false); }
  };


  // --- Speech Synthesis Handling ---
  const toggleSpeech = (index: number, content: string) => {
    const isCurrentlySpeaking = speakingIndex !== null;
    const isClickedMessageSpeaking = isCurrentlySpeaking && speakingIndex === index;

    if (isClickedMessageSpeaking) {
      // STOPPING SPEECH
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      setMessages(prev => prev.map(msg => ({ ...msg, isSpeaking: false })));
    } else {
      // STARTING SPEECH
      if (!isSpeechReady || voices.length === 0) {
        setError("TTS engine initializing. Please wait."); return;
      }
      if (isCurrentlySpeaking) { window.speechSynthesis.cancel(); } // Cancel previous before starting new

      setMessages(prev => prev.map((msg, i) => ({ ...msg, isSpeaking: i === index })));
      setSpeakingIndex(index);

      const utterance = new SpeechSynthesisUtterance(content);
      const preferredVoice = voices.find(v => v.lang === 'en-US' && /Google|Natural/i.test(v.name))
          || voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en-'));
      utterance.voice = preferredVoice || voices[0] || null;

      if (!utterance.voice) {
          setError("No TTS voices available.");
          setSpeakingIndex(null); setMessages(prev => prev.map(msg => ({ ...msg, isSpeaking: false })));
          return;
      }
      utterance.rate = 1; utterance.pitch = 1;

      // --- Refined Event Handlers ---
      utterance.onend = () => {
          if (speakingIndex === index) { // Check prevents race condition
              setSpeakingIndex(null);
              setMessages(prev => prev.map(msg => ({ ...msg, isSpeaking: false })));
          }
      };
      utterance.onerror = (event) => {
          const errorType = event.error || 'unknown';
          const isCancellationError = errorType === 'interrupted' || errorType === 'canceled' || errorType === 'cancelled';

          // Log differently based on type
          if (!isCancellationError) {
              console.error(`Speech synthesis error: ${errorType} on index ${index}`, event);
              setError(`Speech synthesis failed: ${errorType}`); // Show only real errors
          } else {
              // Log cancellations for debugging but don't show error to user
              console.log(`Speech synthesis intentionally stopped/cancelled: ${errorType} on index ${index}`);
          }

          // Always reset UI state if this was the speaking index
          if (speakingIndex === index) {
              setSpeakingIndex(null);
              setMessages(prev => prev.map(msg => ({ ...msg, isSpeaking: false })));
          }
      };
      // --- End Refined Event Handlers ---

      window.speechSynthesis.speak(utterance);
    }
  };

  // --- Other Utils ---
  const handleCopy = async (content: string, index: number) => { /* ... (no changes) ... */
    setError(null); if (!navigator.clipboard) { setError("Clipboard unavailable."); return; } try { let t = content; try { t = content.replace(/```[\s\S]*?```/g, '').replace(/`([^`]*)`/g, '$1').replace(/(\*\*|__)(.*?)\1/g, '$2').replace(/(\*|_)(.*?)\1/g, '$2').replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/^[#>*\-+\s]*/gm, '').trim(); } catch {} await navigator.clipboard.writeText(t); setCopiedIndex(index); setTimeout(() => setCopiedIndex(null), 2000); } catch (err) { console.error('Copy err:', err); setError('Failed to copy.'); }
   };
  const handleDownloadMessage = (content: string) => { /* ... (no changes) ... */
    setError(null); try { let t = content; try { t = content.replace(/```[\s\S]*?```/g, '').replace(/`([^`]*)`/g, '$1').replace(/(\*\*|__)(.*?)\1/g, '$2').replace(/(\*|_)(.*?)\1/g, '$2').replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/^[#>*\-+\s]*/gm, '').trim(); } catch {} const b = new Blob([t], { type: 'text/plain;charset=utf-8' }); fileDownload(b, 'message.txt'); } catch (err) { console.error('Msg DL err:', err); setError('Failed to download message.'); }
  };

  // --- Render ---
  if (!mounted) { return <div className="flex h-screen items-center justify-center bg-background"><div className="animate-pulse">Loading...</div></div>; }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border p-4 flex-shrink-0 flex flex-col">
        <div className="flex items-center gap-2 mb-8"> <Bot className="h-8 w-8 text-primary" /> <span className="text-2xl font-bold">AnalyticAI</span> </div>
        <div className="flex flex-col gap-4">
          <ThemeToggle />
          <Link href="/" passHref> <Button variant="outline" className="w-full justify-start"> <Home className="mr-2 h-4 w-4" /> Back to Home </Button> </Link>
          <Button variant="outline" className="w-full justify-start" onClick={handleDownload}> <Download className="mr-2 h-4 w-4"/> Download Chat </Button>
        </div>
        <div className="mt-auto text-xs text-muted-foreground">
            {window.speechSynthesis ? (isSpeechReady? 'TTS Ready.' : 'TTS Init...') : 'TTS N/A.'}
            {browserSupportsSpeechRecognition?' Voice enabled.':' Voice N/A.'}
            {!isMicrophoneAvailable && browserSupportsSpeechRecognition&&' Mic needed.'}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
         {error && (<div className="p-2 bg-destructive text-destructive-foreground text-sm text-center z-10">{error} <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-2 p-1 h-auto">X</Button></div>)}

        <ScrollArea className="flex-1 p-4 w-full">
          <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[75%] p-3 px-4 rounded-lg shadow-sm overflow-hidden ${ message.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-accent/30 text-foreground border border-border' }`} style={{ wordBreak: 'break-word' }}>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-table:my-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ a: ({node, href, children, ...props}) => ( <a href={href} className="text-blue-500 hover:underline break-all" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>), table: ({node, ...props}) => ( <div className="overflow-x-auto my-2 border border-border rounded"><table className="min-w-full border-collapse text-xs" {...props} /></div>), th: ({node, ...props}) => <th className="border border-border p-1.5 text-left font-semibold bg-muted/30" {...props} />, td: ({node, ...props}) => <td className="border border-border p-1.5" {...props} />, }}>
                    {message.content}
                  </ReactMarkdown>
                </div>
                {message.type === 'bot' && (
                  <div className="flex justify-end items-center mt-2 pt-1.5 border-t border-border/40 gap-1">
                    {index > 0 && ( <Button variant="ghost" size="icon" onClick={() => handleRerun(index)} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Regenerate" disabled={isLoading}> <RefreshCw className="h-4 w-4" /> </Button> )}
                    <Button variant="ghost" size="icon" onClick={() => handleCopy(message.content, index)} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Copy"> {copiedIndex === index ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />} </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDownloadMessage(message.content)} className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Download text"> <Download className="h-4 w-4" /> </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleSpeech(index, message.content)} className={`h-7 w-7 ${speakingIndex === index ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} title={speakingIndex === index ? "Stop" : (isSpeechReady ? "Speak" : "TTS Loading...")} disabled={!isSpeechReady || !window.speechSynthesis} > {speakingIndex === index ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
            {/* Loading Indicator - Corrected Icon Color and Text */}
            {isLoading && (
              <div className="flex justify-start mb-4"> {/* Keep margin for spacing */}
                <div className="bg-muted text-muted-foreground p-3 px-4 rounded-lg shadow-sm flex items-center gap-2"> {/* Use appropriate background */}
                  <Bot className="h-4 w-4 animate-spin text-primary"/> {/* Added text-primary */}
                  <span className="text-sm">AnalyticAI is thinking...</span> {/* Corrected text */}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-border p-4 w-full bg-background">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
             <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Listening..." : "Type message..."} onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (listening && transcript.trim()) { handleVoiceSend(); } else { handleSend(); } } }} className="flex-1 resize-none max-h-36 min-h-[40px] text-sm" rows={1} disabled={isLoading} />
            <div className="flex flex-col gap-1.5">
              {browserSupportsSpeechRecognition && ( <Button onClick={toggleListening} variant="outline" size="icon" className={`h-9 w-9 ${listening ? 'border-primary text-primary animate-pulse' : ''}`} title={listening ? "Stop listening" : "Start listening"} disabled={isLoading}> {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} </Button> )}
              <Button onClick={() => listening ? handleVoiceSend() : handleSend()} size="icon" className="h-9 w-9" disabled={isLoading || (!input.trim() && !transcript.trim())} title={listening ? "Send voice" : "Send text"}> <Send className="h-4 w-4" /> </Button>
            </div>
          </div>
          {listening && ( <div className="mt-1.5 text-xs text-muted-foreground max-w-4xl mx-auto flex items-center gap-1"> <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> <span>Listening... {transcript && <span className='italic'>"{transcript}"</span>}</span> </div> )}
        </div>
      </div>
    </div>
  );
}