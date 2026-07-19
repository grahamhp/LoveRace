const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const FALLBACK_WORLD = 8_141_808_945;
const ANNUAL_GROWTH = 0.0085;
const GENDER_SHARES = Object.freeze({
  alignedWomen: .4895,
  transWomen: .0035,
  alignedMen: .4915,
  transMen: .0035,
  nonbinary: .012,
});
const SELF_LABELS = Object.freeze({
  alignedWoman: 'gender-aligned woman', transWoman: 'trans woman', alignedMan: 'gender-aligned man', transMan: 'trans man',
  nonbinary: 'nonbinary person', skip: 'person whose gender was not provided',
});
const PARTNER_LABELS = Object.freeze({
  alignedWomen: 'gender-aligned women', transWomen: 'trans women', alignedMen: 'gender-aligned men', transMen: 'trans men', nonbinary: 'nonbinary people',
});
const state = {
  step: 0,
  countryFocusIndex: -1,
  worldPopulation: FALLBACK_WORLD,
  livePopulation: FALLBACK_WORLD,
  dataYear: 2024,
  countries: [],
  selectedCountries: [],
  countryPopulations: new Map(),
  countryGdp: new Map(),
  basePopulation: FALLBACK_WORLD,
  researchEstimate: null,
  reciprocalCustomized: false,
};

const fmt = new Intl.NumberFormat('en-US');
const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let resultAnnouncementTimer;

function scrollToElement(element, block = 'start') {
  element.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block });
}

function focusElement(element) {
  if (!element) return;
  element.setAttribute('tabindex', '-1');
  window.requestAnimationFrame(() => element.focus({ preventScroll: true }));
}

function selectedValue(name) {
  return $(`input[name="${name}"]:checked`)?.value;
}

function checkedValues(name) {
  return $$(`input[name="${name}"]:checked`).map(input => input.value);
}

async function fetchWorldData() {
  const base = 'https://api.worldbank.org/v2';
  try {
    const [worldRes, countriesRes, populationRes, gdpRes] = await Promise.all([
      fetch(`${base}/country/WLD/indicator/SP.POP.TOTL?format=json&date=2022:2026&per_page=10`),
      fetch(`${base}/country?format=json&per_page=400`),
      fetch(`${base}/country/all/indicator/SP.POP.TOTL?format=json&date=2023:2025&per_page=2000`),
      fetch(`${base}/country/all/indicator/NY.GDP.PCAP.CD?format=json&date=2022:2025&per_page=2000`),
    ]);
    const [worldJson, countriesJson, populationJson, gdpJson] = await Promise.all([
      worldRes.json(), countriesRes.json(), populationRes.json(), gdpRes.json()
    ]);
    const latestWorld = worldJson[1]?.find(row => row.value);
    if (latestWorld) {
      state.worldPopulation = Number(latestWorld.value);
      state.dataYear = Number(latestWorld.date);
      const elapsedYears = Math.max(0, (Date.now() - new Date(`${state.dataYear}-07-01`).getTime()) / 31_556_952_000);
      state.livePopulation = Math.round(state.worldPopulation * Math.pow(1 + ANNUAL_GROWTH, elapsedYears));
      state.basePopulation = state.livePopulation;
    }
    const validCountries = (countriesJson[1] || []).filter(c => c.region?.id !== 'NA' && c.capitalCity);
    state.countries = validCountries.map(c => ({ code: c.id, name: c.name, region: c.region.value })).sort((a,b) => a.name.localeCompare(b.name));
    ingestLatest(populationJson[1], state.countryPopulations);
    ingestLatest(gdpJson[1], state.countryGdp);
  } catch (error) {
    state.countries = fallbackCountries;
    console.info('Live demographic API unavailable; using documented fallback estimates.', error);
  }
  renderCountryResults('');
  recalculate();
}

function ingestLatest(rows = [], target) {
  rows.filter(row => row.value && row.countryiso3code).forEach(row => {
    if (!target.has(row.countryiso3code)) target.set(row.countryiso3code, Number(row.value));
  });
}

