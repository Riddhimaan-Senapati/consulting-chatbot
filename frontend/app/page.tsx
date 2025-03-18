'use client';

import { Button } from "@/components/ui/button";
import { Bot, BarChart3, Brain, LineChart, LogIn, UserPlus } from "lucide-react";
import Link from 'next/link';
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-16">
        <nav className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">AnalyticAI</span>
          </div>
          <div className="flex gap-4 items-center">
            <ThemeToggle />
            <Button variant="outline">
              <LogIn className="mr-2 h-4 w-4" />
              Login
            </Button>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Sign Up
            </Button>
          </div>
        </nav>

        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
            Strategic Analysis Made Simple
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Transform your business insights with AI-powered SWOT, TOWS, and PESTLE analysis. Make data-driven decisions with confidence.
          </p>
          <Link href="/chat">
            <Button size="lg" className="text-lg px-8">
              Get Started Free
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-card p-6 rounded-lg">
            <BarChart3 className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">SWOT Analysis</h3>
            <p className="text-muted-foreground">
              Identify Strengths, Weaknesses, Opportunities, and Threats with our AI-powered analysis.
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg">
            <Brain className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">TOWS Matrix</h3>
            <p className="text-muted-foreground">
              Generate strategic options by matching external threats and opportunities with internal strengths and weaknesses.
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg">
            <LineChart className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">PESTLE Analysis</h3>
            <p className="text-muted-foreground">
              Comprehensive analysis of Political, Economic, Social, Technological, Legal, and Environmental factors.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">
          Built with ❤️ by Riddhimaan Senapati, Dhumravarna Ambre and Isaac Santana
        </p>
      </footer>
    </div>
  );
}