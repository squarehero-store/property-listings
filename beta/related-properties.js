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
            ${property.area ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Size.svg" alt="Area"> ${property.area.toLocaleString()} sq ft</span>` : ''}
            ${property.bedrooms ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Bedroom.svg" alt="Bedrooms"> ${property.bedrooms}</span>` : ''}
            ${property.bathrooms ? `<span class="details-icon"><img src="https://cdn.jsdelivr.net/gh/squarehero-store/property-listings@main/Icons/Icon-Set_Bathroom.svg" alt="Bathrooms"> ${property.bathrooms}</span>` : ''}
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