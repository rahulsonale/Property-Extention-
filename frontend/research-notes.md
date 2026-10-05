# Property site research notes

**Prepared:** 2026-10-05  
**Purpose:** Preliminary notes for the visible search pages needed for Step 2. Search URLs and page layouts can change, so the extension should use the page reached through the site's visible location search/autocomplete rather than assume every location can be constructed from a slug.

## 99acres

- **Observed search route:** `/search/property/buy/{location-slug}?city={city-id}&keyword={query}&preference=S&res_com=R`. The Majestique Rhythm County / Handewadi / Pune result page was opened in the user's browser from this route. The `city` value is location-specific; the current extension's Pune ID (`1171166`) must not be reused for other cities.
- **What is visible:** Search result cards show a project name, bedroom configurations, and project price ranges. The observed Majestique card showed 2 BHK at ₹59.21–92.48 L and 3 BHK at ₹79.05 L; its description showed a 669–1,045 sq ft carpet-area range. Individual listing cards show a price and area (the user's page showed ₹85 Lac and 894 sq ft carpet area).
- **Rate note:** The observed project card showed total prices, not a consistent rate-per-sq-ft value. Treat a visible ₹/sq-ft figure as optional and keep manual entry available.
- **Implementation note:** Use the location selected on the site to get its actual result URL and city context. Do not infer a city ID from the free-text query.
- **Reference:** [99acres Majestique Rhythm County search page](https://www.99acres.com/search/property/buy/majestique-rhythm-county-handewadipune?city=1171166&keyword=Majestique%20Rhythm%20County%2C%20Handewadi%2C%20Pune&preference=S&res_com=R) (observed in the user's browser on 2026-10-05; page could not be independently opened by the research browser).

## Magicbricks

- **Observed results route:** Pune-wide buy results are available at `/property-for-sale-in-pune-pppfs`. The page has a location search field that accepts a city, locality, or project. Locality/project result URLs should be recorded after making the selection in that UI; do not assume a free-text slug is always valid.
- **Where data appears:** Each listing result shows the property title/configuration, price, and area. Area is explicitly labelled (for example, `Carpet Area` or `Super Area`); listing text can also show the rate per square foot, e.g. `₹14,000/sqft`. The page's sort options include `Rate/sqft`.
- **Implementation note:** Keep the area type with the number. Carpet, super, and built-up areas are not interchangeable. Read only the visible result cards and avoid contact details.
- **Reference:** [Magicbricks properties for sale in Pune](https://www.magicbricks.com/property-for-sale-in-pune-pppfs) (opened 2026-10-05).

## Housing.com

- **Observed results routes:** Pune-wide buy results use `/in/buy/pune/`. A Handewadi project results page was available at `/in/buy/pune/handewadi-gid/projects/majestique-rhythm-county-pid/`. The route contains site-assigned location/project identifiers, so use the site's visible search/autocomplete to resolve a location instead of composing IDs.
- **Where data appears:** Listing cards show a total price, `Avg. price` per sq ft, area, and an area-type label such as `Builtup area`. A visible Majestique example showed ₹52.0 L, ₹6.93k/sq.ft, and 750 sq.ft built-up area. Other cards use different area types, so preserve the displayed label.
- **Implementation note:** Search and extract from the visible results page. Do not read or store seller/agent names, phone numbers, or contact information.
- **References:** [Housing.com Pune results](https://housing.com/in/buy/pune/) and [Housing.com Majestique Rhythm County listings](https://housing.com/in/buy/pune/handewadi-gid/projects/majestique-rhythm-county-pid/) (opened 2026-10-05).

## Step 2 decisions

1. A location query is not enough to safely synthesize the final URL for every site. The extension should let the user select/confirm the correct area on the site when the site requires it.
2. Store and reuse a confirmed result-page URL for the same site and location only after the user reaches the correct page.
3. Keep price, rate per sq ft, area value, and area type as separate fields. Mark unavailable values instead of guessing.
4. If a login, CAPTCHA, or blocking page is visible, stop processing that site and ask the user to check the tab.
