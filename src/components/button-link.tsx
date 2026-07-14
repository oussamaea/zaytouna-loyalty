import Link from "next/link";
import type { ComponentProps } from "react";

export function ButtonLink({
  className = "",
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`inline-flex min-h-12 items-center justify-center rounded-sm bg-[#24301f] px-5 py-3 text-center font-bold text-white transition hover:bg-[#4c5a2d] focus-visible:outline-2 ${className}`}
      {...props}
    />
  );
}
