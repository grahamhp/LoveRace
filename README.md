# LoveRace: A probability study of human connection

A dependency-free interactive study that estimates the size of a potential partner pool and translates a person's rate of new encounters into 20%, 50%, and 80% probability timelines.

- **Live project:** [grahamhp.github.io/LoveRace](https://grahamhp.github.io/LoveRace/)
- **Code repository:** [github.com/grahamhp/LoveRace](https://github.com/grahamhp/LoveRace)

## Built with Codex and GPT-5.6

LoveRace was created through an iterative collaboration between Graham Henderson and OpenAI Codex, powered by GPT-5.6. Graham brought the original concept, product judgment, lived questions, visual direction, and final editorial decisions. Codex helped turn an idea that had previously been difficult to realize in Excel into a researched, working, publicly available web application.

This was not a one-prompt website. Graham repeatedly tested the application, challenged unclear assumptions, shared screenshots, and asked for revisions. GPT-5.6 helped reason across statistics, research quality, interface design, language, and implementation, while Graham decided what the product should communicate and which tradeoffs were acceptable.

Codex and GPT-5.6 were used to:

- **Develop the probability model:** translate the concept into a series of population filters, an eligible-share estimate, weekly encounter probability, and 20%, 50%, and 80% cumulative probability timelines.
- **Research and qualify the data:** identify relevant World Bank, UN, OECD, Pew Research Center, UK ONS, peer-reviewed, and survey sources; distinguish direct measurements from proxies; and label low-confidence assumptions honestly.
- **Interrogate the methodology:** identify limitations such as correlated demographic variables, geographically uneven evidence, clustered social networks, repeated encounters, and the difference between identity, attraction, dating openness, and compatibility.
- **Build the application:** write the dependency-free HTML, CSS, and JavaScript; integrate live World Bank API requests and documented fallback values; implement responsive layouts, editable inputs, multi-select controls, and continuously updating calculations.
- **Refine the experience through visual testing:** inspect the running site in the browser, respond to screenshots and usability feedback, replace an unclear population graphic, rebalance the methodology page, and verify the final responsive presentation.
- **Support product iteration:** separate gender-aligned and trans identity options, redefine the unclear "mutual orientation estimate" as reciprocal dating openness, make research assumptions visible and adjustable, and allow users to revise encounter inputs without restarting the study.
- **Create and deploy the public project:** organize the Git repository, write the technical and methodological documentation, configure GitHub Pages, monitor deployment, and verify the live site and branding assets.

One representative collaboration involved reciprocal dating openness. Graham challenged an early broad estimate and asked a concrete question: if a trans woman is looking for gender-aligned men, what share might actually include her in their dating pool? GPT-5.6 helped locate and compare relevant evidence, derive a clearly labeled low-confidence proxy, connect it to the appropriate user and partner identities, and rewrite the interface so the estimate and its source were understandable. Graham reviewed the result and guided how it should be framed.

Another example involved the site's original population visualization. Graham found the colored-circle graphic creative but difficult to interpret. Codex helped reconceptualize it as an "Equivalent population density" display with a clearer 1-in-X explanation, a proportion bar, and a filter ledger while preserving the site's fashion-editorial and modern-art aesthetic.

The result reflects a human-led, AI-assisted process. Codex and GPT-5.6 expanded what was technically and analytically possible, but the project's purpose, critiques, revisions, and final choices remained directed by Graham.

## Open the project

You can double-click `index.html` and open it directly in a browser. The HTML, CSS, and JavaScript do not need to be compiled or installed.

Running a local web server is recommended because some browsers restrict requests made by pages opened from a `file://` address. From this folder, run:

```powershell
python -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

The app requests current population, country population, and GDP-per-capita data from the World Bank API. Documented fallback values keep the experience working if the API is unavailable or the browser blocks the request.

## What the model estimates

LoveRace begins with the population of the whole world or the countries a user selects. Each answer narrows that population using an estimated demographic or preference share. The final step combines the remaining population share with the number of new people the user meets each week, the share of encounters occurring in the selected geography, and an adjustable mutual-connection assumption.

The output is an exploratory estimate, not a prediction that a particular relationship will occur by a particular date. It is designed to make assumptions visible and adjustable.

## Calculation

The partner-pool estimate is:

```text
pool = starting population × product of the active filter shares
```

The encounter model is:

```text
eligible share = pool / starting population
chance per encounter = eligible share × geographic relevance × connection assumption
weekly chance = 1 − (1 − chance per encounter) ^ new people met per week
P(by week n) = 1 − (1 − weekly chance) ^ n
```

The 20%, 50%, and 80% timelines solve the final equation for `n`. Encounters are treated as independent trials with the same probability.

## How the inputs are modeled

- **Population and geography:** live World Bank population totals are used when available. The world total is projected forward between releases using a small annual-growth assumption.
- **Gender mix:** the selected partner categories are assigned broad population shares. Worldwide data separating gender-aligned, trans, and nonbinary populations are incomplete, so these values are model assumptions rather than precise global counts.
- **Reciprocal dating openness:** the model estimates the share of the selected partner group whose reported orientation or dating choices could include someone with the user's identity. This is not an estimate of personal attraction.
- **Age:** broad global age bands are smoothed from UN population distributions. The current model continues to use this worldwide curve when countries are selected; it does not yet substitute each country's age structure.
- **Relationship availability:** the proportion likely to be single and open to a relationship is an adjustable 38% starting assumption, not an age- or country-specific estimate. [UN World Marriage Data](https://www.un.org/development/desa/pd/node/3593) shows marital status by age and sex across 232 countries or areas, while the [OECD Family Database](https://www.oecd.org/en/data/datasets/oecd-family-database.html) documents differences in marriage, divorce, cohabitation, and partnership definitions.
- **Religion and background:** religion uses broad global shares; cultural-background categories are coarse regional proxies and do not represent a complete ethnicity census.
- **Income:** the selected minimum is modeled against GDP per capita for the chosen geography using a broad income-distribution approximation.
- **Lifestyle and family preferences:** these use adjustable population-wide proxies rather than individualized survey estimates.
- **Weekly interactions:** users choose how many genuinely new people they meet, how locally relevant those encounters are, and the assumed probability of a meaningful mutual connection with an otherwise eligible person.

## Reciprocal dating-openness evidence

No single high-quality global dataset measures every combination of gender identity, sexual orientation, and willingness to date. LoveRace therefore uses an evidence hierarchy and labels weaker estimates as limited evidence:

- Gender-aligned pair orientation baselines use the sex-specific sexual-identity distribution published by the UK Office for National Statistics. UK data are a proxy for places without comparable statistics.
- Estimates involving a trans user and gender-aligned potential partners draw on Blair and Hoskin's stated dating-choice study and are combined with ONS orientation shares. For example, the 2.6% trans-woman/gender-aligned-men default is a derived, low-confidence proxy, not a directly measured worldwide rate.
- When the selected potential partner is trans, the model uses the orientation distribution in the 2015 U.S. Transgender Survey as a proxy. Orientation can indicate who may be included in a dating pool, but it does not directly measure dating willingness.
- Every research default remains adjustable so users can test a different social or geographic context.

## Data sources

| Source | Use in the model | Important qualification |
| --- | --- | --- |
| [World Bank population totals](https://data.worldbank.org/indicator/SP.POP.TOTL) | World and country populations | Live API with documented fallbacks |
| [UN World Population Prospects 2024](https://population.un.org/wpp/) | Broad age and sex distributions | Smoothed into model-friendly age bands |
| [UN World Marriage Data 2019](https://www.un.org/development/desa/pd/node/3593) | Context for relationship availability by age and sex | Marital status is not identical to being single and open to dating |
| [OECD Family Database](https://www.oecd.org/en/data/datasets/oecd-family-database.html) | Marriage, divorce, cohabitation, and partnership context | OECD coverage is not worldwide; definitions differ across societies |
| [Pew Research Center global religion estimates](https://www.pewresearch.org/religion/2025/06/09/how-the-global-religious-landscape-changed-from-2010-to-2020/) | Religion shares | Global categories hide substantial regional variation |
| [UK ONS, Sexual orientation, 2024](https://www.ons.gov.uk/peoplepopulationandcommunity/culturalidentity/sexuality/bulletins/sexualidentityuk/2024) | Gender-aligned pair orientation baselines | Official UK proxy; sexual identity is not identical to attraction or behavior |
| [Blair & Hoskin, *Transgender exclusion from the world of dating*](https://doi.org/10.1177/0265407518779139) | Stated willingness to date trans people | N=958; predominantly Canadian and American; mean age 25.5 |
| [2015 U.S. Transgender Survey](https://transequality.org/sites/default/files/docs/usts/USTS-Full-Report-Dec17.pdf) | Trans respondents' orientation distribution | N=27,715; large U.S. convenience sample, not a direct dating-willingness measure |
| [World Bank GDP per capita](https://data.worldbank.org/indicator/NY.GDP.PCAP.CD) | Income-model calibration | GDP per capita is not the same as an individual's income |

## Modeling note and important limitations

LoveRace is a deliberately simplified portrait of reality. It uses the best relevant public data we could identify, shows where estimates are weak, and lets users adjust the most uncertain assumptions. Even so, the apparent precision of the final number should not be mistaken for certainty.

The largest statistical limitation is that the filters are multiplied as though they are independent. In reality, age, country, income, religion, cultural background, orientation, relationship status, gender identity, and family preferences can all be related. A country with a younger population may also have different income and religion distributions; relationship availability can change with age; and survey responses about identity or dating can vary with culture. Multiplying separate population-wide shares can therefore overestimate or underestimate the true number of people who meet every condition simultaneously.

Other limitations include:

- Source years, definitions, sampling methods, and geographic coverage differ. Combining them creates a useful approximation, not a unified census.
- Many sources measure self-reported identity. Identity, attraction, behavior, and willingness to date are related but not interchangeable.
- Research about trans and nonbinary dating preferences remains limited and is not globally representative. Those results are explicitly treated as low-confidence proxies.
- Global categories for religion, background, gender, and sexuality flatten identities that are more complex and locally specific.
- The displayed uncertainty range is a broad sensitivity cue, not a formal statistical confidence interval.
- The encounter calculation assumes each new interaction is an independent, equally likely opportunity. Real social networks are clustered: people meet friends of friends, return to the same places, use different dating platforms, and repeatedly encounter similar groups.
- “Eligible” does not mean compatible. The model cannot measure chemistry, values in practice, timing, safety, emotional availability, reciprocal effort, or chance events.
- The model does not know whether a user will change their behavior after seeing the result. Meeting more people, changing geography, or adjusting preferences changes the process itself.

The result is best read as a scenario: **given these population assumptions and this encounter rate, what does the probability model imply?** It is a tool for understanding scale and tradeoffs, not a verdict about anyone's future.