const fallbackCountries = [
  ['USA','United States',340110988],['CAN','Canada',41288600],['MEX','Mexico',130861000],['BRA','Brazil',211998573],
  ['GBR','United Kingdom',69226000],['FRA','France',68551653],['DEU','Germany',83516593],['ESP','Spain',48848600],
  ['ITA','Italy',58952696],['NLD','Netherlands',17993486],['IND','India',1450935791],['CHN','China',1408975000],
  ['JPN','Japan',123975371],['KOR','Korea, Rep.',51751065],['IDN','Indonesia',283487931],['AUS','Australia',27196812],
  ['NZL','New Zealand',5287500],['ZAF','South Africa',64007187],['NGA','Nigeria',232679478],['EGY','Egypt, Arab Rep.',116538258],
].map(([code,name,population]) => ({ code, name, population }));
fallbackCountries.forEach(c => state.countryPopulations.set(c.code, c.population));

function animateCounter() {
  if (reduceMotion.matches) return;
  const perSecond = state.livePopulation * ANNUAL_GROWTH / 31_556_952;
  window.setInterval(() => {
    if (state.step === 0 && state.selectedCountries.length === 0) {
      state.livePopulation += perSecond / 4;
      if ($('#study').getBoundingClientRect().top > window.innerHeight * .7) {
        $('#populationNumber').textContent = fmt.format(Math.round(state.livePopulation));
      } else {
        recalculate();
      }
    }
  }, 250);
}

function genderFactor() {
  const genders = checkedValues('partnerGender');
  if (!genders.length) return 0;
  return Math.min(1, genders.reduce((sum, gender) => sum + (GENDER_SHARES[gender] || 0), 0));
}

function multiSelectFactor(name) {
  const choices = $$(`input[name="${name}"]:checked`);
  if (!choices.length || choices.some(input => input.dataset.any === 'true')) return 1;
  return Math.min(1, choices.reduce((sum, input) => sum + Number(input.value), 0));
}

function multiSelectLabel(name, fallback, noun) {
  const choices = $$(`input[name="${name}"]:checked`);
  if (!choices.length || choices.some(input => input.dataset.any === 'true')) return fallback;
  const labels = choices.map(input => input.dataset.label);
  return labels.length <= 2 ? labels.join(' + ') : `${labels.length} ${noun} selected`;
}

function normalizeMultiSelect(input) {
  const choices = $$(`input[name="${input.name}"]`);
  const anyChoice = choices.find(choice => choice.dataset.any === 'true');
  if (input.dataset.any === 'true' && input.checked) {
    choices.forEach(choice => { if (choice !== input) choice.checked = false; });
  } else if (input.checked && anyChoice) {
    anyChoice.checked = false;
  }
  if (!choices.some(choice => choice.checked) && anyChoice) anyChoice.checked = true;
  updateMultiSelectSummaries();
}

function updateMultiSelectSummaries() {
  $('#religionSummary').textContent = multiSelectLabel('religionChoice', 'Open to any religion or worldview', 'religions');
  $('#backgroundSummary').textContent = multiSelectLabel('backgroundChoice', 'Open to any background', 'backgrounds');
}

function reciprocalEstimate() {
  const self = selectedValue('selfGender');
  const partners = checkedValues('partnerGender');
  if (!partners.length) return {
    rate: .001, details: [], sources: [], confidence: 'low', confidenceLabel: 'No selection',
    basis: 'Select at least one partner group to calculate a research-based default.',
  };

  const details = partners.map(partner => ({ partner, weight: GENDER_SHARES[partner] || 0, ...pairOpenness(self, partner) }));
  const totalWeight = details.reduce((sum, item) => sum + item.weight, 0);
  const rate = totalWeight ? details.reduce((sum, item) => sum + item.rate * item.weight, 0) / totalWeight : .001;
  const sources = [...new Set(details.flatMap(item => item.sources))];
  const limited = details.some(item => item.confidence === 'low');
  let basis = 'UK ONS 2024 sexual-identity shares. Official UK data are used as a proxy where comparable worldwide data do not exist.';
  if (sources.includes('blair')) {
    basis = 'Derived from Blair & Hoskin’s stated dating choices (N=958) and ONS orientation shares. The dating sample was mostly Canadian and American, with a mean age of 25.5.';
  }
  if (sources.includes('usts') && !sources.includes('blair')) {
    basis = 'Derived from the 2015 U.S. Transgender Survey orientation distribution (N=27,715). This is an orientation proxy, not a direct measure of dating willingness.';
  }
  if (sources.includes('usts') && sources.includes('blair')) {
    basis += ' Selected trans-partner groups also use the 2015 U.S. Transgender Survey orientation distribution (N=27,715).';
  }
  return {
    rate,
    details,
    sources,
    confidence: limited || sources.includes('usts') || sources.includes('blair') ? 'low' : 'medium',
    confidenceLabel: limited || sources.includes('usts') || sources.includes('blair') ? 'Limited evidence' : 'Official proxy',
    basis,
  };
}

