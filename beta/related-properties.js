// ===================================================================
//   SquareHero Cornerstone Builders: Related Properties Script
// ===================================================================
(function () {
    function setupRelatedProperties() {
      const metaTag = document.querySelector('meta[squarehero-plugin="property-listings"]');
      if (!metaTag || metaTag.getAttribute('enabled') !== 'true') return;
  
      const sheetUrl = metaTag.getAttribute('sheet-url');
      const target = metaTag.getAttribute('target');
      const allPropertiesJsonUrl = `/${target}?format=json&nocache=${new Date().getTime()}`;
      const currentPropertyJsonUrl = `${window.location.pathname}?format=json`;
  
      fetch(currentPropertyJsonUrl)
        .then(response => response.json())
        .then(currentPropertyData => {
          const currentUrlId = currentPropertyData.item.urlId;
  
          Promise.all([
            fetch(sheetUrl).then(response => response.text()),
            fetch(allPropertiesJsonUrl).then(response => response.json())
          ]).then(([csvData, allPropertiesData]) => {
            const sheetData = parseCSV(csvData);
            const propertyData = processPropertyData(sheetData, allPropertiesData.items);
  
            const relatedProperties = propertyData
              .filter(property => property.urlId !== currentUrlId)
              .slice(0, 3);
  
            renderRelatedProperties(relatedProperties);
          }).catch(error => console.error('Error fetching data:', error));
        })
        .catch(error => console.error('Error fetching current property data:', error));
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
          url: item.fullUrl,
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
        <div class="property-image">
          <img src="${property.imageUrl}" alt="${property.title}">
          ${property.category ? `<span class="property-category">${property.category}</span>` : ''}
        </div>
        <div class="listing-content">
          <h3 class="property-title">${property.title}</h3>
          ${property.location ? `<p class="property-location">${property.location}</p>` : ''}
          <p class="property-price ${property.price === null ? 'no-price' : ''}">${displayPrice || 'Price TBA'}</p>
          <div class="property-details">
            ${displayArea ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Size.svg" alt="Area"> ${displayArea} sq ft</span>` : ''}
            ${displayBedrooms ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Bedroom.svg" alt="Bedrooms"> ${displayBedrooms}</span>` : ''}
            ${displayBathrooms ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Bathroom.svg" alt="Bathrooms"> ${displayBathrooms}</span>` : ''}
            ${property.garage ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Garage.svg" alt="Garage"> ${property.garage}</span>` : ''}
          </div>
          <div class="sh-button">View Home</div>
        </div>
      `;
  
      card.innerHTML = cardContent;
      return card;
    }
  
    function renderRelatedProperties(properties) {
      const blogItemWrapper = document.querySelector('.blog-item-wrapper');
      if (!blogItemWrapper) {
        console.error('Blog item wrapper not found');
        return;
      }
  
      const relatedSection = document.createElement('div');
      relatedSection.className = 'related-properties-section';
      relatedSection.innerHTML = '<h2>More Properties</h2>';
  
      const relatedContainer = document.createElement('div');
      relatedContainer.className = 'property-grid';
  
      properties.forEach(property => {
        const card = createPropertyCard(property);
        relatedContainer.appendChild(card);
      });
  
      relatedSection.appendChild(relatedContainer);
      blogItemWrapper.appendChild(relatedSection);
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
  
    // Run setupRelatedProperties when DOM is ready
    domReady(setupRelatedProperties);
  
  })();