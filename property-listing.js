(function () {
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

        return blogItems.map(item => {
            const urlId = item.urlId.toLowerCase();
            const sheetRow = Array.from(urlMap.entries()).find(([regexPattern, value]) => regexPattern.test(urlId));

            if (!sheetRow) {
                console.warn(`No matching sheet data found for blog item: ${item.urlId}`);
            }

            return {
                id: item.id,
                title: item.title,
                location: item.tags && item.tags.length > 0 ? item.tags[0] : '',
                imageUrl: item.assetUrl,
                category: item.categories && item.categories.length > 0 ? item.categories[0] : '',
                tags: item.tags || [],
                price: sheetRow && sheetRow[1].Price ? parseFloat(sheetRow[1].Price.replace(/[$,]/g, '')) : null,
                area: sheetRow && sheetRow[1].Area ? parseInt(sheetRow[1].Area.replace(/,/g, ''), 10) : null,
                bedrooms: sheetRow && sheetRow[1].Bedrooms ? parseInt(sheetRow[1].Bedrooms, 10) : null,
                bathrooms: sheetRow && sheetRow[1].Bathrooms ? parseFloat(sheetRow[1].Bathrooms) : null,
                garage: sheetRow && sheetRow[1].Garage ? sheetRow[1].Garage : '',
                url: item.fullUrl,
                urlId: item.urlId
            };
        });
    }

    function formatPrice(price) {
        if (price === null) return 'Price TBA';
        return '$' + price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
        detailsContainer.className = 'current-property-details';

        let detailsContent = `
    <div class="listing-content">
      ${property.location ? `<p class="property-location">${property.location}</p>` : ''}
      <p class="property-price ${property.price === null ? 'no-price' : ''}">${formatPrice(property.price)}</p>
      <div class="property-details">
        ${property.area ? `<span class="details-icon">${svgIcons.area} ${property.area.toLocaleString()} sq ft</span>` : ''}
        ${property.bedrooms ? `<span class="details-icon">${svgIcons.beds} ${property.bedrooms}</span>` : ''}
        ${property.bathrooms ? `<span class="details-icon">${svgIcons.baths} ${property.bathrooms}</span>` : ''}
        ${property.garage ? `<span class="details-icon">${svgIcons.garage} ${property.garage}</span>` : ''}
        </div>
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
        const card = document.createElement('a');
        card.className = 'property-card';
        card.href = property.url;

        let cardContent = `
      <div class="property-image">
        <img src="${property.imageUrl}" alt="${property.title}">
        ${property.category ? `<span class="property-category">${property.category}</span>` : ''}
      </div>
      <div class="listing-content">
        <h3 class="property-title">${property.title}</h3>
        ${property.location ? `<p class="property-location">${property.location}</p>` : ''}
        <p class="property-price ${property.price === null ? 'no-price' : ''}">${formatPrice(property.price)}</p>
        <div class="property-details">
          ${property.area ? `<span class="details-icon">${svgIcons.area} ${property.area.toLocaleString()} sq ft</span>` : ''}
          ${property.bedrooms ? `<span class="details-icon">${svgIcons.beds} ${property.bedrooms}</span>` : ''}
          ${property.bathrooms ? `<span class="details-icon">${svgIcons.baths} ${property.bathrooms}</span>` : ''}
          ${property.garage ? `<span class="details-icon">${svgIcons.garage} ${property.garage}</span>` : ''}
        </div>
        <span class="sh-button">View Home</span>
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

        const relatedSection = document.createElement('div');
        relatedSection.className = 'related-properties-section';

        const sectionTitle = isTagFiltered ? 'Related Properties' : 'More Properties';
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
    }

    // Updated initialization function
    function init() {
        addPropertyListingsClass();
        setupBannerImage();
        setupCurrentPropertyDetails();
        addExcerpt(); // Updated function name
        setupRelatedProperties();
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