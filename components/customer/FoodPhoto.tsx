/**
 * The supplied food renders.
 *
 * Served straight from /public/food as plain <img>. next/image is not used
 * because its optimiser needs a Cloudflare Images binding this Worker does not
 * declare; these are pre-sized PNGs with their own alpha, so there is nothing
 * for the optimiser to add.
 *
 * Every one is decorative, so each carries an empty alt and is hidden from
 * assistive technology.
 */

const SOURCES = {
  spread: "/food/spread.png",
  celebration: "/food/celebration.png",
  bagCluster: "/food/bag-cluster.png",
  bowl: "/food/bowl.png",
  burger: "/food/burger.png",
  cartDoc: "/food/cart-doc.png",
  receipt: "/food/receipt.png",
} as const;

export type FoodPhotoName = keyof typeof SOURCES;

export function FoodPhoto({
  name,
  className,
  /** Above the fold: skip lazy loading so the hero paints with the screen. */
  eager = false,
}: {
  name: FoodPhotoName;
  className?: string;
  eager?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SOURCES[name]}
      alt=""
      aria-hidden="true"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={className}
    />
  );
}
