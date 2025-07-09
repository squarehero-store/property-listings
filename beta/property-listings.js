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

    function createFilterElements(propertyData) {
        const container = document.getElementById('propertyListingsContainer');
        if (!container) {
            console.error('Property listings container not found');
            return;
        }
        
        // Add pricing-hidden class to container if pricing is disabled
        if (!showPricing) {
            container.classList.add('pricing-hidden');
        }

        const filtersContainer = document.createElement('div');
        filtersContainer.className = 'filters-container sh-filters-container';

        // Check which attributes are available in the data
        const hasLocations = propertyData.some(p => p.allTags && p.allTags.length > 0);
        const hasCategories = propertyData.some(p => p.allCategories && p.allCategories.length > 0);
        const hasBedrooms = propertyData.some(p => p.bedrooms > 0);
        const hasBathrooms = propertyData.some(p => p.bathrooms > 0);
        const hasAreas = propertyData.some(p => p.area > 0);
        const hasPrices = showPricing && propertyData.some(p => p.price > 0);

        // Only add filters for attributes that exist in the data
        if (hasLocations) {
            filtersContainer.appendChild(createDropdownFilter('location-filter', tagLabel, 'All', 'sh-location-filter'));
        }
        
        if (hasCategories) {
            filtersContainer.appendChild(createDropdownFilter('status-filter', categoryLabel, 'All', 'sh-status-filter'));
        }
        
        if (hasBedrooms) {
            filtersContainer.appendChild(createButtonGroupFilter('bedrooms-filter', 'Bedrooms', ['Any', '1', '2', '3', '4', '5', '6', '7', '8'], 'sh-bedrooms-filter'));
        }
        
        if (hasBathrooms) {
            filtersContainer.appendChild(createButtonGroupFilter('bathrooms-filter', 'Bathrooms', ['Any', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6'], 'sh-bathrooms-filter'));
        }
        
        if (hasAreas) {
            filtersContainer.appendChild(createSliderFilter('area-slider', 'Area', 'sh-area-filter'));
        }
        
        if (hasPrices && showPricing) {
            filtersContainer.appendChild(createSliderFilter('price-slider', 'Price', 'sh-price-filter'));
        }
        
        // Add filters for custom columns if they exist
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnId = column.toLowerCase().replace(/\s+/g, '-');
                const columnType = window.customColumnTypes[column];
                
                // Create a filter based on the column type
                if (columnType === 'numeric') {
                    // Check if there are values available for this column
                    const values = propertyData
                        .map(p => p.customFields[column])
                        .filter(v => v !== undefined && !isNaN(v));
                    
                    if (values.length > 0) {
                        // Check if this column has special handling
                        const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[column];
                        
                        if (specialHandling === 'buttonGroup') {
                            // Create a button group for numeric fields with few distinct values
                            console.log(`👥 Creating button group filter for numeric field "${column}"`);
                            
                            // Find the unique values and sort them numerically
                            const uniqueValues = [...new Set(values.map(v => Math.floor(Number(v))))];
                            uniqueValues.sort((a, b) => a - b);
                            
                            // Create options array with "Any" and all possible values
                            const options = ['Any', ...uniqueValues.map(v => v.toString())];
                            
                            filtersContainer.appendChild(createButtonGroupFilter(
                                `${columnId}-filter`, 
                                column, 
                                options, 
                                `sh-${columnId}-filter`
                            ));
                        } else {
                            // Standard numeric slider filter
                            console.log(`📊 Creating numeric slider filter for "${column}"`);
                            filtersContainer.appendChild(createSliderFilter(`${columnId}-slider`, column, `sh-${columnId}-filter`));
                        }
                    }
                } else if (columnType === 'boolean') {
                    // For Yes/No columns, create a toggle filter
                    console.log(`✓ Creating Yes/No toggle filter for "${column}"`);
                    filtersContainer.appendChild(createButtonGroupFilter(`${columnId}-filter`, column, ['Any', 'Yes', 'No'], `sh-${columnId}-filter`));
                } else {
                    // For text columns, create a dropdown if there are fewer than 10 unique values
                    // otherwise, text search might be more appropriate
                    const values = new Set(propertyData
                        .map(p => p.customFields[column])
                        .filter(v => v !== undefined && v !== null && v !== ''));
                    
                    if (values.size > 0 && values.size <= 10) {
                        console.log(`📝 Creating dropdown filter for "${column}" with ${values.size} options`);
                        const customDropdown = createDropdownFilter(`${columnId}-filter`, column, `Any ${column}`, `sh-${columnId}-filter`);
                        // Populate the dropdown with values
                        const dropdown = customDropdown.querySelector(`#${columnId}-filter`);
                        values.forEach(value => {
                            const option = document.createElement('option');
                            option.value = value;
                            option.textContent = value;
                            option.className = `sh-${columnId}-option`;
                            dropdown.appendChild(option);
                        });
                        filtersContainer.appendChild(customDropdown);
                    }
                }
            });
        }

        // Only add reset button if we have at least one filter
        const hasFilters = hasLocations || hasCategories || hasBedrooms || hasBathrooms || hasAreas || hasPrices || 
                          (window.customColumns && window.customColumns.length > 0);
        if (hasFilters) {
            const resetButton = document.createElement('button');
            resetButton.id = 'reset-filters';
            resetButton.className = 'reset-button sh-button sh-reset-button';
            resetButton.textContent = 'Reset Filters';
            resetButton.addEventListener('click', resetFilters);
            filtersContainer.appendChild(resetButton);
        }

        container.appendChild(filtersContainer);

        const gridContainer = document.createElement('div');
        gridContainer.id = 'property-grid';
        gridContainer.className = 'property-grid sh-property-grid';
        container.appendChild(gridContainer);
    }

    function createDropdownFilter(id, label, defaultOption, customClass) {
        const group = document.createElement('div');
        group.className = `filter-group ${customClass}-group`;

        const labelElement = document.createElement('label');
        labelElement.htmlFor = id;
        labelElement.textContent = label;
        labelElement.className = `${customClass}-label`;

        const select = document.createElement('select');
        select.id = id;
        select.className = `dropdown-filter ${customClass}`;

        const option = document.createElement('option');
        option.value = 'all';
        option.textContent = defaultOption;
        option.className = `${customClass}-option`;
        select.appendChild(option);

        group.appendChild(labelElement);
        group.appendChild(select);

        return group;
    }

    function createButtonGroupFilter(id, label, options, customClass) {
        const group = document.createElement('div');
        group.className = `filter-group ${customClass}-group`;

        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.className = `${customClass}-label`;

        const buttonGroup = document.createElement('div');
        buttonGroup.id = id;
        
        // Check if this is a boolean filter (Yes/No)
        const isBooleanFilter = id.includes('-filter') && 
                               options.length === 3 && 
                               options.includes('Any') && 
                               options.includes('Yes') && 
                               options.includes('No');
        
        // Use a special class for boolean filters to style them differently
        buttonGroup.className = isBooleanFilter 
            ? `button-group ${customClass}-buttons boolean-button-group` 
            : `button-group ${customClass}-buttons`;
            
        // Set a data attribute to identify boolean filters
        if (isBooleanFilter) {
            buttonGroup.setAttribute('data-boolean-filter', 'true');
        }

        options.forEach(option => {
            const button = document.createElement('button');
            button.className = `filter-button ${customClass}-button`;
            let filterValue = option.toLowerCase() === 'any' ? 'all' : option;
            if (id === 'bedrooms-filter' && filterValue !== 'all') {
                filterValue = `bed-${filterValue}`;
            } else if (id === 'bathrooms-filter' && filterValue !== 'all') {
                filterValue = `bath-${filterValue}`;
            }
            button.setAttribute('data-filter', filterValue);
            button.textContent = option;
            buttonGroup.appendChild(button);
        });

        group.appendChild(labelElement);
        group.appendChild(buttonGroup);

        return group;
    }

    function createSliderFilter(id, label, customClass) {
        console.log('[createSliderFilter] Creating slider filter:', { id, label, customClass });
        const group = document.createElement('div');
        group.className = `filter-group ${customClass}-group`;

        const labelContainer = document.createElement('div');
        labelContainer.className = `slider-label-container ${customClass}-label-container`;

        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.className = `${customClass}-label`;

        const rangeDisplay = document.createElement('span');
        rangeDisplay.className = `range-display ${customClass}-range`;
        rangeDisplay.id = `${id}-range`;

        labelContainer.appendChild(labelElement);
        labelContainer.appendChild(rangeDisplay);

        const slider = document.createElement('div');
        slider.id = id;
        slider.className = `range-slider ${customClass}-slider`;

        group.appendChild(labelContainer);
        group.appendChild(slider);

        // Log the created DOM structure for debugging
        setTimeout(() => {
            const el = document.getElementById(id);
            const rangeEl = document.getElementById(`${id}-range`);
            console.log(`[createSliderFilter] DOM check for id="${id}":`, el, rangeEl);
        }, 0);

        return group;
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

        // Initialize custom numeric sliders for custom columns
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnType = window.customColumnTypes[column];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[column];
                if (columnType === 'numeric' && specialHandling !== 'buttonGroup') {
                    const columnId = column.toLowerCase().replace(/\s+/g, '-');
                    const slider = document.getElementById(`${columnId}-slider`);
                    if (slider) {
                        // Get all values for this custom column
                        const values = properties.map(p => p.customFields && p.customFields[column]).filter(v => v !== undefined && !isNaN(v));
                        if (values.length > 0) {
                            const minValue = Math.min(...values);
                            const maxValue = Math.max(...values);
                            // Use unit if available, otherwise empty string
                            let unit = '';
                            // Optionally, you can add logic to set a unit per column if needed
                            initializeSlider(`${columnId}-slider`, minValue, maxValue, unit, () => {
                                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
                            });
                        }
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
    
    function hideUnusedOptions(filterId, properties, propertyKey) {
        const filterButtons = document.querySelectorAll(`#${filterId} .filter-button`);
        if (!filterButtons.length) return;
        
        const availableValues = new Set(properties.map(p => p[propertyKey]).filter(Boolean));

        filterButtons.forEach(button => {
            const filterValue = button.getAttribute('data-filter');
            if (filterValue === 'all') return;

            const numericValue = parseFloat(filterValue.split('-')[1]);
            button.style.display = availableValues.has(numericValue) ? '' : 'none';
        });
    }
    
    function initializeMixItUp(itemType = 'properties') {
        // Add custom CSS for excerpt
        const excerptStyle = document.createElement('style');
        excerptStyle.id = 'sh-excerpt-style';
        excerptStyle.textContent = `
            .sh-property-excerpt {
                margin-top: 10px;
                margin-bottom: 15px;
                font-size: 14px;
                line-height: 1.5;
                color: hsl(var(--black-hsl));
                opacity: 0.85;
                overflow: hidden;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
            }
            
            /* Style for multiple categories */
            .property-category {
                display: inline-block;
                margin-right: 5px;
                margin-bottom: 3px;
            }
            
            .property-category:last-child {
                margin-right: 0;
            }
        `;
        document.head.appendChild(excerptStyle);

        const container = document.getElementById('property-grid');
        if (!container) return;

        const noResultsMessage = document.createElement('div');
        noResultsMessage.id = 'no-results-message';
        noResultsMessage.className = 'no-results-message sh-no-results';
        noResultsMessage.style.display = 'none';
        noResultsMessage.innerHTML = `
            <h3 class="sh-no-results-title">No ${itemType} found</h3>
            <p class="sh-no-results-text">We couldn't find any ${itemType} matching your current filter criteria. 
            Please try adjusting your filters or <a href="#" id="reset-filters-link" class="sh-reset-link">reset all filters</a> to see all available ${itemType}.</p>
        `;
        container.parentNode.insertBefore(noResultsMessage, container.nextSibling);

        try {
            window.mixer = mixitup(container, {
                selectors: {
                    target: '.property-card'
                },
                load: {
                    filter: 'all'
                },
                animation: {
                    enable: false,
                    effects: 'fade',
                    duration: 300,
                    easing: 'ease'
                },
                callbacks: {
                    onMixStart: function(state) {
                        return filterByRanges(state);
                    },
                    onMixEnd: function (state) {
                        if (state.totalShow === 0) {
                            noResultsMessage.style.display = 'block';
                            container.style.display = 'none';
                        } else {
                            noResultsMessage.style.display = 'none';
                            container.style.display = 'grid';
                        }
                    }
                }
            });

            function filterByRanges(state) {
                const areaSlider = document.getElementById('area-slider');
                const priceSlider = document.getElementById('price-slider');
                const cards = state.targets;
                
                // Check if any sliders exist (including custom numeric sliders)
                let hasAnySliders = areaSlider || priceSlider;
                
                // Get custom numeric sliders if they exist
                const customNumericSliders = [];
                if (window.customColumns && window.customColumns.length > 0) {
                    window.customColumns.forEach(column => {
                        if (window.customColumnTypes[column] === 'numeric') {
                            const columnId = column.toLowerCase().replace(/\s+/g, '-');
                            const slider = document.getElementById(`${columnId}-slider`);
                            if (slider && slider.noUiSlider) {
                                customNumericSliders.push({ 
                                    column, 
                                    columnId, 
                                    slider 
                                });
                                hasAnySliders = true;
                            }
                        }
                    });
                }
    
                // Only apply range filtering if sliders exist
                if (!hasAnySliders) return true;
    
                cards.forEach(card => {
                    // Default to showing card
                    let shouldShow = true;
                    
                    // Apply area filter if slider exists
                    if (areaSlider && areaSlider.noUiSlider) {
                        const [minArea, maxArea] = areaSlider.noUiSlider.get().map(Number);
                        const cardArea = parseFloat(card.getAttribute('data-area') || 0);
                        
                        // Skip area filtering if card doesn't have area data
                        if (card.hasAttribute('data-area')) {
                            shouldShow = shouldShow && (cardArea >= minArea && cardArea <= maxArea);
                        }
                    }
                    
                    // Apply price filter if slider exists and pricing is enabled
                    if (showPricing && priceSlider && priceSlider.noUiSlider) {
                        const [minPrice, maxPrice] = priceSlider.noUiSlider.get().map(Number);
                        const cardPrice = parseFloat(card.getAttribute('data-price') || 0);
                        
                        // Skip price filtering if card doesn't have price data
                        if (card.hasAttribute('data-price')) {
                            shouldShow = shouldShow && (cardPrice >= minPrice && cardPrice <= maxPrice);
                        }
                    }
                    
                    // Apply custom numeric filters
                    customNumericSliders.forEach(({ column, columnId, slider }) => {
                        if (slider && slider.noUiSlider) {
                            const [minValue, maxValue] = slider.noUiSlider.get().map(Number);
                            const dataAttr = `data-${columnId}`;
                            
                            if (card.hasAttribute(dataAttr)) {
                                const cardValue = parseFloat(card.getAttribute(dataAttr) || 0);
                                shouldShow = shouldShow && (cardValue >= minValue && cardValue <= maxValue);
                            }
                        }
                    });
    
                    // Only hide/show if the card is part of the current filter state
                    if (state.matching.includes(card)) {
                        if (shouldShow && !card.classList.contains('custom-filtered')) {
                            card.classList.remove('range-filtered');
                        } else {
                            card.classList.add('range-filtered');
                        }
                    }
                });
    
                // Add CSS if it doesn't exist
                if (!document.getElementById('range-filter-style')) {
                    const style = document.createElement('style');
                    style.id = 'range-filter-style';
                    style.textContent = '.range-filtered { display: none !important; } .custom-filtered { display: none !important; }';
                    document.head.appendChild(style);
                }
    
                return true;
            }
            
            // Update slider event handlers
            const areaSlider = document.getElementById('area-slider');
            const priceSlider = document.getElementById('price-slider');
    
            if (areaSlider && areaSlider.noUiSlider) {
                areaSlider.noUiSlider.on('update', () => {
                    if (window.mixer) {
                        window.mixer.filter(window.mixer.getState().activeFilter);
                    }
                });
            }
            
            if (priceSlider && priceSlider.noUiSlider) {
                priceSlider.noUiSlider.on('update', () => {
                    if (window.mixer) {
                        window.mixer.filter(window.mixer.getState().activeFilter);
                    }
                });
            }
            
            // Add event listeners to dropdown and button filters
            const locationFilter = document.getElementById('location-filter');
            const statusFilter = document.getElementById('status-filter');
    
            if (locationFilter) {
                locationFilter.addEventListener('change', updateFilters);
            }
            
            if (statusFilter) {
                statusFilter.addEventListener('change', updateFilters);
            }
            
            // Add event listeners for custom column dropdown filters
            if (window.customColumns && window.customColumns.length > 0) {
                window.customColumns.forEach(column => {
                    const columnId = column.toLowerCase().replace(/\s+/g, '-');
                    const columnType = window.customColumnTypes[column];
                    
                    if (columnType === 'text') {
                        const customDropdown = document.getElementById(`${columnId}-filter`);
                        if (customDropdown) {
                            customDropdown.addEventListener('change', updateFilters);
                        }
                    }
                });
            }
            
            // Add event listeners for custom numeric sliders
            if (window.customColumns && window.customColumns.length > 0) {
                window.customColumns.forEach(column => {
                    const columnId = column.toLowerCase().replace(/\s+/g, '-');
                    const columnType = window.customColumnTypes[column];
                    const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[column];
                    
                    if (columnType === 'numeric' && specialHandling !== 'buttonGroup') {
                        const customSlider = document.getElementById(`${columnId}-slider`);
                        if (customSlider && customSlider.noUiSlider) {
                            customSlider.noUiSlider.on('update', () => {
                                if (window.mixer) {
                                    window.mixer.filter(window.mixer.getState().activeFilter);
                                }
                            });
                        }
                    }
                });
            }
    
            document.querySelectorAll('.button-group').forEach(group => {
                group.addEventListener('click', (e) => {
                    if (e.target.classList.contains('filter-button')) {
                        const isBooleanGroup = group.getAttribute('data-boolean-filter') === 'true';
                        
                        if (isBooleanGroup) {
                            // For boolean filters, implement radio-button like behavior
                            // First, handle the 'Any' button
                            if (e.target.getAttribute('data-filter') === 'all') {
                                // If 'Any' is clicked, deactivate all other buttons
                                Array.from(group.children).forEach(button => {
                                    button.classList.remove('active');
                                });
                                e.target.classList.add('active');
                            } else {
                                // If 'Yes' or 'No' is clicked
                                const anyButton = group.querySelector('[data-filter="all"]');
                                if (anyButton) {
                                    anyButton.classList.remove('active');
                                }
                                
                                // Remove active class from all buttons first
                                Array.from(group.children).forEach(button => {
                                    if (button !== e.target && button !== anyButton) {
                                        button.classList.remove('active');
                                    }
                                });
                                
                                // Toggle the clicked button
                                e.target.classList.toggle('active');
                                
                                // If no button is active, activate 'Any'
                                if (!Array.from(group.children).some(btn => btn.classList.contains('active'))) {
                                    anyButton.classList.add('active');
                                }
                            }
                        } else {
                            // Original behavior for non-boolean filters
                            e.target.classList.toggle('active');
                            if (e.target.getAttribute('data-filter') === 'all') {
                                Array.from(e.target.parentNode.children).forEach(sibling => {
                                    if (sibling !== e.target) {
                                        sibling.classList.remove('active');
                                    }
                                });
                            } else {
                                const anyButton = e.target.parentNode.querySelector('[data-filter="all"]');
                                if (anyButton) {
                                    anyButton.classList.remove('active');
                                }
                            }
                        }
                        updateFilters();
                    }
                });
            });
            
            // Apply initial filter
            window.mixer.filter('all');
            
            // Apply URL params after initialization
            setTimeout(applyUrlFilters, 500);
        } catch (error) {
            console.error('Error initializing MixItUp:', error);
        }
    }
    
    function updateFilters() {
        const locationFilter = document.getElementById('location-filter');
        const statusFilter = document.getElementById('status-filter');
        
        // Create a custom filter function for multiple tags/categories
        const customFilterFunction = (card) => {
            let matchesLocation = true;
            let matchesCategory = true;
            
            // Check location filter (tags)
            if (locationFilter && locationFilter.value !== 'all') {
                const selectedLocation = locationFilter.value;
                const allTags = card.getAttribute('data-all-tags');
                
                matchesLocation = allTags && allTags.split('|').includes(selectedLocation);
            }
            
            // Check category filter
            if (statusFilter && statusFilter.value !== 'all') {
                const selectedCategory = statusFilter.value;
                const allCategories = card.getAttribute('data-all-categories');
                
                matchesCategory = allCategories && allCategories.split('|').includes(selectedCategory);
            }
            
            return matchesLocation && matchesCategory;
        };
        
        // Apply custom filtering logic for location and category
        const cards = document.querySelectorAll('.property-card');
        cards.forEach(card => {
            if (customFilterFunction(card)) {
                card.style.display = '';
                card.classList.remove('custom-filtered');
            } else {
                card.style.display = 'none';
                card.classList.add('custom-filtered');
            }
        });
        
        let filterArray = [];

        // Build filter array for other attributes (bedrooms, bathrooms, etc.)
        const bedroomsFilter = document.getElementById('bedrooms-filter');
        if (bedroomsFilter) {
            const bedrooms = getActiveFilters('bedrooms-filter');
            if (bedrooms.length > 0 && !bedrooms.includes('all')) {
                filterArray.push(bedrooms.map(bed => `[data-bedrooms="${bed}"]`).join(', '));
            }
        }
        
        const bathroomsFilter = document.getElementById('bathrooms-filter');
        if (bathroomsFilter) {
            const bathrooms = getActiveFilters('bathrooms-filter');
            if (bathrooms.length > 0 && !bathrooms.includes('all')) {
                filterArray.push(bathrooms.map(bath => `[data-bathrooms="${bath}"]`).join(', '));
            }
        }
        
        // Handle custom column filters if they exist
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnId = column.toLowerCase().replace(/\s+/g, '-');
                const columnType = window.customColumnTypes[column];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[column];
                
                if (columnType === 'boolean') {
                    // Handle Yes/No button group filters
                    const customFilter = document.getElementById(`${columnId}-filter`);
                    if (customFilter) {
                        const customValues = getActiveFilters(`${columnId}-filter`);
                        if (customValues.length > 0 && !customValues.includes('all')) {
                            // Map 'Yes'/'No' to 'yes'/'no' for attribute matching
                            const mappedValues = customValues.map(val => {
                                if (val === 'Yes') return `[data-${columnId}="yes"]`;
                                if (val === 'No') return `[data-${columnId}="no"]`;
                                return `[data-${columnId}="${val.toLowerCase()}"]`;
                            });
                            filterArray.push(mappedValues.join(', '));
                        }
                    }
                } else if (specialHandling === 'buttonGroup') {
                    // Handle special numeric fields using button groups (like Sleeps)
                    const customFilter = document.getElementById(`${columnId}-filter`);
                    if (customFilter) {
                        const customValues = getActiveFilters(`${columnId}-filter`);
                        if (customValues.length > 0 && !customValues.includes('all')) {
                            // Create a selector that matches exact values
                            const valueSelectors = customValues.map(val => {
                                // Ensure the value is properly escaped for CSS selector
                                const numVal = parseInt(val);
                                if (!isNaN(numVal)) {
                                    return `[data-${columnId}="${numVal}"]`;
                                } else {
                                    // Fallback for non-numeric values
                                    return `[data-${columnId}="${CSS.escape(val)}"]`;
                                }
                            });
                            filterArray.push(valueSelectors.join(', '));
                        }
                    }
                } else if (columnType === 'text') {
                    // Handle dropdown text filters
                    const dropdownFilter = document.getElementById(`${columnId}-filter`);
                    if (dropdownFilter) {
                        const value = dropdownFilter.value;
                        if (value !== 'all') {
                            filterArray.push(`[data-${columnId}="${value}"]`);
                        }
                    }
                }
                // Numeric filters are handled separately with sliders
            });
        }

        let filterString = filterArray.length > 0 ? filterArray.join('') : 'all';

        // Clear any existing range filters before applying new filters
        document.querySelectorAll('.property-card').forEach(card => {
            card.classList.remove('range-filtered');
        });
        
        if (window.mixer) {
            window.mixer.filter(filterString);
        }
        
        // Update URL parameters when filters change
        updateUrlWithFilters();
    }

    function getActiveFilters(groupId) {
        const group = document.getElementById(groupId);
        if (!group) return ['all'];
        
        const activeButtons = Array.from(document.querySelectorAll(`#${groupId} .filter-button.active`));
        if (activeButtons.length === 0) {
            return ['all'];
        }
        return activeButtons.map(button => button.getAttribute('data-filter'));
    }

    function resetFilters() {
        // Only reset filters that exist
        const locationFilter = document.getElementById('location-filter');
        if (locationFilter) {
            locationFilter.value = 'all';
        }
        
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.value = 'all';
        }
        
        // Clear all active button states
        document.querySelectorAll('.button-group .filter-button').forEach(button => {
            button.classList.remove('active');
        });
        
        const areaSlider = document.getElementById('area-slider');
        const priceSlider = document.getElementById('price-slider');
        
        // Reset sliders if they exist
        if (areaSlider && areaSlider.noUiSlider) {
            areaSlider.noUiSlider.reset();
        }
        
        if (priceSlider && priceSlider.noUiSlider) {
            priceSlider.noUiSlider.reset();
        }
        
        // Reset custom filters if they exist
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnId = column.toLowerCase().replace(/\s+/g, '-');
                const columnType = window.customColumnTypes[column];
                
                if (columnType === 'numeric') {
                    // Reset numeric sliders
                    const slider = document.getElementById(`${columnId}-slider`);
                    if (slider && slider.noUiSlider) {
                        slider.noUiSlider.reset();
                    }
                } else if (columnType === 'text') {
                    // Reset dropdown filters
                    const dropdown = document.getElementById(`${columnId}-filter`);
                    if (dropdown) {
                        dropdown.value = 'all';
                    }
                } else if (window.customColumnSpecialHandling && window.customColumnSpecialHandling[column] === 'buttonGroup') {
                    // Special handling for button group numeric filters is already covered
                    // by the general button reset above, but we note it here for completeness
                }
                // Button groups already handled above with the general button reset
            });
        }
        
        // Remove range-filtered and custom-filtered classes from all cards
        document.querySelectorAll('.property-card').forEach(card => {
            card.classList.remove('range-filtered');
            card.classList.remove('custom-filtered');
           
            card.style.display = ''; // Reset inline display style
        });

        // Reset the mixer
        if (window.mixer) {
            window.mixer.filter('all');
        }
        
        // Clear URL parameters
        history.pushState(null, '', window.location.pathname);
    }
    
    // Function to parse URL parameters and apply filters on page load
    function applyUrlFilters() {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        let filtersApplied = false;
        
        // Check for location filter
        if (urlParams.has('location')) {
            const locationValue = urlParams.get('location');
            const locationFilter = document.getElementById('location-filter');
            if (locationFilter) {
                // Find the option that matches (case insensitive)
                Array.from(locationFilter.options).forEach(option => {
                    if (option.value.toLowerCase() === locationValue.toLowerCase()) {
                        locationFilter.value = option.value;
                        filtersApplied = true;
                    }
                });
            }
        }
        
        // Check for category/status filter
        if (urlParams.has('category') || urlParams.has('status')) {
            const categoryValue = urlParams.get('category') || urlParams.get('status');
            const statusFilter = document.getElementById('status-filter');
            if (statusFilter) {
                // Find the option that matches (case insensitive)
                Array.from(statusFilter.options).forEach(option => {
                    if (option.value.toLowerCase() === categoryValue.toLowerCase()) {
                        statusFilter.value = option.value;
                        filtersApplied = true;
                    }
                });
            }
        }
        
        // Check for bedrooms filter
        if (urlParams.has('bedrooms')) {
            const bedroomsValue = urlParams.get('bedrooms');
            const bedroomsFilter = document.getElementById('bedrooms-filter');
            if (bedroomsFilter) {
                const button = bedroomsFilter.querySelector(`[data-filter="bed-${bedroomsValue}"]`);
                if (button) {
                    button.classList.add('active');
                    filtersApplied = true;
                    
                    // Remove 'active' from 'Any' button
                    const anyButton = bedroomsFilter.querySelector('[data-filter="all"]');
                    if (anyButton) {
                        anyButton.classList.remove('active');
                    }
                }
            }
        }
        
        // Check for bathrooms filter
        if (urlParams.has('bathrooms')) {
            const bathroomsValue = urlParams.get('bathrooms');
            const bathroomsFilter = document.getElementById('bathrooms-filter');
            if (bathroomsFilter) {
                const button = bathroomsFilter.querySelector(`[data-filter="bath-${bathroomsValue}"]`);
                if (button) {
                    button.classList.add('active');
                    filtersApplied = true;
                    
                    // Remove 'active' from 'Any' button
                    const anyButton = bathroomsFilter.querySelector('[data-filter="all"]');
                    if (anyButton) {
                        anyButton.classList.remove('active');
                    }
                }
            }
        }
        
        // Check for price filter
        if (urlParams.has('minprice') || urlParams.has('maxprice')) {
            const priceSlider = document.getElementById('price-slider');
            if (priceSlider && priceSlider.noUiSlider) {
                const currentValues = priceSlider.noUiSlider.get().map(Number);
                let minPrice = urlParams.has('minprice') ? Number(urlParams.get('minprice')) : currentValues[0];
                let maxPrice = urlParams.has('maxprice') ? Number(urlParams.get('maxprice')) : currentValues[1];
                
                // Update the slider with new values
                priceSlider.noUiSlider.set([minPrice, maxPrice]);
                filtersApplied = true;
            }
        }
        
        // Check for area filter
        if (urlParams.has('minarea') || urlParams.has('maxarea')) {
            const areaSlider = document.getElementById('area-slider');
            if (areaSlider && areaSlider.noUiSlider) {
                const currentValues = areaSlider.noUiSlider.get().map(Number);
                let minArea = urlParams.has('minarea') ? Number(urlParams.get('minarea')) : currentValues[0];
                let maxArea = urlParams.has('maxarea') ? Number(urlParams.get('maxarea')) : currentValues[1];
                
                // Update the slider with new values
                areaSlider.noUiSlider.set([minArea, maxArea]);
                filtersApplied = true;
            }
        }
        
        // Check for custom column filters
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnId = column.toLowerCase().replace(/\s+/g, '-');
                const columnType = window.customColumnTypes[column];
                
                if (urlParams.has(columnId)) {
                    // Handle text and boolean filters
                    const value = urlParams.get(columnId);
                    
                    if (columnType === 'boolean') {
                        // For Yes/No filters, select the appropriate button
                        const filterGroup = document.getElementById(`${columnId}-filter`);
                        if (filterGroup) {
                            const button = filterGroup.querySelector(`.filter-button[data-filter="${value.toLowerCase()}"]`);
                            if (button) {
                                button.classList.add('active');
                                filtersApplied = true;
                                
                                // Remove 'active' from 'Any' button
                                const anyButton = filterGroup.querySelector('[data-filter="all"]');
                                if (anyButton) {
                                    anyButton.classList.remove('active');
                                }
                            }
                        }
                    } else if (columnType === 'text') {
                        // For dropdown filters
                        const dropdown = document.getElementById(`${columnId}-filter`);
                        if (dropdown) {
                            const matchingOption = Array.from(dropdown.options).find(
                                option => option.value.toLowerCase() === value.toLowerCase()
                            );
                            if (matchingOption) {
                                dropdown.value = matchingOption.value;
                                filtersApplied = true;
                            }
                        }
                    }
                } else if (columnType === 'numeric') {
                    // Handle numeric filters
                    if (urlParams.has(`min-${columnId}`) || urlParams.has(`max-${columnId}`)) {
                        const slider = document.getElementById(`${columnId}-slider`);
                        if (slider && slider.noUiSlider) {
                            const currentValues = slider.noUiSlider.get().map(Number);
                            let minValue = urlParams.has(`min-${columnId}`) ? 
                                Number(urlParams.get(`min-${columnId}`)) : currentValues[0];
                            let maxValue = urlParams.has(`max-${columnId}`) ? 
                                Number(urlParams.get(`max-${columnId}`)) : currentValues[1];
                            
                            // Update the slider with new values
                            slider.noUiSlider.set([minValue, maxValue]);
                            filtersApplied = true;
                        }
                    }
                }
            });
        }
        
        // Apply filters if any parameters were found
        if (filtersApplied && window.mixer) {
            console.log('🔍 Applying filters from URL parameters');
            updateFilters();
        }
    }
    
    // Function to update URL with current filter state
    function updateUrlWithFilters() {
        // Create a new URLSearchParams object
        const params = new URLSearchParams();
        
        // Get current filter values
        const locationFilter = document.getElementById('location-filter');
        if (locationFilter && locationFilter.value !== 'all') {
            params.set('location', locationFilter.value);
        }
        
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter && statusFilter.value !== 'all') {
            params.set('category', statusFilter.value);
        }
        
        // Get bedrooms filter
        const bedroomsButtons = document.querySelectorAll('#bedrooms-filter .filter-button.active');
        if (bedroomsButtons.length === 1 && !bedroomsButtons[0].getAttribute('data-filter').includes('all')) {
            const bedroomsValue = bedroomsButtons[0].getAttribute('data-filter').replace('bed-', '');
            params.set('bedrooms', bedroomsValue);
        }
        
        // Get bathrooms filter
        const bathroomsButtons = document.querySelectorAll('#bathrooms-filter .filter-button.active');
        if (bathroomsButtons.length === 1 && !bathroomsButtons[0].getAttribute('data-filter').includes('all')) {
            const bathroomsValue = bathroomsButtons[0].getAttribute('data-filter').replace('bath-', '');
            params.set('bathrooms', bathroomsValue);
        }
        
        // Get price range
        const priceSlider = document.getElementById('price-slider');
        if (priceSlider && priceSlider.noUiSlider) {
            const [minPrice, maxPrice] = priceSlider.noUiSlider.get().map(Number);
            
            // Get all property cards with price data
            const priceValues = Array.from(document.querySelectorAll('.property-card[data-price]'))
                .map(card => parseFloat(card.getAttribute('data-price')))
                .filter(Boolean);
            
            if (priceValues.length > 0) {
                const priceMin = Math.min(...priceValues);
                const priceMax = Math.max(...priceValues);
                
                // Only add if the values are different from min/max
                if (minPrice > priceMin) {
                    params.set('minprice', minPrice);
                }
                if (maxPrice < priceMax) {
                    params.set('maxprice', maxPrice);
                }
            }
        }
        
        // Get area range
        const areaSlider = document.getElementById('area-slider');
        if (areaSlider && areaSlider.noUiSlider) {
            const [minArea, maxArea] = areaSlider.noUiSlider.get().map(Number);
            
            // Get all property cards with area data
            const areaValues = Array.from(document.querySelectorAll('.property-card[data-area]'))
                .map(card => parseFloat(card.getAttribute('data-area')))
                .filter(Boolean);
            
            if (areaValues.length > 0) {
                const areaMin = Math.min(...areaValues);
                const areaMax = Math.max(...areaValues);
                
                // Only add if the values are different from min/max
                if (minArea > areaMin) {
                    params.set('minarea', minArea);
                }
                if (maxArea < areaMax) {
                    params.set('maxarea', maxArea);
                }
            }
        }
        
        // Add URL parameters for custom columns
        if (window.customColumns && window.customColumns.length > 0) {
            window.customColumns.forEach(column => {
                const columnId = column.toLowerCase().replace(/\s+/g, '-');
                const columnType = window.customColumnTypes[column];
                
                if (columnType === 'boolean') {
                    // Add Yes/No filter parameter
                    const activeButtons = document.querySelectorAll(`#${columnId}-filter .filter-button.active`);
                    if (activeButtons.length === 1) {
                        const value = activeButtons[0].textContent.toLowerCase();
                        if (value !== 'any') {
                            params.set(columnId, value);
                        }
                    }
                } else if (columnType === 'text') {
                    // Add text filter parameter
                    const dropdown = document.getElementById(`${columnId}-filter`);
                    if (dropdown && dropdown.value !== 'all') {
                        params.set(columnId, dropdown.value);
                    }
                } else if (columnType === 'numeric') {
                    // Add numeric filter parameters
                    const slider = document.getElementById(`${columnId}-slider`);
                    if (slider && slider.noUiSlider) {
                        const [minValue, maxValue] = slider.noUiSlider.get().map(Number);
                        
                        // Get all values for this custom attribute
                        const dataAttr = `data-${columnId}`;
                        const values = Array.from(document.querySelectorAll(`.property-card[${dataAttr}]`))
                            .map(card => parseFloat(card.getAttribute(dataAttr)))
                            .filter(Boolean);
                            
                        if (values.length > 0) {
                            const min = Math.min(...values);
                            const max = Math.max(...values);
                            
                            // Only add if the values are different from min/max
                            if (minValue > min) {
                                params.set(`min-${columnId}`, minValue);
                            }
                            if (maxValue < max) {
                                params.set(`max-${columnId}`, maxValue);
                            }
                        }
                    }
                }
            });
        }
        
        // Update URL without reloading the page
        const newUrl = params.toString() ? 
            `${window.location.pathname}?${params.toString()}` : 
            window.location.pathname;
        
        history.pushState(null, '', newUrl);
    }
    
    function addPropertyListingsClass() {
        document.body.classList.add('property-listings');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addPropertyListingsClass);
    } else {
        addPropertyListingsClass();
    }

    document.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('propertyListingsContainer');
        if (!container) {
            console.error('Property listings container not found');
        }
    });

    // Add MixItUp library
    if (!window.mixitup && !document.querySelector('script[src*="mixitup"]')) {
        const mixitupScript = document.createElement('script');
        mixitupScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/mixitup/3.3.1/mixitup.min.js';
        document.head.appendChild(mixitupScript);
    }

})();