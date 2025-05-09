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
    
    // Development logging
    console.log('📌 SquareHero.store Real Estate Listings plugin configuration:');
    console.log('- Sheet URL:', sheetUrl);
    console.log('- Target:', target);
    console.log('- Category Label:', categoryLabel);
    console.log('- Tag Label:', tagLabel);
    console.log('- Button Text:', buttonText);

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
    
        return blogItems.map(item => {
            const urlId = item.urlId.toLowerCase();
            const sheetRow = Array.from(urlMap.entries()).find(([regexPattern, value]) => regexPattern.test(urlId));
    
            // Clean and trim the excerpt if available
            let cleanExcerpt = '';
            if (item.excerpt) {
                // Remove any HTML tags and trim whitespace
                cleanExcerpt = item.excerpt.replace(/<\/?[^>]+(>|$)/g, '').trim();
            }
            
            return {
                id: item.id,
                title: item.title,
                location: item.tags && item.tags.length > 0 ? item.tags[0] : '',
                imageUrl: item.assetUrl,
                category: item.categories && item.categories.length > 0 ? item.categories[0] : '',
                excerpt: cleanExcerpt, // Added excerpt with HTML cleaning
                price: sheetRow && sheetRow[1].Price ? parseFloat(sheetRow[1].Price.replace(/[$,]/g, '')) : 0,
                area: sheetRow && sheetRow[1].Area ? parseInt(sheetRow[1].Area, 10) : 0,
                bedrooms: sheetRow && sheetRow[1].Bedrooms ? parseInt(sheetRow[1].Bedrooms, 10) : 0,
                bathrooms: sheetRow && sheetRow[1].Bathrooms ? parseFloat(sheetRow[1].Bathrooms) : 0,
                garage: sheetRow && sheetRow[1].Garage ? sheetRow[1].Garage : '',
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
                    <p>Loading all properties...</p>
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
    
        return blogData.items.map(item => {
            const urlId = item.urlId.toLowerCase();
            const sheetRow = Array.from(urlMap.entries()).find(([regexPattern, value]) => regexPattern.test(urlId));
    
            // Clean and trim the excerpt if available
            let cleanExcerpt = '';
            if (item.excerpt) {
                // Remove any HTML tags and trim whitespace
                cleanExcerpt = item.excerpt.replace(/<\/?[^>]+(>|$)/g, '').trim();
            }
            
            return {
                id: item.id,
                title: item.title,
                location: item.tags && item.tags.length > 0 ? item.tags[0] : '',
                imageUrl: item.assetUrl,
                category: item.categories && item.categories.length > 0 ? item.categories[0] : '',
                excerpt: cleanExcerpt, // Added excerpt with HTML cleaning
                price: sheetRow && sheetRow[1].Price ? parseFloat(sheetRow[1].Price.replace(/[$,]/g, '')) : 0,
                area: sheetRow && sheetRow[1].Area ? parseInt(sheetRow[1].Area, 10) : 0,
                bedrooms: sheetRow && sheetRow[1].Bedrooms ? parseInt(sheetRow[1].Bedrooms, 10) : 0,
                bathrooms: sheetRow && sheetRow[1].Bathrooms ? parseFloat(sheetRow[1].Bathrooms) : 0,
                garage: sheetRow && sheetRow[1].Garage ? sheetRow[1].Garage : '',
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

        const filtersContainer = document.createElement('div');
        filtersContainer.className = 'filters-container sh-filters-container';

        // Check which attributes are available in the data
        const hasLocations = propertyData.some(p => p.location);
        const hasCategories = propertyData.some(p => p.category);
        const hasBedrooms = propertyData.some(p => p.bedrooms > 0);
        const hasBathrooms = propertyData.some(p => p.bathrooms > 0);
        const hasAreas = propertyData.some(p => p.area > 0);
        const hasPrices = propertyData.some(p => p.price > 0);

        // Only add filters for attributes that exist in the data
        if (hasLocations) {
            filtersContainer.appendChild(createDropdownFilter('location-filter', tagLabel, 'Any Location', 'sh-location-filter'));
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
        
        if (hasPrices) {
            filtersContainer.appendChild(createSliderFilter('price-slider', 'Price', 'sh-price-filter'));
        }

        // Only add reset button if we have at least one filter
        if (hasLocations || hasCategories || hasBedrooms || hasBathrooms || hasAreas || hasPrices) {
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
        buttonGroup.className = `button-group ${customClass}-buttons`;

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

        return group;
    }
    
    function createPropertyCard(property) {
        const storeSettings = window.storeSettings || {};
        const isMetric = storeSettings.measurementStandard === 2;
        const currencySymbol = getCurrencySymbol(storeSettings.selectedCurrency);
        const areaUnit = getAreaUnit(isMetric);

        const card = document.createElement('a');
        card.className = 'property-card mix sh-property-card';
        card.href = property.url;
        
        // Only set data attributes for properties that exist
        if (property.location) {
            card.setAttribute('data-location', property.location);
        }
        
        if (property.category) {
            card.setAttribute('data-category', property.category);
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
        
        if (property.price > 0) {
            card.setAttribute('data-price', property.price);
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
                ${property.category ? `<span class="property-category sh-property-category">${property.category}</span>` : ''}
            </div>
            <div class="listing-content sh-listing-content">
                <h3 class="property-title sh-property-title">${property.title}</h3>
                ${property.location ? `<p class="property-location sh-property-location">${property.location}</p>` : ''}
                <p class="property-price sh-property-price ${property.price === 0 ? 'no-price' : ''}">${property.price === 0 ? 'Price TBA' : `${currencySymbol}${property.price.toLocaleString()}`}</p>
                <div class="property-details sh-property-details">
                    ${property.area > 0 ? `<span class="details-icon sh-area-icon">${areaSvg} <span class="sh-area-value">${property.area.toLocaleString()} ${areaUnit}</span></span>` : ''}
                    ${property.bedrooms > 0 ? `<span class="details-icon sh-beds-icon">${bedsSvg} <span class="sh-beds-value">${property.bedrooms}</span></span>` : ''}
                    ${property.bathrooms > 0 ? `<span class="details-icon sh-baths-icon">${bathsSvg} <span class="sh-baths-value">${formatBathrooms(property.bathrooms)}</span></span>` : ''}
                    ${property.garage ? `<span class="details-icon sh-garage-icon">${garageSvg} <span class="sh-garage-value">${property.garage}</span></span>` : ''}
                </div>
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
        initializeMixItUp();
    }

    function initializeFilters(properties) {
        // Get unique values for dropdown filters
        const locations = new Set(properties.map(p => p.location).filter(Boolean));
        const categories = new Set(properties.map(p => p.category).filter(Boolean));
        
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
        const slider = document.getElementById(id);
        if (!slider) return;
        
        const rangeDisplay = document.getElementById(`${id}-range`);
        if (!rangeDisplay) return;

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
    
    function initializeMixItUp() {
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
        `;
        document.head.appendChild(excerptStyle);

        const container = document.getElementById('property-grid');
        if (!container) return;

        const noResultsMessage = document.createElement('div');
        noResultsMessage.id = 'no-results-message';
        noResultsMessage.className = 'no-results-message sh-no-results';
        noResultsMessage.style.display = 'none';
        noResultsMessage.innerHTML = `
            <h3 class="sh-no-results-title">No properties found</h3>
            <p class="sh-no-results-text">We couldn't find any properties matching your current filter criteria. 
            Please try adjusting your filters or <a href="#" id="reset-filters-link" class="sh-reset-link">reset all filters</a> to see all available properties.</p>
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
    
                // Only apply range filtering if sliders exist
                if (!areaSlider && !priceSlider) return true;
    
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
                    
                    // Apply price filter if slider exists
                    if (priceSlider && priceSlider.noUiSlider) {
                        const [minPrice, maxPrice] = priceSlider.noUiSlider.get().map(Number);
                        const cardPrice = parseFloat(card.getAttribute('data-price') || 0);
                        
                        // Skip price filtering if card doesn't have price data
                        if (card.hasAttribute('data-price')) {
                            shouldShow = shouldShow && (cardPrice >= minPrice && cardPrice <= maxPrice);
                        }
                    }
    
                    // Only hide/show if the card is part of the current filter state
                    if (state.matching.includes(card)) {
                        if (shouldShow) {
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
                    style.textContent = '.range-filtered { display: none !important; }';
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
            
            // Add reset filters link event listener
            const resetLink = document.getElementById('reset-filters-link');
            if (resetLink) {
                resetLink.addEventListener('click', resetFilters);
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
    
            document.querySelectorAll('.button-group').forEach(group => {
                group.addEventListener('click', (e) => {
                    if (e.target.classList.contains('filter-button')) {
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
        
        let filterArray = [];

        // Only apply filters that exist
        if (locationFilter) {
            const location = locationFilter.value;
            if (location !== 'all') {
                filterArray.push(`[data-location="${location}"]`);
            }
        }
        
        if (statusFilter) {
            const status = statusFilter.value;
            if (status !== 'all') {
                filterArray.push(`[data-category="${status}"]`);
            }
        }
        
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
        
        // Remove range-filtered class from all cards
        document.querySelectorAll('.property-card').forEach(card => {
            card.classList.remove('range-filtered');
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