/**
 * Interface artwork that is not food.
 *
 * The food itself comes from the supplied renders in /public/food - see
 * components/customer/FoodPhoto.tsx. What remains here is the tick badge on the
 * confirmation screen, which no asset covers.
 */

type Art = { className?: string };

function Frame({ className, viewBox, children }: Art & { viewBox: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

/** Big yellow tick used on the confirmation screen. */
export function TickBadge({ className }: Art) {
  return (
    <Frame className={className} viewBox="0 0 120 120">
      <defs>
        <linearGradient id="ffa-tick" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#f5bf12" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="46" fill="url(#ffa-tick)" />
      <path
        d="m38 62 15 15 30-34"
        fill="none"
        stroke="#17171c"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}
