// ===================================================
//   ⚡ Real Estate Listings plugin by SquareHero.store
// ===================================================
(function () {
    // Check if the plugin is enabled
    const metaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
    if (!metaTag || metaTag.getAttribute('enabled') !== 'true') return;

    const sheetUrl = metaTag.getAttribute('sheet-url');
    const target = metaTag.getAttribute('target');
    const blogJsonUrl = `/${target}?format=json&nocache=${new Date().getTime()}`;
    
    // Custom labels for filter sections (with defaults)
    const categoryLabel = metaTag.getAttribute('category-label') || 'Property Status';
    const tagLabel = metaTag.getAttribute('tag-label') || 'Location';
    
    // Custom button text (new)
    const buttonText = metaTag.getAttribute('button-text') || 'View Home';
    
    // Custom loading label text (new)
    const loadingLabel = metaTag.getAttribute('loading-label') || 'Loading all properties...';
    
    // Check if pricing should be shown or hidden
    const showPricing = metaTag.getAttribute('pricing') !== 'false';
    
    // Read custom icon configurations from meta tag attributes
    const customIcons = {};
    Array.from(metaTag.attributes).forEach(attr => {
        if (attr.name.startsWith('custom-icon-')) {
            const fieldName = attr.name.replace('custom-icon-', '');
            customIcons[fieldName] = attr.value;
        }
    });
    
    // Store custom icons globally for use in other functions
    window.customIcons = customIcons;
    

    console.log('- Custom Icons:', customIcons);

    // Currency symbol helper
    const getCurrencySymbol = (currencyCode) => {
        const symbols = {
            USD: '$',
            CAD: '$',
            AUD: '$',
            NZD: '$',
            GBP: '£',
            EUR: '€'
        };
        return symbols[currencyCode] || '$';
    };

    // Area unit helper
    const getAreaUnit = (isMetric) => {
        return isMetric ? 'm²' : 'sq ft';
    };
    // Load required libraries
    const libraries = [
        'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
        'https://cdn.jsdelivr.net/npm/nouislider@14.6.3/distribute/nouislider.min.js',
        'https://cdn.jsdelivr.net/npm/nouislider@14.6.3/distribute/nouislider.min.css'
    ];

    function loadLibrary(url) {
        return new Promise((resolve, reject) => {
            const isCSS = url.endsWith('.css');
            const element = isCSS ? document.createElement('link') : document.createElement('script');

            if (isCSS) {
                element.rel = 'stylesheet';
                element.href = url;
            } else {
                element.src = url;
            }

            element.onload = () => resolve();
            element.onerror = () => reject(`Failed to load ${url}`);

            document.head.appendChild(element);
        });
    }

    function parseCSV(csv) {
        const results = Papa.parse(csv, {
            header: true,
            skipEmptyLines: true
        });
        return results.data;
    }
    
    // Function to fetch all properties across all pages with lazy loading
    async function fetchAllProperties(baseUrl) {
        console.log('📋 Fetching all properties with pagination and lazy loading...');
        let allItems = [];
        let currentUrl = `${baseUrl}?format=json&nocache=${new Date().getTime()}`;
        let pageCount = 1;
        let firstPageLoaded = false;
        let firstPageData = null;
        
        // Create a function that will be called to fetch the remaining pages
        const fetchRemainingPages = async (nextUrl, offset) => {
            let url = nextUrl;
            let page = 2;
            
            while (url) {
                try {
                    console.log(`📄 Fetching page ${page} in the background...`);
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    if (!data.items || data.items.length === 0) {
                        console.log('No items found on this page');
                        break;
                    }
                    
                    // Add the items to the global allItems array 
                    allItems.push(...data.items);
                    console.log(`✅ Found ${data.items.length} items on page ${page}, total now: ${allItems.length}`);
                    
                    // Trigger rendering the new items
                    if (window.renderAdditionalProperties) {
                        window.renderAdditionalProperties(data.items);
                    }
                    
                    // Check for pagination
                    if (data.pagination && data.pagination.nextPage) {
                        const offset = data.pagination.nextPageOffset;
                        if (offset) {
                            // Build the URL with format=json and the proper offset
                            const nextPageUrl = new URL(baseUrl, window.location.origin);
                            nextPageUrl.searchParams.set('format', 'json');
                            nextPageUrl.searchParams.set('offset', offset);
                            nextPageUrl.searchParams.set('nocache', new Date().getTime());
                            url = nextPageUrl.toString();
                            page++;
                        } else {
                            console.log('Missing offset value in pagination data');
                            url = null;
                        }
                    } else {
                        console.log('No more pages available');
                        url = null;
                    }
                } catch (error) {
                    console.error('❌ Error fetching additional properties:', error);
                    break;
                }
            }
            
            console.log(`🏁 Total properties fetched: ${allItems.length}`);
        };
        
        // First, fetch only the first page
        try {
            console.log('📄 Fetching first page...');
            const response = await fetch(currentUrl);
            const data = await response.json();
            
            if (!data.items || data.items.length === 0) {
                console.log('No items found on the first page');
                return [];
            }
            
            // Store the first page items
            allItems = [...data.items];
            console.log(`✅ Found ${data.items.length} items on page 1`);
            firstPageLoaded = true;
            firstPageData = data;
            
            // Check if there are more pages
            if (data.pagination && data.pagination.nextPage) {
                const offset = data.pagination.nextPageOffset;
                if (offset) {
                    // Build the URL for the next page
                    const nextPageUrl = new URL(baseUrl, window.location.origin);
                    nextPageUrl.searchParams.set('format', 'json');
                    nextPageUrl.searchParams.set('offset', offset);
                    nextPageUrl.searchParams.set('nocache', new Date().getTime());
                    
                    // Start fetching remaining pages in the background
                    setTimeout(() => {
                        fetchRemainingPages(nextPageUrl.toString(), offset);
                    }, 100);
                }
            } else {
                console.log('Only one page of results available');
            }
        } catch (error) {
            console.error('❌ Error fetching first page of properties:', error);
        }
        
        // Return the first page items immediately
        return allItems;
    }

    // Function to render additional properties when they're loaded
    window.renderAdditionalProperties = function(newItems) {
        const container = document.getElementById('property-grid');
        if (!container) {
            console.error('Property grid container not found for additional properties');
            return;
        }
        
        // Process the new properties with sheet data
        const sheetData = window.propertySheetData || [];
        const processedItems = processPropertyBatch(sheetData, newItems);
        
        // Create and append cards for each new property
        processedItems.forEach(property => {
            const card = createPropertyCard(property);
            container.appendChild(card);
        });
        
        // If MixItUp is initialized, update it
        if (window.mixer) {
            window.mixer.forceRefresh();
        }
    }
    
    // Function to process a batch of properties
    function processPropertyBatch(sheetData, blogItems) {
        const urlMap = new Map(sheetData.map(row => {
            const url = row.Url.trim().toLowerCase();
            const regexPattern = new RegExp('^' + url.replace(/\*/g, '.*') + '$');
            return [regexPattern, row];
        }));
        
        // Make sure we have the custom columns set
        const customColumns = window.customColumns || [];
    
        return blogItems.map(item => {
            const urlId = item.urlId.toLowerCase();
            const sheetRow = Array.from(urlMap.entries()).find(([regexPattern, value]) => regexPattern.test(urlId));
    
            // Clean and trim the excerpt if available
            let cleanExcerpt = '';
            if (item.excerpt) {
                // Remove any HTML tags and trim whitespace
                cleanExcerpt = item.excerpt.replace(/<\/?[^>]+(>|$)/g, '').trim();
            }
            
            // Process custom fields if we have a matching sheet row
            const customFields = {};
            if (sheetRow && customColumns.length > 0) {
                customColumns.forEach(column => {
                    const value = sheetRow[1][column];
                    if (value !== undefined) {
                        const columnType = window.customColumnTypes && window.customColumnTypes[column];
                        if (columnType === 'boolean') {
                            customFields[column] = value === 'Yes';
                        } else if (columnType === 'numeric' && value) {
                            customFields[column] = parseFloat(value.replace(/[^\d.-]/g, ''));
                        } else {
                            customFields[column] = value;
                        }
                    }
                });
            }
            
            return {
                id: item.id,
                title: item.title,
                location: item.tags && item.tags.length > 0 ? item.tags[0] : '', // Keep first tag for backwards compatibility
                locations: item.tags || [], // Store all tags/locations
                imageUrl: item.assetUrl,
                category: item.categories && item.categories.length > 0 ? item.categories[0] : '', // Keep first category for backwards compatibility  
                categories: item.categories || [], // Store all categories
                excerpt: cleanExcerpt, // Added excerpt with HTML cleaning
                price: sheetRow && sheetRow[1].Price ? parseFloat(sheetRow[1].Price.replace(/[$,]/g, '')) : 0,
                area: sheetRow && sheetRow[1].Area ? parseInt(sheetRow[1].Area, 10) : 0,
                bedrooms: sheetRow && sheetRow[1].Bedrooms ? parseInt(sheetRow[1].Bedrooms, 10) : 0,
                bathrooms: sheetRow && sheetRow[1].Bathrooms ? parseFloat(sheetRow[1].Bathrooms) : 0,
                garage: sheetRow && sheetRow[1].Garage ? sheetRow[1].Garage : '',
                customFields: customFields, // Add custom fields
                url: item.fullUrl
            };
        });
    }

    Promise.all(libraries.map(url => loadLibrary(url)))
        .then(async () => {
            // Show loading indicator
            const container = document.getElementById('propertyListingsContainer');
            if (container) {
                const loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'sh-loading-indicator';
                loadingIndicator.innerHTML = `
                    <div class="sh-spinner"></div>
                    <p>${loadingLabel}</p>
                `;
                container.appendChild(loadingIndicator);
                
                // Add spinner styles
                const spinnerStyle = document.createElement('style');
                spinnerStyle.textContent = `
                    .sh-loading-indicator {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 40px 0;
                        width: 100%;
                    }
                    .sh-spinner {
                        border: 4px solid rgba(0, 0, 0, 0.1);
                        border-radius: 50%;
                        border-top: 4px solid hsl(var(--accent-hsl));
                        width: 40px;
                        height: 40px;
                        animation: sh-spin 1s linear infinite;
                        margin-bottom: 15px;
                    }
                    @keyframes sh-spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(spinnerStyle);
            }
            
            try {
                // Fetch sheet data first
                const csvData = await fetch(sheetUrl).then(response => response.text());
                const sheetData = parseCSV(csvData);
                window.propertySheetData = sheetData; // Store globally for lazy loading
                
                // Get website settings to have them available
                const websiteSettingsResponse = await fetch(blogJsonUrl);
                const websiteSettingsData = await websiteSettingsResponse.json();
                const storeSettings = websiteSettingsData.websiteSettings?.storeSettings || {};
                
                // Use the fetchAllProperties function to get ALL blog items
                const baseUrl = `/${target}`;
                const allBlogItems = await fetchAllProperties(baseUrl);
                
                // Create a blogData object with the same structure as expected
                const blogData = {
                    items: allBlogItems,
                    websiteSettings: websiteSettingsData.websiteSettings
                };
                
                // Store settings globally for other functions to access
                window.storeSettings = storeSettings;
                
                const isMetric = storeSettings.measurementStandard === 2;
                const currencySymbol = getCurrencySymbol(storeSettings.selectedCurrency);
                const areaUnit = getAreaUnit(isMetric);

                const propertyData = processPropertyData(sheetData, blogData);
                
                // Remove loading indicator if it exists
                if (container) {
                    const loadingIndicator = container.querySelector('.sh-loading-indicator');
                    if (loadingIndicator) {
                        container.removeChild(loadingIndicator);
                    }
                }

                // Inject CSS for multi-select dropdowns
                injectMultiSelectCSS();
                
                createFilterElements(propertyData);
                renderPropertyListings(propertyData);
                console.log('🚀 SquareHero.store Real Estate Listings plugin loaded');
            } catch (error) {
                console.error('❌ Error fetching data:', error);
                
                // Show error message if loading indicator exists
                const container = document.getElementById('propertyListingsContainer');
                if (container) {
                    const loadingIndicator = container.querySelector('.sh-loading-indicator');
                    if (loadingIndicator) {
                        loadingIndicator.innerHTML = `
                            <p style="color: red">❌ Error loading properties. Please refresh and try again.</p>
                        `;
                    }
                }
            }
        })
        .catch(error => console.error('❌ Error loading libraries:', error));
        
    function processPropertyData(sheetData, blogData) {
        const urlMap = new Map(sheetData.map(row => {
            const url = row.Url.trim().toLowerCase();
            const regexPattern = new RegExp('^' + url.replace(/\*/g, '.*') + '$');
            return [regexPattern, row];
        }));
    
        // Debug excerpt availability
        const hasExcerpts = blogData.items.some(item => item.excerpt && item.excerpt.trim() !== '');
        console.log('📝 Properties with excerpts available:', hasExcerpts);
        
        if (hasExcerpts) {
            console.log('Sample excerpt from first item with excerpt:', 
                blogData.items.find(item => item.excerpt && item.excerpt.trim() !== '')?.excerpt || 'None found');
        }

        // Add debugging for sheet columns
        console.log('📊 Available sheet columns:', Object.keys(sheetData[0] || {}).join(', '));
        console.log('📋 First row sample:', sheetData[0]);
        
        // Identify custom columns (all columns except standard ones)
        const standardColumns = ['Title', 'Url', 'Price', 'Area', 'Bedrooms', 'Bathrooms', 'Garage', 'Featured'];
        const customColumns = Object.keys(sheetData[0] || {}).filter(column => 
            !standardColumns.includes(column));
        
        console.log('✨ Custom columns detected:', customColumns.join(', '));
        
        // Set global custom columns for use in other functions
        window.customColumns = customColumns;
        
        // Determine data types for custom columns
        window.customColumnTypes = {};
        window.customColumnSpecialHandling = {};
        
        customColumns.forEach(column => {
            // Check values to determine type
            const values = sheetData.map(row => row[column]).filter(Boolean);
            
            if (values.length === 0) {
                console.log(`⚠️ No values found for column "${column}"`);
                window.customColumnTypes[column] = 'text';
            } else if (values.every(value => value === 'Yes' || value === 'No')) {
                console.log(`✓ Column "${column}" appears to be boolean (Yes/No)`);
                window.customColumnTypes[column] = 'boolean';
            } else if (values.every(value => !isNaN(parseFloat(value)))) {
                console.log(`🔢 Column "${column}" appears to be numeric`);
                window.customColumnTypes[column] = 'numeric';
                
                // Determine whether to use button group or slider based on the range of values
                const numericValues = values.map(v => parseFloat(v));
                // Find unique integer values (floor the numbers to group similar values)
                const uniqueIntegerValues = [...new Set(numericValues.map(v => Math.floor(v)))];
                // Sort the values to determine range
                uniqueIntegerValues.sort((a, b) => a - b);
                
                // If we have a small number of distinct values (≤ 8) and a reasonably small range,
                // use a button group instead of a slider
                if (uniqueIntegerValues.length <= 8 && 
                   (uniqueIntegerValues[uniqueIntegerValues.length - 1] - uniqueIntegerValues[0]) <= 10) {
                    console.log(`👥 Column "${column}" will use button group (${uniqueIntegerValues.length} unique values) instead of slider`);
                    window.customColumnSpecialHandling[column] = 'buttonGroup';
                } else {
                    console.log(`📊 Column "${column}" will use slider (${uniqueIntegerValues.length} unique values with range: ${uniqueIntegerValues[0]}-${uniqueIntegerValues[uniqueIntegerValues.length - 1]})`);
                }
            } else {
                console.log(`📝 Column "${column}" appears to be text`);
                window.customColumnTypes[column] = 'text';
            }
        });
    
        return blogData.items.map(item => {
            const urlId = item.urlId.toLowerCase();
            const sheetRow = Array.from(urlMap.entries()).find(([regexPattern, value]) => regexPattern.test(urlId));
    
            // Clean and trim the excerpt if available
            let cleanExcerpt = '';
            if (item.excerpt) {
                // Remove any HTML tags and trim whitespace
                cleanExcerpt = item.excerpt.replace(/<\/?[^>]+(>|$)/g, '').trim();
            }
            
            // Process custom fields if we have a matching sheet row
            const customFields = {};
            if (sheetRow) {
                customColumns.forEach(column => {
                    const value = sheetRow[1][column];
                    if (value !== undefined) {
                        const columnType = window.customColumnTypes[column];
                        if (columnType === 'boolean') {
                            customFields[column] = value === 'Yes';
                        } else if (columnType === 'numeric' && value) {
                            customFields[column] = parseFloat(value.replace(/[^\d.-]/g, ''));
                        } else {
                            customFields[column] = value;
                        }
                    }
                });
            }
            
            return {
                id: item.id,
                title: item.title,
                location: item.tags && item.tags.length > 0 ? item.tags[0] : '', // Keep first tag for backwards compatibility
                locations: item.tags || [], // Store all tags/locations
                imageUrl: item.assetUrl,
                category: item.categories && item.categories.length > 0 ? item.categories[0] : '', // Keep first category for backwards compatibility  
                categories: item.categories || [], // Store all categories
                excerpt: cleanExcerpt, // Added excerpt with HTML cleaning
                price: sheetRow && sheetRow[1].Price ? parseFloat(sheetRow[1].Price.replace(/[$,]/g, '')) : 0,
                area: sheetRow && sheetRow[1].Area ? parseInt(sheetRow[1].Area, 10) : 0,
                bedrooms: sheetRow && sheetRow[1].Bedrooms ? parseInt(sheetRow[1].Bedrooms, 10) : 0,
                bathrooms: sheetRow && sheetRow[1].Bathrooms ? parseFloat(sheetRow[1].Bathrooms) : 0,
                garage: sheetRow && sheetRow[1].Garage ? sheetRow[1].Garage : '',
                customFields: customFields, // Add custom fields
                url: item.fullUrl
            };
        });
    }

    // Add CSS for multi-select dropdowns
    function injectMultiSelectCSS() {
        if (document.getElementById('multi-select-css')) return; // Already injected

        const style = document.createElement('style');
        style.id = 'multi-select-css';
        style.textContent = `
            .multi-select-dropdown {
                position: relative;
                display: inline-block;
                width: 100%;
            }

            .multi-select-button {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                background: white;
                cursor: pointer;
                text-align: left;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 14px;
                border-radius: 4px;
                transition: border-color 0.2s;
            }

            .multi-select-button:hover {
                border-color: #999;
            }

            .multi-select-button[aria-expanded="true"] {
                border-color: #007cba;
            }

            .multi-select-arrow {
                font-size: 12px;
                transition: transform 0.2s;
                margin-left: 8px;
            }

            .multi-select-button[aria-expanded="true"] .multi-select-arrow {
                transform: rotate(180deg);
            }

            .multi-select-options {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #ddd;
                border-top: none;
                border-radius: 0 0 4px 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                z-index: 1000;
                max-height: 200px;
                overflow-y: auto;
            }

            .multi-select-option {
                padding: 8px 12px;
                display: flex;
                align-items: center;
                cursor: pointer;
                transition: background-color 0.2s;
            }

            .multi-select-option:hover {
                background-color: #f5f5f5;
            }

            .multi-select-checkbox {
                margin-right: 8px;
                cursor: pointer;
            }

            .multi-select-label {
                cursor: pointer;
                user-select: none;
                flex: 1;
                font-size: 14px;
            }

            /* Responsive adjustments */
            @media (max-width: 768px) {
                .multi-select-options {
                    max-height: 150px;
                }
                
                .multi-select-option {
                    padding: 10px 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Inject CSS for multi-select dropdowns
    injectMultiSelectCSS();

    // ...existing code...
})();