function pairOpenness(self, partner) {
  if (self === 'skip') return { rate: .50, sources: ['ons','blair','usts'], confidence: 'low' };

  const selfIsWoman = self === 'alignedWoman' || self === 'transWoman';
  const selfIsMan = self === 'alignedMan' || self === 'transMan';
  const selfIsTrans = self === 'transWoman' || self === 'transMan';
  const partnerIsWoman = partner === 'alignedWomen' || partner === 'transWomen';
  const partnerIsMan = partner === 'alignedMen' || partner === 'transMen';
  const partnerIsTrans = partner === 'transWomen' || partner === 'transMen';

  if (partner === 'nonbinary') {
    return { rate: self === 'nonbinary' ? .56 : .53, sources: ['usts'], confidence: 'low' };
  }

  if (partnerIsTrans) {
    if (selfIsTrans || self === 'nonbinary') return { rate: .556, sources: ['blair','usts'], confidence: 'low' };
    const sameGender = (selfIsWoman && partnerIsWoman) || (selfIsMan && partnerIsMan);
    return { rate: sameGender ? .48 : .47, sources: ['usts'], confidence: 'low' };
  }

  if (selfIsTrans) {
    const rates = {
      transWoman: { alignedWomen: .017, alignedMen: .026 },
      transMan: { alignedWomen: .034, alignedMen: .032 },
    };
    return { rate: rates[self][partner], sources: ['ons','blair'], confidence: 'low' };
  }

  if (self === 'nonbinary') {
    return { rate: partner === 'alignedWomen' ? .031 : .022, sources: ['ons','usts'], confidence: 'low' };
  }

  const alignedRates = {
    alignedWoman: { alignedWomen: .034, alignedMen: .941 },
    alignedMan: { alignedWomen: .957, alignedMen: .040 },
  };
  return { rate: alignedRates[self][partner], sources: ['ons'], confidence: 'medium' };
}

function ageShare(min, max) {
  // Smoothed global adult age curve, calibrated to UN WPP 2024 broad age bands.
  const bins = [
    [18,24,.108],[25,34,.155],[35,44,.135],[45,54,.116],[55,64,.093],[65,74,.067],[75,84,.036],[85,100,.013]
  ];
  return bins.reduce((sum,[lo,hi,share]) => {
    const overlap = Math.max(0, Math.min(max + 1, hi + 1) - Math.max(min, lo));
    return sum + share * (overlap / (hi - lo + 1));
  }, 0);
}

function incomeShare(minIncome) {
  if (!minIncome) return 1;
  let gdp = 13_000;
  if (state.selectedCountries.length) {
    const weighted = state.selectedCountries.map(code => ({ pop: state.countryPopulations.get(code) || 0, gdp: state.countryGdp.get(code) || 0 })).filter(x => x.gdp);
    if (weighted.length) gdp = weighted.reduce((s,x) => s + x.gdp * x.pop, 0) / weighted.reduce((s,x) => s + x.pop, 0);
  }
  const median = Math.max(1200, gdp * .56);
  const sigma = .92;
  const z = Math.log(minIncome / median) / sigma;
  return Math.max(.002, Math.min(.995, 1 - normalCdf(z)));
}

function normalCdf(x) {
  const t = 1 / (1 + .2316419 * Math.abs(x));
  const d = .3989423 * Math.exp(-x*x/2);
  let p = d*t*(.3193815 + t*(-.3565638 + t*(1.781478 + t*(-1.821256 + t*1.330274))));
  return x > 0 ? 1-p : p;
}

