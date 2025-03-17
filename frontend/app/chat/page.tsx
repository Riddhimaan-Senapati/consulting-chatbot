'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Home } from "lucide-react";
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface Message {
  type: 'user' | 'bot';
  content: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      type: 'bot',
      content: 'Hello! I can help you with SWOT, TOWS, and PESTLE analysis. What would you like to analyze today?'
    }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages([...messages, { type: 'user', content: input }]);
    setInput('');

    // Simulate bot response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        type: 'bot',
        content: "I'll help you analyze that. Let's break it down systematically. What specific aspect would you like to focus on first?"
      }]);
    }, 1000);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r p-4">
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
      <div className="flex-1 flex flex-col">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-4">
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
              className="flex-1 min-h-[60px] p-2 rounded-md border"
              rows={2}
            />
            <Button onClick={handleSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}