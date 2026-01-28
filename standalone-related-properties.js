/**
 * Standalone Related Properties Script for Marty
 */

(function() {
  'use strict';

  // Store reference to the current script element for later use
  const currentScript = document.currentScript;

  // ===== CONFIGURATION =====
  // Get configuration from meta tag
  const metaTag = document.querySelector('meta[squarehero-plugin="real-estate-listings"]');
  
  if (!metaTag) {
    console.error('Real Estate Listings meta tag not found. Please add the meta tag to your page.');
    return;
  }

  const blogCollectionPath = metaTag.getAttribute('target');
  const customFieldsUrl = metaTag.getAttribute('sheet-url');
  
  if (!blogCollectionPath) {
    console.error('Blog collection path (target) not found in meta tag');
    return;
  }
  
  if (!customFieldsUrl) {
    console.error('Custom fields URL (sheet-url) not found in meta tag');
    return;
  }
  
  // Number of related properties to display
  const numberOfRelatedProperties = 3;
  // ===== END CONFIGURATION =====

  async function setupStandaloneRelatedProperties() {
    try {
      // Get current page URL path
      const currentPagePath = window.location.pathname;
      
      // Extract the slug from current page (e.g., /url-title-here -> url-title-here)
      const currentSlug = currentPagePath.split('/').filter(Boolean).pop();
      
      if (!currentSlug) {
        console.error('Could not determine current page slug');
        return;
      }

      console.log('Current page slug:', currentSlug);

      // Fetch all blog listings
      const blogResponse = await fetch(`${blogCollectionPath}?format=json`);
      if (!blogResponse.ok) {
        throw new Error('Failed to fetch blog listings');
      }
      const blogData = await blogResponse.json();
      
      // Find the matching property by URL slug
      const matchingProperty = blogData.items.find(item => {
        const itemSlug = item.urlId || item.fullUrl.split('/').filter(Boolean).pop();
        return itemSlug === currentSlug;
      });

      if (!matchingProperty) {
        console.error('No matching property found for slug:', currentSlug);
        return;
      }

      console.log('Found matching property:', matchingProperty.title);

      // Fetch custom fields data
      const csvResponse = await fetch(customFieldsUrl);
      if (!csvResponse.ok) {
        throw new Error('Failed to fetch custom fields CSV');
      }
      const csvText = await csvResponse.text();
      const sheetData = parseCSV(csvText);

      // Process all properties
      const allProperties = processPropertyData(sheetData, blogData.items);
      
      // Filter out the current property and get related ones
      const relatedProperties = allProperties
        .filter(p => p.urlId !== matchingProperty.urlId)
        .slice(0, numberOfRelatedProperties);

      if (relatedProperties.length > 0) {
        renderRelatedProperties(relatedProperties);
      } else {
        console.log('No related properties found');
      }

    } catch (error) {
      console.error('Error setting up related properties:', error);
    }
  }

  // Inline SVG icons
  const svgIcons = {
    area: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="17" fill="none" viewBox="0 0 18 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#areaClip)"><path d="M.364 3.203 0 2.839 2.202.638l2.202 2.201-.363.364a.794.794 0 0 1-1.122 0l-.717-.715-.714.715a.794.794 0 0 1-1.124 0Z"/><path d="M16.855 15.016H1.548V1.563h1.308v12.144h14v1.309Z"/><path d="m15.58 16.564-.364-.364a.794.794 0 0 1 0-1.121l.714-.715-.714-.715a.794.794 0 0 1 0-1.122l.363-.363 2.202 2.202-2.202 2.198ZM16.119 11.598h-.634a.654.654 0 0 1 0-1.308h.634c.192 0 .347-.14.347-.317v-.614a.654.654 0 1 1 1.309 0v.614c0 .896-.743 1.625-1.656 1.625ZM13.063 11.599H9.727a.654.654 0 1 1 0-1.309h3.336a.654.654 0 0 1 0 1.309ZM7.251 11.598h-.633c-.913 0-1.657-.729-1.657-1.625v-.614a.654.654 0 1 1 1.309 0v.614c0 .175.156.317.348.317h.633a.654.654 0 1 1 0 1.309ZM5.616 7.727a.654.654 0 0 1-.655-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654ZM5.616 3.537a.654.654 0 0 1-.655-.654v-.614c0-.896.744-1.625 1.657-1.625h.633a.654.654 0 0 1 0 1.308h-.633c-.192 0-.348.14-.348.317v.614a.654.654 0 0 1-.654.654ZM13.01 1.952H9.674a.654.654 0 0 1 0-1.308h3.337a.654.654 0 0 1 0 1.308ZM17.12 3.537a.654.654 0 0 1-.654-.654v-.614c0-.175-.155-.317-.347-.317h-.634a.654.654 0 1 1 0-1.308h.634c.913 0 1.656.729 1.656 1.625v.614a.654.654 0 0 1-.654.654ZM17.12 7.727a.655.655 0 0 1-.654-.654V5.17a.654.654 0 1 1 1.309 0v1.904a.654.654 0 0 1-.654.654Z"/></g><defs><clipPath id="areaClip"><path fill="#fff" d="M0 .65h17.759v15.89H0z"/></clipPath></defs></svg>`,
    beds: `<svg xmlns="http://www.w3.org/2000/svg" width="23" height="21" fill="none" viewBox="0 0 23 21"><g clip-path="url(#bedsClip)"><path fill="hsl(var(--black-hsl))" d="M2.735 4.856a.907.907 0 0 0-.95-.906.923.923 0 0 0-.863.93v12.09h1.814v-3.627h4.532V9.716H2.735v-4.86Zm16.1 1.66H8.174v6.827h12.022V7.875a1.36 1.36 0 0 0-1.36-1.36Zm3.085 3.2h-.819v7.254h1.814v-6.26a.994.994 0 0 0-.995-.994ZM5.573 5.613a1.814 1.814 0 1 0-.237 3.62 1.814 1.814 0 0 0 .237-3.62Z"/></g><defs><clipPath id="bedsClip"><path fill="#fff" d="M.685.65h22.23v19.89H.685z"/></clipPath></defs></svg>`,
    baths: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="17" fill="none" viewBox="0 0 19 17"><g fill="hsl(var(--black-hsl))" clip-path="url(#bathsClip)"><path d="M13.361 6.618a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm-1.553-1.166a.388.388 0 1 0 .147.028.389.389 0 0 0-.15-.029l.003.001Zm-.196 1.166a.389.389 0 1 0 0 .778.389.389 0 0 0 0-.778Zm1.749-1.166a.389.389 0 1 0-.001.78.389.389 0 0 0 .001-.78Zm2.137-1.165H11.03a.389.389 0 1 0 0 .777h4.468a.39.39 0 1 0 0-.777ZM15.304.594a2.717 2.717 0 0 0-2.249 1.19 2.135 2.135 0 0 0-1.831 2.113h4.274a2.136 2.136 0 0 0-1.537-2.05 1.981 1.981 0 0 1 1.343-.524c.95 0 1.942.686 1.942 1.991v4.471h.778v-4.47a2.72 2.72 0 0 0-2.72-2.72Zm.194 6.412a.388.388 0 1 0-.777-.001.388.388 0 0 0 .777 0Zm-.194-1.166a.39.39 0 0 0-.664-.275.389.389 0 1 0 .664.275ZM1.537 11.722a3.477 3.477 0 0 0 1.75 3.018l-.889.889a.566.566 0 1 0 .8.8l1.274-1.273c.18.03.363.045.545.046h9.53c.182 0 .364-.017.545-.046l1.273 1.273a.565.565 0 1 0 .8-.8l-.889-.89a3.478 3.478 0 0 0 1.752-3.017v-1.393H1.537v1.393Zm.696-3.133h-.696a.696.696 0 0 0-.696.696v.348h17.882v-.348a.696.696 0 0 0-.696-.696H2.233Z"/></g><defs><clipPath id="bathsClip"><path fill="#fff" d="M.84.594h17.883v16H.84z"/></clipPath></defs></svg>`,
    garage: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" fill="none" viewBox="0 0 20 18"><g fill="hsl(var(--black-hsl))" clip-path="url(#garageClip)"><path d="M15.908 17.09c.413-.046.717-.41.717-.826v-.788a.81.81 0 0 0 .81-.81v-3.238a.81.81 0 0 0-.81-.81h-.113l-1.122-3.77a.404.404 0 0 0-.384-.277H5.292a.404.404 0 0 0-.384.277l-1.122 3.77h-.113a.81.81 0 0 0-.81.81v3.238a.81.81 0 0 0 .81.81v.788c0 .415.304.78.717.826a.812.812 0 0 0 .9-.805v-.81h9.716v.81a.81.81 0 0 0 .902.805ZM5.896 7.785h8.506l.843 2.834H5.052l.844-2.834Zm-.917 5.764a.911.911 0 1 1-.185-1.814.911.911 0 0 1 .185 1.814Zm9.526-.814a.91.91 0 1 1 1.812-.187.91.91 0 0 1-1.812.187ZM18.24 5.92l-8.091-4.245-8.09 4.245a.85.85 0 0 1-1.15-.358l-.254-.487 9.494-4.98 9.494 4.98-.256.487a.851.851 0 0 1-1.148.358Z"/></g><defs><clipPath id="garageClip"><path fill="#fff" d="M.649.094h19v17h-19z"/></clipPath></defs></svg>`
  };

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

      // Transform URL by removing the first path segment (e.g., /find-home/essentialseton -> /essentialseton)
      const urlParts = item.fullUrl.split('/').filter(Boolean);
      const transformedUrl = urlParts.length > 1 ? '/' + urlParts.slice(1).join('/') : item.fullUrl;

      return {
        id: item.id,
        title: item.title,
        location: item.tags && item.tags.length > 0 ? item.tags[0] : '',
        imageUrl: item.assetUrl,
        category: item.categories && item.categories.length > 0 ? item.categories[0] : '',
        price: price,
        priceValue: priceValue,
        area: area,
        areaValue: areaValue,
        bedrooms: bedrooms,
        bedroomsValue: bedroomsValue,
        bathrooms: bathrooms,
        bathroomsValue: bathroomsValue,
        garage: sheetRow && sheetRow[1].Garage ? sheetRow[1].Garage : '',
        url: transformedUrl,
        urlId: item.urlId
      };
    });
  }

  function createPropertyCard(property) {
    const card = document.createElement('a');
    card.className = 'property-card';
    card.href = property.url;

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

    let cardContent = `
      <div class="property-image sh-property-image">
        <img src="${property.imageUrl}" alt="${property.title}" class="sh-property-img">
        ${property.category ? `<span class="property-category sh-property-category">${property.category}</span>` : ''}
      </div>
      <div class="listing-content sh-listing-content">
        <h3 class="property-title sh-property-title">${property.title}</h3>
        ${property.location ? `<p class="property-location sh-property-location">${property.location}</p>` : ''}
        <p class="property-price sh-property-price ${property.price === null ? 'no-price' : ''}">${displayPrice || 'Price TBA'}</p>
        <div class="property-details sh-property-details">
          ${displayArea ? `<span class="details-icon sh-area-icon">${svgIcons.area} <span class="sh-area-value">${displayArea} sq ft</span></span>` : ''}
          ${displayBedrooms ? `<span class="details-icon sh-beds-icon">${svgIcons.beds} <span class="sh-beds-value">${displayBedrooms}</span></span>` : ''}
          ${displayBathrooms ? `<span class="details-icon sh-baths-icon">${svgIcons.baths} <span class="sh-baths-value">${displayBathrooms}</span></span>` : ''}
          ${property.garage ? `<span class="details-icon sh-garage-icon">${svgIcons.garage} <span class="sh-garage-value">${property.garage}</span></span>` : ''}
        </div>
        <span class="sh-button sh-view-button">View Home</span>
      </div>
    `;

    card.innerHTML = cardContent;
    return card;
  }

  function renderRelatedProperties(properties) {
    // Create the related properties section
    const relatedSection = document.createElement('div');
    relatedSection.className = 'related-properties-section';
    relatedSection.innerHTML = '<h2>More Properties</h2>';

    const relatedGrid = document.createElement('div');
    relatedGrid.className = 'property-grid';

    properties.forEach(property => {
      const card = createPropertyCard(property);
      relatedGrid.appendChild(card);
    });

    relatedSection.appendChild(relatedGrid);
    
    // Insert after the current script tag
    if (currentScript && currentScript.parentNode) {
      currentScript.parentNode.insertBefore(relatedSection, currentScript.nextSibling);
    } else {
      // Fallback: append to body if script reference not available
      document.body.appendChild(relatedSection);
    }
  }

  function formatPrice(price) {
    if (price === null) return 'Price TBA';
    return '$' + price.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
  }

  // Function to check if DOM is already loaded
  function domReady(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 1);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  // Run setup when DOM is ready
  domReady(setupStandaloneRelatedProperties);

})();
