'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Clear previous error

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('Logged in successfully', data);

        router.push('/chat');
      } else {
        const errorData = await res.json();
        setError(errorData.detail || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      console.error('An unexpected error occurred:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-[#eafaf1]">
      <div className="flex flex-col items-center gap-2 mb-8">
        <Bot className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold">AnalyticAI</span>
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
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
          {error && <p className="text-center text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full">
            Login
          </Button>
          <p className="text-center text-muted-foreground text-sm mt-4">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-primary underline">Sign Up</Link>
          </p>
          <p className="text-center text-muted-foreground text-sm mt-2">
            <Link href="/" className="underline">← Back to Home</Link>
          </p>
        </div>
      </form>
    </div>
  );
}
