// ===================================================
//   ⚡ Featured Listings plugin by SquareHero.store
// ===================================================
(function () {
    // Check if the plugin is enabled
    const metaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
    if (!metaTag || metaTag.getAttribute('enabled') !== 'true') return;

    const sheetUrl = metaTag.getAttribute('sheet-url');
    const target = metaTag.getAttribute('target');
    const blogJsonUrl = `/${target}?format=json&nocache=${new Date().getTime()}`;
    
    // Custom button text
    const buttonText = metaTag.getAttribute('button-text') || 'View Home';
    
    // Development logging
    console.log('📌 SquareHero.store Featured Listings plugin configuration:');
    console.log('- Sheet URL:', sheetUrl);
    console.log('- Target:', target);
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
        'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js'
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
            // Fetch data from Google Sheets and Blog JSON
            Promise.all([
                fetch(sheetUrl).then(response => response.text()),
                fetch(blogJsonUrl).then(response => response.json())
            ]).then(([csvData, blogData]) => {
                const storeSettings = blogData.websiteSettings?.storeSettings || {};
                
                const isMetric = storeSettings.measurementStandard === 2;
                const currencySymbol = getCurrencySymbol(storeSettings.selectedCurrency);
                const areaUnit = getAreaUnit(isMetric);

                // Store settings globally for other functions to access
                window.storeSettings = storeSettings;

                const sheetData = parseCSV(csvData);
                const propertyData = processPropertyData(sheetData, blogData);

                // Find the container element - now looking for class instead of ID
                const containers = document.querySelectorAll('#propertyListingsContainer.featured-listings');
                containers.forEach(container => {
                    if (container) {
                        // Get the number of listings to show from the attribute
                        const listingsAmount = parseInt(container.getAttribute('listings-amount') || '3', 10);
                        
                        // Create the grid container
                        const gridContainer = document.createElement('div');
                        gridContainer.id = 'property-grid';
                        gridContainer.className = 'property-grid sh-property-grid sh-featured-grid';
                        
                        // Render limited number of properties
                        renderFeaturedListings(propertyData, gridContainer, listingsAmount);
                        
                        // Add grid to the main container
                        container.appendChild(gridContainer);
                    }
                });
                
                console.log('🚀 SquareHero.store Featured Listings plugin loaded');
            }).catch(error => console.error('❌ Error fetching data:', error));
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
    
    function createPropertyCard(property) {
        const storeSettings = window.storeSettings || {};
        const isMetric = storeSettings.measurementStandard === 2;
        const currencySymbol = getCurrencySymbol(storeSettings.selectedCurrency);
        const areaUnit = getAreaUnit(isMetric);

        const card = document.createElement('a');
        card.className = 'property-card sh-property-card sh-featured-card';
        card.href = property.url;

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

    function renderFeaturedListings(properties, container, listingsAmount) {
        if (!container) {
            console.error('Featured property grid container not found');
            return;
        }

        // Add custom CSS for featured properties
        const featuredStyle = document.createElement('style');
        featuredStyle.id = 'sh-featured-style';
        featuredStyle.textContent = `
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
            
            .sh-featured-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 30px;
                margin: 30px 0;
            }
            
            /* Hide filters and search sections for featured listings */
            #propertyListingsContainer.featured-listings .filters-container {
                display: none;
            }
            
            #propertyListingsContainer.featured-listings #no-results-message {
                display: none;
            }
        `;
        document.head.appendChild(featuredStyle);

        // Take only the specified amount of properties
        const limitedProperties = properties.slice(0, listingsAmount);
        
        // Create and append property cards
        limitedProperties.forEach(property => {
            const card = createPropertyCard(property);
            container.appendChild(card);
        });
        
        console.log(`🏠 Rendered ${limitedProperties.length} featured properties`);
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Look for containers with the featured-listings class
        const containers = document.querySelectorAll('#propertyListingsContainer.featured-listings');
        if (containers.length === 0) {
            console.log('No featured listings containers found');
        } else {
            console.log(`Found ${containers.length} featured listings containers`);
        }
    });
})();