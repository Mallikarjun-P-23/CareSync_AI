"use client";

import Link from "next/link";
import { useLocalAuth } from "@/lib/local-auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function SignUp() {
  const { registerWithPassword, isLoading } = useLocalAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await registerWithPassword({ role: "doctor", email, password, username, mobile });
      router.push("/dashboard");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Signup failed";
      setError(text.replace(/^\{"detail":"|"\}$/g, ""));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Doctor Signup</h1>
        <p className="text-sm text-muted-foreground">Create account with email, username, and mobile.</p>
      </div>

      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        required
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <input
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        placeholder="Mobile Number"
        required
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        minLength={6}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating account..." : "Create Account"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Already registered? <Link href="/signIn" className="underline">Doctor login</Link>
      </p>
    </form>
  );
}