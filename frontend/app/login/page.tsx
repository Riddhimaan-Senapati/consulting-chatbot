'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('http://localhost:8000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log('Logged in successfully', data.access_token);
      // Save token if needed, then redirect
      window.location.href = '/chat';
    } else {
      alert('Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
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
          <Button type="submit" className="w-full">
            Login
          </Button>
          <p className="text-center text-muted-foreground text-sm mt-4">
            Don't have an account? <Link href="/signup" className="text-primary underline">Sign Up</Link>
          </p>
          <p className="text-center text-muted-foreground text-sm mt-2">
            <Link href="/" className="underline">← Back to Home</Link>
          </p>
        </div>
      </form>
    </div>
  );
}