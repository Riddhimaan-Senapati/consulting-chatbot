'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    const res = await fetch('http://localhost:8000/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      alert('Account created! Please log in.');
      window.location.href = '/login';
    } else {
      const error = await res.json();
      alert(`Error: ${error.detail}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-[#eafaf1]">
      <div className="flex flex-col items-center gap-2 mb-8">
        <Bot className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold">AnalyticAI</span>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Sign Up</h1>
        <div className="space-y-4">
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <Input
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
          <Input
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            required
          />
          <Button type="submit" className="w-full">
            Sign Up
          </Button>
          <p className="text-center text-muted-foreground text-sm mt-4">
            Already have an account? <Link href="/login" className="text-primary underline">Login</Link>
          </p>
          <p className="text-center text-muted-foreground text-sm mt-2">
            <Link href="/" className="underline">← Back to Home</Link>
          </p>
        </div>
      </form>
    </div>
  );
}