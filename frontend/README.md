    # Task: Property Rate Finder (Chrome Extension)
    
    ## What are we building?
    
    A Chrome extension that helps property valuers check market rates quickly.
    
    Today, a valuer opens 99acres, MagicBricks and Housing.com one by one, searches the area, notes down rates and takes screenshots. Our extension will do this in one go.
    
    ## How it should work
    
    1. The user clicks the extension icon. A **side panel** opens on the right side of the browser.
    2. The user types a location (example: `Baner, Pune`) and ticks the sites to search: 99acres, MagicBricks, Housing.com.
    3. The user clicks **Search**.
    4. The extension opens **3 new tabs**, one per site, showing search results for that location.
    5. The side panel shows **one card per site** with:
       - the rate found on that site (rate per sq ft, price range)
       - a **Take Snapshot** button that takes a screenshot of that site's tab and shows it on the card
       - a box to **type the rate manually** if it wasn't found
    6. Each screenshot must show the **website URL and date/time** on it, as proof.
    
    ## Build it in 3 steps
    
    Finish and test each step before starting the next.
    
    ### Step 1: Basic version
    
    - Side panel with a location box, site checkboxes and a Search button
    - Search opens each site's homepage in a new tab
    - Take Snapshot button works for each tab, with URL and date/time stamped on the image
    - Manual rate entry
    - Data stays saved after closing and reopening the panel
    
    ### Step 2: Open the right search page
    
    - Typing `Baner, Pune` opens each site's search results for Baner, not just the homepage
    - If the site can't find the location, show "Please select the correct area on the site" and let the user fix it
    - Remember the correct page, so the next search for the same location opens it directly
    
    ### Step 3: Read rates automatically
    
    - Read the rate per sq ft, price range and the first 10 listings (price, area) from each results page
    - Show them on the site's card
    - If reading fails, show "Enter manually". The screenshot and manual entry must still work.
    
    ## Tech to use
    
    - Chrome extension, **Manifest V3**
    - Plain **HTML, CSS, JavaScript**. No framework.
    - Chrome APIs you will need: `sidePanel`, `tabs`, `scripting`, `storage`
    - Use **IndexedDB** to store screenshots, because images are large.
    - Docs: https://developer.chrome.com/docs/extensions
    
    ## Important rules (must follow)
    
    These sites can block users if the extension behaves like a bot. So:
    
    1. **One search = one page per site.** Don't open extra pages, don't go to page 2, don't keep reloading.
    2. **Wait at least 1 minute between searches.** Allow a maximum of 20 searches per hour.
    3. **Only read what's on the screen.** Don't call the sites' hidden APIs, and don't fetch their pages in the background.
    4. **Don't change the website's page.** All our buttons and UI stay in the side panel.
    5. **If a captcha or login page appears, stop for that site** and show "Please check this tab". Never try to solve or bypass it.
    6. **Never collect phone numbers, names or emails** of sellers or agents.
    
    ## Problems you must handle
    
    Show a clear message on the site's card when:
    
    - the site doesn't load
    - a captcha or login page appears
    - no listings are found
    - the rate can't be read
    - the user closes the tab
    - the screenshot fails
    
    One site failing must never break the other sites.
    
    ## Before you start
    
    1. Open each of the 3 sites yourself and note:
       - how their search URL looks for a location
       - where the price and area are shown on the page
    2. Write these notes in a file called `research-notes.md` and show it to me before Step 2.
    3. Ask me if anything is unclear. Don't guess.
    
    ## When is it done?
    
    - All 3 steps work for at least 5 different locations
    - Screenshots show the correct tab with URL and date/time
    - Every problem listed above shows a proper message
    - No errors in the Chrome console