function calculateModel() {
  const base = state.selectedCountries.length
    ? state.selectedCountries.reduce((sum, code) => sum + (state.countryPopulations.get(code) || 0), 0)
    : state.livePopulation;
  const minAge = Number($('#ageMin').value);
  const maxAge = Number($('#ageMax').value);
  const religionFactor = multiSelectFactor('religionChoice');
  const backgroundFactor = multiSelectFactor('backgroundChoice');
  const factors = [
    { key: 'Gender mix', value: genderFactor(), show: state.step >= 2 },
    { key: 'Reciprocal dating openness', value: Number($('#orientationRate').value) / 100, show: state.step >= 2 },
    { key: `Age ${minAge}–${maxAge}`, value: ageShare(minAge, maxAge), show: state.step >= 3 },
    { key: 'Single & open', value: Number($('#availability').value) / 100, show: state.step >= 3 },
    { key: multiSelectLabel('religionChoice', 'Religion open', 'religions'), value: religionFactor, show: state.step >= 4 && religionFactor < 1 },
    { key: multiSelectLabel('backgroundChoice', 'Background open', 'backgrounds'), value: backgroundFactor, show: state.step >= 4 && backgroundFactor < 1 },
    { key: Number($('#income').value) ? `Income ≥ ${money(Number($('#income').value))}` : 'Income open', value: incomeShare(Number($('#income').value)), show: state.step >= 5 && Number($('#income').value) > 0 },
    { key: 'Children preference', value: Number(selectedValue('kids')), show: state.step >= 5 && Number(selectedValue('kids')) < 1 },
    { key: 'Non-smoker', value: $('#nonSmoker').checked ? .78 : 1, show: state.step >= 5 && $('#nonSmoker').checked },
    { key: 'Seeking long-term', value: $('#longTerm').checked ? .58 : 1, show: state.step >= 5 && $('#longTerm').checked },
  ];
  const activeFactors = factors.filter(f => f.show);
  const product = activeFactors.reduce((p,f) => p * f.value, 1);
  return { base, factors: activeFactors, product, pool: Math.round(base * product) };
}

function recalculate(announce = false) {
  const model = calculateModel();
  state.basePopulation = model.base;
  $('#populationNumber').textContent = fmt.format(model.pool);
  const error = uncertaintyForStep();
  $('#uncertainty').textContent = `Likely range ${compactFmt.format(Math.max(0, model.pool*(1-error)))}–${compactFmt.format(model.pool*(1+error))}`;
  $('#resultContext').textContent = state.selectedCountries.length
    ? `Potential people · ${state.selectedCountries.length} ${state.selectedCountries.length === 1 ? 'country' : 'countries'}`
    : 'Potential people · worldwide';
  const percent = model.base ? model.pool / model.base * 100 : 0;
  $('#fractionLabel').textContent = `${percent < .01 ? '<0.01' : percent.toFixed(percent < 1 ? 2 : 1)}% of the starting population`;
  const ratio = model.product > 0 ? 1 / model.product : Infinity;
  $('#ratioNumber').textContent = formatRatio(ratio);
  $('#ratioCopy').textContent = ratio <= 1.01
    ? 'Every person is included before filtering.'
    : `About 1 in every ${formatRatio(ratio)} people meets the filters modeled so far.`;
  $('#shareFill').style.width = `${Math.max(percent > 0 ? .7 : 0, Math.min(100, percent))}%`;
  renderLedger(model.factors);
  if (state.step === 6) renderOdds(model);
  if (announce) scheduleResultAnnouncement(model, percent);
}

function scheduleResultAnnouncement(model, percent) {
  window.clearTimeout(resultAnnouncementTimer);
  resultAnnouncementTimer = window.setTimeout(() => {
    const percentText = percent < .01 ? 'less than 0.01 percent' : `${percent.toFixed(percent < 1 ? 2 : 1)} percent`;
    let message = `Estimated partner pool: ${fmt.format(model.pool)} people, ${percentText} of the starting population.`;
    if (state.step === 6) {
      message += ` Estimated time to a 20 percent chance: ${$('#chance20').textContent}; 50 percent: ${$('#chance50').textContent}; 80 percent: ${$('#chance80').textContent}.`;
    }
    $('#resultStatus').textContent = message;
  }, 350);
}

function uncertaintyForStep() {
  return [.02,.08,.17,.22,.27,.31,.35][state.step] || .35;
}

function renderLedger(factors) {
  const ledger = $('#filterLedger');
  const header = '<div class="ledger-title"><span>Your filters</span><span>effect</span></div>';
  if (!factors.length && !state.selectedCountries.length) {
    ledger.innerHTML = header + '<div class="ledger-empty">Your choices will appear here.</div>';
    return;
  }
  const geo = state.selectedCountries.length ? `<div class="ledger-row"><span>Chosen geography</span><b>${compactFmt.format(state.basePopulation)}</b></div>` : '';
  ledger.innerHTML = header + geo + factors.map(f => `<div class="ledger-row"><span>${f.key}</span><b>× ${f.value < .01 ? f.value.toFixed(3) : f.value.toFixed(2)}</b></div>`).join('');
}

