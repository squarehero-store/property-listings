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
    
    // Custom item type for non-real estate uses
    const itemType = metaTag.getAttribute('item-type') || 'properties';
    
    // Custom loading label text (new)
    const loadingLabel = metaTag.getAttribute('loading-label') || `Loading all ${itemType}...`;
    
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
                            customFields[column] = parseFloat(value.replace(/[^ -9.-]/g, ''));
                        } else {
                            customFields[column] = value;
                        }
                    }
                });
            }
            
            return {
                id: item.id,
                title: item.title,
                location: item.tags && item.tags.length > 0 ? item.tags[0] : '',
                allTags: item.tags || [], // Store all tags
                imageUrl: item.assetUrl,
                category: item.categories && item.categories.length > 0 ? item.categories[0] : '',
                allCategories: item.categories || [], // Store all categories
                excerpt: cleanExcerpt, // Added excerpt with HTML cleaning
                price: sheetRow && sheetRow[1].Price ? parseFloat(sheetRow[1].Price.replace(/[$,]/g, '')) : 0,
                area: sheetRow && sheetRow[1].Area ? parseInt(sheetRow[1].Area.replace(/,/g, ''), 10) : 0,
                bedrooms: sheetRow && sheetRow[1].Bedrooms ? parseInt(sheetRow[1].Bedrooms.replace(/,/g, ''), 10) : 0,
                bathrooms: sheetRow && sheetRow[1].Bathrooms ? parseFloat(sheetRow[1].Bathrooms.replace(/,/g, '')) : 0,
                garage: sheetRow && sheetRow[1].Garage ? sheetRow[1].Garage : '',
                customFields: (() => {
                    const fields = {};
                    if (sheetRow && customColumns.length > 0) {
                        customColumns.forEach(column => {
                            const value = sheetRow[1][column];
                            if (value !== undefined) {
                                const columnType = window.customColumnTypes && window.customColumnTypes[column];
                                if (columnType === 'boolean') {
                                    fields[column] = value === 'Yes';
                                } else if (columnType === 'numeric' && value) {
                                    fields[column] = parseFloat(value.replace(/[^ -9.-]/g, ''));
                                } else {
                                    fields[column] = value;
                                }
                            }
                        });
                    }
                    return fields;
                })(),
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
                            <p style="color: red">❌ Error loading ${itemType}. Please refresh and try again.</p>
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
                            customFields[column] = parseFloat(value.replace(/[^ -9.-]/g, ''));
                        } else {
                            customFields[column] = value;
                        }
                    }
                });
            }
            
            return {
                id: item.id,
                title: item.title,
                location: item.tags && item.tags.length > 0 ? item.tags[0] : '',
                allTags: item.tags || [], // Store all tags
                imageUrl: item.assetUrl,
                category: item.categories && item.categories.length > 0 ? item.categories[0] : '',
                allCategories: item.categories || [], // Store all categories
                excerpt: cleanExcerpt, // Added excerpt with HTML cleaning
                price: sheetRow && sheetRow[1].Price ? parseFloat(sheetRow[1].Price.replace(/[$,]/g, '')) : 0,
                area: sheetRow && sheetRow[1].Area ? parseInt(sheetRow[1].Area.replace(/,/g, ''), 10) : 0,
                bedrooms: sheetRow && sheetRow[1].Bedrooms ? parseInt(sheetRow[1].Bedrooms.replace(/,/g, ''), 10) : 0,
                bathrooms: sheetRow && sheetRow[1].Bathrooms ? parseFloat(sheetRow[1].Bathrooms.replace(/,/g, '')) : 0,
                garage: sheetRow && sheetRow[1].Garage ? sheetRow[1].Garage : '',
                customFields: (() => {
                    const fields = {};
                    if (sheetRow && customColumns.length > 0) {
                        customColumns.forEach(column => {
                            const value = sheetRow[1][column];
                            if (value !== undefined) {
                                const columnType = window.customColumnTypes && window.customColumnTypes[column];
                                if (columnType === 'boolean') {
                                    fields[column] = value === 'Yes';
                                } else if (columnType === 'numeric' && value) {
                                    fields[column] = parseFloat(value.replace(/[^ -9.-]/g, ''));
                                } else {
                                    fields[column] = value;
                                }
                            }
                        });
                    }
                    return fields;
                })(),
                url: item.fullUrl
            };
        });
    }

    function initializeFilters(properties) {
        // Get unique values for dropdown filters - collect all tags and categories
        const locations = new Set();
        const categories = new Set();
        
        properties.forEach(property => {
            // Add all tags to locations
            if (property.allTags && property.allTags.length > 0) {
                property.allTags.forEach(tag => locations.add(tag));
            }
            // Add all categories
            if (property.allCategories && property.allCategories.length > 0) {
                property.allCategories.forEach(category => categories.add(category));
            }
        });
        
        // Only fill dropdowns if they exist
        const locationFilter = document.getElementById('location-filter');
        if (locationFilter && locations.size > 0) {
            populateDropdown('location-filter', locations, 'sh-location-option');
        }
        
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter && categories.size > 0) {
            populateDropdown('status-filter', categories, 'sh-status-option');
        }
        
        // Initialize sliders only if they exist and have valid data
        const areaValues = properties.map(p => p.area).filter(area => area > 0);
        const priceValues = properties.map(p => p.price).filter(price => price > 0);
        
        const areaSlider = document.getElementById('area-slider');
        if (areaSlider && areaValues.length > 0) {
            const minArea = Math.min(...areaValues);
            const maxArea = Math.max(...areaValues);
            initializeSlider('area-slider', minArea, maxArea, window.storeSettings?.measurementStandard === 2 ? 'm²' : 'sq ft', () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
        }
        
        const priceSlider = document.getElementById('price-slider');
        if (priceSlider && priceValues.length > 0) {
            const minPrice = Math.min(...priceValues);
            const maxPrice = Math.max(...priceValues);
            const currencySymbol = getCurrencySymbol(window.storeSettings?.selectedCurrency);
            initializeSlider('price-slider', minPrice, maxPrice, currencySymbol, () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
        }
        
        // Only initialize button group filters if they exist
        const bedroomsFilter = document.getElementById('bedrooms-filter');
        if (bedroomsFilter) {
            hideUnusedOptions('bedrooms-filter', properties, 'bedrooms');
        }
        const bathroomsFilter = document.getElementById('bathrooms-filter');
        if (bathroomsFilter) {
            hideUnusedOptions('bathrooms-filter', properties, 'bathrooms');
        }

        // Initialize custom numeric sliders (not button groups)
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnId = column.toLowerCase().replace(/\s+/g, '-');
                const columnType = window.customColumnTypes[column];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[column];
                if (columnType === 'numeric' && specialHandling !== 'buttonGroup') {
                    // Get all values for this custom field
                    const values = properties.map(p => p.customFields[column]).filter(v => v !== undefined && !isNaN(v));
                    if (values.length > 0) {
                        const minValue = Math.min(...values);
                        const maxValue = Math.max(...values);
                        // Use no unit for custom sliders
                        initializeSlider(`${columnId}-slider`, minValue, maxValue, '', () => {
                            if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
                        });
                    }
                }
            });
        }
    }

    function populateDropdown(id, options, customClass) {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            optionElement.className = customClass;
            dropdown.appendChild(optionElement);
        });
    }

    function initializeSlider(id, min, max, unit, callback) {
        console.log('[initializeSlider] Initializing slider:', { id, min, max, unit });
        const slider = document.getElementById(id);
        if (!slider) {
            console.warn(`[initializeSlider] Slider element not found for id="${id}"`);
            return;
        }
        const rangeDisplay = document.getElementById(`${id}-range`);
        if (!rangeDisplay) {
            console.warn(`[initializeSlider] Range display element not found for id="${id}-range"`);
            return;
        }
        // Ensure min and max are not the same to avoid noUiSlider errors
        if (min === max) {
            max = min + 1;
        }
        noUiSlider.create(slider, {
            start: [min, max],
            connect: true,
            range: { 'min': min, 'max': max },
            format: {
                to: value => Math.round(value),
                from: value => Number(value)
            }
        });
        function updateRangeDisplay(values) {
            const formattedMin = unit === 'm²' || unit === 'sq ft' ?
                `${parseInt(values[0]).toLocaleString()} ${unit}` :
                `${unit}${parseInt(values[0]).toLocaleString()}`;
            const formattedMax = unit === 'm²' || unit === 'sq ft' ?
                `${parseInt(values[1]).toLocaleString()} ${unit}` :
                `${unit}${parseInt(values[1]).toLocaleString()}`;
            rangeDisplay.textContent = `${formattedMin} - ${formattedMax}`;
        }
        slider.noUiSlider.on('update', (values) => {
            updateRangeDisplay(values);
            if (callback) callback(values);
        });
        updateRangeDisplay([min, max]);
        // Log after initialization
        setTimeout(() => {
            console.log(`[initializeSlider] Slider initialized for id="${id}":`, slider, slider.noUiSlider);
        }, 0);
    }
    
    function createPropertyCard(property) {
        const storeSettings = window.storeSettings || {};
        const isMetric = storeSettings.measurementStandard === 2;
        const currencySymbol = getCurrencySymbol(storeSettings.selectedCurrency);
        const areaUnit = getAreaUnit(isMetric);

        const card = document.createElement('a');
        card.className = 'property-card mix sh-property-card';
        card.href = property.url;
        
        // Set data attributes for all tags (for location filtering)
        if (property.allTags && property.allTags.length > 0) {
            card.setAttribute('data-all-tags', property.allTags.join('|'));
            // Keep first tag as location for backwards compatibility with existing filters
            card.setAttribute('data-location', property.allTags[0]);
        }
        
        // Set data attributes for all categories (for category filtering)
        if (property.allCategories && property.allCategories.length > 0) {
            card.setAttribute('data-all-categories', property.allCategories.join('|'));
            // Keep first category for backwards compatibility with existing filters
            card.setAttribute('data-category', property.allCategories[0]);
        }
        
        if (property.bedrooms > 0) {
            card.setAttribute('data-bedrooms', `bed-${property.bedrooms}`);
        }
        
        if (property.bathrooms > 0) {
            card.setAttribute('data-bathrooms', `bath-${formatBathroomsForFilter(property.bathrooms)}`);
        }
        
        if (property.area > 0) {
            card.setAttribute('data-area', property.area);
        }
        
        if (property.price > 0 && showPricing) {
            card.setAttribute('data-price', property.price);
        }
        
        // Add data attributes for custom fields
        if (property.customFields) {
            Object.entries(property.customFields).forEach(([key, value]) => {
                const attributeName = `data-${key.toLowerCase().replace(/\s+/g, '-')}`;
                const columnType = window.customColumnTypes && window.customColumnTypes[key];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[key];
                
                if (columnType === 'boolean') {
                    // For boolean fields, set to 'yes' or 'no' for easier filtering
                    card.setAttribute(attributeName, value ? 'yes' : 'no');
                } else if (columnType === 'numeric') {
                    if (specialHandling === 'buttonGroup') {
                        // For special numeric fields with button group (like Sleeps)
                        // Use the integer value for exact matching
                        card.setAttribute(attributeName, Math.floor(Number(value)));
                    } else {
                        // For standard numeric fields, set the raw number for range filtering
                        card.setAttribute(attributeName, value);
                    }
                } else {
                    // For text fields, set the text value
                    card.setAttribute(attributeName, value);
                }
            });
        }

        // SVG definitions
        const areaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" fill="none" viewBox="0 0 18 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#areaClip)"><path d="M.364 3.203 0 2.839 2.202.638l2.202 2.201-.363.364a.794.794 0 0 1-1.122 0l-.717-.715-.714.715a.794.794 0 0 1-1.124 0Z"/><path d="M16.855 15.016H1.548V1.563h1.308v12.144h14v1.309Z"/><path d="m15.58 16.564-.364-.364a.794.794 0 0 1 0-1.121l.714-.715-.714-.715a.794.794 0 0 1 0-1.122l.363-.363 2.202 2.202-2.202 2.198ZM16.119 11.598h-.634a.654.654 0 0 1 0-1.308h.634c.192 0 .347-.14.347-.317v-.614a.654.654 0 1 1 1.309 0v.614c0 .896-.743 1.625-1.656 1.625ZM13.063 11.599H9.727a.654.654 0 1 1 0-1.309h3.336a.654.654 0 0 1 0 1.309ZM7.251 11.598h-.633c-.913 0-1.657-.729-1.657-1.625v-.614a.654.654 0 1 1 1.309 0v.614c0 .175.156.317.348.317h.633a.654.654 0 1 1 0 1.309ZM5.616 7.727a.654.654 0 0 1-.655-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654ZM5.616 3.537a.654.654 0 0 1-.655-.654v-.614c0-.896.744-1.625 1.657-1.625h.633a.654.654 0 0 1 0 1.308h-.633c-.192 0-.348.14-.348.317v.614a.654.654 0 0 1-.654.654ZM13.01 1.952H9.674a.654.654 0 0 1 0-1.308h3.337a.654.654 0 0 1 0 1.308ZM17.12 3.537a.654.654 0 0 1-.654-.654v-.614c0-.175-.155-.317-.347-.317h-.634a.654.654 0 1 1 0-1.308h.634c.913 0 1.656.729 1.656 1.625v.614a.654.654 0 0 1-.654.654ZM17.12 7.727a.655.655 0 0 1-.654-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654Z"/></g><defs><clipPath id="areaClip"><path fill="#fff" d="M0 .65h17.759v15.89H0z"/></clipPath></defs></svg>`;

        const bedsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="23" height="21" fill="none" viewBox="0 0 23 21"><g clip-path="url(#bedsClip)"><path fill="hsl(var(--black-hsl))" d="M2.735 4.856a.907.907 0 0 0-.95-.906.923.923 0 0 0-.863.93v12.09h1.814v-3.627h4.532V9.716H2.735v-4.86Zm16.1 1.66H8.174v6.827h12.022V7.875a1.36 1.36 0 0 0-1.36-1.36Zm3.085 3.2h-.819v7.254h1.814v-6.26a.994.994 0 0 0-.995-.994ZM5.573 5.613a1.814 1.814 0 1 0-.237 3.62 1.814 1.814 0 0 0 .237-3.62Z"/></g><defs><clipPath id="bedsClip"><path fill="#fff" d="M.685.65h22.23v19.89H.685z"/></clipPath></defs></svg>`;

        const bathsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="17" fill="none" viewBox="0 0 19 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#bathsClip)"><path d="M13.361 6.618a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm-1.553-1.166a.388.388 0 1 0 .147.028.389.389 0 0 0-.15-.029l.003.001Zm-.196 1.166a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm1.749-1.166a.389.389 0 1 0-.001.78.389.389 0 0 0 .001-.78Zm2.137-1.165H11.03a.389.389 0 1 0 0 .777h4.468a.39.39 0 1 0 0-.777ZM15.304.594a2.717 2.717 0 0 0-2.249 1.19 2.135 2.135 0 0 0-1.831 2.113h4.274a2.136 2.136 0 0 0-1.537-2.05 1.981 1.981 0 0 1 1.343-.524c.95 0 1.942.686 1.942 1.991v4.471h.778v-4.47a2.72 2.72 0 0 0-2.72-2.72Zm.194 6.412a.388.388 0 1 0-.777-.001.388.388 0 0 0 .777 0Zm-.194-1.166a.39.39 0 0 0-.664-.275.389.389 0 1 0 .664.275ZM1.537 11.722a3.477 3.477 0 0 0 1.75 3.018l-.889.889a.566.566 0 1 0 .8.8l1.274-1.273c.18.03.363.045.545.046h9.53c.182 0 .364-.017.545-.046l1.273 1.273a.565.565 0 1 0 .8-.8l-.889-.89a3.478 3.478 0 0 0 1.752-3.017v-1.393H1.537v1.393Zm.696-3.133h-.696a.696.696 0 0 0-.696.696v.348h17.882v-.348a.696.696 0 0 0-.696-.696H2.233Z"/></g><defs><clipPath id="bathsClip"><path fill="#fff" d="M.84.594h17.883v16H.84z"/></clipPath></defs></svg>`;

        const garageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" fill="none" viewBox="0 0 20 18"><g fill="hsl(var(--black-hsl))" clip-path="url(#garageClip)"><path d="M15.908 17.09c.413-.046.717-.41.717-.826v-.788a.81.81 0 0 0 .81-.81v-3.238a.81.81 0 0 0-.81-.81h-.113l-1.122-3.77a.404.404 0 0 0-.384-.277H5.292a.404.404 0 0 0-.384.277l-1.122 3.77h-.113a.81.81 0 0 0-.81.81v3.238a.81.81 0 0 0 .81.81v.788c0 .415.304.78.717.826a.812.812 0 0 0 .9-.805v-.81h9.716v.81a.81.81 0 0 0 .902.805ZM5.896 7.785h8.506l.843 2.834H5.052l.844-2.834Zm-.917 5.764a.911.911 0 1 1-.185-1.814.911.911 0 0 1 .185 1.814Zm9.526-.814a.91.91 0 1 1 1.812-.187.91.91 0 0 1-1.812.187ZM18.24 5.92l-8.091-4.245-8.09 4.245a.85.85 0 0 1-1.15-.358l-.254-.487 9.494-4.98 9.494 4.98-.256.487a.851.851 0 0 1-1.148.358Z"/></g><defs><clipPath id="garageClip"><path fill="#fff" d="M.649.094h19v17h-19z"/></clipPath></defs></svg>`;

        // New: Check if excerpt exists
        const excerptHtml = property.excerpt ? 
            `<p class="property-excerpt sh-property-excerpt">${property.excerpt}</p>` : '';

        let cardContent = `
            <div class="property-image sh-property-image">
                <img src="${property.imageUrl}" alt="${property.title}" class="sh-property-img">
                ${property.allCategories && property.allCategories.length > 0 ? 
                    property.allCategories.map(category => `<span class="property-category sh-property-category">${category}</span>`).join('') : ''
                }
            </div>
            <div class="listing-content sh-property-title">
                <h3 class="property-title sh-property-title">${property.title}</h3>
                ${property.allTags && property.allTags.length > 0 ? 
                    `<p class="property-location sh-property-location">${property.allTags.join(', ')}</p>` : ''
                }
                ${showPricing ? `<p class="property-price sh-property-price ${property.price === 0 ? 'no-price' : ''}">${property.price === 0 ? 'Price TBA' : `${currencySymbol}${property.price.toLocaleString()}`}</p>` : ''}
                <div class="property-details sh-property-details">
                    ${property.area > 0 ? `<span class="details-icon sh-area-icon">${areaSvg} <span class="sh-area-value">${property.area.toLocaleString()} ${areaUnit}</span></span>` : ''}
                    ${property.bedrooms > 0 ? `<span class="details-icon sh-beds-icon">${bedsSvg} <span class="sh-beds-value">${property.bedrooms}</span></span>` : ''}
                    ${property.bathrooms > 0 ? `<span class="details-icon sh-baths-icon">${bathsSvg} <span class="sh-baths-value">${formatBathrooms(property.bathrooms)}</span></span>` : ''}
                    ${property.garage ? `<span class="details-icon sh-garage-icon">${garageSvg} <span class="sh-garage-value">${property.garage}</span></span>` : ''}
                    ${(() => {
                        // Add custom fields with icons to the main property details
                        if (!property.customFields || !window.customIcons) {
                            return '';
                        }
                        
                        return Object.entries(property.customFields).map(([key, value]) => {
                            const iconUrl = window.customIcons[key.toLowerCase()];
                            if (!iconUrl) {
                                return ''; // Only show custom fields that have icons here
                            }
                            
                            const columnType = window.customColumnTypes && window.customColumnTypes[key];
                            const formattedValue = columnType === 'boolean' 
                                ? (value ? 'Yes' : 'No')
                                : (columnType === 'numeric' ? value.toLocaleString() : value);
                            
                            // Handle different icon file types and add error handling
                            const isImageIcon = iconUrl.toLowerCase().endsWith('.png') || 
                                              iconUrl.toLowerCase().endsWith('.jpg') || 
                                              iconUrl.toLowerCase().endsWith('.jpeg');
                            
                            const iconElement = isImageIcon 
                                ? `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.style.display='none'">` 
                                : `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px;" onerror="this.style.display='none'">`;
                            
                            return `<span class="details-icon sh-custom-icon sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}-icon">${iconElement} <span class="sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}-value">${formattedValue}</span></span>`;
                        }).join('');
                    })()}
                </div>
                ${(() => {
                    // Generate HTML for custom fields WITHOUT icons (fields with icons are shown above)
                    if (!property.customFields || Object.keys(property.customFields).length === 0) {
                        return '';
                    }
                    
                    // Filter out custom fields that have icons - they're already shown in the property-details section
                    const fieldsWithoutIcons = Object.entries(property.customFields).filter(([key, value]) => {
                        const iconUrl = window.customIcons && window.customIcons[key.toLowerCase()];
                        return !iconUrl; // Only include fields that don't have custom icons
                    });
                    
                    if (fieldsWithoutIcons.length === 0) {
                        return '';
                    }
                    
                    return `
                    <div class="custom-property-details sh-custom-property-details">
                        ${fieldsWithoutIcons.map(([key, value]) => {
                            const columnType = window.customColumnTypes && window.customColumnTypes[key];
                            const formattedValue = columnType === 'boolean' 
                                ? (value ? 'Yes' : 'No')
                                : (columnType === 'numeric' ? value.toLocaleString() : value);
                            
                            return `<div class="custom-detail sh-custom-detail sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}">
                                <span class="custom-detail-label">${key}:</span>
                                <span class="custom-detail-value">${formattedValue}</span>
                            </div>`;
                        }).join('')}
                    </div>
                    `;
                })()}
                ${excerptHtml}
                <span class="sh-button sh-view-button">${buttonText}</span>
            </div>
        `;

        card.innerHTML = cardContent;
        return card;
    }
    
    function formatBathrooms(bathrooms) {
        return Number.isInteger(bathrooms) ? bathrooms.toString() : bathrooms.toFixed(1);
    }

    function formatBathroomsForFilter(bathrooms) {
        return Number.isInteger(bathrooms) ? bathrooms.toString() : bathrooms.toFixed(1);
    }
    
    function renderPropertyListings(properties) {
        const container = document.getElementById('property-grid');
        if (!container) {
            console.error('Property grid container not found');
            return;
        }

        properties.forEach(property => {
            const card = createPropertyCard(property);
            container.appendChild(card);
        });

        initializeFilters(properties);
        initializeMixItUp(itemType);
    }

    function initializeFilters(properties) {
        // Get unique values for dropdown filters - collect all tags and categories
        const locations = new Set();
        const categories = new Set();
        
        properties.forEach(property => {
            // Add all tags to locations
            if (property.allTags && property.allTags.length > 0) {
                property.allTags.forEach(tag => locations.add(tag));
            }
            // Add all categories
            if (property.allCategories && property.allCategories.length > 0) {
                property.allCategories.forEach(category => categories.add(category));
            }
        });
        
        // Only fill dropdowns if they exist
        const locationFilter = document.getElementById('location-filter');
        if (locationFilter && locations.size > 0) {
            populateDropdown('location-filter', locations, 'sh-location-option');
        }
        
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter && categories.size > 0) {
            populateDropdown('status-filter', categories, 'sh-status-option');
        }
        
        // Initialize sliders only if they exist and have valid data
        const areaValues = properties.map(p => p.area).filter(area => area > 0);
        const priceValues = properties.map(p => p.price).filter(price => price > 0);
        
        const areaSlider = document.getElementById('area-slider');
        if (areaSlider && areaValues.length > 0) {
            const minArea = Math.min(...areaValues);
            const maxArea = Math.max(...areaValues);
            initializeSlider('area-slider', minArea, maxArea, window.storeSettings?.measurementStandard === 2 ? 'm²' : 'sq ft', () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
        }
        
        const priceSlider = document.getElementById('price-slider');
        if (priceSlider && priceValues.length > 0) {
            const minPrice = Math.min(...priceValues);
            const maxPrice = Math.max(...priceValues);
            const currencySymbol = getCurrencySymbol(window.storeSettings?.selectedCurrency);
            initializeSlider('price-slider', minPrice, maxPrice, currencySymbol, () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
        }
        
        // Only initialize button group filters if they exist
        const bedroomsFilter = document.getElementById('bedrooms-filter');
        if (bedroomsFilter) {
            hideUnusedOptions('bedrooms-filter', properties, 'bedrooms');
        }
        const bathroomsFilter = document.getElementById('bathrooms-filter');
        if (bathroomsFilter) {
            hideUnusedOptions('bathrooms-filter', properties, 'bathrooms');
        }

        // Initialize custom numeric sliders (not button groups)
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnId = column.toLowerCase().replace(/\s+/g, '-');
                const columnType = window.customColumnTypes[column];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[column];
                if (columnType === 'numeric' && specialHandling !== 'buttonGroup') {
                    // Get all values for this custom field
                    const values = properties.map(p => p.customFields[column]).filter(v => v !== undefined && !isNaN(v));
                    if (values.length > 0) {
                        const minValue = Math.min(...values);
                        const maxValue = Math.max(...values);
                        // Use no unit for custom sliders
                        initializeSlider(`${columnId}-slider`, minValue, maxValue, '', () => {
                            if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
                        });
                    }
                }
            });
        }
    }

    function populateDropdown(id, options, customClass) {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            optionElement.className = customClass;
            dropdown.appendChild(optionElement);
        });
    }

    function initializeSlider(id, min, max, unit, callback) {
        console.log('[initializeSlider] Initializing slider:', { id, min, max, unit });
        const slider = document.getElementById(id);
        if (!slider) {
            console.warn(`[initializeSlider] Slider element not found for id="${id}"`);
            return;
        }
        const rangeDisplay = document.getElementById(`${id}-range`);
        if (!rangeDisplay) {
            console.warn(`[initializeSlider] Range display element not found for id="${id}-range"`);
            return;
        }
        // Ensure min and max are not the same to avoid noUiSlider errors
        if (min === max) {
            max = min + 1;
        }
        noUiSlider.create(slider, {
            start: [min, max],
            connect: true,
            range: { 'min': min, 'max': max },
            format: {
                to: value => Math.round(value),
                from: value => Number(value)
            }
        });
        function updateRangeDisplay(values) {
            const formattedMin = unit === 'm²' || unit === 'sq ft' ?
                `${parseInt(values[0]).toLocaleString()} ${unit}` :
                `${unit}${parseInt(values[0]).toLocaleString()}`;
            const formattedMax = unit === 'm²' || unit === 'sq ft' ?
                `${parseInt(values[1]).toLocaleString()} ${unit}` :
                `${unit}${parseInt(values[1]).toLocaleString()}`;
            rangeDisplay.textContent = `${formattedMin} - ${formattedMax}`;
        }
        slider.noUiSlider.on('update', (values) => {
            updateRangeDisplay(values);
            if (callback) callback(values);
        });
        updateRangeDisplay([min, max]);
        // Log after initialization
        setTimeout(() => {
            console.log(`[initializeSlider] Slider initialized for id="${id}":`, slider, slider.noUiSlider);
        }, 0);
    }
    
    function createPropertyCard(property) {
        const storeSettings = window.storeSettings || {};
        const isMetric = storeSettings.measurementStandard === 2;
        const currencySymbol = getCurrencySymbol(storeSettings.selectedCurrency);
        const areaUnit = getAreaUnit(isMetric);

        const card = document.createElement('a');
        card.className = 'property-card mix sh-property-card';
        card.href = property.url;
        
        // Set data attributes for all tags (for location filtering)
        if (property.allTags && property.allTags.length > 0) {
            card.setAttribute('data-all-tags', property.allTags.join('|'));
            // Keep first tag as location for backwards compatibility with existing filters
            card.setAttribute('data-location', property.allTags[0]);
        }
        
        // Set data attributes for all categories (for category filtering)
        if (property.allCategories && property.allCategories.length > 0) {
            card.setAttribute('data-all-categories', property.allCategories.join('|'));
            // Keep first category for backwards compatibility with existing filters
            card.setAttribute('data-category', property.allCategories[0]);
        }
        
        if (property.bedrooms > 0) {
            card.setAttribute('data-bedrooms', `bed-${property.bedrooms}`);
        }
        
        if (property.bathrooms > 0) {
            card.setAttribute('data-bathrooms', `bath-${formatBathroomsForFilter(property.bathrooms)}`);
        }
        
        if (property.area > 0) {
            card.setAttribute('data-area', property.area);
        }
        
        if (property.price > 0 && showPricing) {
            card.setAttribute('data-price', property.price);
        }
        
        // Add data attributes for custom fields
        if (property.customFields) {
            Object.entries(property.customFields).forEach(([key, value]) => {
                const attributeName = `data-${key.toLowerCase().replace(/\s+/g, '-')}`;
                const columnType = window.customColumnTypes && window.customColumnTypes[key];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[key];
                
                if (columnType === 'boolean') {
                    // For boolean fields, set to 'yes' or 'no' for easier filtering
                    card.setAttribute(attributeName, value ? 'yes' : 'no');
                } else if (columnType === 'numeric') {
                    if (specialHandling === 'buttonGroup') {
                        // For special numeric fields with button group (like Sleeps)
                        // Use the integer value for exact matching
                        card.setAttribute(attributeName, Math.floor(Number(value)));
                    } else {
                        // For standard numeric fields, set the raw number for range filtering
                        card.setAttribute(attributeName, value);
                    }
                } else {
                    // For text fields, set the text value
                    card.setAttribute(attributeName, value);
                }
            });
        }

        // SVG definitions
        const areaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" fill="none" viewBox="0 0 18 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#areaClip)"><path d="M.364 3.203 0 2.839 2.202.638l2.202 2.201-.363.364a.794.794 0 0 1-1.122 0l-.717-.715-.714.715a.794.794 0 0 1-1.124 0Z"/><path d="M16.855 15.016H1.548V1.563h1.308v12.144h14v1.309Z"/><path d="m15.58 16.564-.364-.364a.794.794 0 0 1 0-1.121l.714-.715-.714-.715a.794.794 0 0 1 0-1.122l.363-.363 2.202 2.202-2.202 2.198ZM16.119 11.598h-.634a.654.654 0 0 1 0-1.308h.634c.192 0 .347-.14.347-.317v-.614a.654.654 0 1 1 1.309 0v.614c0 .896-.743 1.625-1.656 1.625ZM13.063 11.599H9.727a.654.654 0 1 1 0-1.309h3.336a.654.654 0 0 1 0 1.309ZM7.251 11.598h-.633c-.913 0-1.657-.729-1.657-1.625v-.614a.654.654 0 1 1 1.309 0v.614c0 .175.156.317.348.317h.633a.654.654 0 1 1 0 1.309ZM5.616 7.727a.654.654 0 0 1-.655-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654ZM5.616 3.537a.654.654 0 0 1-.655-.654v-.614c0-.896.744-1.625 1.657-1.625h.633a.654.654 0 0 1 0 1.308h-.633c-.192 0-.348.14-.348.317v.614a.654.654 0 0 1-.654.654ZM13.01 1.952H9.674a.654.654 0 0 1 0-1.308h3.337a.654.654 0 0 1 0 1.308ZM17.12 3.537a.654.654 0 0 1-.654-.654v-.614c0-.175-.155-.317-.347-.317h-.634a.654.654 0 1 1 0-1.308h.634c.913 0 1.656.729 1.656 1.625v.614a.654.654 0 0 1-.654.654ZM17.12 7.727a.655.655 0 0 1-.654-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654Z"/></g><defs><clipPath id="areaClip"><path fill="#fff" d="M0 .65h17.759v15.89H0z"/></clipPath></defs></svg>`;

        const bedsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="23" height="21" fill="none" viewBox="0 0 23 21"><g clip-path="url(#bedsClip)"><path fill="hsl(var(--black-hsl))" d="M2.735 4.856a.907.907 0 0 0-.95-.906.923.923 0 0 0-.863.93v12.09h1.814v-3.627h4.532V9.716H2.735v-4.86Zm16.1 1.66H8.174v6.827h12.022V7.875a1.36 1.36 0 0 0-1.36-1.36Zm3.085 3.2h-.819v7.254h1.814v-6.26a.994.994 0 0 0-.995-.994ZM5.573 5.613a1.814 1.814 0 1 0-.237 3.62 1.814 1.814 0 0 0 .237-3.62Z"/></g><defs><clipPath id="bedsClip"><path fill="#fff" d="M.685.65h22.23v19.89H.685z"/></clipPath></defs></svg>`;

        const bathsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="17" fill="none" viewBox="0 0 19 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#bathsClip)"><path d="M13.361 6.618a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm-1.553-1.166a.388.388 0 1 0 .147.028.389.389 0 0 0-.15-.029l.003.001Zm-.196 1.166a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm1.749-1.166a.389.389 0 1 0-.001.78.389.389 0 0 0 .001-.78Zm2.137-1.165H11.03a.389.389 0 1 0 0 .777h4.468a.39.39 0 1 0 0-.777ZM15.304.594a2.717 2.717 0 0 0-2.249 1.19 2.135 2.135 0 0 0-1.831 2.113h4.274a2.136 2.136 0 0 0-1.537-2.05 1.981 1.981 0 0 1 1.343-.524c.95 0 1.942.686 1.942 1.991v4.471h.778v-4.47a2.72 2.72 0 0 0-2.72-2.72Zm.194 6.412a.388.388 0 1 0-.777-.001.388.388 0 0 0 .777 0Zm-.194-1.166a.39.39 0 0 0-.664-.275.389.389 0 1 0 .664.275ZM1.537 11.722a3.477 3.477 0 0 0 1.75 3.018l-.889.889a.566.566 0 1 0 .8.8l1.274-1.273c.18.03.363.045.545.046h9.53c.182 0 .364-.017.545-.046l1.273 1.273a.565.565 0 1 0 .8-.8l-.889-.89a3.478 3.478 0 0 0 1.752-3.017v-1.393H1.537v1.393Zm.696-3.133h-.696a.696.696 0 0 0-.696.696v.348h17.882v-.348a.696.696 0 0 0-.696-.696H2.233Z"/></g><defs><clipPath id="bathsClip"><path fill="#fff" d="M.84.594h17.883v16H.84z"/></clipPath></defs></svg>`;

        const garageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" fill="none" viewBox="0 0 20 18"><g fill="hsl(var(--black-hsl))" clip-path="url(#garageClip)"><path d="M15.908 17.09c.413-.046.717-.41.717-.826v-.788a.81.81 0 0 0 .81-.81v-3.238a.81.81 0 0 0-.81-.81h-.113l-1.122-3.77a.404.404 0 0 0-.384-.277H5.292a.404.404 0 0 0-.384.277l-1.122 3.77h-.113a.81.81 0 0 0-.81.81v3.238a.81.81 0 0 0 .81.81v.788c0 .415.304.78.717.826a.812.812 0 0 0 .9-.805v-.81h9.716v.81a.81.81 0 0 0 .902.805ZM5.896 7.785h8.506l.843 2.834H5.052l.844-2.834Zm-.917 5.764a.911.911 0 1 1-.185-1.814.911.911 0 0 1 .185 1.814Zm9.526-.814a.91.91 0 1 1 1.812-.187.91.91 0 0 1-1.812.187ZM18.24 5.92l-8.091-4.245-8.09 4.245a.85.85 0 0 1-1.15-.358l-.254-.487 9.494-4.98 9.494 4.98-.256.487a.851.851 0 0 1-1.148.358Z"/></g><defs><clipPath id="garageClip"><path fill="#fff" d="M.649.094h19v17h-19z"/></clipPath></defs></svg>`;

        // New: Check if excerpt exists
        const excerptHtml = property.excerpt ? 
            `<p class="property-excerpt sh-property-excerpt">${property.excerpt}</p>` : '';

        let cardContent = `
            <div class="property-image sh-property-image">
                <img src="${property.imageUrl}" alt="${property.title}" class="sh-property-img">
                ${property.allCategories && property.allCategories.length > 0 ? 
                    property.allCategories.map(category => `<span class="property-category sh-property-category">${category}</span>`).join('') : ''
                }
            </div>
            <div class="listing-content sh-property-title">
                <h3 class="property-title sh-property-title">${property.title}</h3>
                ${property.allTags && property.allTags.length > 0 ? 
                    `<p class="property-location sh-property-location">${property.allTags.join(', ')}</p>` : ''
                }
                ${showPricing ? `<p class="property-price sh-property-price ${property.price === 0 ? 'no-price' : ''}">${property.price === 0 ? 'Price TBA' : `${currencySymbol}${property.price.toLocaleString()}`}</p>` : ''}
                <div class="property-details sh-property-details">
                    ${property.area > 0 ? `<span class="details-icon sh-area-icon">${areaSvg} <span class="sh-area-value">${property.area.toLocaleString()} ${areaUnit}</span></span>` : ''}
                    ${property.bedrooms > 0 ? `<span class="details-icon sh-beds-icon">${bedsSvg} <span class="sh-beds-value">${property.bedrooms}</span></span>` : ''}
                    ${property.bathrooms > 0 ? `<span class="details-icon sh-baths-icon">${bathsSvg} <span class="sh-baths-value">${formatBathrooms(property.bathrooms)}</span></span>` : ''}
                    ${property.garage ? `<span class="details-icon sh-garage-icon">${garageSvg} <span class="sh-garage-value">${property.garage}</span></span>` : ''}
                    ${(() => {
                        // Add custom fields with icons to the main property details
                        if (!property.customFields || !window.customIcons) {
                            return '';
                        }
                        
                        return Object.entries(property.customFields).map(([key, value]) => {
                            const iconUrl = window.customIcons[key.toLowerCase()];
                            if (!iconUrl) {
                                return ''; // Only show custom fields that have icons here
                            }
                            
                            const columnType = window.customColumnTypes && window.customColumnTypes[key];
                            const formattedValue = columnType === 'boolean' 
                                ? (value ? 'Yes' : 'No')
                                : (columnType === 'numeric' ? value.toLocaleString() : value);
                            
                            // Handle different icon file types and add error handling
                            const isImageIcon = iconUrl.toLowerCase().endsWith('.png') || 
                                              iconUrl.toLowerCase().endsWith('.jpg') || 
                                              iconUrl.toLowerCase().endsWith('.jpeg');
                            
                            const iconElement = isImageIcon 
                                ? `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.style.display='none'">` 
                                : `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px;" onerror="this.style.display='none'">`;
                            
                            return `<span class="details-icon sh-custom-icon sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}-icon">${iconElement} <span class="sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}-value">${formattedValue}</span></span>`;
                        }).join('');
                    })()}
                </div>
                ${(() => {
                    // Generate HTML for custom fields WITHOUT icons (fields with icons are shown above)
                    if (!property.customFields || Object.keys(property.customFields).length === 0) {
                        return '';
                    }
                    
                    // Filter out custom fields that have icons - they're already shown in the property-details section
                    const fieldsWithoutIcons = Object.entries(property.customFields).filter(([key, value]) => {
                        const iconUrl = window.customIcons && window.customIcons[key.toLowerCase()];
                        return !iconUrl; // Only include fields that don't have custom icons
                    });
                    
                    if (fieldsWithoutIcons.length === 0) {
                        return '';
                    }
                    
                    return `
                    <div class="custom-property-details sh-custom-property-details">
                        ${fieldsWithoutIcons.map(([key, value]) => {
                            const columnType = window.customColumnTypes && window.customColumnTypes[key];
                            const formattedValue = columnType === 'boolean' 
                                ? (value ? 'Yes' : 'No')
                                : (columnType === 'numeric' ? value.toLocaleString() : value);
                            
                            return `<div class="custom-detail sh-custom-detail sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}">
                                <span class="custom-detail-label">${key}:</span>
                                <span class="custom-detail-value">${formattedValue}</span>
                            </div>`;
                        }).join('')}
                    </div>
                    `;
                })()}
                ${excerptHtml}
                <span class="sh-button sh-view-button">${buttonText}</span>
            </div>
        `;

        card.innerHTML = cardContent;
        return card;
    }
    
    function formatBathrooms(bathrooms) {
        return Number.isInteger(bathrooms) ? bathrooms.toString() : bathrooms.toFixed(1);
    }

    function formatBathroomsForFilter(bathrooms) {
        return Number.isInteger(bathrooms) ? bathrooms.toString() : bathrooms.toFixed(1);
    }
    
    function renderPropertyListings(properties) {
        const container = document.getElementById('property-grid');
        if (!container) {
            console.error('Property grid container not found');
            return;
        }

        properties.forEach(property => {
            const card = createPropertyCard(property);
            container.appendChild(card);
        });

        initializeFilters(properties);
        initializeMixItUp(itemType);
    }

    function initializeFilters(properties) {
        // Get unique values for dropdown filters - collect all tags and categories
        const locations = new Set();
        const categories = new Set();
        
        properties.forEach(property => {
            // Add all tags to locations
            if (property.allTags && property.allTags.length > 0) {
                property.allTags.forEach(tag => locations.add(tag));
            }
            // Add all categories
            if (property.allCategories && property.allCategories.length > 0) {
                property.allCategories.forEach(category => categories.add(category));
            }
        });
        
        // Only fill dropdowns if they exist
        const locationFilter = document.getElementById('location-filter');
        if (locationFilter && locations.size > 0) {
            populateDropdown('location-filter', locations, 'sh-location-option');
        }
        
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter && categories.size > 0) {
            populateDropdown('status-filter', categories, 'sh-status-option');
        }
        
        // Initialize sliders only if they exist and have valid data
        const areaValues = properties.map(p => p.area).filter(area => area > 0);
        const priceValues = properties.map(p => p.price).filter(price => price >  0);
        
        const areaSlider = document.getElementById('area-slider');
        if (areaSlider && areaValues.length > 0) {
            const minArea = Math.min(...areaValues);
            const maxArea = Math.max(...areaValues);
            initializeSlider('area-slider', minArea, maxArea, window.storeSettings?.measurementStandard === 2 ? 'm²' : 'sq ft', () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
        }
        
        const priceSlider = document.getElementById('price-slider');
        if (priceSlider && priceValues.length > 0) {
            const minPrice = Math.min(...priceValues);
            const maxPrice = Math.max(...priceValues);
            const currencySymbol = getCurrencySymbol(window.storeSettings?.selectedCurrency);
            initializeSlider('price-slider', minPrice, maxPrice, currencySymbol, () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
        }
        
        // Only initialize button group filters if they exist
        const bedroomsFilter = document.getElementById('bedrooms-filter');
        if (bedroomsFilter) {
            hideUnusedOptions('bedrooms-filter', properties, 'bedrooms');
        }
        const bathroomsFilter = document.getElementById('bathrooms-filter');
        if (bathroomsFilter) {
            hideUnusedOptions('bathrooms-filter', properties, 'bathrooms');
        }

        // Initialize custom numeric sliders (not button groups)
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnId = column.toLowerCase().replace(/\s+/g, '-');
                const columnType = window.customColumnTypes[column];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[column];
                if (columnType === 'numeric' && specialHandling !== 'buttonGroup') {
                    // Get all values for this custom field
                    const values = properties.map(p => p.customFields[column]).filter(v => v !== undefined && !isNaN(v));
                    if (values.length > 0) {
                        const minValue = Math.min(...values);
                        const maxValue = Math.max(...values);
                        // Use no unit for custom sliders
                        initializeSlider(`${columnId}-slider`, minValue, maxValue, '', () => {
                            if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
                        });
                    }
                }
            });
        }
    }

    function populateDropdown(id, options, customClass) {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            optionElement.className = customClass;
            dropdown.appendChild(optionElement);
        });
    }

    function initializeSlider(id, min, max, unit, callback) {
        console.log('[initializeSlider] Initializing slider:', { id, min, max, unit });
        const slider = document.getElementById(id);
        if (!slider) {
            console.warn(`[initializeSlider] Slider element not found for id="${id}"`);
            return;
        }
        const rangeDisplay = document.getElementById(`${id}-range`);
        if (!rangeDisplay) {
            console.warn(`[initializeSlider] Range display element not found for id="${id}-range"`);
            return;
        }
        // Ensure min and max are not the same to avoid noUiSlider errors
        if (min === max) {
            max = min + 1;
        }
        noUiSlider.create(slider, {
            start: [min, max],
            connect: true,
            range: { 'min': min, 'max': max },
            format: {
                to: value => Math.round(value),
                from: value => Number(value)
            }
        });
        function updateRangeDisplay(values) {
            const formattedMin = unit === 'm²' || unit === 'sq ft' ?
                `${parseInt(values[0]).toLocaleString()} ${unit}` :
                `${unit}${parseInt(values[0]).toLocaleString()}`;
            const formattedMax = unit === 'm²' || unit === 'sq ft' ?
                `${parseInt(values[1]).toLocaleString()} ${unit}` :
                `${unit}${parseInt(values[1]).toLocaleString()}`;
            rangeDisplay.textContent = `${formattedMin} - ${formattedMax}`;
        }
        slider.noUiSlider.on('update', (values) => {
            updateRangeDisplay(values);
            if (callback) callback(values);
        });
        updateRangeDisplay([min, max]);
        // Log after initialization
        setTimeout(() => {
            console.log(`[initializeSlider] Slider initialized for id="${id}":`, slider, slider.noUiSlider);
        }, 0);
    }
    
    function createPropertyCard(property) {
        const storeSettings = window.storeSettings || {};
        const isMetric = storeSettings.measurementStandard === 2;
        const currencySymbol = getCurrencySymbol(storeSettings.selectedCurrency);
        const areaUnit = getAreaUnit(isMetric);

        const card = document.createElement('a');
        card.className = 'property-card mix sh-property-card';
        card.href = property.url;
        
        // Set data attributes for all tags (for location filtering)
        if (property.allTags && property.allTags.length > 0) {
            card.setAttribute('data-all-tags', property.allTags.join('|'));
            // Keep first tag as location for backwards compatibility with existing filters
            card.setAttribute('data-location', property.allTags[0]);
        }
        
        // Set data attributes for all categories (for category filtering)
        if (property.allCategories && property.allCategories.length > 0) {
            card.setAttribute('data-all-categories', property.allCategories.join('|'));
            // Keep first category for backwards compatibility with existing filters
            card.setAttribute('data-category', property.allCategories[0]);
        }
        
        if (property.bedrooms > 0) {
            card.setAttribute('data-bedrooms', `bed-${property.bedrooms}`);
        }
        
        if (property.bathrooms > 0) {
            card.setAttribute('data-bathrooms', `bath-${formatBathroomsForFilter(property.bathrooms)}`);
        }
        
        if (property.area > 0) {
            card.setAttribute('data-area', property.area);
        }
        
        if (property.price > 0 && showPricing) {
            card.setAttribute('data-price', property.price);
        }
        
        // Add data attributes for custom fields
        if (property.customFields) {
            Object.entries(property.customFields).forEach(([key, value]) => {
                const attributeName = `data-${key.toLowerCase().replace(/\s+/g, '-')}`;
                const columnType = window.customColumnTypes && window.customColumnTypes[key];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[key];
                
                if (columnType === 'boolean') {
                    // For boolean fields, set to 'yes' or 'no' for easier filtering
                    card.setAttribute(attributeName, value ? 'yes' : 'no');
                } else if (columnType === 'numeric') {
                    if (specialHandling === 'buttonGroup') {
                        // For special numeric fields with button group (like Sleeps)
                        // Use the integer value for exact matching
                        card.setAttribute(attributeName, Math.floor(Number(value)));
                    } else {
                        // For standard numeric fields, set the raw number for range filtering
                        card.setAttribute(attributeName, value);
                    }
                } else {
                    // For text fields, set the text value
                    card.setAttribute(attributeName, value);
                }
            });
        }

        // SVG definitions
        const areaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" fill="none" viewBox="0 0 18 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#areaClip)"><path d="M.364 3.203 0 2.839 2.202.638l2.202 2.201-.363.364a.794.794 0 0 1-1.122 0l-.717-.715-.714.715a.794.794 0 0 1-1.124 0Z"/><path d="M16.855 15.016H1.548V1.563h1.308v12.144h14v1.309Z"/><path d="m15.58 16.564-.364-.364a.794.794 0 0 1 0-1.121l.714-.715-.714-.715a.794.794 0 0 1 0-1.122l.363-.363 2.202 2.202-2.202 2.198ZM16.119 11.598h-.634a.654.654 0 0 1 0-1.308h.634c.192 0 .347-.14.347-.317v-.614a.654.654 0 1 1 1.309 0v.614c0 .896-.743 1.625-1.656 1.625ZM13.063 11.599H9.727a.654.654 0 1 1 0-1.309h3.336a.654.654 0 0 1 0 1.309ZM7.251 11.598h-.633c-.913 0-1.657-.729-1.657-1.625v-.614a.654.654 0 1 1 1.309 0v.614c0 .175.156.317.348.317h.633a.654.654 0 1 1 0 1.309ZM5.616 7.727a.654.654 0 0 1-.655-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654ZM5.616 3.537a.654.654 0 0 1-.655-.654v-.614c0-.896.744-1.625 1.657-1.625h.633a.654.654 0 0 1 0 1.308h-.633c-.192 0-.348.14-.348.317v.614a.654.654 0 0 1-.654.654ZM13.01 1.952H9.674a.654.654 0 0 1 0-1.308h3.337a.654.654 0 0 1 0 1.308ZM17.12 3.537a.654.654 0 0 1-.654-.654v-.614c0-.175-.155-.317-.347-.317h-.634a.654.654 0 1 1 0-1.308h.634c.913 0 1.656.729 1.656 1.625v.614a.654.654 0 0 1-.654.654ZM17.12 7.727a.655.655 0 0 1-.654-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654Z"/></g><defs><clipPath id="areaClip"><path fill="#fff" d="M0 .65h17.759v15.89H0z"/></clipPath></defs></svg>`;

        const bedsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="23" height="21" fill="none" viewBox="0 0 23 21"><g clip-path="url(#bedsClip)"><path fill="hsl(var(--black-hsl))" d="M2.735 4.856a.907.907 0 0 0-.95-.906.923.923 0 0 0-.863.93v12.09h1.814v-3.627h4.532V9.716H2.735v-4.86Zm16.1 1.66H8.174v6.827h12.022V7.875a1.36 1.36 0 0 0-1.36-1.36Zm3.085 3.2h-.819v7.254h1.814v-6.26a.994.994 0 0 0-.995-.994ZM5.573 5.613a1.814 1.814 0 1 0-.237 3.62 1.814 1.814 0 0 0 .237-3.62Z"/></g><defs><clipPath id="bedsClip"><path fill="#fff" d="M.685.65h22.23v19.89H.685z"/></clipPath></defs></svg>`;

        const bathsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="17" fill="none" viewBox="0 0 19 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#bathsClip)"><path d="M13.361 6.618a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm-1.553-1.166a.388.388 0 1 0 .147.028.389.389 0 0 0-.15-.029l.003.001Zm-.196 1.166a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm1.749-1.166a.389.389 0 1 0-.001.78.389.389 0 0 0 .001-.78Zm2.137-1.165H11.03a.389.389 0 1 0 0 .777h4.468a.39.39 0 1 0 0-.777ZM15.304.594a2.717 2.717 0 0 0-2.249 1.19 2.135 2.135 0 0 0-1.831 2.113h4.274a2.136 2.136 0 0 0-1.537-2.05 1.981 1.981 0 0 1 1.343-.524c.95 0 1.942.686 1.942 1.991v4.471h.778v-4.47a2.72 2.72 0 0 0-2.72-2.72Zm.194 6.412a.388.388 0 1 0-.777-.001.388.388 0 0 0 .777 0Zm-.194-1.166a.39.39 0 0 0-.664-.275.389.389 0 1 0 .664.275ZM1.537 11.722a3.477 3.477 0 0 0 1.75 3.018l-.889.889a.566.566 0 1 0 .8.8l1.274-1.273c.18.03.363.045.545.046h9.53c.182 0 .364-.017.545-.046l1.273 1.273a.565.565 0 1 0 .8-.8l-.889-.89a3.478 3.478 0 0 0 1.752-3.017v-1.393H1.537v1.393Zm.696-3.133h-.696a.696.696 0 0 0-.696.696v.348h17.882v-.348a.696.696 0 0 0-.696-.696H2.233Z"/></g><defs><clipPath id="bathsClip"><path fill="#fff" d="M.84.594h17.883v16H.84z"/></clipPath></defs></svg>`;

        const garageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" fill="none" viewBox="0 0 20 18"><g fill="hsl(var(--black-hsl))" clip-path="url(#garageClip)"><path d="M15.908 17.09c.413-.046.717-.41.717-.826v-.788a.81.81 0 0 0 .81-.81v-3.238a.81.81 0 0 0-.81-.81h-.113l-1.122-3.77a.404.404 0 0 0-.384-.277H5.292a.404.404 0 0 0-.384.277l-1.122 3.77h-.113a.81.81 0 0 0-.81.81v3.238a.81.81 0 0 0 .81.81v.788c0 .415.304.78.717.826a.812.812 0 0 0 .9-.805v-.81h9.716v.81a.81.81 0 0 0 .902.805ZM5.896 7.785h8.506l.843 2.834H5.052l.844-2.834Zm-.917 5.764a.911.911 0 1 1-.185-1.814.911.911 0 0 1 .185 1.814Zm9.526-.814a.91.91 0 1 1 1.812-.187.91.91 0 0 1-1.812.187ZM18.24 5.92l-8.091-4.245-8.09 4.245a.85.85 0 0 1-1.15-.358l-.254-.487 9.494-4.98 9.494 4.98-.256.487a.851.851 0 0 1-1.148.358Z"/></g><defs><clipPath id="garageClip"><path fill="#fff" d="M.649.094h19v17h-19z"/></clipPath></defs></svg>`;

        // New: Check if excerpt exists
        const excerptHtml = property.excerpt ? 
            `<p class="property-excerpt sh-property-excerpt">${property.excerpt}</p>` : '';

        let cardContent = `
            <div class="property-image sh-property-image">
                <img src="${property.imageUrl}" alt="${property.title}" class="sh-property-img">
                ${property.allCategories && property.allCategories.length > 0 ? 
                    property.allCategories.map(category => `<span class="property-category sh-property-category">${category}</span>`).join('') : ''
                }
            </div>
            <div class="listing-content sh-property-title">
                <h3 class="property-title sh-property-title">${property.title}</h3>
                ${property.allTags && property.allTags.length > 0 ? 
                    `<p class="property-location sh-property-location">${property.allTags.join(', ')}</p>` : ''
                }
                ${showPricing ? `<p class="property-price sh-property-price ${property.price === 0 ? 'no-price' : ''}">${property.price === 0 ? 'Price TBA' : `${currencySymbol}${property.price.toLocaleString()}`}</p>` : ''}
                <div class="property-details sh-property-details">
                    ${property.area > 0 ? `<span class="details-icon sh-area-icon">${areaSvg} <span class="sh-area-value">${property.area.toLocaleString()} ${areaUnit}</span></span>` : ''}
                    ${property.bedrooms > 0 ? `<span class="details-icon sh-beds-icon">${bedsSvg} <span class="sh-beds-value">${property.bedrooms}</span></span>` : ''}
                    ${property.bathrooms > 0 ? `<span class="details-icon sh-baths-icon">${bathsSvg} <span class="sh-baths-value">${formatBathrooms(property.bathrooms)}</span></span>` : ''}
                    ${property.garage ? `<span class="details-icon sh-garage-icon">${garageSvg} <span class="sh-garage-value">${property.garage}</span></span>` : ''}
                    ${(() => {
                        // Add custom fields with icons to the main property details
                        if (!property.customFields || !window.customIcons) {
                            return '';
                        }
                        
                        return Object.entries(property.customFields).map(([key, value]) => {
                            const iconUrl = window.customIcons[key.toLowerCase()];
                            if (!iconUrl) {
                                return ''; // Only show custom fields that have icons here
                            }
                            
                            const columnType = window.customColumnTypes && window.customColumnTypes[key];
                            const formattedValue = columnType === 'boolean' 
                                ? (value ? 'Yes' : 'No')
                                : (columnType === 'numeric' ? value.toLocaleString() : value);
                            
                            // Handle different icon file types and add error handling
                            const isImageIcon = iconUrl.toLowerCase().endsWith('.png') || 
                                              iconUrl.toLowerCase().endsWith('.jpg') || 
                                              iconUrl.toLowerCase().endsWith('.jpeg');
                            
                            const iconElement = isImageIcon 
                                ? `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.style.display='none'">` 
                                : `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px;" onerror="this.style.display='none'">`;
                            
                            return `<span class="details-icon sh-custom-icon sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}-icon">${iconElement} <span class="sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}-value">${formattedValue}</span></span>`;
                        }).join('');
                    })()}
                </div>
                ${(() => {
                    // Generate HTML for custom fields WITHOUT icons (fields with icons are shown above)
                    if (!property.customFields || Object.keys(property.customFields).length === 0) {
                        return '';
                    }
                    
                    // Filter out custom fields that have icons - they're already shown in the property-details section
                    const fieldsWithoutIcons = Object.entries(property.customFields).filter(([key, value]) => {
                        const iconUrl = window.customIcons && window.customIcons[key.toLowerCase()];
                        return !iconUrl; // Only include fields that don't have custom icons
                    });
                    
                    if (fieldsWithoutIcons.length === 0) {
                        return '';
                    }
                    
                    return `
                    <div class="custom-property-details sh-custom-property-details">
                        ${fieldsWithoutIcons.map(([key, value]) => {
                            const columnType = window.customColumnTypes && window.customColumnTypes[key];
                            const formattedValue = columnType === 'boolean' 
                                ? (value ? 'Yes' : 'No')
                                : (columnType === 'numeric' ? value.toLocaleString() : value);
                            
                            return `<div class="custom-detail sh-custom-detail sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}">
                                <span class="custom-detail-label">${key}:</span>
                                <span class="custom-detail-value">${formattedValue}</span>
                            </div>`;
                        }).join('')}
                    </div>
                    `;
                })()}
                ${excerptHtml}
                <span class="sh-button sh-view-button">${buttonText}</span>
            </div>
        `;

        card.innerHTML = cardContent;
        return card;
    }
    
    function formatBathrooms(bathrooms) {
        return Number.isInteger(bathrooms) ? bathrooms.toString() : bathrooms.toFixed(1);
    }

    function formatBathroomsForFilter(bathrooms) {
        return Number.isInteger(bathrooms) ? bathrooms.toString() : bathrooms.toFixed(1);
    }
    
    function renderPropertyListings(properties) {
        const container = document.getElementById('property-grid');
        if (!container) {
            console.error('Property grid container not found');
            return;
        }

        properties.forEach(property => {
            const card = createPropertyCard(property);
            container.appendChild(card);
        });

        initializeFilters(properties);
        initializeMixItUp(itemType);
    }

    function initializeFilters(properties) {
        // Get unique values for dropdown filters - collect all tags and categories
        const locations = new Set();
        const categories = new Set();
        
        properties.forEach(property => {
            // Add all tags to locations
            if (property.allTags && property.allTags.length > 0) {
                property.allTags.forEach(tag => locations.add(tag));
            }
            // Add all categories
            if (property.allCategories && property.allCategories.length > 0) {
                property.allCategories.forEach(category => categories.add(category));
            }
        });
        
        // Only fill dropdowns if they exist
        const locationFilter = document.getElementById('location-filter');
        if (locationFilter && locations.size > 0) {
            populateDropdown('location-filter', locations, 'sh-location-option');
        }
        
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter && categories.size > 0) {
            populateDropdown('status-filter', categories, 'sh-status-option');
        }
        
        // Initialize sliders only if they exist and have valid data
        const areaValues = properties.map(p => p.area).filter(area => area > 0);
        const priceValues = properties.map(p => p.price).filter(price => price > 0);
        
        const areaSlider = document.getElementById('area-slider');
        if (areaSlider && areaValues.length > 0) {
            const minArea = Math.min(...areaValues);
            const maxArea = Math.max(...areaValues);
            initializeSlider('area-slider', minArea, maxArea, window.storeSettings?.measurementStandard === 2 ? 'm²' : 'sq ft', () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
        }
        
        const priceSlider = document.getElementById('price-slider');
        if (priceSlider && priceValues.length > 0) {
            const minPrice = Math.min(...priceValues);
            const maxPrice = Math.max(...priceValues);
            const currencySymbol = getCurrencySymbol(window.storeSettings?.selectedCurrency);
            initializeSlider('price-slider', minPrice, maxPrice, currencySymbol, () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
        }
        
        // Only initialize button group filters if they exist
        const bedroomsFilter = document.getElementById('bedrooms-filter');
        if (bedroomsFilter) {
            hideUnusedOptions('bedrooms-filter', properties, 'bedrooms');
        }
        const bathroomsFilter = document.getElementById('bathrooms-filter');
        if (bathroomsFilter) {
            hideUnusedOptions('bathrooms-filter', properties, 'bathrooms');
        }

        // Initialize custom numeric sliders (not button groups)
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnId = column.toLowerCase().replace(/\s+/g, '-');
                const columnType = window.customColumnTypes[column];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[column];
                if (columnType === 'numeric' && specialHandling !== 'buttonGroup') {
                    // Get all values for this custom field
                    const values = properties.map(p => p.customFields[column]).filter(v => v !== undefined && !isNaN(v));
                    if (values.length > 0) {
                        const minValue = Math.min(...values);
                        const maxValue = Math.max(...values);
                        // Use no unit for custom sliders
                        initializeSlider(`${columnId}-slider`, minValue, maxValue, '', () => {
                            if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
                        });
                    }
                }
            });
        }
    }

    function populateDropdown(id, options, customClass) {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            optionElement.className = customClass;
            dropdown.appendChild(optionElement);
        });
    }

    function initializeSlider(id, min, max, unit, callback) {
        console.log('[initializeSlider] Initializing slider:', { id, min, max, unit });
        const slider = document.getElementById(id);
        if (!slider) {
            console.warn(`[initializeSlider] Slider element not found for id="${id}"`);
            return;
        }
        const rangeDisplay = document.getElementById(`${id}-range`);
        if (!rangeDisplay) {
            console.warn(`[initializeSlider] Range display element not found for id="${id}-range"`);
            return;
        }
        // Ensure min and max are not the same to avoid noUiSlider errors
        if (min === max) {
            max = min + 1;
        }
        noUiSlider.create(slider, {
            start: [min, max],
            connect: true,
            range: { 'min': min, 'max': max },
            format: {
                to: value => Math.round(value),
                from: value => Number(value)
            }
        });
        function updateRangeDisplay(values) {
            const formattedMin = unit === 'm²' || unit === 'sq ft' ?
                `${parseInt(values[0]).toLocaleString()} ${unit}` :
                `${unit}${parseInt(values[0]).toLocaleString()}`;
            const formattedMax = unit === 'm²' || unit === 'sq ft' ?
                `${parseInt(values[1]).toLocaleString()} ${unit}` :
                `${unit}${parseInt(values[1]).toLocaleString()}`;
            rangeDisplay.textContent = `${formattedMin} - ${formattedMax}`;
        }
        slider.noUiSlider.on('update', (values) => {
            updateRangeDisplay(values);
            if (callback) callback(values);
        });
        updateRangeDisplay([min, max]);
        // Log after initialization
        setTimeout(() => {
            console.log(`[initializeSlider] Slider initialized for id="${id}":`, slider, slider.noUiSlider);
        }, 0);
    }
    
    function createPropertyCard(property) {
        const storeSettings = window.storeSettings || {};
        const isMetric = storeSettings.measurementStandard === 2;
        const currencySymbol = getCurrencySymbol(storeSettings.selectedCurrency);
        const areaUnit = getAreaUnit(isMetric);

        const card = document.createElement('a');
        card.className = 'property-card mix sh-property-card';
        card.href = property.url;
        
        // Set data attributes for all tags (for location filtering)
        if (property.allTags && property.allTags.length > 0) {
            card.setAttribute('data-all-tags', property.allTags.join('|'));
            // Keep first tag as location for backwards compatibility with existing filters
            card.setAttribute('data-location', property.allTags[0]);
        }
        
        // Set data attributes for all categories (for category filtering)
        if (property.allCategories && property.allCategories.length > 0) {
            card.setAttribute('data-all-categories', property.allCategories.join('|'));
            // Keep first category for backwards compatibility with existing filters
            card.setAttribute('data-category', property.allCategories[0]);
        }
        
        if (property.bedrooms > 0) {
            card.setAttribute('data-bedrooms', `bed-${property.bedrooms}`);
        }
        
        if (property.bathrooms > 0) {
            card.setAttribute('data-bathrooms', `bath-${formatBathroomsForFilter(property.bathrooms)}`);
        }
        
        if (property.area > 0) {
            card.setAttribute('data-area', property.area);
        }
        
        if (property.price > 0 && showPricing) {
            card.setAttribute('data-price', property.price);
        }
        
        // Add data attributes for custom fields
        if (property.customFields) {
            Object.entries(property.customFields).forEach(([key, value]) => {
                const attributeName = `data-${key.toLowerCase().replace(/\s+/g, '-')}`;
                const columnType = window.customColumnTypes && window.customColumnTypes[key];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[key];
                
                if (columnType === 'boolean') {
                    // For boolean fields, set to 'yes' or 'no' for easier filtering
                    card.setAttribute(attributeName, value ? 'yes' : 'no');
                } else if (columnType === 'numeric') {
                    if (specialHandling === 'buttonGroup') {
                        // For special numeric fields with button group (like Sleeps)
                        // Use the integer value for exact matching
                        card.setAttribute(attributeName, Math.floor(Number(value)));
                    } else {
                        // For standard numeric fields, set the raw number for range filtering
                        card.setAttribute(attributeName, value);
                    }
                } else {
                    // For text fields, set the text value
                    card.setAttribute(attributeName, value);
                }
            });
        }

        // SVG definitions
        const areaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" fill="none" viewBox="0 0 18 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#areaClip)"><path d="M.364 3.203 0 2.839 2.202.638l2.202 2.201-.363.364a.794.794 0 0 1-1.122 0l-.717-.715-.714.715a.794.794 0 0 1-1.124 0Z"/><path d="M16.855 15.016H1.548V1.563h1.308v12.144h14v1.309Z"/><path d="m15.58 16.564-.364-.364a.794.794 0 0 1 0-1.121l.714-.715-.714-.715a.794.794 0 0 1 0-1.122l.363-.363 2.202 2.202-2.202 2.198ZM16.119 11.598h-.634a.654.654 0 0 1 0-1.308h.634c.192 0 .347-.14.347-.317v-.614a.654.654 0 1 1 1.309 0v.614c0 .896-.743 1.625-1.656 1.625ZM13.063 11.599H9.727a.654.654 0 1 1 0-1.309h3.336a.654.654 0 0 1 0 1.309ZM7.251 11.598h-.633c-.913 0-1.657-.729-1.657-1.625v-.614a.654.654 0 1 1 1.309 0v.614c0 .175.156.317.348.317h.633a.654.654 0 1 1 0 1.309ZM5.616 7.727a.654.654 0 0 1-.655-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654ZM5.616 3.537a.654.654 0 0 1-.655-.654v-.614c0-.896.744-1.625 1.657-1.625h.633a.654.654 0 0 1 0 1.308h-.633c-.192 0-.348.14-.348.317v.614a.654.654 0 0 1-.654.654ZM13.01 1.952H9.674a.654.654 0 0 1 0-1.308h3.337a.654.654 0 0 1 0 1.308ZM17.12 3.537a.654.654 0 0 1-.654-.654v-.614c0-.175-.155-.317-.347-.317h-.634a.654.654 0 1 1 0-1.308h.634c.913 0 1.656.729 1.656 1.625v.614a.654.654 0 0 1-.654.654ZM17.12 7.727a.655.655 0 0 1-.654-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654Z"/></g><defs><clipPath id="areaClip"><path fill="#fff" d="M0 .65h17.759v15.89H0z"/></clipPath></defs></svg>`;

        const bedsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="23" height="21" fill="none" viewBox="0 0 23 21"><g clip-path="url(#bedsClip)"><path fill="hsl(var(--black-hsl))" d="M2.735 4.856a.907.907 0 0 0-.95-.906.923.923 0 0 0-.863.93v12.09h1.814v-3.627h4.532V9.716H2.735v-4.86Zm16.1 1.66H8.174v6.827h12.022V7.875a1.36 1.36 0 0 0-1.36-1.36Zm3.085 3.2h-.819v7.254h1.814v-6.26a.994.994 0 0 0-.995-.994ZM5.573 5.613a1.814 1.814 0 1 0-.237 3.62 1.814 1.814 0 0 0 .237-3.62Z"/></g><defs><clipPath id="bedsClip"><path fill="#fff" d="M.685.65h22.23v19.89H.685z"/></clipPath></defs></svg>`;

        const bathsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="17" fill="none" viewBox="0 0 19 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#bathsClip)"><path d="M13.361 6.618a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm-1.553-1.166a.388.388 0 1 0 .147.028.389.389 0 0 0-.15-.029l.003.001Zm-.196 1.166a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm1.749-1.166a.389.389 0 1 0-.001.78.389.389 0 0 0 .001-.78Zm2.137-1.165H11.03a.389.389 0 1 0 0 .777h4.468a.39.39 0 1 0 0-.777ZM15.304.594a2.717 2.717 0 0 0-2.249 1.19 2.135 2.135 0 0 0-1.831 2.113h4.274a2.136 2.136 0 0 0-1.537-2.05 1.981 1.981 0 0 1 1.343-.524c.95 0 1.942.686 1.942 1.991v4.471h.778v-4.47a2.72 2.72 0 0 0-2.72-2.72Zm.194 6.412a.388.388 0 1 0-.777-.001.388.388 0 0 0 .777 0Zm-.194-1.166a.39.39 0 0 0-.664-.275.389.389 0 1 0 .664.275ZM1.537 11.722a3.477 3.477 0 0 0 1.75 3.018l-.889.889a.566.566 0 1 0 .8.8l1.274-1.273c.18.03.363.045.545.046h9.53c.182 0 .364-.017.545-.046l1.273 1.273a.565.565 0 1 0 .8-.8l-.889-.89a3.478 3.478 0 0 0 1.752-3.017v-1.393H1.537v1.393Zm.696-3.133h-.696a.696.696 0 0 0-.696.696v.348h17.882v-.348a.696.696 0 0 0-.696-.696H2.233Z"/></g><defs><clipPath id="bathsClip"><path fill="#fff" d="M.84.594h17.883v16H.84z"/></clipPath></defs></svg>`;

        const garageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" fill="none" viewBox="0 0 20 18"><g fill="hsl(var(--black-hsl))" clip-path="url(#garageClip)"><path d="M15.908 17.09c.413-.046.717-.41.717-.826v-.788a.81.81 0 0 0 .81-.81v-3.238a.81.81 0 0 0-.81-.81h-.113l-1.122-3.77a.404.404 0 0 0-.384-.277H5.292a.404.404 0 0 0-.384.277l-1.122 3.77h-.113a.81.81 0 0 0-.81.81v3.238a.81.81 0 0 0 .81.81v.788c0 .415.304.78.717.826a.812.812 0 0 0 .9-.805v-.81h9.716v.81a.81.81 0 0 0 .902.805ZM5.896 7.785h8.506l.843 2.834H5.052l.844-2.834Zm-.917 5.764a.911.911 0 1 1-.185-1.814.911.911 0 0 1 .185 1.814Zm9.526-.814a.91.91 0 1 1 1.812-.187.91.91 0 0 1-1.812.187ZM18.24 5.92l-8.091-4.245-8.09 4.245a.85.85 0 0 1-1.15-.358l-.254-.487 9.494-4.98 9.494 4.98-.256.487a.851.851 0 0 1-1.148.358Z"/></g><defs><clipPath id="garageClip"><path fill="#fff" d="M.649.094h19v17h-19z"/></clipPath></defs></svg>`;

        // New: Check if excerpt exists
        const excerptHtml = property.excerpt ? 
            `<p class="property-excerpt sh-property-excerpt">${property.excerpt}</p>` : '';

        let cardContent = `
            <div class="property-image sh-property-image">
                <img src="${property.imageUrl}" alt="${property.title}" class="sh-property-img">
                ${property.allCategories && property.allCategories.length > 0 ? 
                    property.allCategories.map(category => `<span class="property-category sh-property-category">${category}</span>`).join('') : ''
                }
            </div>
            <div class="listing-content sh-property-title">
                <h3 class="property-title sh-property-title">${property.title}</h3>
                ${property.allTags && property.allTags.length > 0 ? 
                    `<p class="property-location sh-property-location">${property.allTags.join(', ')}</p>` : ''
                }
                ${showPricing ? `<p class="property-price sh-property-price ${property.price === 0 ? 'no-price' : ''}">${property.price === 0 ? 'Price TBA' : `${currencySymbol}${property.price.toLocaleString()}`}</p>` : ''}
                <div class="property-details sh-property-details">
                    ${property.area > 0 ? `<span class="details-icon sh-area-icon">${areaSvg} <span class="sh-area-value">${property.area.toLocaleString()} ${areaUnit}</span></span>` : ''}
                    ${property.bedrooms > 0 ? `<span class="details-icon sh-beds-icon">${bedsSvg} <span class="sh-beds-value">${property.bedrooms}</span></span>` : ''}
                    ${property.bathrooms > 0 ? `<span class="details-icon sh-baths-icon">${bathsSvg} <span class="sh-baths-value">${formatBathrooms(property.bathrooms)}</span></span>` : ''}
                    ${property.garage ? `<span class="details-icon sh-garage-icon">${garageSvg} <span class="sh-garage-value">${property.garage}</span></span>` : ''}
                    ${(() => {
                        // Add custom fields with icons to the main property details
                        if (!property.customFields || !window.customIcons) {
                            return '';
                        }
                        
                        return Object.entries(property.customFields).map(([key, value]) => {
                            const iconUrl = window.customIcons[key.toLowerCase()];
                            if (!iconUrl) {
                                return ''; // Only show custom fields that have icons here
                            }
                            
                            const columnType = window.customColumnTypes && window.customColumnTypes[key];
                            const formattedValue = columnType === 'boolean' 
                                ? (value ? 'Yes' : 'No')
                                : (columnType === 'numeric' ? value.toLocaleString() : value);
                            
                            // Handle different icon file types and add error handling
                            const isImageIcon = iconUrl.toLowerCase().endsWith('.png') || 
                                              iconUrl.toLowerCase().endsWith('.jpg') || 
                                              iconUrl.toLowerCase().endsWith('.jpeg');
                            
                            const iconElement = isImageIcon 
                                ? `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.style.display='none'">` 
                                : `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px;" onerror="this.style.display='none'">`;
                            
                            return `<span class="details-icon sh-custom-icon sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}-icon">${iconElement} <span class="sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}-value">${formattedValue}</span></span>`;
                        }).join('');
                    })()}
                </div>
                ${(() => {
                    // Generate HTML for custom fields WITHOUT icons (fields with icons are shown above)
                    if (!property.customFields || Object.keys(property.customFields).length === 0) {
                        return '';
                    }
                    
                    // Filter out custom fields that have icons - they're already shown in the property-details section
                    const fieldsWithoutIcons = Object.entries(property.customFields).filter(([key, value]) => {
                        const iconUrl = window.customIcons && window.customIcons[key.toLowerCase()];
                        return !iconUrl; // Only include fields that don't have custom icons
                    });
                    
                    if (fieldsWithoutIcons.length === 0) {
                        return '';
                    }
                    
                    return `
                    <div class="custom-property-details sh-custom-property-details">
                        ${fieldsWithoutIcons.map(([key, value]) => {
                            const columnType = window.customColumnTypes && window.customColumnTypes[key];
                            const formattedValue = columnType === 'boolean' 
                                ? (value ? 'Yes' : 'No')
                                : (columnType === 'numeric' ? value.toLocaleString() : value);
                            
                            return `<div class="custom-detail sh-custom-detail sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}">
                                <span class="custom-detail-label">${key}:</span>
                                <span class="custom-detail-value">${formattedValue}</span>
                            </div>`;
                        }).join('')}
                    </div>
                    `;
                })()}
                ${excerptHtml}
                <span class="sh-button sh-view-button">${buttonText}</span>
            </div>
        `;

        card.innerHTML = cardContent;
        return card;
    }
    
    function formatBathrooms(bathrooms) {
        return Number.isInteger(bathrooms) ? bathrooms.toString() : bathrooms.toFixed(1);
    }

    function formatBathroomsForFilter(bathrooms) {
        return Number.isInteger(bathrooms) ? bathrooms.toString() : bathrooms.toFixed(1);
    }
    
    function renderPropertyListings(properties) {
        const container = document.getElementById('property-grid');
        if (!container) {
            console.error('Property grid container not found');
            return;
        }

        properties.forEach(property => {
            const card = createPropertyCard(property);
            container.appendChild(card);
        });

        initializeFilters(properties);
        initializeMixItUp(itemType);
    }

    function initializeFilters(properties) {
        // Get unique values for dropdown filters - collect all tags and categories
        const locations = new Set();
        const categories = new Set();
        
        properties.forEach(property => {
            // Add all tags to locations
            if (property.allTags && property.allTags.length > 0) {
                property.allTags.forEach(tag => locations.add(tag));
            }
            // Add all categories
            if (property.allCategories && property.allCategories.length > 0) {
                property.allCategories.forEach(category => categories.add(category));
            }
        });
        
        // Only fill dropdowns if they exist
        const locationFilter = document.getElementById('location-filter');
        if (locationFilter && locations.size > 0) {
            populateDropdown('location-filter', locations, 'sh-location-option');
        }
        
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter && categories.size > 0) {
            populateDropdown('status-filter', categories, 'sh-status-option');
        }
        
        // Initialize sliders only if they exist and have valid data
        const areaValues = properties.map(p => p.area).filter(area => area > 0);
        const priceValues = properties.map(p => p.price).filter(price => price > 0);
        
        const areaSlider = document.getElementById('area-slider');
        if (areaSlider && areaValues.length > 0) {
            const minArea = Math.min(...areaValues);
            const maxArea = Math.max(...areaValues);
            initializeSlider('area-slider', minArea, maxArea, window.storeSettings?.measurementStandard === 2 ? 'm²' : 'sq ft', () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
        }
        
        const priceSlider = document.getElementById('price-slider');
        if (priceSlider && priceValues.length > 0) {
            const minPrice = Math.min(...priceValues);
            const maxPrice = Math.max(...priceValues);
            const currencySymbol = getCurrencySymbol(window.storeSettings?.selectedCurrency);
            initializeSlider('price-slider', minPrice, maxPrice, currencySymbol, () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
        }
        
        // Only initialize button group filters if they exist
        const bedroomsFilter = document.getElementById('bedrooms-filter');
        if (bedroomsFilter) {
            hideUnusedOptions('bedrooms-filter', properties, 'bedrooms');
        }
        const bathroomsFilter = document.getElementById('bathrooms-filter');
        if (bathroomsFilter) {
            hideUnusedOptions('bathrooms-filter', properties, 'bathrooms');
        }

        // Initialize custom numeric sliders (not button groups)
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnId = column.toLowerCase().replace(/\s+/g, '-');
                const columnType = window.customColumnTypes[column];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[column];
                if (columnType === 'numeric' && specialHandling !== 'buttonGroup') {
                    // Get all values for this custom field
                    const values = properties.map(p => p.customFields[column]).filter(v => v !== undefined && !isNaN(v));
                    if (values.length > 0) {
                        const minValue = Math.min(...values);
                        const maxValue = Math.max(...values);
                        // Use no unit for custom sliders
                        initializeSlider(`${columnId}-slider`, minValue, maxValue, '', () => {
                            if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
                        });
                    }
                }
            });
        }
    }

    function populateDropdown(id, options, customClass) {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            optionElement.className = customClass;
            dropdown.appendChild(optionElement);
        });
    }

    function initializeSlider(id, min, max, unit, callback) {
        console.log('[initializeSlider] Initializing slider:', { id, min, max, unit });
        const slider = document.getElementById(id);
        if (!slider) {
            console.warn(`[initializeSlider] Slider element not found for id="${id}"`);
            return;
        }
        const rangeDisplay = document.getElementById(`${id}-range`);
        if (!rangeDisplay) {
            console.warn(`[initializeSlider] Range display element not found for id="${id}-range"`);
            return;
        }
        // Ensure min and max are not the same to avoid noUiSlider errors
        if (min === max) {
            max = min + 1;
        }
        noUiSlider.create(slider, {
            start: [min, max],
            connect: true,
            range: { 'min': min, 'max': max },
            format: {
                to: value => Math.round(value),
                from: value => Number(value)
            }
        });
        function updateRangeDisplay(values) {
            const formattedMin = unit === 'm²' || unit === 'sq ft' ?
                `${parseInt(values[0]).toLocaleString()} ${unit}` :
                `${unit}${parseInt(values[0]).toLocaleString()}`;
            const formattedMax = unit === 'm²' || unit === 'sq ft' ?
                `${parseInt(values[1]).toLocaleString()} ${unit}` :
                `${unit}${parseInt(values[1]).toLocaleString()}`;
            rangeDisplay.textContent = `${formattedMin} - ${formattedMax}`;
        }
        slider.noUiSlider.on('update', (values) => {
            updateRangeDisplay(values);
            if (callback) callback(values);
        });
        updateRangeDisplay([min, max]);
        // Log after initialization
        setTimeout(() => {
            console.log(`[initializeSlider] Slider initialized for id="${id}":`, slider, slider.noUiSlider);
        }, 0);
    }
    
    function createPropertyCard(property) {
        const storeSettings = window.storeSettings || {};
        const isMetric = storeSettings.measurementStandard === 2;
        const currencySymbol = getCurrencySymbol(storeSettings.selectedCurrency);
        const areaUnit = getAreaUnit(isMetric);

        const card = document.createElement('a');
        card.className = 'property-card mix sh-property-card';
        card.href = property.url;
        
        // Set data attributes for all tags (for location filtering)
        if (property.allTags && property.allTags.length > 0) {
            card.setAttribute('data-all-tags', property.allTags.join('|'));
            // Keep first tag as location for backwards compatibility with existing filters
            card.setAttribute('data-location', property.allTags[0]);
        }
        
        // Set data attributes for all categories (for category filtering)
        if (property.allCategories && property.allCategories.length > 0) {
            card.setAttribute('data-all-categories', property.allCategories.join('|'));
            // Keep first category for backwards compatibility with existing filters
            card.setAttribute('data-category', property.allCategories[0]);
        }
        
        if (property.bedrooms > 0) {
            card.setAttribute('data-bedrooms', `bed-${property.bedrooms}`);
        }
        
        if (property.bathrooms > 0) {
            card.setAttribute('data-bathrooms', `bath-${formatBathroomsForFilter(property.bathrooms)}`);
        }
        
        if (property.area > 0) {
            card.setAttribute('data-area', property.area);
        }
        
        if (property.price > 0 && showPricing) {
            card.setAttribute('data-price', property.price);
        }
        
        // Add data attributes for custom fields
        if (property.customFields) {
            Object.entries(property.customFields).forEach(([key, value]) => {
                const attributeName = `data-${key.toLowerCase().replace(/\s+/g, '-')}`;
                const columnType = window.customColumnTypes && window.customColumnTypes[key];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[key];
                
                if (columnType === 'boolean') {
                    // For boolean fields, set to 'yes' or 'no' for easier filtering
                    card.setAttribute(attributeName, value ? 'yes' : 'no');
                } else if (columnType === 'numeric') {
                    if (specialHandling === 'buttonGroup') {
                        // For special numeric fields with button group (like Sleeps)
                        // Use the integer value for exact matching
                        card.setAttribute(attributeName, Math.floor(Number(value)));
                    } else {
                        // For standard numeric fields, set the raw number for range filtering
                        card.setAttribute(attributeName, value);
                    }
                } else {
                    // For text fields, set the text value
                    card.setAttribute(attributeName, value);
                }
            });
        }

        // SVG definitions
        const areaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" fill="none" viewBox="0 0 18 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#areaClip)"><path d="M.364 3.203 0 2.839 2.202.638l2.202 2.201-.363.364a.794.794 0 0 1-1.122 0l-.717-.715-.714.715a.794.794 0 0 1-1.124 0Z"/><path d="M16.855 15.016H1.548V1.563h1.308v12.144h14v1.309Z"/><path d="m15.58 16.564-.364-.364a.794.794 0 0 1 0-1.121l.714-.715-.714-.715a.794.794 0 0 1 0-1.122l.363-.363 2.202 2.202-2.202 2.198ZM16.119 11.598h-.634a.654.654 0 0 1 0-1.308h.634c.192 0 .347-.14.347-.317v-.614a.654.654 0 1 1 1.309 0v.614c0 .896-.743 1.625-1.656 1.625ZM13.063 11.599H9.727a.654.654 0 1 1 0-1.309h3.336a.654.654 0 0 1 0 1.309ZM7.251 11.598h-.633c-.913 0-1.657-.729-1.657-1.625v-.614a.654.654 0 1 1 1.309 0v.614c0 .175.156.317.348.317h.633a.654.654 0 1 1 0 1.309ZM5.616 7.727a.654.654 0 0 1-.655-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654ZM5.616 3.537a.654.654 0 0 1-.655-.654v-.614c0-.896.744-1.625 1.657-1.625h.633a.654.654 0 0 1 0 1.308h-.633c-.192 0-.348.14-.348.317v.614a.654.654 0 0 1-.654.654ZM13.01 1.952H9.674a.654.654 0 0 1 0-1.308h3.337a.654.654 0 0 1 0 1.308ZM17.12 3.537a.654.654 0 0 1-.654-.654v-.614c0-.175-.155-.317-.347-.317h-.634a.654.654 0 1 1 0-1.308h.634c.913 0 1.656.729 1.656 1.625v.614a.654.654 0 0 1-.654.654ZM17.12 7.727a.655.655 0 0 1-.654-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654Z"/></g><defs><clipPath id="areaClip"><path fill="#fff" d="M0 .65h17.759v15.89H0z"/></clipPath></defs></svg>`;

        const bedsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="23" height="21" fill="none" viewBox="0 0 23 21"><g clip-path="url(#bedsClip)"><path fill="hsl(var(--black-hsl))" d="M2.735 4.856a.907.907 0 0 0-.95-.906.923.923 0 0 0-.863.93v12.09h1.814v-3.627h4.532V9.716H2.735v-4.86Zm16.1 1.66H8.174v6.827h12.022V7.875a1.36 1.36 0 0 0-1.36-1.36Zm3.085 3.2h-.819v7.254h1.814v-6.26a.994.994 0 0 0-.995-.994ZM5.573 5.613a1.814 1.814 0 1 0-.237 3.62 1.814 1.814 0 0 0 .237-3.62Z"/></g><defs><clipPath id="bedsClip"><path fill="#fff" d="M.685.65h22.23v19.89H.685z"/></clipPath></defs></svg>`;

        const bathsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="17" fill="none" viewBox="0 0 19 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#bathsClip)"><path d="M13.361 6.618a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm-1.553-1.166a.388.388 0 1 0 .147.028.389.389 0 0 0-.15-.029l.003.001Zm-.196 1.166a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm1.749-1.166a.389.389 0 1 0-.001.78.389.389 0 0 0 .001-.78Zm2.137-1.165H11.03a.389.389 0 1 0 0 .777h4.468a.39.39 0 1 0 0-.777ZM15.304.594a2.717 2.717 0 0 0-2.249 1.19 2.135 2.135 0 0 0-1.831 2.113h4.274a2.136 2.136 0 0 0-1.537-2.05 1.981 1.981 0 0 1 1.343-.524c.95 0 1.942.686 1.942 1.991v4.471h.778v-4.47a2.72 2.72 0 0 0-2.72-2.72Zm.194 6.412a.388.388 0 1 0-.777-.001.388.388 0 0 0 .777 0Zm-.194-1.166a.39.39 0 0 0-.664-.275.389.389 0 1 0 .664.275ZM1.537 11.722a3.477 3.477 0 0 0 1.75 3.018l-.889.889a.566.566 0 1 0 .8.8l1.274-1.273c.18.03.363.045.545.046h9.53c.182 0 .364-.017.545-.046l1.273 1.273a.565.565 0 1 0 .8-.8l-.889-.89a3.478 3.478 0 0 0 1.752-3.017v-1.393H1.537v1.393Zm.696-3.133h-.696a.696.696 0 0 0-.696.696v.348h17.882v-.348a.696.696 0 0 0-.696-.696H2.233Z"/></g><defs><clipPath id="bathsClip"><path fill="#fff" d="M.84.594h17.883v16H.84z"/></clipPath></defs></svg>`;

        const garageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" fill="none" viewBox="0 0 20 18"><g fill="hsl(var(--black-hsl))" clip-path="url(#garageClip)"><path d="M15.908 17.09c.413-.046.717-.41.717-.826v-.788a.81.81 0 0 0 .81-.81v-3.238a.81.81 0 0 0-.81-.81h-.113l-1.122-3.77a.404.404 0 0 0-.384-.277H5.292a.404.404 0 0 0-.384.277l-1.122 3.77h-.113a.81.81 0 0 0-.81.81v3.238a.81.81 0 0 0 .81.81v.788c0 .415.304.78.717.826a.812.812 0 0 0 .9-.805v-.81h9.716v.81a.81.81 0 0 0 .902.805ZM5.896 7.785h8.506l.843 2.834H5.052l.844-2.834Zm-.917 5.764a.911.911 0 1 1-.185-1.814.911.911 0 0 1 .185 1.814Zm9.526-.814a.91.91 0 1 1 1.812-.187.91.91 0 0 1-1.812.187ZM18.24 5.92l-8.091-4.245-8.09 4.245a.85.85 0 0 1-1.15-.358l-.254-.487 9.494-4.98 9.494 4.98-.256.487a.851.851 0 0 1-1.148.358Z"/></g><defs><clipPath id="garageClip"><path fill="#fff" d="M.649.094h19v17h-19z"/></clipPath></defs></svg>`;

        // New: Check if excerpt exists
        const excerptHtml = property.excerpt ? 
            `<p class="property-excerpt sh-property-excerpt">${property.excerpt}</p>` : '';

        let cardContent = `
            <div class="property-image sh-property-image">
                <img src="${property.imageUrl}" alt="${property.title}" class="sh-property-img">
                ${property.allCategories && property.allCategories.length > 0 ? 
                    property.allCategories.map(category => `<span class="property-category sh-property-category">${category}</span>`).join('') : ''
                }
            </div>
            <div class="listing-content sh-property-title">
                <h3 class="property-title sh-property-title">${property.title}</h3>
                ${property.allTags && property.allTags.length > 0 ? 
                    `<p class="property-location sh-property-location">${property.allTags.join(', ')}</p>` : ''
                }
                ${showPricing ? `<p class="property-price sh-property-price ${property.price === 0 ? 'no-price' : ''}">${property.price === 0 ? 'Price TBA' : `${currencySymbol}${property.price.toLocaleString()}`}</p>` : ''}
                <div class="property-details sh-property-details">
                    ${property.area > 0 ? `<span class="details-icon sh-area-icon">${areaSvg} <span class="sh-area-value">${property.area.toLocaleString()} ${areaUnit}</span></span>` : ''}
                    ${property.bedrooms > 0 ? `<span class="details-icon sh-beds-icon">${bedsSvg} <span class="sh-beds-value">${property.bedrooms}</span></span>` : ''}
                    ${property.bathrooms > 0 ? `<span class="details-icon sh-baths-icon">${bathsSvg} <span class="sh-baths-value">${formatBathrooms(property.bathrooms)}</span></span>` : ''}
                    ${property.garage ? `<span class="details-icon sh-garage-icon">${garageSvg} <span class="sh-garage-value">${property.garage}</span></span>` : ''}
                    ${(() => {
                        // Add custom fields with icons to the main property details
                        if (!property.customFields || !window.customIcons) {
                            return '';
                        }
                        
                        return Object.entries(property.customFields).map(([key, value]) => {
                            const iconUrl = window.customIcons[key.toLowerCase()];
                            if (!iconUrl) {
                                return ''; // Only show custom fields that have icons here
                            }
                            
                            const columnType = window.customColumnTypes && window.customColumnTypes[key];
                            const formattedValue = columnType === 'boolean' 
                                ? (value ? 'Yes' : 'No')
                                : (columnType === 'numeric' ? value.toLocaleString() : value);
                            
                            // Handle different icon file types and add error handling
                            const isImageIcon = iconUrl.toLowerCase().endsWith('.png') || 
                                              iconUrl.toLowerCase().endsWith('.jpg') || 
                                              iconUrl.toLowerCase().endsWith('.jpeg');
                            
                            const iconElement = isImageIcon 
                                ? `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.style.display='none'">` 
                                : `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px;" onerror="this.style.display='none'">`;
                            
                            return `<span class="details-icon sh-custom-icon sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}-icon">${iconElement} <span class="sh-custom-${key.toLowerCase().replace(/\s+/g, '-')}-value">${formattedValue}</span></span>`;
                        }).join('');
                    })()}
                </div>
                ${(() => {
                    // Generate HTML for custom fields WITHOUT icons (fields with icons are shown above)
                    if (!property.customFields || Object.keys(property.customFields).length === 0) {
                        return '';
                    }
                    
                    // Filter out custom fields that have icons - they're already shown in the property-details section
                   