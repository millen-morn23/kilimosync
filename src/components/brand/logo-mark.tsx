import type { SVGProps } from "react";

/**
 * KilimoSync icon mark: a leaf split into two synced halves — deep green
 * (the farm) and fresh green (the market) — meeting at a single vein, with
 * a small node at the tip standing in for the "sync" connecting them.
 */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M20 4C10.06 4 4 13.16 4 22.5 4 30.34 9.53 36.53 20 38V4Z"
        fill="#166534"
      />
      <path
        d="M20 4c9.94 0 16 9.16 16 18.5C36 30.34 30.47 36.53 20 38V4Z"
        fill="#22C55E"
      />
      <circle cx="20" cy="7.5" r="3" fill="#F5F5DC" />
    </svg>
  );
}