function renderOdds(model) {
  $('#oddsPanel').classList.add('visible');
  const interactions = Number($('#interactions').value);
  const relevance = Number($('#relevance').value) / 100;
  const spark = Number($('#spark').value) / 100;
  const eligibleShare = Math.min(1, model.base ? model.pool / model.base : 0);
  const perEncounter = Math.max(1e-12, eligibleShare * relevance * spark);
  const weekly = 1 - Math.pow(1 - perEncounter, interactions);
  [20,50,80].forEach(target => {
    const weeks = Math.log(1-target/100) / Math.log(1-weekly);
    $(`#chance${target}`).textContent = formatDuration(weeks);
  });
  $('#oddsFootnote').textContent = `${interactions} new people/week · ${(eligibleShare*100).toFixed(eligibleShare < .01 ? 3 : 1)}% meet modeled filters · ${Math.round(relevance*100)}% locally relevant · ${Math.round(spark*100)}% connection assumption. Encounters are treated as independent.`;
}

function formatDuration(weeks) {
  if (!Number.isFinite(weeks) || weeks > 5200) return '100+ years';
  if (weeks < 1) return '< 1 week';
  if (weeks < 8) return `${Math.ceil(weeks)} weeks`;
  const months = weeks / 4.345;
  if (months < 24) return `${months.toFixed(months < 10 ? 1 : 0)} months`;
  const years = weeks / 52.1429;
  return `${years.toFixed(years < 10 ? 1 : 0)} years`;
}

function formatRatio(ratio) {
  if (!Number.isFinite(ratio)) return '∞';
  if (ratio <= 1.01) return '1';
  if (ratio < 10) return ratio.toFixed(ratio < 2 ? 1 : 0);
  if (ratio < 1000) return fmt.format(Math.round(ratio));
  return compactFmt.format(ratio);
}

function money(value) {
  return value === 0 ? 'No minimum' : `$${Math.round(value/1000)}k`;
}

function showStep(nextStep) {
  state.step = Math.max(0, Math.min(6, nextStep));
  $$('.step').forEach((el,i) => el.classList.toggle('active', i === state.step));
  $('#stepLabel').textContent = `${String(state.step+1).padStart(2,'0')} / 07`;
  $('#progressFill').style.width = `${(state.step+1)/7*100}%`;
  $('#progressTrack').setAttribute('aria-valuenow', String(state.step + 1));
  $('#progressTrack').setAttribute('aria-valuetext', `Step ${state.step + 1} of 7`);
  $('#backButton').style.visibility = state.step ? 'visible' : 'hidden';
  $('#nextButton span:first-child').textContent = state.step === 6 ? 'See results' : 'Continue';
  $('#nextButton span:last-child').textContent = state.step === 6 ? '↑' : '→';
  if (state.step < 6) $('#oddsPanel').classList.remove('visible');
  if (state.step === 2) syncOrientationDefault();
  recalculate(true);
  scrollToElement($('.question-panel'));
  focusElement($('.step.active h2'));
}

function syncOrientationDefault() {
  const estimate = reciprocalEstimate();
  const percent = estimate.rate * 100;
  state.researchEstimate = estimate;
  state.reciprocalCustomized = false;
  $('#orientationRate').value = percent;
  $('#orientationOutput').textContent = formatEvidencePercent(percent);
  renderEstimateEvidence(estimate, false);
}

function formatEvidencePercent(value) {
  if (value < 1) return `${value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}%`;
  if (value < 10) return `${value.toFixed(1).replace(/\.0$/, '')}%`;
  return `${value.toFixed(1).replace(/\.0$/, '')}%`;
}

