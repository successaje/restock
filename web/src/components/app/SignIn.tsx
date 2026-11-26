import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { motion, useAnimationControls } from "motion/react";
import { ArrowRight, KeyRound, LockKeyhole } from "lucide-react";
import { Logo } from "../brand/Logo";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/form";
import { useSignIn } from "@/lib/queries";

const ease = [0.16, 1, 0.3, 1] as const;

/** Shown in place of the dashboard when the agent's server has a DASHBOARD_TOKEN. */
export function SignIn() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const signIn = useSignIn();
  const shake = useAnimationControls();

  useEffect(() => {
    document.title = "Sign in · Restock";
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const key = token.trim();
    if (!key) return setError("Enter your access key.");
    setError(null);
    signIn.mutate(key, {
      onError: (err) => {
        setError(err.message);
        void shake.start({ x: [0, -9, 8, -5, 3, 0], transition: { duration: 0.42, ease: "easeOut" } });
      },
    });
  };

  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden bg-bg px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-18rem] -z-10 h-[34rem] w-[46rem] -translate-x-1/2 rounded-full bg-brand/30 blur-[120px] dark:bg-brand/[0.08]"
      />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease }}
        className="w-full max-w-[400px]"
      >
        <Link to="/" aria-label="Restock home" className="mx-auto mb-10 flex w-fit">
          <Logo />
        </Link>

        <motion.form
          animate={shake}
          onSubmit={submit}
          noValidate
          className="rounded-[22px] border border-line bg-surface p-6 shadow-pop sm:p-8"
        >
          <div className="mb-6 grid size-11 place-items-center rounded-[14px] bg-ink text-bg">
            <LockKeyhole className="size-5" strokeWidth={1.9} />
          </div>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Open your dashboard</h1>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
            Reorders, your restock rule and your customer book sit behind your access key.
          </p>

          {/* Lets a password manager file the key under this agent. */}
          <input type="text" name="username" autoComplete="username" value="Restock installer" readOnly hidden />

          <div className="mt-6">
            <Field label="Access key" error={error} hint="The DASHBOARD_TOKEN set on this agent's server.">
              {(id) => (
                <Input
                  id={id}
                  name="token"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  spellCheck={false}
                  value={token}
                  invalid={!!error}
                  prefix={<KeyRound className="size-4" />}
                  onChange={(e) => {
                    setToken(e.target.value);
                    if (error) setError(null);
                  }}
                />
              )}
            </Field>
          </div>

          <Button type="submit" variant="primary" size="lg" className="mt-6 w-full" loading={signIn.isPending} trailing={<ArrowRight />}>
            Open dashboard
          </Button>
        </motion.form>

        <p className="mx-auto mt-6 max-w-[340px] text-center text-[13px] leading-relaxed text-muted">
          Paying an installment? Open the payment link your installer sent you. It works without signing in.
        </p>
      </motion.div>
    </main>
  );
}
