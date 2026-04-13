import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { Sparkles, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

const Login = () => {
  const { signIn, signUp } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const { error: err } = isSignUp ? await signUp(email, password) : await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(err.message);
    } else if (!isSignUp) {
      navigate("/dashboard");
    } else {
      setInfo("Check your email to confirm your account.");
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-[hsl(214_95%_18%)]" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-96 h-96 rounded-full bg-blue blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-teal blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground w-full">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-semibold text-lg tracking-tight">
              {tenant?.name || "AutoLabels.io"}
            </span>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-semibold tracking-tight font-display leading-tight">
                The premium<br />addendum platform<br />for modern dealers.
              </h2>
              <p className="mt-4 text-base text-primary-foreground/70 max-w-md">
                Build, sign, and audit dealer addendums with compliance-grade
                tools trusted by leading automotive groups.
              </p>
            </div>

            <div className="space-y-3 max-w-md">
              <Feature icon={ShieldCheck} text="CARS Act & FTC compliance built-in" />
              <Feature icon={Zap} text="VIN decode, rules engine, digital signing" />
              <Feature icon={CheckCircle2} text="Multi-store white label ready" />
            </div>
          </div>

          <div className="text-xs text-primary-foreground/50">
            © {new Date().getFullYear()} {tenant?.name || "AutoLabels.io"}. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-base tracking-tight">
              {tenant?.name || "AutoLabels.io"}
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight font-display text-foreground">
              {isSignUp ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {isSignUp
                ? "Get started with a free account"
                : "Sign in to your dealership account"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@dealership.com"
                required
                autoComplete="email"
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            {info && (
              <div className="text-sm text-teal bg-teal/5 border border-teal/20 rounded-md px-3 py-2">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setInfo("");
            }}
            className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Feature = ({ icon: Icon, text }: { icon: typeof Sparkles; text: string }) => (
  <div className="flex items-center gap-3 text-sm text-primary-foreground/80">
    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
      <Icon className="w-3 h-3" />
    </div>
    <span>{text}</span>
  </div>
);

export default Login;