function renderEstimateEvidence(estimate, custom = false) {
  const shown = Number($('#orientationRate').value);
  const confidence = $('#estimateConfidence');
  confidence.className = `confidence ${custom ? 'low' : estimate.confidence}`;
  confidence.textContent = custom ? 'Adjusted by you' : estimate.confidenceLabel;

  if (custom) {
    $('#estimateSummary').textContent = `You set reciprocal dating openness to ${formatEvidencePercent(shown)}. The research default for these selections is ${formatEvidencePercent(estimate.rate * 100)}.`;
  } else if (estimate.details.length === 1) {
    const detail = estimate.details[0];
    $('#estimateSummary').textContent = `About ${formatEvidencePercent(detail.rate * 100).replace('%', '')} in 100 ${PARTNER_LABELS[detail.partner]} are estimated to include a ${SELF_LABELS[selectedValue('selfGender')]} in their dating pool.`;
  } else {
    $('#estimateSummary').textContent = `Across the selected groups, the population-weighted estimate is ${formatEvidencePercent(estimate.rate * 100)}.`;
  }

  $('#estimateBasis').textContent = estimate.basis;
  $('#estimateBreakdown').innerHTML = estimate.details
    .map(detail => `<span>${PARTNER_LABELS[detail.partner]} · ${formatEvidencePercent(detail.rate * 100)}</span>`)
    .join('');
  $$('.estimate-sources a').forEach(link => {
    link.classList.toggle('active', estimate.sources.includes(link.dataset.source));
  });
}

function renderCountryResults(query) {
  const root = $('#countryResults');
  const q = query.trim().toLowerCase();
  const matches = state.countries.filter(c => !state.selectedCountries.includes(c.code) && (!q || c.name.toLowerCase().includes(q))).slice(0, 10);
  root.innerHTML = matches.map(c => `<div class="country-result" id="country-option-${c.code}" role="option" aria-selected="false" data-code="${c.code}"><span>${c.name}</span><span>${compactFmt.format(state.countryPopulations.get(c.code) || c.population || 0)}</span></div>`).join('');
  const isOpen = !!q && matches.length > 0;
  root.classList.toggle('open', isOpen);
  $('#countrySearch').setAttribute('aria-expanded', String(isOpen));
  $('#countrySearch').removeAttribute('aria-activedescendant');
  state.countryFocusIndex = -1;
}

function setActiveCountryOption(index) {
  const options = $$('.country-result', $('#countryResults'));
  if (!options.length) return;
  state.countryFocusIndex = (index + options.length) % options.length;
  options.forEach((option, optionIndex) => {
    const active = optionIndex === state.countryFocusIndex;
    option.classList.toggle('active', active);
    option.setAttribute('aria-selected', String(active));
    if (active) option.scrollIntoView({ block: 'nearest' });
  });
  $('#countrySearch').setAttribute('aria-activedescendant', options[state.countryFocusIndex].id);
}

function addCountry(code) {
  if (!state.selectedCountries.includes(code)) state.selectedCountries.push(code);
  $('#selectWorld').classList.remove('active');
  $('#countrySearch').value = '';
  $('#countryResults').classList.remove('open');
  $('#countrySearch').setAttribute('aria-expanded', 'false');
  $('#countrySearch').removeAttribute('aria-activedescendant');
  renderSelectedCountries();
  recalculate(true);
}

function renderSelectedCountries() {
  const root = $('#selectedCountries');
  if (!state.selectedCountries.length) {
    root.innerHTML = '<span class="empty-selection">select one or more countries</span>';
    $('#selectWorld').classList.add('active');
    return;
  }
  root.innerHTML = state.selectedCountries.map(code => {
    const country = state.countries.find(c => c.code === code) || fallbackCountries.find(c => c.code === code);
    const name = country?.name || code;
    return `<button type="button" class="selected-chip" data-code="${code}" aria-label="Remove ${name}">${name}</button>`;
  }).join('');
}

