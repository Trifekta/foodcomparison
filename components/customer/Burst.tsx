/**
 * The small ray burst behind a success mark. Purely decorative, so it is hidden
 * from assistive technology and carries no motion.
 */
export function Burst({ className = "" }: { className?: string }) {
  const rays = [
    { x: 12, y: 30, r: -35 },
    { x: 30, y: 12, r: -12 },
    { x: 96, y: 10, r: 14 },
    { x: 116, y: 32, r: 38 },
    { x: 6, y: 74, r: -62 },
    { x: 122, y: 76, r: 62 },
    { x: 52, y: 4, r: -4 },
    { x: 78, y: 6, r: 8 },
  ];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 132 110"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {rays.map((ray, index) => (
        <rect
          key={index}
          x={ray.x}
          y={ray.y}
          width={index % 2 === 0 ? 4 : 3}
          height={index % 3 === 0 ? 16 : 11}
          rx={2}
          fill="currentColor"
          transform={`rotate(${ray.r} ${ray.x} ${ray.y})`}
        />
      ))}
    </svg>
  );
}
