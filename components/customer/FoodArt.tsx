/**
 * Food illustrations.
 *
 * Hand-authored vectors with gradient shading, standing in for the photographic
 * food in the reference designs. Drawn rather than photographed on purpose:
 * they ship inside the bundle, need no external request or licence, stay crisp
 * at any size, and sit in the brand palette. All decorative, so all hidden from
 * assistive technology.
 *
 * Gradient ids are fixed rather than generated. Rendering the same dish twice
 * on one page duplicates an id, and SVG then resolves to the first definition -
 * which is identical, so the result is unchanged.
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

/** Soft contact shadow shared by the free-standing dishes. */
function Shadow({ cx, cy, rx, ry = 5 }: { cx: number; cy: number; rx: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#c9a86b" opacity="0.22" />;
}

export function Burger({ className }: Art) {
  return (
    <Frame className={className} viewBox="0 0 120 104">
      <defs>
        <linearGradient id="ffa-bun-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6c675" />
          <stop offset="0.55" stopColor="#e8a94e" />
          <stop offset="1" stopColor="#d9973c" />
        </linearGradient>
        <linearGradient id="ffa-bun-bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6a94f" />
          <stop offset="1" stopColor="#c9863a" />
        </linearGradient>
        <linearGradient id="ffa-patty" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c4a26" />
          <stop offset="1" stopColor="#5d3419" />
        </linearGradient>
        <linearGradient id="ffa-cheese" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd45e" />
          <stop offset="1" stopColor="#f7b32b" />
        </linearGradient>
      </defs>

      <Shadow cx={60} cy={96} rx={44} />

      {/* top bun */}
      <path d="M12 46C12 25 33 10 60 10s48 15 48 36z" fill="url(#ffa-bun-top)" />
      <path d="M22 36c5-13 20-21 38-21" stroke="#ffdca0" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.75" />
      <g fill="#fff4de">
        <ellipse cx="42" cy="28" rx="4" ry="2.4" transform="rotate(-18 42 28)" />
        <ellipse cx="60" cy="22" rx="4" ry="2.4" />
        <ellipse cx="78" cy="29" rx="4" ry="2.4" transform="rotate(18 78 29)" />
        <ellipse cx="30" cy="39" rx="3.4" ry="2.1" transform="rotate(-30 30 39)" />
      </g>

      {/* tomato + cheese */}
      <path d="M11 46h98l-4 9H15z" fill="#e05a45" />
      <path d="M10 54h100l-9 12-10-8-11 8-10-8-11 8-10-8-11 7-9-8z" fill="url(#ffa-cheese)" />

      {/* patty */}
      <rect x="10" y="62" width="100" height="16" rx="8" fill="url(#ffa-patty)" />

      {/* lettuce */}
      <path d="M9 78h102c-3 6-9 9-16 8-6 4-13 4-19 0-6 4-13 4-19 0-6 4-13 4-19 0-7 1-13-2-16-8z" fill="#7fae55" />

      {/* bottom bun */}
      <path d="M14 84h92a10 10 0 0 1-10 12H24a10 10 0 0 1-10-12z" fill="url(#ffa-bun-bottom)" />
    </Frame>
  );
}

export function Fries({ className }: Art) {
  return (
    <Frame className={className} viewBox="0 0 100 110">
      <defs>
        <linearGradient id="ffa-carton" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e8543f" />
          <stop offset="0.55" stopColor="#d63c28" />
          <stop offset="1" stopColor="#b52f1e" />
        </linearGradient>
        <linearGradient id="ffa-fry" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffdd8a" />
          <stop offset="1" stopColor="#f0b53f" />
        </linearGradient>
      </defs>

      <Shadow cx={50} cy={104} rx={34} ry={4} />

      {/* fries */}
      <g fill="url(#ffa-fry)">
        <rect x="18" y="20" width="11" height="46" rx="5.5" transform="rotate(-12 23 43)" />
        <rect x="32" y="10" width="11" height="56" rx="5.5" transform="rotate(-5 37 38)" />
        <rect x="46" y="6" width="11" height="60" rx="5.5" />
        <rect x="59" y="12" width="11" height="54" rx="5.5" transform="rotate(7 64 39)" />
        <rect x="71" y="24" width="11" height="42" rx="5.5" transform="rotate(15 76 45)" />
      </g>

      {/* carton */}
      <path d="M16 52h68l-8 48a8 8 0 0 1-8 7H32a8 8 0 0 1-8-7z" fill="url(#ffa-carton)" />
      <path d="M18 62h64l-1.6 10H19.6z" fill="#fff" opacity="0.9" />
    </Frame>
  );
}

export function PizzaSlice({ className }: Art) {
  return (
    <Frame className={className} viewBox="0 0 110 100">
      <defs>
        <linearGradient id="ffa-pizza" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbdc9d" />
          <stop offset="1" stopColor="#f3c16a" />
        </linearGradient>
        <linearGradient id="ffa-crust" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eab463" />
          <stop offset="1" stopColor="#d1913f" />
        </linearGradient>
      </defs>

      <Shadow cx={55} cy={94} rx={38} ry={4} />

      <path d="M55 6 100 84a6 6 0 0 1-5 9H15a6 6 0 0 1-5-9z" fill="url(#ffa-pizza)" />
      <path d="M15 93h80a6 6 0 0 0 5-9l-3-6H13l-3 6a6 6 0 0 0 5 9z" fill="url(#ffa-crust)" />
      <g fill="#d94a37">
        <circle cx="55" cy="32" r="7" />
        <circle cx="38" cy="56" r="6.2" />
        <circle cx="72" cy="57" r="6.2" />
        <circle cx="55" cy="70" r="5.4" />
      </g>
      <g fill="#8fb85f">
        <ellipse cx="44" cy="38" rx="3.4" ry="2.2" transform="rotate(-25 44 38)" />
        <ellipse cx="66" cy="45" rx="3.4" ry="2.2" transform="rotate(20 66 45)" />
      </g>
    </Frame>
  );
}

export function GrainBowl({ className }: Art) {
  return (
    <Frame className={className} viewBox="0 0 120 92">
      <defs>
        <linearGradient id="ffa-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e6ded0" />
        </linearGradient>
        <linearGradient id="ffa-chicken" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e7b56b" />
          <stop offset="1" stopColor="#c98f42" />
        </linearGradient>
      </defs>

      <Shadow cx={60} cy={86} rx={40} ry={4} />

      {/* contents mounded above the rim */}
      <path d="M22 44a38 26 0 0 1 76 0z" fill="#fbf3e2" />
      <g>
        <rect x="30" y="26" width="26" height="11" rx="5.5" fill="url(#ffa-chicken)" transform="rotate(-8 43 31)" />
        <rect x="34" y="17" width="26" height="11" rx="5.5" fill="url(#ffa-chicken)" transform="rotate(-4 47 22)" />
        <circle cx="76" cy="30" r="8" fill="#8fb85f" />
        <circle cx="88" cy="38" r="6" fill="#e05a45" />
        <circle cx="66" cy="38" r="5" fill="#ffc93c" />
        <path d="M72 44a8 8 0 1 1 16 0" stroke="#c0498f" strokeWidth="3" fill="none" opacity="0.75" />
      </g>

      {/* bowl */}
      <path d="M14 44h92a46 40 0 0 1-92 0z" fill="url(#ffa-bowl)" />
      <rect x="12" y="40" width="96" height="8" rx="4" fill="#fffdf8" />
      <path d="M28 62a34 26 0 0 0 20 16" stroke="#ffffff" strokeWidth="4" fill="none" opacity="0.6" strokeLinecap="round" />
    </Frame>
  );
}

export function Wrap({ className }: Art) {
  return (
    <Frame className={className} viewBox="0 0 90 110">
      <defs>
        <linearGradient id="ffa-wrap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f3dcae" />
          <stop offset="0.6" stopColor="#e5c684" />
          <stop offset="1" stopColor="#cfa960" />
        </linearGradient>
      </defs>

      <Shadow cx={45} cy={104} rx={26} ry={4} />

      <path d="M26 30h38l10 68a6 6 0 0 1-6 7H22a6 6 0 0 1-6-7z" fill="url(#ffa-wrap)" />
      <path d="M22 52h46l1.6 10H20.6z" fill="#d9bb7c" opacity="0.7" />
      <ellipse cx="45" cy="30" rx="19" ry="8" fill="#fbf3e2" />
      <g>
        <circle cx="36" cy="28" r="5" fill="#8fb85f" />
        <circle cx="48" cy="26" r="5" fill="#e05a45" />
        <circle cx="55" cy="31" r="4" fill="#ffc93c" />
      </g>
    </Frame>
  );
}

export function DrinkCup({ className }: Art) {
  return (
    <Frame className={className} viewBox="0 0 76 110">
      <defs>
        <linearGradient id="ffa-cup" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a4a52" />
          <stop offset="0.5" stopColor="#2c2c33" />
          <stop offset="1" stopColor="#17171c" />
        </linearGradient>
      </defs>
      <Shadow cx={38} cy={104} rx={24} ry={4} />
      <path d="M16 20h44l-6 80a8 8 0 0 1-8 7H30a8 8 0 0 1-8-7z" fill="url(#ffa-cup)" />
      <rect x="12" y="12" width="52" height="12" rx="6" fill="#d8d8de" />
      <path d="M44 12 52 0" stroke="#e05a45" strokeWidth="6" strokeLinecap="round" />
    </Frame>
  );
}

export function PaperBag({ className, note }: Art & { note?: React.ReactNode }) {
  return (
    <div className={className}>
      <div className="relative h-full w-full">
      <Frame className="h-full w-full" viewBox="0 0 100 120">
        <defs>
          <linearGradient id="ffa-bag" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#e5cba4" />
            <stop offset="0.55" stopColor="#d4b184" />
            <stop offset="1" stopColor="#b8916a" />
          </linearGradient>
        </defs>
        <Shadow cx={50} cy={114} rx={34} ry={4} />
        <path d="M14 30h72v82a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" fill="url(#ffa-bag)" />
        <path d="M14 30h72v14H14z" fill="#c9a87c" />
      </Frame>
      {note ? (
        <span className="script absolute inset-x-3 top-[38%] text-center text-[0.72rem] leading-tight text-ink-800">
          {note}
        </span>
      ) : null}
      </div>
    </div>
  );
}

/**
 * Generic insulated delivery bag. Deliberately unbranded - no third-party mark
 * is reproduced anywhere in this app.
 */
export function DeliveryBag({ className }: Art) {
  return (
    <Frame className={className} viewBox="0 0 110 120">
      <defs>
        <linearGradient id="ffa-delivery" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe58a" />
          <stop offset="0.5" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#e8b21c" />
        </linearGradient>
      </defs>
      <Shadow cx={55} cy={114} rx={38} ry={4} />
      <path d="M36 20h38v10H36z" fill="#2c2c33" />
      <rect x="12" y="28" width="86" height="86" rx="10" fill="url(#ffa-delivery)" />
      <rect x="24" y="44" width="62" height="34" rx="6" fill="#fff" opacity="0.35" />
      <rect x="12" y="28" width="86" height="10" rx="5" fill="#fff" opacity="0.3" />
    </Frame>
  );
}

/** Document with a food mark: the empty state for the cart-screenshot slot. */
export function CartDocArt({ className }: Art) {
  return (
    <Frame className={className} viewBox="0 0 110 100">
      <path d="M22 10h48l18 18v52a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z" fill="#fff" stroke="#e6ded0" strokeWidth="2.5" />
      <path d="M70 10v18h18" fill="none" stroke="#e6ded0" strokeWidth="2.5" />
      <g transform="translate(30 30) scale(0.42)">
        <path d="M12 46C12 25 33 10 60 10s48 15 48 36z" fill="#e8a94e" />
        <rect x="10" y="62" width="100" height="16" rx="8" fill="#7c4a26" />
        <path d="M14 84h92a10 10 0 0 1-10 12H24a10 10 0 0 1-10-12z" fill="#c9863a" />
      </g>
      <g fill="#eee7da">
        <rect x="30" y="62" width="50" height="6" rx="3" />
        <rect x="30" y="74" width="34" height="6" rx="3" />
      </g>
    </Frame>
  );
}

/** Receipt marked AED: the empty state for the checkout-screenshot slot. */
export function ReceiptArt({ className }: Art) {
  return (
    <Frame className={className} viewBox="0 0 110 100">
      <path d="M26 8h58a4 4 0 0 1 4 4v78l-8-5-8 5-8-5-8 5-8-5-8 5-8-5-8 5V12a4 4 0 0 1 4-4z" fill="#fff" stroke="#e6ded0" strokeWidth="2.5" />
      <g fill="#eee7da">
        <rect x="34" y="24" width="42" height="6" rx="3" />
        <rect x="34" y="38" width="30" height="6" rx="3" />
      </g>
      <text
        x="30"
        y="72"
        fontFamily="var(--font-sans)"
        fontSize="17"
        fontWeight="800"
        fill="#8a93a6"
      >
        AED
      </text>
    </Frame>
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

/**
 * The overlapping spread used in hero banners: fries, burger, bowl and wrap,
 * arranged the way the reference lays them out.
 */
export function FoodSpread({ className }: Art) {
  return (
    <div className={`pointer-events-none select-none ${className ?? ""}`} aria-hidden="true">
      <div className="relative h-full w-full">
        <Fries className="absolute bottom-[16%] left-0 h-[64%] w-auto drop-shadow-sm" />
        <PizzaSlice className="absolute bottom-[42%] left-[22%] h-[44%] w-auto -rotate-6 drop-shadow-sm" />
        <Burger className="absolute bottom-[6%] left-[15%] h-[52%] w-auto drop-shadow" />
        <GrainBowl className="absolute bottom-[6%] left-[46%] h-[42%] w-auto drop-shadow-sm" />
        <Wrap className="absolute bottom-[10%] right-0 h-[54%] w-auto rotate-6 drop-shadow-sm" />
      </div>
    </div>
  );
}
