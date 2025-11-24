(function () {
    // Read custom icon configurations from meta tag attributes
    function getCustomIcons() {
        const metaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
        if (!metaTag) return {};
        
        const customIcons = {};
        Array.from(metaTag.attributes).forEach(attr => {
            if (attr.name.startsWith('custom-icon-')) {
                const fieldName = attr.name.replace('custom-icon-', '');
                customIcons[fieldName] = attr.value;
            }
        });
        
        return customIcons;
    }

    // Helper functions for Property Data
    function parseCSV(csv) {
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        return lines.slice(1).map(line => {
            const values = [];
            let currentValue = '';
            let withinQuotes = false;

            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') {
                    withinQuotes = !withinQuotes;
                } else if (line[i] === ',' && !withinQuotes) {
                    values.push(currentValue.trim());
                    currentValue = '';
                } else {
                    currentValue += line[i];
                }
            }
            values.push(currentValue.trim());

            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] ? values[index].replace(/^"|"$/g, '') : '';
                return obj;
            }, {});
        });
    }

    function processPropertyData(sheetData, blogItems) {
        const urlMap = new Map(sheetData.map(row => {
            const url = row.Url.replace(/^\//, '').trim().toLowerCase();
            const regexPattern = new RegExp('^' + url.replace(/\*/g, '.*') + '$');
            return [regexPattern, row];
        }));
        
        // Identify custom columns (all columns except standard ones)
        const standardColumns = ['Title', 'Url', 'Price', 'Area', 'Bedrooms', 'Bathrooms', 'Garage', 'Featured'];
        const customColumns = Object.keys(sheetData[0] || {}).filter(column => 
            !standardColumns.includes(column));
        
        // Set global custom columns for use in other functions
        window.customColumns = customColumns;
        
        // Determine data types for custom columns
        window.customColumnTypes = {};
        window.customColumnSpecialHandling = {};
        
        customColumns.forEach(column => {
            // Check values to determine type
            const values = sheetData.map(row => row[column]).filter(Boolean);
            
            if (values.length === 0) {
                window.customColumnTypes[column] = 'text';
            } else if (values.every(value => value === 'Yes' || value === 'No')) {
                window.customColumnTypes[column] = 'boolean';
            } else if (values.every(value => !isNaN(parseFloat(value)))) {
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
                    window.customColumnSpecialHandling[column] = 'buttonGroup';
                } 
            } else {
                // Check if this is a comma-separated text field
                const hasCommaSeparatedValues = values.some(value => 
                    value.includes(',') && value.split(',').length > 1
                );
                
                if (hasCommaSeparatedValues) {
                    window.customColumnTypes[column] = 'comma-separated';
                } else {
                    window.customColumnTypes[column] = 'text';
                }
            }
        });

        // Process blog items with the sheet data
        const processedItems = blogItems.map(item => {
            const urlId = item.urlId.toLowerCase();
            const sheetRow = Array.from(urlMap.entries()).find(([regexPattern, value]) => regexPattern.test(urlId));

            if (!sheetRow) {
                console.warn(`⚠️ No matching sheet row found for: ${item.urlId}`);
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
                        } else if (columnType === 'comma-separated' && value) {
                            // Split comma-separated values and clean them up
                            customFields[column] = value.split(',').map(v => v.trim()).filter(v => v);
                        } else {
                            customFields[column] = value;
                        }
                    }
                });
            }

            // Parse range values for price, area, bedrooms, bathrooms
            let price = null, priceValue = null;
            if (sheetRow && sheetRow[1].Price) {
                const priceRange = parseRange(sheetRow[1].Price.replace(/[$,\s]/g, ''));
                if (priceRange) {
                    price = priceRange;
                    priceValue = priceRange.min;
                } else {
                    price = parseFloat(sheetRow[1].Price.replace(/[$,]/g, ''));
                    priceValue = price;
                }
            }

            let area = null, areaValue = null;
            if (sheetRow && sheetRow[1].Area) {
                const areaRange = parseRange(sheetRow[1].Area.replace(/,/g, ''));
                if (areaRange) {
                    area = areaRange;
                    areaValue = areaRange.min;
                } else {
                    area = parseInt(sheetRow[1].Area.replace(/,/g, ''), 10);
                    areaValue = area;
                }
            }

            let bedrooms = null, bedroomsValue = null;
            if (sheetRow && sheetRow[1].Bedrooms) {
                const bedroomsRange = parseRange(sheetRow[1].Bedrooms);
                if (bedroomsRange) {
                    bedrooms = bedroomsRange;
                    bedroomsValue = bedroomsRange.min;
                } else {
                    bedrooms = parseInt(sheetRow[1].Bedrooms, 10);
                    bedroomsValue = bedrooms;
                }
            }

            let bathrooms = null, bathroomsValue = null;
            if (sheetRow && sheetRow[1].Bathrooms) {
                const bathroomsRange = parseRange(sheetRow[1].Bathrooms);
                if (bathroomsRange) {
                    bathrooms = bathroomsRange;
                    bathroomsValue = bathroomsRange.min;
                } else {
                    bathrooms = parseFloat(sheetRow[1].Bathrooms);
                    bathroomsValue = bathrooms;
                }
            }

            return {
                id: item.id,
                title: item.title,
                location: item.tags && item.tags.length > 0 ? item.tags[0] : '',
                imageUrl: item.assetUrl,
                category: item.categories && item.categories.length > 0 ? item.categories[0] : '',
                tags: item.tags || [],
                price: price,
                priceValue: priceValue,
                area: area,
                areaValue: areaValue,
                bedrooms: bedrooms,
                bedroomsValue: bedroomsValue,
                bathrooms: bathrooms,
                bathroomsValue: bathroomsValue,
                garage: sheetRow && sheetRow[1].Garage ? sheetRow[1].Garage : '',
                customFields: customFields, // Add custom fields
                url: item.fullUrl,
                urlId: item.urlId
            };
        });
        
        return processedItems;
    }

    function formatPrice(price) {
        if (price === null) return 'Price TBA';
        return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    // Parse range values like "2-4" or "595000-645000"
    function parseRange(value) {
        if (!value) return null;
        
        const str = value.toString().trim();
        const rangeMatch = str.match(/^([\d,]+(?:\.\d+)?)\s*-\s*([\d,]+(?:\.\d+)?)$/);
        
        if (rangeMatch) {
            const min = parseFloat(rangeMatch[1].replace(/,/g, ''));
            const max = parseFloat(rangeMatch[2].replace(/,/g, ''));
            return { min, max, isRange: true, original: str };
        }
        
        return null;
    }

    // Format range values for display
    function formatRange(rangeObj, formatter = (v) => v) {
        if (!rangeObj || !rangeObj.isRange) return null;
        return `${formatter(rangeObj.min)}-${formatter(rangeObj.max)}`;
    }

    // Helper function to check if a custom field value should be displayed
    function shouldDisplayValue(value, columnType) {
        if (value === null || value === undefined) return false;
        
        if (columnType === 'boolean') {
            return true; // Always show boolean values (Yes/No)
        } else if (columnType === 'numeric') {
            return value > 0; // Only show numeric values greater than 0
        } else if (columnType === 'comma-separated') {
            return Array.isArray(value) && value.length > 0; // Show if array has items
        } else {
            // For text fields, check if not empty
            return value !== '' && value.toString().trim() !== '';
        }
    }

    // SVG Icons remain unchanged
    const svgIcons = {
        area: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" fill="none" viewBox="0 0 18 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#areaClip)"><path d="M.364 3.203 0 2.839 2.202.638l2.202 2.201-.363.364a.794.794 0 0 1-1.122 0l-.717-.715-.714.715a.794.794 0 0 1-1.124 0Z"/><path d="M16.855 15.016H1.548V1.563h1.308v12.144h14v1.309Z"/><path d="m15.58 16.564-.364-.364a.794.794 0 0 1 0-1.121l.714-.715-.714-.715a.794.794 0 0 1 0-1.122l.363-.363 2.202 2.202-2.202 2.198ZM16.119 11.598h-.634a.654.654 0 0 1 0-1.308h.634c.192 0 .347-.14.347-.317v-.614a.654.654 0 1 1 1.309 0v.614c0 .896-.743 1.625-1.656 1.625ZM13.063 11.599H9.727a.654.654 0 1 1 0-1.309h3.336a.654.654 0 0 1 0 1.309ZM7.251 11.598h-.633c-.913 0-1.657-.729-1.657-1.625v-.614a.654.654 0 1 1 1.309 0v.614c0 .175.156.317.348.317h.633a.654.654 0 1 1 0 1.309ZM5.616 7.727a.654.654 0 0 1-.655-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654ZM5.616 3.537a.654.654 0 0 1-.655-.654v-.614c0-.896.744-1.625 1.657-1.625h.633a.654.654 0 0 1 0 1.308h-.633c-.192 0-.348.14-.348.317v.614a.654.654 0 0 1-.654.654ZM13.01 1.952H9.674a.654.654 0 0 1 0-1.308h3.337a.654.654 0 0 1 0 1.308ZM17.12 3.537a.654.654 0 0 1-.654-.654v-.614c0-.175-.155-.317-.347-.317h-.634a.654.654 0 1 1 0-1.308h.634c.913 0 1.656.729 1.656 1.625v.614a.654.654 0 0 1-.654.654ZM17.12 7.727a.655.655 0 0 1-.654-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654Z"/></g><defs><clipPath id="areaClip"><path fill="#fff" d="M0 .65h17.759v15.89H0z"/></clipPath></defs></svg>`,
        beds: `<svg xmlns="http://www.w3.org/2000/svg" width="23" height="21" fill="none" viewBox="0 0 23 21"><g clip-path="url(#bedsClip)"><path fill="hsl(var(--black-hsl))" d="M2.735 4.856a.907.907 0 0 0-.95-.906.923.923 0 0 0-.863.93v12.09h1.814v-3.627h4.532V9.716H2.735v-4.86Zm16.1 1.66H8.174v6.827h12.022V7.875a1.36 1.36 0 0 0-1.36-1.36Zm3.085 3.2h-.819v7.254h1.814v-6.26a.994.994 0 0 0-.995-.994ZM5.573 5.613a1.814 1.814 0 1 0-.237 3.62 1.814 1.814 0 0 0 .237-3.62Z"/></g><defs><clipPath id="bedsClip"><path fill="#fff" d="M.685.65h22.23v19.89H.685z"/></clipPath></defs></svg>`,
        baths: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="17" fill="none" viewBox="0 0 19 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#bathsClip)"><path d="M13.361 6.618a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm-1.553-1.166a.388.388 0 1 0 .147.028.389.389 0 0 0-.15-.029l.003.001Zm-.196 1.166a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm1.749-1.166a.389.389 0 1 0-.001.78.389.389 0 0 0 .001-.78Zm2.137-1.165H11.03a.389.389 0 1 0 0 .777h4.468a.39.39 0 1 0 0-.777ZM15.304.594a2.717 2.717 0 0 0-2.249 1.19 2.135 2.135 0 0 0-1.831 2.113h4.274a2.136 2.136 0 0 0-1.537-2.05 1.981 1.981 0 0 1 1.343-.524c.95 0 1.942.686 1.942 1.991v4.471h.778v-4.47a2.72 2.72 0 0 0-2.72-2.72Zm.194 6.412a.388.388 0 1 0-.777-.001.388.388 0 0 0 .777 0Zm-.194-1.166a.39.39 0 0 0-.664-.275.389.389 0 1 0 .664.275ZM1.537 11.722a3.477 3.477 0 0 0 1.75 3.018l-.889.889a.566.566 0 1 0 .8.8l1.274-1.273c.18.03.363.045.545.046h9.53c.182 0 .364-.017.545-.046l1.273 1.273a.565.565 0 1 0 .8-.8l-.889-.89a3.478 3.478 0 0 0 1.752-3.017v-1.393H1.537v1.393Zm.696-3.133h-.696a.696.696 0 0 0-.696.696v.348h17.882v-.348a.696.696 0 0 0-.696-.696H2.233Z"/></g><defs><clipPath id="bathsClip"><path fill="#fff" d="M.84.594h17.883v16H.84z"/></clipPath></defs></svg>`,
        garage: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" fill="none" viewBox="0 0 20 18"><g fill="hsl(var(--black-hsl))" clip-path="url(#garageClip)"><path d="M15.908 17.09c.413-.046.717-.41.717-.826v-.788a.81.81 0 0 0 .81-.81v-3.238a.81.81 0 0 0-.81-.81h-.113l-1.122-3.77a.404.404 0 0 0-.384-.277H5.292a.404.404 0 0 0-.384.277l-1.122 3.77h-.113a.81.81 0 0 0-.81.81v3.238a.81.81 0 0 0 .81.81v.788c0 .415.304.78.717.826a.812.812 0 0 0 .9-.805v-.81h9.716v.81a.81.81 0 0 0 .902.805ZM5.896 7.785h8.506l.843 2.834H5.052l.844-2.834Zm-.917 5.764a.911.911 0 1 1-.185-1.814.911.911 0 0 1 .185 1.814Zm9.526-.814a.91.91 0 1 1 1.812-.187.91.91 0 0 1-1.812.187ZM18.24 5.92l-8.091-4.245-8.09 4.245a.85.85 0 0 1-1.15-.358l-.254-.487 9.494-4.98 9.494 4.98-.256.487a.851.851 0 0 1-1.148.358Z"/></g><defs><clipPath id="garageClip"><path fill="#fff" d="M.649.094h19v17h-19z"/></clipPath></defs></svg>`
    };

    // Updated Current Property Details Script
    function setupCurrentPropertyDetails() {
        const metaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
        if (!metaTag || metaTag.getAttribute('enabled') !== 'true') return;

        const sheetUrl = metaTag.getAttribute('sheet-url');
        const currentPropertyJsonUrl = `${window.location.pathname}?format=json`;

        Promise.all([
            fetch(sheetUrl).then(response => response.text()),
            fetch(currentPropertyJsonUrl).then(response => response.json())
        ]).then(([csvData, currentPropertyData]) => {
            const sheetData = parseCSV(csvData);
            const propertyData = processPropertyData(sheetData, [currentPropertyData.item]);
            const currentProperty = propertyData[0];

            if (currentProperty) {
                insertCurrentPropertyDetails(currentProperty);
            }
        }).catch(error => console.error('Error fetching property data:', error));
    }

    function insertCurrentPropertyDetails(property) {
        const blogItemTitle = document.querySelector('.blog-item-title');
        if (!blogItemTitle) {
            console.error('Blog item title element not found');
            return;
        }

        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'current-property-details sh-current-property-details';

        // Check pricing setting from meta tag
        const metaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
        const showPricing = metaTag ? metaTag.getAttribute('pricing') !== 'false' : true;

        // Get custom icons configuration
        const customIcons = getCustomIcons();

        // Check for custom fields before generating the HTML
        const hasCustomFields = property.customFields && Object.keys(property.customFields).length > 0;

        // Format display values for ranges
        const displayPrice = property.price && property.price.isRange 
            ? formatRange(property.price, (v) => '$' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }))
            : property.price ? formatPrice(property.price) : null;
        
        const displayArea = property.area && property.area.isRange
            ? formatRange(property.area, (v) => v.toLocaleString())
            : property.area ? property.area.toLocaleString() : null;
        
        const displayBedrooms = property.bedrooms && property.bedrooms.isRange
            ? formatRange(property.bedrooms, (v) => v)
            : property.bedrooms;
        
        const displayBathrooms = property.bathrooms && property.bathrooms.isRange
            ? formatRange(property.bathrooms, (v) => v)
            : property.bathrooms;

        let detailsContent = `
    <div class="listing-content sh-listing-content">
      ${property.location ? `<p class="property-location sh-property-location">${property.location}</p>` : ''}
      ${showPricing && displayPrice ? `<p class="property-price sh-property-price ${property.price === null ? 'no-price' : ''}">${displayPrice}</p>` : ''}
      <div class="property-details sh-property-details">
        ${displayArea ? `<span class="details-icon sh-area-icon">${svgIcons.area} <span class="sh-area-value">${displayArea} sq ft</span></span>` : ''}
        ${displayBedrooms ? `<span class="details-icon sh-beds-icon">${svgIcons.beds} <span class="sh-beds-value">${displayBedrooms}</span></span>` : ''}
        ${displayBathrooms ? `<span class="details-icon sh-baths-icon">${svgIcons.baths} <span class="sh-baths-value">${displayBathrooms}</span></span>` : ''}
        ${property.garage ? `<span class="details-icon sh-garage-icon">${svgIcons.garage} <span class="sh-garage-value">${property.garage}</span></span>` : ''}
        ${(() => {
            // Add custom fields with icons to the main property details
            if (!hasCustomFields || !customIcons) {
                return '';
            }
            
            return Object.entries(property.customFields).map(([key, value]) => {
                // Normalize the field name to match the icon key format
                const normalizedKey = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
                const iconUrl = customIcons[normalizedKey] || customIcons[normalizedKey + '-icon'];
                if (!iconUrl) {
                    return ''; // Only show custom fields that have icons here
                }
                
                const columnType = window.customColumnTypes && window.customColumnTypes[key];
                
                // Check if this value should be displayed
                if (!shouldDisplayValue(value, columnType)) {
                    return ''; // Don't show fields with empty/zero values
                }
                
                const formattedValue = columnType === 'boolean' 
                    ? (value ? 'Yes' : 'No')
                    : (columnType === 'numeric' ? value.toLocaleString() 
                    : (columnType === 'comma-separated' ? value.join(', ') : value));
                
                // Handle different icon file types and add error handling
                const isImageIcon = iconUrl.toLowerCase().endsWith('.png') || 
                                  iconUrl.toLowerCase().endsWith('.jpg') || 
                                  iconUrl.toLowerCase().endsWith('.jpeg');
                
                const iconElement = isImageIcon 
                    ? `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.style.display='none'">` 
                    : `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px;" onerror="this.style.display='none'">`;
                
                return `<span class="details-icon sh-custom-icon sh-custom-${key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}-icon">${iconElement} <span class="sh-custom-${key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}-value">${formattedValue}</span></span>`;
            }).join('');
        })()}
      </div>`;
      
        // Add custom fields WITHOUT icons (fields with icons are shown above)
        if (hasCustomFields) {
            // Filter out custom fields that have icons - they're already shown in the property-details section
            // Also filter out fields with empty/zero values
            const fieldsWithoutIcons = Object.entries(property.customFields).filter(([key, value]) => {
                // Normalize the field name to match the icon key format
                const normalizedKey = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
                const iconUrl = customIcons[normalizedKey] || customIcons[normalizedKey + '-icon'];
                
                // Skip fields that have icons - they're shown in the main details section
                if (iconUrl) return false;
                
                // Only include fields with meaningful values
                const columnType = window.customColumnTypes && window.customColumnTypes[key];
                return shouldDisplayValue(value, columnType);
            });
            
            if (fieldsWithoutIcons.length > 0) {
                detailsContent += `
      <div class="custom-property-details sh-custom-property-details">
        ${fieldsWithoutIcons.map(([key, value]) => {
            const columnType = window.customColumnTypes && window.customColumnTypes[key];
            const formattedValue = columnType === 'boolean' 
                ? (value ? 'Yes' : 'No')
                : (columnType === 'numeric' ? value.toLocaleString() 
                : (columnType === 'comma-separated' ? value.join(', ') : value));
            
            return `<div class="custom-detail sh-custom-detail sh-custom-${key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}">
                <span class="custom-detail-label sh-custom-detail-label">${key}:</span>
                <span class="custom-detail-value sh-custom-detail-value">${formattedValue}</span>
            </div>`;
        }).join('')}
      </div>`;
            }
        }
        
        // Close the listing-content div
        detailsContent += `
    </div>
    `;

        detailsContainer.innerHTML = detailsContent;
        blogItemTitle.appendChild(detailsContainer);
    }

    // Function to add excerpt
    async function addExcerpt() {
        const blogTitle = document.querySelector('.blog-item-title');
        const existingExcerpt = blogTitle.querySelector('.item-excerpt');

        // If there's already an excerpt, remove it so we can place it at the end
        if (existingExcerpt) {
            existingExcerpt.remove();
        }

        try {
            const timestamp = new Date().getTime();
            const currentPropertyJsonUrl = `${window.location.pathname}?format=json&_=${timestamp}`;
            const response = await fetch(currentPropertyJsonUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const jsonData = await response.json();

            if (jsonData && jsonData.item && jsonData.item.excerpt) {
                const excerptDiv = document.createElement('div');
                excerptDiv.className = 'item-excerpt';
                excerptDiv.innerHTML = jsonData.item.excerpt;

                // Force the excerpt to be the last child of blog-item-title
                blogTitle.appendChild(excerptDiv);
            } else {
                console.error('Excerpt not found in JSON data');
            }
        } catch (error) {
            console.error("Could not fetch or add excerpt:", error);
        }
    }


    // BANNER IMAGE SCRIPT
    function setupBannerImage() {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) {
            const imageUrl = ogImage.content.replace('http:', 'https:');

            const banner = document.createElement('div');
            banner.className = 'blog-banner';

            const img = document.createElement('img');
            img.className = 'blog-banner-image';
            img.src = imageUrl;

            banner.appendChild(img);

            const header = document.getElementById('header');
            if (header && header.nextSibling) {
                header.parentNode.insertBefore(banner, header.nextSibling);
            }
        }
    }

    // Related Properties Functions
    function setupRelatedProperties() {
        const mainMetaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
        const settingsMetaTag = document.querySelector('meta[squarehero-plugin-settings="property-listings"]');

        if (!mainMetaTag || !settingsMetaTag || settingsMetaTag.getAttribute('related-properties') !== 'true') {
            return;
        }

        const sheetUrl = mainMetaTag.getAttribute('sheet-url');
        const target = mainMetaTag.getAttribute('target');
        const shouldFilterByTag = settingsMetaTag.getAttribute('tag') === 'true';
        const allPropertiesJsonUrl = `/${target}?format=json&nocache=${new Date().getTime()}`;
        const currentPropertyJsonUrl = `${window.location.pathname}?format=json`;

        fetch(currentPropertyJsonUrl)
            .then(response => response.json())
            .then(currentPropertyData => {
                const currentUrlId = currentPropertyData.item.urlId;
                const currentTags = currentPropertyData.item.tags || [];

                Promise.all([
                    fetch(sheetUrl).then(response => response.text()),
                    fetch(allPropertiesJsonUrl).then(response => response.json())
                ]).then(([csvData, allPropertiesData]) => {
                    const sheetData = parseCSV(csvData);
                    const propertyData = processPropertyData(sheetData, allPropertiesData.items);

                    let filteredProperties = propertyData.filter(property => property.urlId !== currentUrlId);

                    if (shouldFilterByTag && currentTags.length > 0) {
                        filteredProperties = filteredProperties.filter(property =>
                            property.tags && property.tags.some(tag => currentTags.includes(tag))
                        );
                    }

                    const relatedProperties = filteredProperties.slice(0, 3);

                    if (relatedProperties.length > 0) {
                        renderRelatedProperties(relatedProperties, shouldFilterByTag);
                    }
                }).catch(error => console.error('Error fetching data:', error));
            })
            .catch(error => console.error('Error fetching current property data:', error));
    }

    function createPropertyCard(property) {
        // Check pricing setting from meta tag
        const metaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
        const showPricing = metaTag ? metaTag.getAttribute('pricing') !== 'false' : true;
        const buttonText = metaTag ? metaTag.getAttribute('button-text') || 'View Home' : 'View Home';
        
        // Get custom icons configuration
        const customIcons = getCustomIcons();
        
        const card = document.createElement('a');
        card.className = 'property-card sh-property-card';
        card.href = property.url;
        
        // Only set data attributes for properties that exist
        if (property.location) {
            card.setAttribute('data-location', property.location);
        }
        
        if (property.category) {
            card.setAttribute('data-category', property.category);
        }
        
        if (property.bedrooms) {
            card.setAttribute('data-bedrooms', `bed-${property.bedrooms}`);
        }
        
        if (property.bathrooms) {
            card.setAttribute('data-bathrooms', `bath-${property.bathrooms}`);
        }
        
        if (property.area) {
            card.setAttribute('data-area', property.area);
        }
        
        if (property.price && showPricing) {
            card.setAttribute('data-price', property.price);
        }
        
        // Add data attributes for custom fields
        if (property.customFields) {
            Object.entries(property.customFields).forEach(([key, value]) => {
                const attributeName = `data-${key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}`;
                const columnType = window.customColumnTypes && window.customColumnTypes[key];
                const specialHandling = window.customColumnSpecialHandling && window.customColumnSpecialHandling[key];
                
                if (columnType === 'boolean') {
                    // For boolean fields, set to 'yes' or 'no' for easier filtering
                    card.setAttribute(attributeName, value ? 'yes' : 'no');
                } else if (columnType === 'numeric') {
                    if (specialHandling === 'buttonGroup') {
                        // For special numeric fields with button group
                        card.setAttribute(attributeName, Math.floor(Number(value)));
                    } else {
                        // For standard numeric fields
                        card.setAttribute(attributeName, value);
                    }
                } else if (columnType === 'comma-separated') {
                    // For comma-separated fields, join with commas for data attribute
                    card.setAttribute(attributeName, Array.isArray(value) ? value.join(',') : value);
                } else {
                    // For text fields
                    card.setAttribute(attributeName, value);
                }
            });
        }
        
        // Check for custom fields before generating the HTML
        const hasCustomFields = property.customFields && Object.keys(property.customFields).length > 0;

        let cardContent = `
      <div class="property-image sh-property-image">
        <img src="${property.imageUrl}" alt="${property.title}" class="sh-property-img">
        ${property.category ? `<span class="property-category sh-property-category">${property.category}</span>` : ''}
      </div>
      <div class="listing-content sh-listing-content">
        <h3 class="property-title sh-property-title">${property.title}</h3>
        ${property.location ? `<p class="property-location sh-property-location">${property.location}</p>` : ''}
        ${showPricing ? `<p class="property-price sh-property-price ${property.price === null ? 'no-price' : ''}">${formatPrice(property.price)}</p>` : ''}
        <div class="property-details sh-property-details">
          ${property.area ? `<span class="details-icon sh-area-icon">${svgIcons.area} <span class="sh-area-value">${property.area.toLocaleString()} sq ft</span></span>` : ''}
          ${property.bedrooms ? `<span class="details-icon sh-beds-icon">${svgIcons.beds} <span class="sh-beds-value">${property.bedrooms}</span></span>` : ''}
          ${property.bathrooms ? `<span class="details-icon sh-baths-icon">${svgIcons.baths} <span class="sh-baths-value">${property.bathrooms}</span></span>` : ''}
          ${property.garage ? `<span class="details-icon sh-garage-icon">${svgIcons.garage} <span class="sh-garage-value">${property.garage}</span></span>` : ''}
          ${(() => {
              // Add custom fields with icons to the main property details
              if (!hasCustomFields || !customIcons) {
                  return '';
              }
              
              return Object.entries(property.customFields).map(([key, value]) => {
                  // Normalize the field name to match the icon key format
                  const normalizedKey = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
                  const iconUrl = customIcons[normalizedKey] || customIcons[normalizedKey + '-icon'];
                  if (!iconUrl) {
                      return ''; // Only show custom fields that have icons here
                  }
                  
                  const columnType = window.customColumnTypes && window.customColumnTypes[key];
                  
                  // Check if this value should be displayed
                  if (!shouldDisplayValue(value, columnType)) {
                      return ''; // Don't show fields with empty/zero values
                  }
                  
                  const formattedValue = columnType === 'boolean' 
                      ? (value ? 'Yes' : 'No')
                      : (columnType === 'numeric' ? value.toLocaleString() 
                      : (columnType === 'comma-separated' ? value.join(', ') : value));
                  
                  // Handle different icon file types and add error handling
                  const isImageIcon = iconUrl.toLowerCase().endsWith('.png') || 
                                    iconUrl.toLowerCase().endsWith('.jpg') || 
                                    iconUrl.toLowerCase().endsWith('.jpeg');
                  
                  const iconElement = isImageIcon 
                      ? `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.style.display='none'">` 
                      : `<img src="${iconUrl}" alt="${key} icon" style="width: 20px; height: 20px;" onerror="this.style.display='none'">`;
                  
                  return `<span class="details-icon sh-custom-icon sh-custom-${key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}-icon">${iconElement} <span class="sh-custom-${key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}-value">${formattedValue}</span></span>`;
              }).join('');
          })()}
        </div>`;
        
        // Add custom fields WITHOUT icons (fields with icons are shown above)
        if (hasCustomFields) {
            // Filter out custom fields that have icons - they're already shown in the property-details section
            // Also filter out fields with empty/zero values
            const fieldsWithoutIcons = Object.entries(property.customFields).filter(([key, value]) => {
                // Normalize the field name to match the icon key format
                const normalizedKey = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
                const iconUrl = customIcons[normalizedKey] || customIcons[normalizedKey + '-icon'];
                
                // Skip fields that have icons - they're shown in the main details section
                if (iconUrl) return false;
                
                // Only include fields with meaningful values
                const columnType = window.customColumnTypes && window.customColumnTypes[key];
                return shouldDisplayValue(value, columnType);
            });
            
            if (fieldsWithoutIcons.length > 0) {
                cardContent += `
        <div class="custom-property-details sh-custom-property-details">
          ${fieldsWithoutIcons.map(([key, value]) => {
              const columnType = window.customColumnTypes && window.customColumnTypes[key];
              const formattedValue = columnType === 'boolean' 
                  ? (value ? 'Yes' : 'No')
                  : (columnType === 'numeric' ? value.toLocaleString() 
                  : (columnType === 'comma-separated' ? value.join(', ') : value));
              
              return `<div class="custom-detail sh-custom-detail sh-custom-${key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}">
                  <span class="custom-detail-label sh-custom-detail-label">${key}:</span>
                  <span class="custom-detail-value sh-custom-detail-value">${formattedValue}</span>
              </div>`;
          }).join('')}
        </div>`;
            }
        }
        
        // Add View Home button and close listing-content div
        cardContent += `
        <span class="sh-button sh-view-button">${buttonText}</span>
      </div>
    `;

        card.innerHTML = cardContent;
        return card;
    }

    function renderRelatedProperties(properties, isTagFiltered) {
        const blogItemWrapper = document.querySelector('.blog-item-wrapper');
        if (!blogItemWrapper) {
            console.error('Blog item wrapper not found');
            return;
        }

        // Get custom item type from meta tag
        const metaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
        const itemType = metaTag ? metaTag.getAttribute('item-type') || 'Properties' : 'Properties';
        
        // Capitalize the first letter of itemType
        const capitalizedItemType = itemType.charAt(0).toUpperCase() + itemType.slice(1);

        const relatedSection = document.createElement('div');
        relatedSection.className = 'related-properties-section';

        const sectionTitle = isTagFiltered ? `Related ${capitalizedItemType}` : `More ${capitalizedItemType}`;
        relatedSection.innerHTML = `<h2>${sectionTitle}</h2>`;

        const relatedContainer = document.createElement('div');
        relatedContainer.className = 'property-grid';

        properties.forEach(property => {
            const card = createPropertyCard(property);
            relatedContainer.appendChild(card);
        });

        relatedSection.appendChild(relatedContainer);
        blogItemWrapper.appendChild(relatedSection);
    }

    // Function to add property-listings class to body
    function addPropertyListingsClass() {
        document.body.classList.add('property-listings');
        
        // Check if pricing is disabled and add pricing-hidden class
        const metaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
        if (metaTag && metaTag.getAttribute('pricing') === 'false') {
            document.body.classList.add('pricing-hidden');
        }
    }

    // Updated initialization function
    function init() {
        addPropertyListingsClass();
        setupBannerImage();
        setupCurrentPropertyDetails();
        addExcerpt(); // Updated function name
        setupRelatedProperties();
        
        console.log('🚀 SquareHero.store Real Estate Listings plugin loaded');
    }

    // Function to check if DOM is already loaded
    function domReady(fn) {
        if (document.readyState === "complete" || document.readyState === "interactive") {
            setTimeout(fn, 1);
        } else {
            document.addEventListener("DOMContentLoaded", fn);
        }
    }

    // Run init() when DOM is ready
    domReady(init);
})();