function bindEvents() {
  $('#studyForm').addEventListener('submit', event => event.preventDefault());
  $('#startButton').addEventListener('click', () => {
    scrollToElement($('.question-panel'));
    focusElement($('.step.active h2'));
  });
  $('#nextButton').addEventListener('click', () => state.step === 6
    ? (scrollToElement($('.result-panel')), focusElement($('#resultsHeading')))
    : showStep(state.step + 1));
  $('#adjustInputs').addEventListener('click', () => {
    scrollToElement($('.final-step'));
    focusElement($('.final-step h2'));
  });
  $('#backButton').addEventListener('click', () => showStep(state.step - 1));
  $('#resetButton').addEventListener('click', resetStudy);
  $('#countrySearch').addEventListener('input', e => renderCountryResults(e.target.value));
  $('#countrySearch').addEventListener('keydown', event => {
    const options = $$('.country-result', $('#countryResults'));
    if (event.key === 'ArrowDown' && options.length) {
      event.preventDefault();
      setActiveCountryOption(state.countryFocusIndex + 1);
    } else if (event.key === 'ArrowUp' && options.length) {
      event.preventDefault();
      setActiveCountryOption(state.countryFocusIndex < 0 ? options.length - 1 : state.countryFocusIndex - 1);
    } else if (event.key === 'Enter' && state.countryFocusIndex >= 0 && options[state.countryFocusIndex]) {
      event.preventDefault();
      addCountry(options[state.countryFocusIndex].dataset.code);
    } else if (event.key === 'Escape') {
      $('#countryResults').classList.remove('open');
      $('#countrySearch').setAttribute('aria-expanded', 'false');
      $('#countrySearch').removeAttribute('aria-activedescendant');
      state.countryFocusIndex = -1;
    }
  });
  $('#countryResults').addEventListener('click', e => {
    const row = e.target.closest('[data-code]'); if (row) addCountry(row.dataset.code);
  });
  $('#selectedCountries').addEventListener('click', e => {
    const chip = e.target.closest('[data-code]');
    if (chip) {
      state.selectedCountries = state.selectedCountries.filter(code => code !== chip.dataset.code);
      renderSelectedCountries();
      recalculate(true);
      $('#countrySearch').focus();
    }
  });
  $('#selectWorld').addEventListener('click', () => { state.selectedCountries = []; renderSelectedCountries(); recalculate(true); });
  $$('input, select', $('#studyForm')).forEach(input => input.addEventListener('input', () => {
    if (input.matches('[name="religionChoice"], [name="backgroundChoice"]')) normalizeMultiSelect(input);
    if (input.matches('[name="selfGender"], [name="orientation"], [name="partnerGender"]') && state.step <= 2) syncOrientationDefault();
    if (input.id === 'orientationRate') {
      state.reciprocalCustomized = true;
      if (state.researchEstimate) renderEstimateEvidence(state.researchEstimate, true);
    }
    updateOutputs(); recalculate(true);
  }));
  $('#restoreEstimate').addEventListener('click', () => { syncOrientationDefault(); recalculate(true); });
  $('#openMethod').addEventListener('click', () => $('#methodDialog').showModal());
  $('#openAssumptions').addEventListener('click', () => $('#methodDialog').showModal());
  $('.dialog-close').addEventListener('click', () => $('#methodDialog').close());
  $('#methodDialog').addEventListener('click', e => { if (e.target === $('#methodDialog')) $('#methodDialog').close(); });
}

function updateOutputs() {
  let min = Number($('#ageMin').value), max = Number($('#ageMax').value);
  if (min > max - 2) {
    if (document.activeElement === $('#ageMin')) min = max - 2; else max = min + 2;
    $('#ageMin').value = min; $('#ageMax').value = max;
  }
  $('#ageMinDisplay').textContent = min; $('#ageMaxDisplay').textContent = max;
  const minPct = (min-18)/(85-18)*100, maxPct = (max-18)/(85-18)*100;
  $('#ageBetween').style.marginLeft = `${minPct}%`; $('#ageBetween').style.width = `${maxPct-minPct}%`;
  $('#availabilityOutput').textContent = `${$('#availability').value}%`;
  $('#orientationOutput').textContent = formatEvidencePercent(Number($('#orientationRate').value));
  $('#incomeOutput').textContent = money(Number($('#income').value));
  $('#interactionsOutput').textContent = $('#interactions').value;
  $('#relevanceOutput').textContent = `${$('#relevance').value}%`;
  $('#sparkOutput').textContent = `${$('#spark').value}%`;
  $('#availability').setAttribute('aria-valuetext', `${$('#availability').value} percent`);
  $('#orientationRate').setAttribute('aria-valuetext', `${formatEvidencePercent(Number($('#orientationRate').value))} reciprocal dating openness`);
  $('#income').setAttribute('aria-valuetext', money(Number($('#income').value)));
  $('#interactions').setAttribute('aria-valuetext', `${$('#interactions').value} new people per week`);
  $('#relevance').setAttribute('aria-valuetext', `${$('#relevance').value} percent`);
  $('#spark').setAttribute('aria-valuetext', `${$('#spark').value} percent`);
}

function resetStudy() {
  $('#studyForm').reset();
  state.selectedCountries = [];
  renderSelectedCountries();
  updateMultiSelectSummaries();
  syncOrientationDefault();
  updateOutputs();
  showStep(0);
}

bindEvents();
updateMultiSelectSummaries();
syncOrientationDefault();
updateOutputs();
fetchWorldData().then(animateCounter);
