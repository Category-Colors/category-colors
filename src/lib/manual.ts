// The manual's content: every technical term the interface uses, grouped the
// way the work happens. Data only — Manual.tsx renders it and filters it.
//
// `where` names the control the term belongs to, in the interface's own words
// (panel › folder), and is left off concepts that have no control. Definitions
// state what the app actually does, so anything numeric here is a value read
// from the code, not a round figure: keep them in step when defaults move.

export interface ManualEntry {
  term: string
  /** The control this term names, as "Panel › Folder". Omitted for concepts. */
  where?: string
  body: string
}

interface ManualSection {
  title: string
  blurb: string
  entries: ManualEntry[]
}

export const MANUAL: ManualSection[] = [
  {
    title: 'The run',
    blurb:
      'Generate hands the parameters to a background thread and searches for a palette. Nothing here is a setting you tune directly, apart from the two the Optimizer folder exposes — but they are what the numbers in the report are describing.',
    entries: [
      {
        term: 'Simulated annealing',
        where: 'Generate',
        body: 'The search. It starts from a random palette, nudges one color at a time, and keeps the change if it lowers the cost. A change that raises the cost is also sometimes kept — with a probability that falls as the run cools — which is what lets it climb out of a merely decent palette on its way to a better one. Named for the metallurgical process: heat, then cool slowly enough that the structure settles.',
      },
      {
        term: 'Cost',
        where: 'Report › Statistics',
        body: 'The one number the run makes small: the weighted average of every active evaluator’s score. It has no unit and no absolute meaning. Two palettes are only comparable by cost if they were scored by the same evaluators at the same weights.',
      },
      {
        term: 'Temperature',
        body: 'How willing the run is to accept a worse palette. It is set at the start by sampling 100 random changes and picking the value that would accept about 95% of them, then falls for the rest of the run. It also sets how far each nudge moves: hot runs make large jumps, cold runs make small corrections.',
      },
      {
        term: 'Cooling rate',
        body: 'The factor temperature is multiplied by every iteration — 0.999. Cooling is geometric, so the run usually reaches its stopping temperature well before the iteration cap; raising Iterations past that point changes nothing.',
      },
      {
        term: 'Neighbor',
        body: 'One candidate palette: the current one with a single color moved a short distance inside the working space. The move shrinks from 0.15 of the space down to 0.005 as the run cools. Colors marked Fix color are never chosen.',
      },
      {
        term: 'Iterations',
        where: 'Configuration › Optimizer',
        body: 'A ceiling on annealing steps, 1,000 to 100,000, default 20,000. It is a limit rather than a target — the run stops at whichever comes first, this or the temperature reaching its cutoff. More iterations buy a longer search at a proportionally longer wait, with sharp diminishing returns.',
      },
      {
        term: 'Loss curve',
        where: 'Report › Statistics',
        body: 'Cost plotted against iteration, sampled about 250 times across the run, with the start, high, low and end points marked. Expect a steep early fall and a long flat tail. A curve still dropping at the right edge means the run was cut off with progress left in it — raise Iterations.',
      },
      {
        term: 'Order optimization',
        where: 'Configuration › Optimizer',
        body: 'A pass after annealing that reorders the finished colors so that consecutive ones are as evenly spaced as possible. It matters when something assigns colors by position — the first two series in a chart should not be near-neighbors. Up to 10 colors every order is tried; past that it settles for repeated pairwise swaps. Colors marked Fix order stay put.',
      },
    ],
  },
  {
    title: 'Evaluators',
    blurb:
      'An evaluator scores the palette on one criterion and returns a number the run tries to reduce. They are averaged, not summed, so evaluators only ever compete for the same budget: adding one dilutes every other. Weight is the only dial that matters, and it is relative.',
    entries: [
      {
        term: 'Evaluator',
        where: 'Configuration › Evaluators',
        body: 'One scoring function with its own weight and settings. Any number can be stacked, including several of the same type — two CVD evaluators for different deficiencies is the common case. An evaluator at weight 0 is skipped entirely.',
      },
      {
        term: 'Weight',
        where: 'Configuration › Evaluators',
        body: 'How much this evaluator’s score counts toward cost, 0 to 1. Only the ratio between weights matters: all evaluators at 0.5 behaves identically to all at 1. Raising one is the same as lowering all the others.',
      },
      {
        term: 'Score',
        where: 'Report › Statistics',
        body: 'What one evaluator returned for the finished palette, before its weight is applied. Scores from different evaluator types are on different scales and are not comparable to each other — compare a score only against the same evaluator on another palette.',
      },
      {
        term: 'Share',
        where: 'Report › Statistics',
        body: 'The fraction of the total cost this evaluator contributes, after weighting. The most useful column in the table: an evaluator with a large share is the one holding the palette back, and the one whose weight will change the result if you move it.',
      },
      {
        term: 'Energy',
        body: 'Pushes every color away from every other. Each pair is charged by how close it is, cubed, so the penalty concentrates on the closest pairs and near-duplicates dominate the score. The blunt instrument of the set: it wants colors far apart and has no opinion about anything else.',
      },
      {
        term: 'Range',
        body: 'Evens out the spacing. It measures the spread of all the pairwise distances and penalizes variation in them, so it prefers a palette whose colors are equally far apart over one with two tight clusters at opposite ends. It says nothing about how far apart they are — pair it with Energy or JND, which do.',
      },
      {
        term: 'JND',
        body: 'Penalizes pairs that fall below the JND threshold. The charge is the ratio of threshold to distance raised to the fourth power, which is near zero for comfortable pairs and enormous for colliding ones. Where Energy asks for distance in general, this asks for a specific floor and stops caring above it.',
      },
      {
        term: 'CVD',
        body: 'The JND evaluator run against a simulated copy of the palette. Every pair still has to clear the threshold, but under a condition where some pairs collapse that look distinct to you. Choose the simulation and its severity on the evaluator itself: three color vision deficiencies, or Grayscale (print), which is not one.',
      },
      {
        term: 'Similarity',
        body: 'Pulls the palette toward a set of target colors — for staying in the neighborhood of a brand or an existing chart. Targets are matched to palette colors one-to-one by minimum total distance (the Hungarian assignment), so it judges the palette as a set rather than color by color.',
      },
      {
        term: 'Target color',
        where: 'Configuration › Evaluators › Similarity',
        body: 'One color the Similarity evaluator pulls toward. The list is shared: every Similarity evaluator reads the same targets, because the algorithm has a single target set.',
      },
      {
        term: 'Avoid',
        body: 'The inverse of Similarity: pushes the palette away from colors you do not want it near — a background, a semantic red already spoken for, a competitor. A color is charged only for how far it has intruded inside the radius, and costs nothing once outside it.',
      },
      {
        term: 'Radius',
        where: 'Configuration › Evaluators › Avoid',
        body: 'How wide a berth to give each avoid color, 0.05 to 0.5, as a fraction of the largest distance the metric can report. Default 0.15.',
      },
      {
        term: 'Contrast',
        body: 'Holds WCAG contrast against a background color. Below the required ratio the penalty rises steeply; above it a small charge remains, so the run keeps buying more contrast when it is cheap.',
      },
      {
        term: 'Min ratio',
        where: 'Configuration › Evaluators › Contrast',
        body: 'The contrast ratio each color must reach against the background, 1 to 7. Default 3, which is the WCAG floor for non-text graphics. Use 4.5 if the colors will carry text.',
      },
      {
        term: 'Adjacent pairs',
        where: 'Configuration › Evaluators › Contrast',
        body: 'Also require the ratio between colors that end up next to each other in the list, not only against the background. For stacked bars and pie slices, where the boundary a reader needs to see is between two palette colors.',
      },
      {
        term: 'Saliency',
        body: 'Prefers colors people can name. It scores each color against a model built from a public color-naming survey: prototypical reds and blues score well, while the mud between named regions scores badly. Concerned with what a color means rather than where it sits, as Name difference is.',
      },
      {
        term: 'Name difference',
        body: 'Penalizes colors people would call by the same word. Every color carries a vector of how often survey participants reached for each of 153 terms — Heer and Stone (2012) — and the cost is the mean overlap between every pair, so two blues score badly however far apart ΔE puts them. Saliency asks whether a color has a name; this asks whether two colors share one.',
      },
    ],
  },
  {
    title: 'Color spaces',
    blurb:
      'The annealer searches inside one space, and only within the channel ranges you leave open. The space decides what "move a short distance" means, so it shapes the result as much as any evaluator does.',
    entries: [
      {
        term: 'Working space',
        where: 'Configuration › Color space',
        body: 'The space the search happens in. It is not the space colors are reported or exported in — those are set separately in the Output panel, and distances are always measured in the same perceptual space whatever this is set to.',
      },
      {
        term: 'Channel range',
        where: 'Configuration › Color space',
        body: 'A floor and ceiling on one channel, and the main way to give a palette a character. Narrow lightness for a palette that reads evenly on a chart; narrow saturation to keep it muted; leave hue wide open. Colors are only ever generated inside these bounds.',
      },
      {
        term: 'RGB',
        body: 'The sRGB cube: red, green and blue on 0 to 1. What screens accept, and the worst space to search in — equal steps in it look wildly unequal, and most of it is dark. Included for completeness.',
      },
      {
        term: 'HSL',
        body: 'Hue, saturation and lightness in a cylinder over sRGB. Intuitive to steer and not perceptually uniform: its yellows are far lighter than its blues at the same lightness, and saturation collapses toward both ends, so a fresh run starts in the middle band rather than the full range.',
      },
      {
        term: 'OKHSL',
        body: 'The default. Same three familiar channels as HSL, rebuilt on the OKLab model so that lightness means the same thing at every hue and saturation stays usable across the range. Cannot be written in CSS, which does not matter here — it is where the search happens, not how the result is exported.',
      },
      {
        term: 'OKLCH',
        body: 'Lightness, chroma and hue: the polar form of OKLab, and the one CSS speaks. Its chroma is an absolute quantity rather than a percentage of what is available, so wide chroma ranges push colors outside sRGB in the greens and yellows, where less is on offer.',
      },
      {
        term: 'OKLAB',
        body: 'Lightness plus two opponent axes. Cartesian rather than polar, so it has no hue channel to bound — useful when you want to constrain a direction (only warm colors, say) rather than a hue arc.',
      },
      {
        term: 'Hue',
        body: 'Position around the color wheel, 0–360°, where the color sits between red, yellow, green and blue. The one channel that is an angle: its range wraps, and 0 and 360 are the same place.',
      },
      {
        term: 'Saturation',
        body: 'How far a color is from grey, as a fraction of how far it could go at that hue and lightness. Because it is relative, a fully saturated dark color and a fully saturated light one are not equally colorful.',
      },
      {
        term: 'Lightness',
        body: 'How light the color is, from black to white. In OKHSL, OKLCH and OKLab it is perceptual: two colors at the same lightness look equally light. In HSL it is not, which is the difference between the two.',
      },
      {
        term: 'Chroma',
        body: 'Colorfulness in absolute terms — unlike saturation, not scaled to what is achievable. sRGB tops out near 0.32, and much lower in some hues, so a high chroma range asks for colors that do not exist on a screen.',
      },
      {
        term: 'Opponent axes',
        body: 'OKLab’s a and b, labeled Green–red and Blue–yellow. They come from opponent process theory: the visual system encodes color as two signed differences rather than three primaries, so negative a is green and positive a is red. Zero on both is grey.',
      },
      {
        term: 'Perceptual uniformity',
        body: 'The property that equal numeric steps look like equal visual steps. It is what the OK spaces have and RGB and HSL do not, and it is why the search and every distance in the app happen in perceptual spaces: without it, a palette optimized for even spacing would not look evenly spaced.',
      },
      {
        term: 'Gamut',
        body: 'The set of colors a device can actually show. The map draws the sRGB gamut as a point cloud so you can see the shape of what is available — it is not a cylinder, and the room for chroma varies sharply with hue and lightness.',
      },
    ],
  },
  {
    title: 'Measuring color',
    blurb:
      'Every distance in the app is the same measurement, and every threshold is a line drawn across it. Two colors are "distinguishable" here in a specific, checkable sense.',
    entries: [
      {
        term: 'ΔE',
        body: 'Delta E: the perceptual distance between two colors. Roughly, 1 is the smallest difference a person can see under ideal conditions; charts need considerably more, because their marks are small, separated, and surrounded by other colors.',
      },
      {
        term: 'CIEDE2000',
        body: 'The formula the app uses for every ΔE, computed in CIELAB. It corrects the older Euclidean distance for the places plain geometry misleads — particularly the blues, where equal numeric distances look much smaller than elsewhere.',
      },
      {
        term: 'JND',
        body: 'Just-noticeable difference: the smallest change a viewer can reliably detect. Here it means the ΔE below which two palette colors are treated as colliding.',
      },
      {
        term: 'JND threshold',
        where: 'Configuration › Optimizer',
        body: 'The line itself, 5 to 40, default 20. It sets both what the JND and CVD evaluators penalize and what the report calls a failure, so raising it makes the report stricter and the search harder in one move. Above roughly 25 a large palette becomes impossible to satisfy and every pair fails.',
      },
      {
        term: 'Pair grid',
        where: 'Report › Pairs',
        body: 'Every pair of colors in the palette, as a lower triangle — the upper half would repeat it. Each cell carries the pair’s ΔE over its contrast ratio, with the failing tests marked by letter. Hover a cell or a swatch for the full breakdown.',
      },
      {
        term: 'Issue',
        where: 'Report › Pairs',
        body: 'One pair falling below the JND threshold under one test. The count beside the Report tab is the total across every test, so a single bad pair can be counted several times over — once for normal vision and once per simulated deficiency.',
      },
      {
        term: 'WCAG contrast ratio',
        body: 'The luminance-based ratio from the accessibility guidelines, between 1:1 and 21:1. It measures light against dark only — two colors of the same lightness contrast at 1:1 no matter how different their hues — which is exactly why it is reported alongside ΔE rather than instead of it.',
      },
      {
        term: 'Non-text contrast',
        where: 'Report › Pairs',
        body: 'WCAG 1.4.11: graphical objects that carry meaning need at least 3:1 against what is behind them. The grid measures each color against the live page background, so it changes with the theme.',
      },
      {
        term: 'Relative luminance',
        body: 'The perceived brightness of a color on a 0–1 scale, the quantity contrast ratios are computed from. Also what decides whether text drawn over a swatch is set in near-black or near-white.',
      },
      {
        term: 'min pair ΔE · mean pair ΔE',
        where: 'Report › Statistics',
        body: 'The closest pair in the palette, and the average across all pairs. The minimum is the number that matters — a palette is only as distinguishable as its worst pair, and the mean can look healthy while one collision hides inside it.',
      },
      {
        term: 'L range · C range',
        where: 'Report › Statistics',
        body: 'The lightness and chroma spread of the finished palette, always reported in OKLCH whatever space the run worked in, so runs in different spaces stay comparable. A narrow L range means the colors will hold up in greyscale but may fight when placed adjacent.',
      },
      {
        term: 'Color naming model',
        body: 'The data behind the Saliency evaluator: a map of CIELAB scored by how consistently people give each region the same name, derived from a large public color survey. Colors near the center of a named region score high; colors between regions score low.',
      },
    ],
  },
  {
    title: 'Color vision',
    blurb:
      'Color vision deficiency is the single most common reason a categorical palette fails in use. It is commonly given as around 8% of men and 0.5% of women — enough that any palette meant for an audience should be checked.',
    entries: [
      {
        term: 'Color vision deficiency',
        body: 'CVD: reduced ability to tell certain colors apart, from one of the three cone types being shifted in sensitivity or absent. It is not seeing in greyscale — most people with CVD see color perfectly well, but some pairs that look distinct to others collapse into one.',
      },
      {
        term: 'Protanomaly',
        body: 'Shifted red cones. Reds are darkened and pulled toward green, so red and green — and red and dark brown or black — are the pairs that collide.',
      },
      {
        term: 'Deuteranomaly',
        body: 'Shifted green cones, and by a wide margin the most common form. Red and green again, but with reds keeping their brightness. Weighted highest of the three by default, for that reason.',
      },
      {
        term: 'Tritanomaly',
        body: 'Shifted blue cones. Rare. Blue against green, and yellow against pink or violet.',
      },
      {
        term: '-anomaly vs -anopia',
        body: 'Anomaly means a cone type is present but shifted; anopia means it is missing altogether. The app models the anomalous forms and uses Severity to cover the range, where severity 1 is effectively the anopia.',
      },
      {
        term: 'Severity',
        where: 'Configuration › Evaluators › CVD',
        body: 'How pronounced the simulation is, 0 to 1, default 0.5. At 0 it is normal vision; at 1 the affected cone contributes nothing. Optimizing against 1 is the conservative choice and costs the palette some of its range. The control is absent on Grayscale (print), which has no meaningful degree — it always runs at full.',
      },
      {
        term: 'CVD simulation',
        body: 'The transform used to produce the palette as it would appear with a deficiency, from a physiologically-based model (Machado et al., 2009) that interpolates smoothly with severity. The same transform drives both the evaluators and the report’s columns. Any claim about CVD is relative to the model behind it, which is why this one is named here.',
      },
      {
        term: 'Grayscale (print)',
        where: 'Configuration › Evaluators › CVD › Simulation',
        body: 'The fourth option on a CVD evaluator, and the one that is not a vision condition: a luminance projection — the same matrix CSS filter: grayscale() uses — standing in for a palette that gets printed or photocopied. It has no Severity, so that control disappears when you pick it; a half-desaturated palette is not something anything prints, so it always runs at full. Worth a low weight if your charts end up on paper. It is not a model of achromatopsia and should not be described as one; the three deficiencies above it are.',
      },
    ],
  },
  {
    title: 'Palette and output',
    blurb:
      'A run produces a version, which lands in the history and can be edited, restored, or taken away in whatever format you need.',
    entries: [
      {
        term: 'Categorical palette',
        body: 'A set of colors for data with no order — countries, product lines, causes of failure. The requirement is that any two be told apart, which is a different problem from a sequential scale, where the requirement is that they be seen in order.',
      },
      {
        term: 'Version',
        where: 'Output › History',
        body: 'One entry in the history: the colors plus the exact parameters that produced them. Loading a preset or an image makes a version too, with no loss curve, since the optimizer never ran.',
      },
      {
        term: 'History',
        where: 'Output › History',
        body: 'Every version this session, oldest first. Clicking one restores it — both its colors and the whole configuration it was generated under, so the parameters panel goes back with it. History lives in the tab and is gone on reload; export anything worth keeping.',
      },
      {
        term: 'Initialize',
        where: 'Configuration › Initialize',
        body: 'Colors the run starts from instead of random ones. Fewer seeds than the palette needs and the rest are filled in at random; more and the extras are dropped. Unless a seed is fixed, the run is free to move it.',
      },
      {
        term: 'Fix color',
        where: 'Configuration › Initialize',
        body: 'Pins a seed to its exact value: the run may never move it, and works the rest of the palette around it. The setting for a brand color that has to appear untouched.',
      },
      {
        term: 'Fix order',
        where: 'Configuration › Initialize',
        body: 'Pins a color to its position in the list, leaving order optimization to rearrange everything else around it. Independent of Fix color — a color can be free to change and still required to stay first.',
      },
      {
        term: 'Parameter preset',
        body: 'Vivid, Dusky and Pastel on the opening screen: a color count with saturation and lightness bands, over the defaults. They load into the configuration panel rather than replacing your palette, so each is also a worked example of what the channel ranges do.',
      },
      {
        term: 'Established palette',
        body: 'The named palettes offered as a starting point — Okabe–Ito, Tableau 10, Observable 10, the ColorBrewer sets, Adobe Spectrum, IBM Carbon. Loading one replaces the palette wholesale. Run the report on one to see the trade-offs its authors made.',
      },
      {
        term: 'Extract from image',
        body: 'Pulls a palette out of a picture: the image is reduced, its colors binned in OKLab, and the most popular bins picked greedily subject to a minimum separation, so the result is dominant colors that are also distinct. It can return fewer colors than asked for when the image does not hold that many.',
      },
      {
        term: 'Color format',
        where: 'Output',
        body: 'How each color is written — Hex, RGB, HSL, OKLCH or OKLAB. Presentation only: it changes the text of every swatch and everything copied out, and has no effect on the palette or the search.',
      },
      {
        term: 'Output format',
        where: 'Output',
        body: 'The wrapper around those colors. Raw is one per line; CSS is a :root block of --palette-1… custom properties; JSON is a DTCG token file.',
      },
      {
        term: 'DTCG',
        body: 'The Design Tokens Community Group format: the interchange standard for design tokens. The JSON export writes each color as a token with structured components in its own color space plus a hex fallback, which most token pipelines will read directly.',
      },
      {
        term: 'Configuration file',
        where: 'Configuration › menu',
        body: 'The whole parameter set as JSON — every evaluator, seed, range and threshold. Export it to keep a recipe or hand it to someone else; import restores it exactly. It holds no colors, only the instructions for making them.',
      },
    ],
  },
]
