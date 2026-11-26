import { LogoMark } from "../brand/Logo";

export function PageLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-label="Loading">
      <LogoMark animated className="size-9 opacity-90" />
    </div>
  );
}
