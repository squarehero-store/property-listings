// Property Listings Script
    (function () {
        // Check if the plugin is enabled
        const metaTag = document.querySelector('meta[squarehero-plugin="property-listings"]');
        if (!metaTag || metaTag.getAttribute('enabled') !== 'true') return;

        const sheetUrl = metaTag.getAttribute('sheet-url');
        const target = metaTag.getAttribute('target');
        const blogJsonUrl = `/${target}?format=json&nocache=${new Date().getTime()}`;

        console.log('Sheet URL:', sheetUrl);
        console.log('Blog JSON URL:', blogJsonUrl);

        // Load required libraries
        const libraries = [
            'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
            'https://cdn.jsdelivr.net/npm/nouislider@14.6.3/distribute/nouislider.min.js',
            'https://cdn.jsdelivr.net/npm/nouislider@14.6.3/distribute/nouislider.min.css'
        ];

        Promise.all(libraries.map(url => loadLibrary(url)))
            .then(() => {
                // Fetch data from Google Sheets and Blog JSON
                Promise.all([
                    fetch(sheetUrl).then(response => response.text()),
                    fetch(blogJsonUrl).then(response => response.json())
                ]).then(([csvData, blogData]) => {
                    console.log('CSV data fetched:', csvData.substring(0, 200) + '...');
                    console.log('Blog data fetched:', JSON.stringify(blogData).substring(0, 200) + '...');

                    const sheetData = parseCSV(csvData);
                    console.log('Parsed sheet data:', sheetData);

                    const propertyData = processPropertyData(sheetData, blogData);
                    console.log('Processed property data:', propertyData);

                    createFilterElements();
                    renderPropertyListings(propertyData);
                }).catch(error => console.error('Error fetching data:', error));
            })
            .catch(error => console.error('Error loading libraries:', error));

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
            console.log('Papaparse results:', results);
            return results.data;
        }

        function processPropertyData(sheetData, blogData) {
            const urlMap = new Map(sheetData.map(row => [row.Url.replace(/^\//, ''), row]));
            return blogData.items.map(item => {
                const sheetRow = urlMap.get(item.urlId);
                return {
                    id: item.id,
                    title: item.title,
                    location: item.tags && item.tags.length > 0 ? item.tags[0] : '',
                    imageUrl: item.assetUrl,
                    category: item.categories && item.categories.length > 0 ? item.categories[0] : '',
                    price: sheetRow && sheetRow.Price ? parseFloat(sheetRow.Price.replace(/[$,]/g, '')) : 0,
                    area: sheetRow && sheetRow.Area ? parseInt(sheetRow.Area, 10) : 0,
                    bedrooms: sheetRow && sheetRow.Bedrooms ? parseInt(sheetRow.Bedrooms, 10) : 0,
                    bathrooms: sheetRow && sheetRow.Bathrooms ? parseFloat(sheetRow.Bathrooms) : 0,
                    garage: sheetRow && sheetRow.Garage ? sheetRow.Garage : '',
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

            // Location filter
            filtersContainer.appendChild(createDropdownFilter('location-filter', 'Location', 'Any Location'));

            // Property Status filter
            filtersContainer.appendChild(createDropdownFilter('status-filter', 'Property Status', 'All'));

            // Bedrooms filter
            filtersContainer.appendChild(createButtonGroupFilter('bedrooms-filter', 'Bedrooms', ['Any', '1', '2', '3', '4', '5', '6', '7', '8']));

            // Bathrooms filter
            filtersContainer.appendChild(createButtonGroupFilter('bathrooms-filter', 'Bathrooms', ['Any', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6']));

            // Area filter
            filtersContainer.appendChild(createSliderFilter('area-slider', 'Sq. Ft.'));

            // Price filter
            filtersContainer.appendChild(createSliderFilter('price-slider', 'Price'));

            container.appendChild(filtersContainer);

            // Create grid container
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
            labelElement.textContent = label;

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
            const card = document.createElement('div');
            card.className = 'property-card mix';
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
        <p class="property-price ${property.price === 0 ? 'no-price' : ''}">${property.price === 0 ? 'Price TBA' : '$' + property.price.toLocaleString()}</p>
        <div class="property-details">
            ${property.area ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Size.svg" alt="Area"> ${property.area} sq ft</span>` : ''}
            ${property.bedrooms ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Bedroom.svg" alt="Bedrooms"> ${property.bedrooms}</span>` : ''}
            ${property.bathrooms ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Bathroom.svg" alt="Bathrooms"> ${formatBathrooms(property.bathrooms)}</span>` : ''}
            ${property.garage ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Garage.svg" alt="Garage"> ${property.garage}</span>` : ''}
        </div>
        <a href="${property.url}" class="sh-button">View Home</a>
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

            console.log('Property listings rendered');
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

            initializeSlider('area-slider', minArea, maxArea, 'sq ft', () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });
            initializeSlider('price-slider', minPrice, maxPrice, '$', () => {
                if (window.mixer) window.mixer.filter(window.mixer.getState().activeFilter);
            });

            // Hide unused bedroom and bathroom options
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
                const formattedMin = unit === '$' ?
                    `$${parseInt(values[0]).toLocaleString()}` :
                    `${parseInt(values[0]).toLocaleString()} ${unit}`;
                const formattedMax = unit === '$' ?
                    `$${parseInt(values[1]).toLocaleString()}` :
                    `${parseInt(values[1]).toLocaleString()} ${unit}`;
                rangeDisplay.textContent = `${formattedMin} - ${formattedMax}`;
            }

            slider.noUiSlider.on('update', (values) => {
                updateRangeDisplay(values);
                if (callback) callback(values);
            });

            // Initial update
            updateRangeDisplay([min, max]);
        }

        function hideUnusedOptions(filterId, properties, propertyKey) {
            const filterButtons = document.querySelectorAll(`#${filterId} .filter-button`);
            const availableValues = new Set(properties.map(p => p[propertyKey]).filter(Boolean));

            filterButtons.forEach(button => {
                const filterValue = button.getAttribute('data-filter');
                if (filterValue === 'all') return; // Always keep the 'Any' option

                const numericValue = parseFloat(filterValue.split('-')[1]);
                button.style.display = availableValues.has(numericValue) ? '' : 'none';
            });
        }

        function initializeMixItUp() {
            const container = document.getElementById('property-grid');
            window.mixer = mixitup(container, {
                selectors: {
                    target: '.property-card'
                },
                load: {
                    filter: 'all'
                },
                callbacks: {
                    onMixStart: function (state, futureState) {
                        let total = futureState.totalShow;
                        console.log(`Showing ${total} properties`);
                    }
                }
            });

            // Set up event listeners for dropdowns
            const locationFilter = document.getElementById('location-filter');
            const statusFilter = document.getElementById('status-filter');

            locationFilter.addEventListener('change', updateFilters);
            statusFilter.addEventListener('change', updateFilters);

            // Set up event listeners for button groups
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

            function updateFilters() {
                const location = locationFilter.value;
                const status = statusFilter.value;
                const bedrooms = getActiveFilters('bedrooms-filter');
                const bathrooms = getActiveFilters('bathrooms-filter');

                console.log('Active filters:', { location, status, bedrooms, bathrooms });

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

                console.log('Applying filter:', filterString);
                window.mixer.filter(filterString);
            }

            function getActiveFilters(groupId) {
                const activeButtons = Array.from(document.querySelectorAll(`#${groupId} .filter-button.active`));
                if (activeButtons.length === 0) {
                    return ['all'];
                }
                const filters = activeButtons.map(button => button.getAttribute('data-filter'));
                console.log(`Active filters for ${groupId}:`, filters);
                return filters;
            }

            function filterTestResult(testResult, target) {
                if (!testResult) return false;

                const areaSlider = document.getElementById('area-slider');
                const priceSlider = document.getElementById('price-slider');

                const [minArea, maxArea] = areaSlider.noUiSlider.get().map(Number);
                const [minPrice, maxPrice] = priceSlider.noUiSlider.get().map(Number);

                const area = Number(target.dom.el.getAttribute('data-area'));
                const price = Number(target.dom.el.getAttribute('data-price'));

                return (area >= minArea && area <= maxArea) && (price >= minPrice && price <= maxPrice);
            }

            mixitup.Mixer.registerFilter('testResultEvaluateHideShow', 'sliderFilter', filterTestResult);

            window.mixer.filter('all');
        }

        // Add a reset function
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
            if (areaSlider.noUiSlider) {
                areaSlider.noUiSlider.reset();
            }
            if (priceSlider.noUiSlider) {
                priceSlider.noUiSlider.reset();
            }
            if (window.mixer) {
                window.mixer.filter('all');
            }
        }

        // Add a reset button event listener if you have one
        const resetButton = document.getElementById('reset-filters');
        if (resetButton) {
            resetButton.addEventListener('click', resetFilters);
        }

        // Call the function when the DOM is fully loaded
        document.addEventListener('DOMContentLoaded', () => {
            const container = document.getElementById('propertyListingsContainer');
            if (container) {
                // The rest of your initialization code will be called from within the 
                // Promise.all() chain in the main part of the script
            } else {
                console.error('Property listings container not found');
            }
        });

    })();