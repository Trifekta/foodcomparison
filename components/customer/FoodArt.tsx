/**
 * Food illustrations.
 *
 * Hand-authored flat vectors rather than photographs: they ship inside the
 * bundle (no external image request, nothing to license), stay crisp at any
 * size, and sit in the brand's warm palette. Every one is decorative, so they
 * are hidden from assistive technology.
 *
 * House style: flat fills, no outlines, gently geometric. Warm enough to read
 * as takeaway food, restrained enough not to look like a children's app.
 */

type IconProps = { className?: string };

const BUN = "#efb15f";
const BUN_DARK = "#e09b45";
const PATTY = "#8a5433";
const LETTUCE = "#8ab266";
const CHEESE = "#ffc93c";
const TOMATO = "#dd5540";
const CARTON = "#e2543f";
const FRY = "#f5c455";
const CRUST = "#eec27c";
const DOUGH = "#f8d99a";
const BOWL = "#d94f3d";
const RICE = "#fdf3e0";
const WRAP = "#e8c890";

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

export function BurgerIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      {/* top bun */}
      <path d="M8 27a24 16 0 0 1 48 0z" fill={BUN} />
      <circle cx="24" cy="19" r="1.7" fill={RICE} />
      <circle cx="33" cy="15.5" r="1.7" fill={RICE} />
      <circle cx="42" cy="19.5" r="1.7" fill={RICE} />
      {/* cheese */}
      <path d="M9 28h46l-5 6-6-4-6 4-6-4-6 4-6-4-5 3z" fill={CHEESE} />
      {/* patty */}
      <rect x="8" y="33" width="48" height="9" rx="4.5" fill={PATTY} />
      {/* lettuce */}
      <path d="M8 42h48a6 6 0 0 1-6 4H14a6 6 0 0 1-6-4z" fill={LETTUCE} />
      {/* bottom bun */}
      <path d="M10 46h44a4 4 0 0 1-4 6H14a4 4 0 0 1-4-6z" fill={BUN_DARK} />
    </Svg>
  );
}

export function FriesIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      {/* fries */}
      <rect x="18" y="12" width="6" height="26" rx="3" fill={FRY} transform="rotate(-9 21 25)" />
      <rect x="27" y="8" width="6" height="30" rx="3" fill="#f8d372" />
      <rect x="36" y="12" width="6" height="26" rx="3" fill={FRY} transform="rotate(9 39 25)" />
      {/* carton */}
      <path d="M15 32h34l-4 20a3 3 0 0 1-3 2.5H22a3 3 0 0 1-3-2.5z" fill={CARTON} />
      <path d="M15 32h34l-1 5H16z" fill="#c8432f" />
    </Svg>
  );
}

export function PizzaIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      {/* slice */}
      <path d="M32 8 55 50a3 3 0 0 1-2.7 4.4H11.7A3 3 0 0 1 9 50z" fill={DOUGH} />
      {/* crust */}
      <path d="M11.7 54.4h40.6A3 3 0 0 0 55 50l-1.6-3H10.6L9 50a3 3 0 0 0 2.7 4.4z" fill={CRUST} />
      {/* toppings */}
      <circle cx="32" cy="26" r="3.6" fill={TOMATO} />
      <circle cx="24" cy="38" r="3.2" fill={TOMATO} />
      <circle cx="40" cy="38" r="3.2" fill={TOMATO} />
      <circle cx="32" cy="17" r="2" fill={CHEESE} />
    </Svg>
  );
}

export function BowlIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      {/* contents */}
      <path d="M16 32a16 12 0 0 1 32 0z" fill={RICE} />
      <circle cx="24" cy="27" r="4" fill={LETTUCE} />
      <circle cx="33" cy="24" r="4.5" fill={TOMATO} />
      <circle cx="42" cy="27.5" r="3.6" fill={CHEESE} />
      {/* bowl */}
      <path d="M10 32h44a22 20 0 0 1-44 0z" fill={BOWL} />
      <rect x="8" y="30" width="48" height="5" rx="2.5" fill="#e8604c" />
    </Svg>
  );
}

export function WrapIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <g transform="rotate(-28 32 32)">
        <rect x="20" y="10" width="24" height="44" rx="12" fill={WRAP} />
        <path d="M20 22h24v6H20z" fill="#dbb87a" />
        <ellipse cx="32" cy="14" rx="12" ry="5" fill={RICE} />
        <circle cx="27" cy="14" r="2.4" fill={LETTUCE} />
        <circle cx="35" cy="13" r="2.4" fill={TOMATO} />
      </g>
    </Svg>
  );
}

const ICONS = {
  burger: BurgerIcon,
  fries: FriesIcon,
  pizza: PizzaIcon,
  bowl: BowlIcon,
  wrap: WrapIcon,
} as const;

export type FoodName = keyof typeof ICONS;

export function FoodIcon({ name, className }: { name: FoodName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon className={className} />;
}

/**
 * Warm banner strip. Used once per screen at most, as a header accent - never
 * as a decorative background behind content that has to stay readable.
 */
export function FoodStrip({
  items = ["burger", "fries", "pizza", "bowl"],
  className = "",
}: {
  items?: FoodName[];
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-end justify-center gap-3 overflow-hidden rounded-3xl bg-linear-to-b from-flame-100 to-cream px-4 pb-3 pt-4 ${className}`}
    >
      {/* soft glow behind the row */}
      <span
        aria-hidden="true"
        className="absolute inset-x-8 -top-10 h-24 rounded-full bg-brand-200/60 blur-2xl"
      />
      {items.map((name, index) => (
        <FoodIcon
          key={name}
          name={name}
          className={
            index === 1 || index === 2
              ? "relative h-14 w-14 drop-shadow-sm"
              : "relative h-11 w-11 opacity-90 drop-shadow-sm"
          }
        />
      ))}
    </div>
  );
}

/** Confirmation graphic: a receipt-style card with a food mark and a tick. */
export function PriceCheckMark({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* receipt */}
      <path
        d="M28 22h56a4 4 0 0 1 4 4v66l-8-5-8 5-8-5-8 5-8-5-8 5-8-5-8 5V26a4 4 0 0 1 4-4z"
        fill="#ffffff"
      />
      {/* food mark, centred on the receipt */}
      <g transform="translate(44 26) scale(0.45)">
        <path d="M8 27a24 16 0 0 1 48 0z" fill={BUN} />
        <rect x="8" y="30" width="48" height="9" rx="4.5" fill={PATTY} />
        <path d="M10 41h44a4 4 0 0 1-4 6H14a4 4 0 0 1-4-6z" fill={BUN_DARK} />
      </g>
      <rect x="38" y="60" width="40" height="5" rx="2.5" fill="var(--color-sand)" />
      <rect x="38" y="70" width="28" height="5" rx="2.5" fill="var(--color-sand)" />
      <rect x="38" y="80" width="16" height="5" rx="2.5" fill="var(--color-sand)" />
      {/* tick badge */}
      <circle cx="86" cy="84" r="20" fill="#15a34a" />
      <path
        d="m77 84 6 6 12-13"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
