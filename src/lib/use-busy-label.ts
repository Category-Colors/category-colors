import { useEffect, useState } from 'react'

// While the worker anneals, the button cycles through the stages of the craft
// every 5s so long runs feel alive.
const BUSY_VERBS = ['Annealing…', 'Heating…', 'Cooling…', 'Tempering…', 'Quenching…', 'Polishing…']

/**
 * The generate button's label while a run is in flight.
 *
 * Called by each button rather than lifted above them: the panel's Generate
 * and the toolbar's are never on screen together — the toolbar ducks away
 * whenever a sheet is up, and there is no toolbar at all above the phone
 * breakpoint — so they have nothing to stay in step with. Lifting it would
 * put a 5-second timer on the app root and re-render the whole tree, charts
 * included, to change one word in one button.
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
