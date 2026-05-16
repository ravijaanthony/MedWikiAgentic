import { Link } from "react-router-dom";

type Props = {
  children: React.ReactNode;
  /** Optional content in the top-right (e.g. step label) */
  trailing?: React.ReactNode;
};

export default function ImmersiveShell({ children, trailing }: Props) {
  return (
    <div className="immersive-bg flex min-h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between px-5 py-5 sm:px-8">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-clinical-200"
          aria-label="MedWiki home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-clinical-700 text-sm font-bold text-white shadow-sm">
            M
          </span>
          <span className="hidden font-semibold text-slate-900 sm:inline">MedWiki</span>
        </Link>
        {trailing ? (
          <div className="flex items-center gap-3">{trailing}</div>
        ) : (
          <span className="w-9" aria-hidden />
        )}
      </header>

      <main className="flex flex-1 flex-col px-5 pb-8 sm:px-8">{children}</main>
    </div>
  );
}
