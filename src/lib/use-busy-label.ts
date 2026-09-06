import { useEffect, useState } from 'react'

// While the worker anneals, the button cycles through the stages of the craft
// every 5s so long runs feel alive.
const BUSY_VERBS = ['Annealing…', 'Heating…', 'Cooling…', 'Tempering…', 'Quenching…', 'Polishing…']

/**
 * The generate button's label while a run is in flight.
 *
 * Owned above both buttons that show it: on a phone the panel's Generate and
 * the toolbar's are on screen in the same run, and two timers started a moment
 * apart would have them reading different stages of the same anneal.
 */
export function useBusyLabel(busy: boolean) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!busy) {
      setIndex(0)
      return
    }
    const timer = setInterval(() => setIndex((i) => i + 1), 5000)
    return () => clearInterval(timer)
  }, [busy])

  return BUSY_VERBS[index % BUSY_VERBS.length]
}
