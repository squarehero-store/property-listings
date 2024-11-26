// ================================================
//   ⚡ Property Listings plugin by SquareHero.store
// ================================================
(function () {
    // Check if the plugin is enabled
    const metaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
    if (!metaTag || metaTag.getAttribute('enabled') !== 'true') return;

    const sheetUrl = metaTag.getAttribute('sheet-url');
    const target = metaTag.getAttribute('target');
    const blogJsonUrl = `/${target}?format=json&nocache=${new Date().getTime()}`;

    console.log('🏗️ SquareHero Plugin Initializing...', {
        sheetUrl,
        target,
        blogJsonUrl
    });

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

    Promise.all(libraries.map(url => loadLibrary(url)))
        .then(() => {
            console.log('📚 Libraries loaded successfully');
            // Fetch data from Google Sheets and Blog JSON
            Promise.all([
                fetch(sheetUrl).then(response => response.text()),
                fetch(blogJsonUrl).then(response => response.json())
            ]).then(([csvData, blogData]) => {
                console.log('📊 Blog JSON Data received:', blogData);
                const storeSettings = blogData.websiteSettings?.storeSettings || {};
                console.log('⚙️ Store Settings:', storeSettings);
                
                const isMetric = storeSettings.measurementStandard === 2;
                const currencySymbol = getCurrencySymbol(storeSettings.selectedCurrency);
                const areaUnit = getAreaUnit(isMetric);
                
                console.log('🔧 Display Settings:', {
                    measurementStandard: storeSettings.measurementStandard,
                    isMetric,
                    selectedCurrency: storeSettings.selectedCurrency,
                    currencySymbol,
                    areaUnit
                });

                // Store settings globally for other functions to access
                window.storeSettings = storeSettings;

                const sheetData = parseCSV(csvData);
                console.log('📑 Sheet Data:', sheetData);
                
                const propertyData = processPropertyData(sheetData, blogData);
                console.log('🏠 Processed Property Data:', propertyData);

                createFilterElements();
                renderPropertyListings(propertyData);
                console.log('🚀 SquareHero.store Property Listings plugin loaded');
            }).catch(error => console.error('❌ Error fetching data:', error));
        })
        .catch(error => console.error('❌ Error loading libraries:', error));
        function processPropertyData(sheetData, blogData) {
        const urlMap = new Map(sheetData.map(row => {
            const url = row.Url.trim().toLowerCase();
            const regexPattern = new RegExp('^' + url.replace(/\*/g, '.*') + '$');
            return [regexPattern, row];
        }));
    
        return blogData.items.map(item => {
            const urlId = item.urlId.toLowerCase();
            const sheetRow = Array.from(urlMap.entries()).find(([regexPattern, value]) => regexPattern.test(urlId));
    
            return {
                id: item.id,
                title: item.title,
                location: item.tags && item.tags.length > 0 ? item.tags[0] : '',
                imageUrl: item.assetUrl,
                category: item.categories && item.categories.length > 0 ? item.categories[0] : '',
                price: sheetRow ? parseFloat(sheetRow[1].Price.replace(/[$,]/g, '')) : 0,
                area: sheetRow ? parseInt(sheetRow[1].Area, 10) : 0,
                bedrooms: sheetRow ? parseInt(sheetRow[1].Bedrooms, 10) : 0,
                bathrooms: sheetRow ? parseFloat(sheetRow[1].Bathrooms) : 0,
                garage: sheetRow ? sheetRow[1].Garage : '',
                url: item.fullUrl
            };
        });
    }

    function createFilterElements() {
        const container = document.getElementById('propertyListingsContainer');
        if (!container) {
            console.error('Property listings container not found');
            return;
        }

        const filtersContainer = document.createElement('div');
        filtersContainer.className = 'filters-container';

        filtersContainer.appendChild(createDropdownFilter('location-filter', 'Location', 'Any Location'));
        filtersContainer.appendChild(createDropdownFilter('status-filter', 'Property Status', 'All'));
        filtersContainer.appendChild(createButtonGroupFilter('bedrooms-filter', 'Bedrooms', ['Any', '1', '2', '3', '4', '5', '6', '7', '8']));
        filtersContainer.appendChild(createButtonGroupFilter('bathrooms-filter', 'Bathrooms', ['Any', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6']));
        filtersContainer.appendChild(createSliderFilter('area-slider', 'Area'));
        filtersContainer.appendChild(createSliderFilter('price-slider', 'Price'));

        const resetButton = document.createElement('button');
        resetButton.id = 'reset-filters';
        resetButton.className = 'reset-button sh-button';
        resetButton.textContent = 'Reset Filters';
        resetButton.addEventListener('click', resetFilters);
        filtersContainer.appendChild(resetButton);

        container.appendChild(filtersContainer);

        const gridContainer = document.createElement('div');
        gridContainer.id = 'property-grid';
        gridContainer.className = 'property-grid';
        container.appendChild(gridContainer);
    }

    function createDropdownFilter(id, label, defaultOption) {
        const group = document.createElement('div');
        group.className = 'filter-group';

        const labelElement = document.createElement('label');
        labelElement.htmlFor = id;
        labelElement.textContent = label;

        const select = document.createElement('select');
        select.id = id;
        select.className = 'dropdown-filter';

        const option = document.createElement('option');
        option.value = 'all';
        option.textContent = defaultOption;
        select.appendChild(option);

        group.appendChild(labelElement);
        group.appendChild(select);

        return group;
    }

    function createButtonGroupFilter(id, label, options) {
        const group = document.createElement('div');
        group.className = 'filter-group';

        const labelElement = document.createElement('label');
        labelElement.textContent = label;

        const buttonGroup = document.createElement('div');
        buttonGroup.id = id;
        buttonGroup.className = 'button-group';

        options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'filter-button';
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

    function createSliderFilter(id, label) {
        const group = document.createElement('div');
        group.className = 'filter-group';

        const labelContainer = document.createElement('div');
        labelContainer.className = 'slider-label-container';

        const labelElement = document.createElement('label');
        labelElement.textContent = label; // No longer checking for 'Sq. Ft.'

        const rangeDisplay = document.createElement('span');
        rangeDisplay.className = 'range-display';
        rangeDisplay.id = `${id}-range`;

        labelContainer.appendChild(labelElement);
        labelContainer.appendChild(rangeDisplay);

        const slider = document.createElement('div');
        slider.id = id;
        slider.className = 'range-slider';

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
        card.className = 'property-card mix';
        card.href = property.url;
        card.setAttribute('data-location', property.location);
        card.setAttribute('data-category', property.category);
        card.setAttribute('data-bedrooms', `bed-${property.bedrooms}`);
        card.setAttribute('data-bathrooms', `bath-${formatBathroomsForFilter(property.bathrooms)}`);
        card.setAttribute('data-area', property.area);
        card.setAttribute('data-price', property.price);

        let cardContent = `
            <div class="property-image">
                <img src="${property.imageUrl}" alt="${property.title}">
                ${property.category ? `<span class="property-category">${property.category}</span>` : ''}
            </div>
            <div class="listing-content">
                <h3 class="property-title">${property.title}</h3>
                ${property.location ? `<p class="property-location">${property.location}</p>` : ''}
                <p class="property-price ${property.price === 0 ? 'no-price' : ''}">${property.price === 0 ? 'Price TBA' : `${currencySymbol}${property.price.toLocaleString()}`}</p>
                <div class="property-details">
                    ${property.area ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Size.svg" alt="Area"> ${property.area.toLocaleString()} ${areaUnit}</span>` : ''}
                    ${property.bedrooms ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Bedroom.svg" alt="Bedrooms"> ${property.bedrooms}</span>` : ''}
                    ${property.bathrooms ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Bathroom.svg" alt="Bathrooms"> ${formatBathrooms(property.bathrooms)}</span>` : ''}
                    ${property.garage ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Garage.svg" alt="Garage"> ${property.garage}</span>` : ''}
                </div>
                <span class="sh-button">View Home</span>
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
        const locations = new Set(properties.map(p => p.location).filter(Boolean));
        const categories = new Set(properties.map(p => p.category).filter(Boolean));
        const minArea = Math.min(...properties.map(p => p.area));
        const maxArea = Math.max(...properties.map(p => p.area));
        const minPrice = Math.min(...properties.map(p => p.price));
        const maxPrice = Math.max(...properties.map(p => p.price));

        populateDropdown('location-filter', locations);
        populateDropdown('status-filter', categories);

        initializeSlider('area-slider', minArea, maxArea, window.storeSettings?.measurementStandard === 2 ? 'm²' : 'sq ft', () => {
            if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
        });
        
        const currencySymbol = getCurrencySymbol(window.storeSettings?.selectedCurrency);
        initializeSlider('price-slider', minPrice, maxPrice, currencySymbol, () => {
            if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
        });

        hideUnusedOptions('bedrooms-filter', properties, 'bedrooms');
        hideUnusedOptions('bathrooms-filter', properties, 'bathrooms');
    }

    function populateDropdown(id, options) {
        const dropdown = document.getElementById(id);
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            dropdown.appendChild(optionElement);
        });
    }

    function initializeSlider(id, min, max, unit, callback) {
        const slider = document.getElementById(id);
        const rangeDisplay = document.getElementById(`${id}-range`);

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
        const availableValues = new Set(properties.map(p => p[propertyKey]).filter(Boolean));

        filterButtons.forEach(button => {
            const filterValue = button.getAttribute('data-filter');
            if (filterValue === 'all') return;

            const numericValue = parseFloat(filterValue.split('-')[1]);
            button.style.display = availableValues.has(numericValue) ? '' : 'none';
        });
    }

    function initializeMixItUp() {
        const container = document.getElementById('property-grid');

        const noResultsMessage = document.createElement('div');
        noResultsMessage.id = 'no-results-message';
        noResultsMessage.className = 'no-results-message';
        noResultsMessage.style.display = 'none';
        noResultsMessage.innerHTML = `
            <h3>No properties found</h3>
            <p>We couldn't find any properties matching your current filter criteria. 
            Please try adjusting your filters or <a href="#" id="reset-filters-link">reset all filters</a> to see all available properties.</p>
        `;
        container.parentNode.insertBefore(noResultsMessage, container.nextSibling);

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

            // Get current slider values
            const [minArea, maxArea] = areaSlider.noUiSlider.get().map(Number);
            const [minPrice, maxPrice] = priceSlider.noUiSlider.get().map(Number);

            cards.forEach(card => {
                // Get the raw numeric values
                const cardArea = parseFloat(card.getAttribute('data-area'));
                const cardPrice = parseFloat(card.getAttribute('data-price'));

                // Check if the card matches all range criteria
                const areaMatch = cardArea >= minArea && cardArea <= maxArea;
                const priceMatch = cardPrice >= minPrice && cardPrice <= maxPrice;

                // Only hide/show if the card is part of the current filter state
                if (state.matching.includes(card)) {
                    if (areaMatch && priceMatch) {
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

        [areaSlider, priceSlider].forEach(slider => {
            slider.noUiSlider.on('update', () => {
                if (window.mixer) {
                    window.mixer.filter(window.mixer.getState().activeFilter);
                }
            });
        });

        document.getElementById('reset-filters-link').addEventListener('click', resetFilters);

        const locationFilter = document.getElementById('location-filter');
        const statusFilter = document.getElementById('status-filter');

        locationFilter.addEventListener('change', updateFilters);
        statusFilter.addEventListener('change', updateFilters);

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

        window.mixer.filter('all');
    }

    function updateFilters() {
        const locationFilter = document.getElementById('location-filter');
        const statusFilter = document.getElementById('status-filter');
        
        const location = locationFilter.value;
        const status = statusFilter.value;
        const bedrooms = getActiveFilters('bedrooms-filter');
        const bathrooms = getActiveFilters('bathrooms-filter');

        let filterArray = [];

        if (location !== 'all') {
            filterArray.push(`[data-location="${location}"]`);
        }
        if (status !== 'all') {
            filterArray.push(`[data-category="${status}"]`);
        }
        if (bedrooms.length > 0 && !bedrooms.includes('all')) {
            filterArray.push(bedrooms.map(bed => `[data-bedrooms="${bed}"]`).join(', '));
        }
        if (bathrooms.length > 0 && !bathrooms.includes('all')) {
            filterArray.push(bathrooms.map(bath => `[data-bathrooms="${bath}"]`).join(', '));
        }

        let filterString = filterArray.length > 0 ? filterArray.join('') : 'all';

        // Clear any existing range filters before applying new filters
        document.querySelectorAll('.property-card').forEach(card => {
            card.classList.remove('range-filtered');
        });
        
        if (window.mixer) {
            window.mixer.filter(filterString);
        }
    }

    function getActiveFilters(groupId) {
        const activeButtons = Array.from(document.querySelectorAll(`#${groupId} .filter-button.active`));
        if (activeButtons.length === 0) {
            return ['all'];
        }
        return activeButtons.map(button => button.getAttribute('data-filter'));
    }

       function resetFilters() {
        const locationFilter = document.getElementById('location-filter');
        const statusFilter = document.getElementById('status-filter');
        locationFilter.value = 'all';
        statusFilter.value = 'all';
        
        document.querySelectorAll('.button-group .filter-button').forEach(button => {
            button.classList.remove('active');
        });
        
        const areaSlider = document.getElementById('area-slider');
        const priceSlider = document.getElementById('price-slider');
        
        // Reset sliders
        if (areaSlider.noUiSlider) {
            areaSlider.noUiSlider.reset();
        }
        if (priceSlider.noUiSlider) {
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
    }

    document.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('propertyListingsContainer');
        if (!container) {
            console.error('Property listings container not found');
        }
    });

})();