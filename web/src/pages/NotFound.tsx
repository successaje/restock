import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <Logo className="mb-10 justify-center" />
        <p className="font-display text-7xl italic text-muted">404</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">This page sold out.</h1>
        <p className="mt-2 text-muted">The link may be old, or the page has moved.</p>
        <Link to="/" className={buttonVariants({ variant: "ink", className: "mt-8" })}>
          <ArrowLeft /> Back home
        </Link>
      </div>
    </main>
  );
}
