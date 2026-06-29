// Maps each guide slug to: its sibling guides (same topical cluster) and the
// calculator that goes with it. Used by <RelatedGuides /> to render a uniform
// footer on every /guides/X page.
//
// To add a guide: append to GUIDE_META and (optionally) reference it from
// other entries' `siblings` arrays. Keep siblings to 3 entries — the footer
// renders exactly 3 cards.

export interface GuideMeta {
  slug: string;
  title: string;
  calculatorHref: string;
  siblings: string[]; // slugs of 3 related guides
}

export const GUIDE_META: Record<string, GuideMeta> = {
  // HVAC heating
  'heat-pumps': {
    slug: 'heat-pumps',
    title: 'Heat pumps',
    calculatorHref: '/heat-pump-cost-calculator/',
    siblings: ['is-a-heat-pump-worth-it', 'mini-splits', 'gas-furnaces'],
  },
  'mini-splits': {
    slug: 'mini-splits',
    title: 'Ductless mini-splits',
    calculatorHref: '/mini-split-heat-pump-cost-calculator/',
    siblings: ['heat-pumps', 'geothermal', 'ac-replacement'],
  },
  'geothermal': {
    slug: 'geothermal',
    title: 'Geothermal heat pumps',
    calculatorHref: '/geothermal-heat-pump-cost-calculator/',
    siblings: ['heat-pumps', 'mini-splits', 'gas-furnaces'],
  },
  'gas-furnaces': {
    slug: 'gas-furnaces',
    title: 'Gas furnaces',
    calculatorHref: '/gas-furnace-replacement-cost-calculator/',
    siblings: ['heat-pumps', 'boilers', 'hvac-repair-replace'],
  },
  'boilers': {
    slug: 'boilers',
    title: 'Boilers',
    calculatorHref: '/boiler-replacement-cost-calculator/',
    siblings: ['gas-furnaces', 'heat-pumps', 'hvac-repair-replace'],
  },
  'hvac-repair-replace': {
    slug: 'hvac-repair-replace',
    title: 'HVAC repair vs replace',
    calculatorHref: '/hvac-repair-vs-replace/',
    siblings: ['heat-pumps', 'ac-replacement', 'gas-furnaces'],
  },
  // HVAC cooling
  'ac-replacement': {
    slug: 'ac-replacement',
    title: 'AC replacement',
    calculatorHref: '/ac-replacement-cost-calculator/',
    siblings: ['heat-pumps', 'mini-splits', 'ductwork'],
  },
  'ductwork': {
    slug: 'ductwork',
    title: 'Ductwork',
    calculatorHref: '/ductwork-installation-cost-calculator/',
    siblings: ['heat-pumps', 'ac-replacement', 'insulation'],
  },
  // Water heating
  'heat-pump-water-heaters': {
    slug: 'heat-pump-water-heaters',
    title: 'Heat pump water heaters',
    calculatorHref: '/heat-pump-water-heater-cost-calculator/',
    siblings: ['tankless-water-heaters', 'tank-water-heaters', 'hot-water-recirculation'],
  },
  'tankless-water-heaters': {
    slug: 'tankless-water-heaters',
    title: 'Tankless water heaters',
    calculatorHref: '/tankless-water-heater-cost-calculator/',
    siblings: ['heat-pump-water-heaters', 'tank-water-heaters', 'hot-water-recirculation'],
  },
  'tank-water-heaters': {
    slug: 'tank-water-heaters',
    title: 'Tank water heaters',
    calculatorHref: '/tank-water-heater-cost-calculator/',
    siblings: ['heat-pump-water-heaters', 'tankless-water-heaters', 'hot-water-recirculation'],
  },
  'hot-water-recirculation': {
    slug: 'hot-water-recirculation',
    title: 'Hot water recirculation',
    calculatorHref: '/hot-water-recirculation-cost-calculator/',
    siblings: ['heat-pump-water-heaters', 'tankless-water-heaters', 'tank-water-heaters'],
  },
  // Solar & Power
  'solar': {
    slug: 'solar',
    title: 'Solar PV',
    calculatorHref: '/solar-panel-cost-calculator/',
    siblings: ['home-batteries', 'solar-payback', 'off-grid-solar'],
  },
  'home-batteries': {
    slug: 'home-batteries',
    title: 'Home batteries',
    calculatorHref: '/home-battery-cost-calculator/',
    siblings: ['solar', 'generators', 'off-grid-solar'],
  },
  'off-grid-solar': {
    slug: 'off-grid-solar',
    title: 'Off-grid solar',
    calculatorHref: '/off-grid-solar-cost-calculator/',
    siblings: ['solar', 'home-batteries', 'generators'],
  },
  'generators': {
    slug: 'generators',
    title: 'Generators',
    calculatorHref: '/generator-cost-calculator/',
    siblings: ['home-batteries', 'sump-pumps', 'solar'],
  },
  'solar-payback': {
    slug: 'solar-payback',
    title: 'Solar payback',
    calculatorHref: '/solar-payback-calculator/',
    siblings: ['solar', 'home-batteries', 'off-grid-solar'],
  },
  // EV
  'ev-chargers': {
    slug: 'ev-chargers',
    title: 'EV chargers',
    calculatorHref: '/ev-charger-installation-cost-calculator/',
    siblings: ['ev-charging-cost', 'ev-tco', 'electrical-panels'],
  },
  'ev-charging-cost': {
    slug: 'ev-charging-cost',
    title: 'EV charging cost',
    calculatorHref: '/ev-charging-cost-calculator/',
    siblings: ['ev-chargers', 'ev-tco', 'electrical-panels'],
  },
  'ev-tco': {
    slug: 'ev-tco',
    title: 'EV total cost of ownership',
    calculatorHref: '/ev-total-cost-of-ownership-calculator/',
    siblings: ['ev-chargers', 'ev-charging-cost', 'electrical-panels'],
  },
  // Electrical
  'electrical-panels': {
    slug: 'electrical-panels',
    title: 'Electrical panels',
    calculatorHref: '/electrical-panel-upgrade-cost-calculator/',
    siblings: ['smart-panels', 'ev-chargers', 'heat-pumps'],
  },
  'smart-panels': {
    slug: 'smart-panels',
    title: 'Smart electrical panels',
    calculatorHref: '/smart-panel-cost-calculator/',
    siblings: ['electrical-panels', 'ev-chargers', 'home-batteries'],
  },
  // Appliances
  'induction-cooking': {
    slug: 'induction-cooking',
    title: 'Induction cooking',
    calculatorHref: '/induction-stove-cost-calculator/',
    siblings: ['heat-pump-dryers', 'electrical-panels', 'whole-home-electrification'],
  },
  'heat-pump-dryers': {
    slug: 'heat-pump-dryers',
    title: 'Heat pump dryers',
    calculatorHref: '/heat-pump-dryer-cost-calculator/',
    siblings: ['induction-cooking', 'heat-pump-water-heaters', 'whole-home-electrification'],
  },
  // Envelope
  'insulation': {
    slug: 'insulation',
    title: 'Insulation',
    calculatorHref: '/insulation-cost-calculator/',
    siblings: ['air-sealing', 'windows', 'energy-audits'],
  },
  'air-sealing': {
    slug: 'air-sealing',
    title: 'Air sealing',
    calculatorHref: '/air-sealing-cost-calculator/',
    siblings: ['insulation', 'windows', 'energy-audits'],
  },
  'windows': {
    slug: 'windows',
    title: 'Windows',
    calculatorHref: '/window-replacement-cost-calculator/',
    siblings: ['insulation', 'air-sealing', 'door-replacement'],
  },
  'door-replacement': {
    slug: 'door-replacement',
    title: 'Door replacement',
    calculatorHref: '/door-replacement-cost-calculator/',
    siblings: ['windows', 'insulation', 'roof-replacement'],
  },
  'roof-replacement': {
    slug: 'roof-replacement',
    title: 'Roof replacement',
    calculatorHref: '/roof-replacement-cost-calculator/',
    siblings: ['insulation', 'solar', 'door-replacement'],
  },
  // Auxiliary
  'smart-thermostats': {
    slug: 'smart-thermostats',
    title: 'Smart thermostats',
    calculatorHref: '/smart-thermostat-cost-calculator/',
    siblings: ['heat-pumps', 'ac-replacement', 'insulation'],
  },
  'energy-audits': {
    slug: 'energy-audits',
    title: 'Home energy audits',
    calculatorHref: '/home-energy-audit-cost-calculator/',
    siblings: ['insulation', 'air-sealing', 'whole-home-electrification'],
  },
  'water-treatment': {
    slug: 'water-treatment',
    title: 'Water treatment',
    calculatorHref: '/water-treatment-cost-calculator/',
    siblings: ['tank-water-heaters', 'heat-pump-water-heaters', 'sump-pumps'],
  },
  'sump-pumps': {
    slug: 'sump-pumps',
    title: 'Sump pumps',
    calculatorHref: '/sump-pump-cost-calculator/',
    siblings: ['generators', 'water-treatment', 'home-batteries'],
  },
  'pool-heat-pumps': {
    slug: 'pool-heat-pumps',
    title: 'Pool heat pumps',
    calculatorHref: '/pool-heat-pump-cost-calculator/',
    siblings: ['hot-tub-heat-pumps', 'heat-pumps', 'solar'],
  },
  'hot-tub-heat-pumps': {
    slug: 'hot-tub-heat-pumps',
    title: 'Hot tub heat pumps',
    calculatorHref: '/hot-tub-heat-pump-cost-calculator/',
    siblings: ['pool-heat-pumps', 'heat-pumps', 'heat-pump-water-heaters'],
  },
  'wood-pellet-stoves': {
    slug: 'wood-pellet-stoves',
    title: 'Wood & pellet stoves',
    calculatorHref: '/wood-pellet-stove-cost-calculator/',
    siblings: ['heat-pumps', 'gas-furnaces', 'boilers'],
  },
  // Whole-home
  'whole-home-electrification': {
    slug: 'whole-home-electrification',
    title: 'Whole-home electrification',
    calculatorHref: '/whole-home-electrification-cost-calculator/',
    siblings: ['should-i-electrify', 'heat-pumps', 'hiring-a-contractor'],
  },
  // Decision / start-here guides (top-of-funnel: "should I" and "is it worth it")
  'should-i-electrify': {
    slug: 'should-i-electrify',
    title: 'Should I electrify?',
    calculatorHref: '/whole-home-electrification-cost-calculator/',
    siblings: ['is-a-heat-pump-worth-it', 'whole-home-electrification', 'energy-audits'],
  },
  'is-a-heat-pump-worth-it': {
    slug: 'is-a-heat-pump-worth-it',
    title: 'Is a heat pump worth it?',
    calculatorHref: '/heat-pump-cost-calculator/',
    siblings: ['heat-pumps', 'gas-furnaces', 'hvac-repair-replace'],
  },
  'hiring-a-contractor': {
    slug: 'hiring-a-contractor',
    title: 'Hiring a contractor',
    calculatorHref: '/heat-pump-cost-calculator/',
    siblings: ['is-a-heat-pump-worth-it', 'heat-pumps', 'whole-home-electrification'],
  },
};
