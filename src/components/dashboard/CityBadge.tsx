import { inkFor } from '@/lib/weather'

export function CityBadge({
  code,
  color,
  size = 18,
}: {
  code: string
  color: string
  size?: number
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[5px] tabular-nums font-semibold tracking-wide"
      style={{
        height: size,
        paddingInline: size * 0.3,
        fontSize: size * 0.55,
        backgroundColor: color,
        color: inkFor(color),
      }}
    >
      {code}
    </span>
  )
}
