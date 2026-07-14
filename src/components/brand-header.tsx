import Link from "next/link";
import { Leaf } from "lucide-react";

export function BrandHeader({ staff = false }: { staff?: boolean }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
      <Link href="/" className="flex items-center gap-3 font-semibold">
        <span className="grid size-11 place-items-center rounded-sm bg-[#b1c553] text-[#24301f]">
          <Leaf aria-hidden className="size-5" />
        </span>
        <span>
          <span className="block font-display text-2xl leading-none">
            Zaytouna
          </span>
          <span className="block text-xs uppercase tracking-[0.18em] text-[#59623d]">
            Bistro Loyalty
          </span>
        </span>
      </Link>
      <nav className="flex items-center gap-3 text-sm font-semibold">
        {staff ? (
          <Link href="/staff/dashboard" className="hover:underline">
            Dashboard
          </Link>
        ) : (
          <>
            <Link href="/card" className="hover:underline">
              Card
            </Link>
            <Link href="/join" className="hover:underline">
              Join
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
