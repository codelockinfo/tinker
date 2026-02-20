/**
 * Quick View Popup functionality for wishlist products
 */
(function() {
  'use strict';

  class QuickViewPopup {
    constructor() {
      this.currentPopup = null;
      this.isMobile = window.innerWidth <= 768;
      this.init();
      this.handleResize();
    }

    init() {
      // Listen for quick view button clicks from wishlist cards
      document.addEventListener('click', (e) => {
        const quickViewBtn = e.target.closest('.wishlist-card__action-btn--quick-view');
        if (quickViewBtn) {
          e.preventDefault();
          const productId = quickViewBtn.dataset.productId;
          if (productId) {
            this.openQuickView(productId);
          }
        }
      });

      // Handle quantity buttons
      document.addEventListener('click', (e) => {
        const minusBtn = e.target.closest('[data-quantity-minus]');
        const plusBtn = e.target.closest('[data-quantity-plus]');
        if (minusBtn || plusBtn) {
          const input = (minusBtn || plusBtn).closest('.quick-view-popup__quantity')?.querySelector('[data-quantity-input]');
          if (input) {
            let value = parseInt(input.value) || 1;
            if (minusBtn && value > 1) {
              value--;
            } else if (plusBtn) {
              value++;
            }
            input.value = value;
            
            // Update add to cart button variant if needed (quantity change might affect variant selection)
            this.updateAddToCartQuantity(input.value);
          }
        }
      });

      // Handle quantity input changes
      document.addEventListener('input', (e) => {
        if (e.target.matches('[data-quantity-input]')) {
          let value = parseInt(e.target.value) || 1;
          if (value < 1) value = 1;
          e.target.value = value;
          this.updateAddToCartQuantity(value);
        }
      });

      // Close popup on close button or overlay click
      document.addEventListener('click', (e) => {
        if (!this.currentPopup) return;
        
        const popup = this.currentPopup;
        
        // Check if click is on close button
        const closeButton = e.target.closest('.quick-view-popup__close');
        if (closeButton && closeButton.closest('.quick-view-popup') === popup) {
          e.preventDefault();
          e.stopPropagation();
          this.closePopup();
          return;
        }
        
        // Check if click is on overlay element
        if (e.target.classList.contains('quick-view-popup__overlay')) {
          // Verify this overlay belongs to the current popup
          if (e.target.closest('.quick-view-popup') === popup) {
            e.preventDefault();
            e.stopPropagation();
            this.closePopup();
            return;
          }
        }
        
        // Check if click is outside the popup content
        // If the click target is the popup container itself (not content or inner elements)
        if (e.target === popup) {
          this.closePopup();
          return;
        }
        
        // Check if click is outside content but inside popup
        const clickedContent = e.target.closest('.quick-view-popup__content');
        if (!clickedContent && popup.contains(e.target)) {
          // Click is inside popup but not on content - likely on overlay
          this.closePopup();
        }
      });

      // Close popup on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.currentPopup) {
          this.closePopup();
        }
      });

      // Handle view details link - close popup before navigation
      document.addEventListener('click', (e) => {
        if (e.target.closest('[data-view-details]')) {
          this.closePopup();
        }
      });
    }

    handleResize() {
      window.addEventListener('resize', () => {
        this.isMobile = window.innerWidth <= 768;
      });
    }

    async openQuickView(productId) {
      try {
        // Close any existing popup
        if (this.currentPopup) {
          this.closePopup();
        }

        // Fetch product data
        const product = await this.fetchProduct(productId);
        if (!product) {
          console.error('Product not found');
          return;
        }

        // Render popup
        await this.renderPopup(product);

        // Show appropriate popup (desktop or mobile)
        const popupId = this.isMobile ? `quick-view-popup-mobile-${productId}` : `quick-view-popup-${productId}`;
        const popup = document.getElementById(popupId);
        
        if (!popup) {
          console.error(`Popup not found: ${popupId}`);
          return;
        }

        this.currentPopup = popup;
        popup.classList.add('is-open');

        // Initialize image slider if multiple images exist
        this.initImageSlider(popup, product);

        // Update wishlist and compare button states
        this.updateButtonStates(product);

        // Focus management for accessibility
        const closeButton = popup.querySelector('.quick-view-popup__close');
        if (closeButton) {
          closeButton.focus();
        }

      } catch (error) {
        console.error('Error opening quick view:', error);
      }
    }

    async fetchProduct(productId) {
      try {
        // First try to get product handle from the wishlist card
        const card = document.querySelector(`[data-product-id="${productId}"][data-wishlist-item]`);
        const productHandle = card?.getAttribute('data-product-handle');
        
        if (!productHandle) {
          console.error('Product handle not found');
          return null;
        }

        // Fetch product by handle using Shopify .js endpoint
        const response = await fetch(`/products/${productHandle}.js`);
        if (!response.ok) {
          throw new Error(`Product fetch failed: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Error fetching product:', error);
        return null;
      }
    }

    async renderPopup(product) {
      // Check if popup already exists
      const desktopPopup = document.getElementById(`quick-view-popup-${product.id}`);
      const mobilePopup = document.getElementById(`quick-view-popup-mobile-${product.id}`);
      
      if (desktopPopup && mobilePopup) {
        // Popup already exists, just show it
        return;
      }

      // Render popup HTML dynamically
      this.createPopupHTML(product);
    }

    createPopupHTML(product) {
      // Get product data
      const firstVariant = product.selected_or_first_available_variant || (product.variants && product.variants[0]) || null;
      const rating = product.metafields?.reviews?.rating?.value || 5;
      const ratingValue = Math.round(parseFloat(rating));
      const reviewsCount = product.metafields?.reviews?.rating_count?.value || 1;
      
      // Format price
      const price = this.formatMoney(product.price);
      const comparePrice = product.compare_at_price ? this.formatMoney(product.compare_at_price) : null;
      
      // Get image URL
      const imageUrl = product.featured_image || (product.images && product.images[0]) || '';
      const imageSrc = typeof imageUrl === 'string' ? imageUrl : (imageUrl.src || '');
      
      // Create stars HTML
      const starsHtml = Array.from({ length: 5 }, (_, i) => {
        const filled = i < ratingValue;
        return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 1L12.09 7.26L19 8.27L14 12.14L15.18 19.02L10 15.77L4.82 19.02L6 12.14L1 8.27L7.91 7.26L10 1Z" 
            fill="${filled ? '#FFD700' : '#E0E0E0'}" 
            stroke="${filled ? '#FFD700' : '#E0E0E0'}" 
            stroke-width="1"/>
        </svg>`;
      }).join('');

      // Create desktop popup
      const desktopPopupHTML = this.createDesktopPopupHTML(product, firstVariant, price, comparePrice, imageSrc, starsHtml, reviewsCount);
      const desktopDiv = document.createElement('div');
      desktopDiv.innerHTML = desktopPopupHTML;
      const desktopPopup = desktopDiv.firstElementChild;
      document.body.appendChild(desktopPopup);

      // Create mobile popup
      const mobilePopupHTML = this.createMobilePopupHTML(product, firstVariant, price, comparePrice, imageSrc, starsHtml, reviewsCount);
      const mobileDiv = document.createElement('div');
      mobileDiv.innerHTML = mobilePopupHTML;
      const mobilePopup = mobileDiv.firstElementChild;
      document.body.appendChild(mobilePopup);
    }

    createDesktopPopupHTML(product, firstVariant, price, comparePrice, imageSrc, starsHtml, reviewsCount) {
      const buyNowUrl = firstVariant ? `/cart/add?id=${firstVariant.id}&quantity=1&return_to=/checkout` : '#';
      const description = product.description ? this.escapeHtml(product.description).substring(0, 150) : '';
      const images = product.images || [];
      const imagesCount = images.length || 1;
      
      return `
        <div class="quick-view-popup quick-view-popup--desktop" id="quick-view-popup-${product.id}" data-product-id="${product.id}" role="dialog" aria-modal="true" aria-labelledby="quick-view-popup-title-${product.id}" data-quick-view-popup>
          <div class="quick-view-popup__overlay" data-popup-close></div>
          <div class="quick-view-popup__content">
            <div class="quick-view-popup__inner">
              <button class="quick-view-popup__close" data-popup-close aria-label="Close popup">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div class="quick-view-popup__image-section">
                ${imageSrc ? `
                  <div class="quick-view-popup__image-wrapper">
                    <img src="${imageSrc}" alt="${this.escapeHtml(product.title)}" class="quick-view-popup__image" loading="lazy">
                  </div>
                ` : `
                  <div class="quick-view-popup__image-wrapper quick-view-popup__image-wrapper--placeholder">
                    <svg viewBox="0 0 525.5 525.5" xmlns="http://www.w3.org/2000/svg"><path d="M324.5 212.5h-123c-5 0-9 4-9 9s4 9 9 9h123c5 0 9-4 9-9s-4-9-9-9z" fill="#999"/></svg>
                  </div>
                `}
              </div>
              <div class="quick-view-popup__details-section">
                <div class="quick-view-popup__details-content">
                  <div class="quick-view-popup__header">
                    <h2 class="quick-view-popup__title" id="quick-view-popup-title-${product.id}">${this.escapeHtml(product.title)}</h2>
                    <div class="quick-view-popup__rating">
                      <div class="quick-view-popup__stars">${starsHtml}</div>
                      <span class="quick-view-popup__reviews-count">${reviewsCount} review${reviewsCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div class="quick-view-popup__price">
                    ${comparePrice && parseFloat(product.compare_at_price) > parseFloat(product.price) 
                      ? `<span class="quick-view-popup__price--sale">${price}</span><span class="quick-view-popup__price--compare">${comparePrice}</span>`
                      : `<span>${price}</span>`
                    }
                  </div>
                  ${description ? `<div class="quick-view-popup__description">${description}</div>` : ''}
                  <div class="quantity-with-action-btns">
                  <div class="quick-view-popup__quantity 33">
                    <button type="button" class="quick-view-popup__quantity-btn quick-view-popup__quantity-btn--minus" data-quantity-minus>-</button>
                    <input type="number" class="quick-view-popup__quantity-input" value="1" min="1" data-quantity-input>
                    <button type="button" class="quick-view-popup__quantity-btn quick-view-popup__quantity-btn--plus" data-quantity-plus>+</button>
                  </div>
                  <div class="quick-view-popup__actions">
                    ${this.createAddToCartButton(product, firstVariant)}
                    <div class="quick-view-popup__action-icons">
                      ${this.createWishlistButton(product)}
                      ${this.createCompareButton(product)}
                    </div>
                  </div>
                  </div>
                  <div class="quick-view-popup__terms">
                    <label class="quick-view-popup__terms-label">
                      <input type="checkbox" class="quick-view-popup__terms-checkbox" data-terms-checkbox>
                      <span>I agree with <a href="/pages/terms-and-conditions" class="quick-view-popup__terms-link">Terms & Conditions</a></span>
                    </label>
                  </div>
                  ${firstVariant ? `<a href="${buyNowUrl}" class="quick-view-popup__buy-now-btn" data-buy-now>Buy It Now</a>` : ''}
                  <a href="${product.url}" class="quick-view-popup__view-details" data-view-details>View Full Details >></a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    createMobilePopupHTML(product, firstVariant, price, comparePrice, imageSrc, starsHtml, reviewsCount) {
      const buyNowUrl = firstVariant ? `/cart/add?id=${firstVariant.id}&quantity=1&return_to=/checkout` : '#';
      const description = product.description ? this.escapeHtml(product.description).substring(0, 150) : '';
      const images = product.images || [];
      const imagesCount = images.length || 1;
      
      return `
        <div class="quick-view-popup quick-view-popup--mobile" id="quick-view-popup-mobile-${product.id}" data-product-id="${product.id}" role="dialog" aria-modal="true" aria-labelledby="quick-view-popup-mobile-title-${product.id}" data-quick-view-popup>
          <div class="quick-view-popup__overlay" data-popup-close></div>
          <div class="quick-view-popup__content quick-view-popup__content--mobile">
            ${imagesCount > 1 ? `
              <div class="quick-view-popup__image-counter">
                <span data-current-image>1</span>/<span data-total-images>${imagesCount}</span>
              </div>
            ` : ''}
            <div class="quick-view-popup__inner quick-view-popup__inner--mobile">
              <button class="quick-view-popup__close" data-popup-close aria-label="Close popup">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div class="quick-view-popup__image-section quick-view-popup__image-section--mobile">
                ${imageSrc ? `
                  <div class="quick-view-popup__image-wrapper quick-view-popup__image-wrapper--mobile">
                    <img src="${imageSrc}" alt="${this.escapeHtml(product.title)}" class="quick-view-popup__image quick-view-popup__image--mobile" loading="lazy">
                  </div>
                ` : `
                  <div class="quick-view-popup__image-wrapper quick-view-popup__image-wrapper--mobile quick-view-popup__image-wrapper--placeholder">
                    <svg viewBox="0 0 525.5 525.5" xmlns="http://www.w3.org/2000/svg"><path d="M324.5 212.5h-123c-5 0-9 4-9 9s4 9 9 9h123c5 0 9-4 9-9s-4-9-9-9z" fill="#999"/></svg>
                  </div>
                `}
              </div>
              <div class="quick-view-popup__scrollable-content">
                <div class="quick-view-popup__header">
                  <h2 class="quick-view-popup__title quick-view-popup__title--mobile" id="quick-view-popup-mobile-title-${product.id}">${this.escapeHtml(product.title)}</h2>
                  <div class="quick-view-popup__rating">
                    <div class="quick-view-popup__stars">${starsHtml}</div>
                    <span class="quick-view-popup__reviews-count">${reviewsCount} review${reviewsCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div class="quick-view-popup__price quick-view-popup__price--mobile">
                  ${comparePrice && parseFloat(product.compare_at_price) > parseFloat(product.price) 
                    ? `<span class="quick-view-popup__price--sale">${price}</span><span class="quick-view-popup__price--compare">${comparePrice}</span>`
                    : `<span>${price}</span>`
                  }
                </div>
                ${description ? `<div class="quick-view-popup__description quick-view-popup__description--mobile">${description}</div>` : ''}
                <div class="quantity-with-action-btns">
                  <div class="quick-view-popup__quantity">
                    <button type="button" class="quick-view-popup__quantity-btn quick-view-popup__quantity-btn--minus" data-quantity-minus>-</button>
                    <input type="number" class="quick-view-popup__quantity-input" value="1" min="1" data-quantity-input>
                    <button type="button" class="quick-view-popup__quantity-btn quick-view-popup__quantity-btn--plus" data-quantity-plus>+</button>
                  </div>
                  <div class="quick-view-popup__actions quick-view-popup__actions--mobile">
                    ${this.createAddToCartButton(product, firstVariant)}
                    <div class="quick-view-popup__action-icons">
                      ${this.createWishlistButton(product)}
                      ${this.createCompareButton(product)}
                    </div>
                  </div>
                </div>
                <div class="quick-view-popup__terms quick-view-popup__terms--mobile">
                  <label class="quick-view-popup__terms-label">
                    <input type="checkbox" class="quick-view-popup__terms-checkbox" data-terms-checkbox>
                    <span>I agree with <a href="/pages/terms-and-conditions" class="quick-view-popup__terms-link">Terms & Conditions</a></span>
                  </label>
                </div>
                ${firstVariant ? `<a href="${buyNowUrl}" class="quick-view-popup__buy-now-btn quick-view-popup__buy-now-btn--mobile" data-buy-now>Buy It Now</a>` : ''}
                <a href="${product.url}" class="quick-view-popup__view-details quick-view-popup__view-details--mobile" data-view-details>View Full Details >></a>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    createAddToCartButton(product, variant) {
      if (!variant || !variant.id) {
        return '<button type="button" class="add-to-cart-button" disabled><span class="add-to-cart-button__text">Unavailable</span></button>';
      }
      
      const isAvailable = variant.available !== false;
      const disabledAttr = !isAvailable ? 'disabled="disabled" aria-disabled="true"' : '';
      
      return `
        <button 
          type="button"
          class="add-to-cart-button"
          data-add-to-cart
          data-product-id="${product.id}"
          data-variant-id="${variant.id}"
          ${disabledAttr}
          aria-label="${isAvailable ? `Add ${this.escapeHtml(product.title)} to cart` : 'Out of stock'}"
        >
          <span class="add-to-cart-button__text">${isAvailable ? 'Add To Cart' : 'Out of Stock'}</span>
          <span class="add-to-cart-button__loading" style="display: none;">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" stroke-dasharray="32" stroke-dashoffset="32">
                <animate attributeName="stroke-dasharray" dur="1.5s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                <animate attributeName="stroke-dashoffset" dur="1.5s" values="0;-16;-32;-32" repeatCount="indefinite"/>
              </circle>
            </svg>
          </span>
        </button>
      `;
    }

    createWishlistButton(product) {
      return `
        <button 
          type="button"
          class="wishlist-button"
          data-wishlist-button
          data-product-id="${product.id}"
          data-product-handle="${product.handle}"
          aria-label="Add ${this.escapeHtml(product.title)} to wishlist"
          title="Add to wishlist"
        >
          <svg class="wishlist-button__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" 
              stroke="currentColor" 
              stroke-width="2" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
          <svg class="wishlist-button__icon--filled" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: none;">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" 
              fill="currentColor"
            />
          </svg>
        </button>
      `;
    }

    createCompareButton(product) {
      // Try to get compare page URL from existing button on page, or use default
      const existingCompareButton = document.querySelector('[data-compare-button][data-compare-page-url]');
      const comparePageUrl = existingCompareButton?.getAttribute('data-compare-page-url') || '/pages/compare';
      
      return `
        <button 
          type="button"
          class="compare-button"
          data-compare-button
          data-product-id="${product.id}"
          data-product-handle="${product.handle}"
          data-compare-page-url="${comparePageUrl}"
          aria-label="Add ${this.escapeHtml(product.title)} to compare"
          title="Add to compare"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6h10M4 6l3-3M4 6l3 3"
                stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20 18H10M20 18l-3-3M20 18l-3 3"
                stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        </button>
      `;
    }

    formatMoney(cents) {
      const moneyFormat = window.Shopify?.shop?.money_format || '${{amount}}';
      const centsValue = typeof cents === 'string' ? parseFloat(cents) : cents;
      const amount = (centsValue / 100).toFixed(2);
      
      return moneyFormat
        .replace(/\{\{amount\}\}/g, amount)
        .replace(/\{\{amount_no_decimals\}\}/g, Math.round(centsValue / 100).toString())
        .replace(/\{\{amount_with_comma_separator\}\}/g, amount.replace('.', ','));
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    updateAddToCartQuantity(quantity) {
      // Update the quantity in add to cart button if needed
      // The add to cart functionality should handle this automatically
      // This could be used to update variant selection based on quantity if needed
    }

    initImageSlider(popup, product) {
      if (!popup || !product) return;
      
      const images = product.images || [];
      if (images.length <= 1) return; // No slider needed for single image
      
      const imageSection = popup.querySelector('.quick-view-popup__image-section');
      const imageWrapper = popup.querySelector('.quick-view-popup__image-wrapper');
      if (!imageSection || !imageWrapper) return;
      
      const isMobile = popup.classList.contains('quick-view-popup--mobile');
      
      // Create slider container
      const sliderContainer = document.createElement('div');
      sliderContainer.className = 'quick-view-popup__image-slider';
      sliderContainer.setAttribute('data-image-slider', '');
      
      // For mobile, maintain the wrapper structure with padding-top
      if (isMobile) {
        sliderContainer.className += ' quick-view-popup__image-wrapper--mobile';
        sliderContainer.style.position = 'relative';
        sliderContainer.style.width = '100%';
        sliderContainer.style.paddingTop = '100%';
        sliderContainer.style.overflow = 'hidden';
      }
      
      // Create images container
      const imagesContainer = document.createElement('div');
      imagesContainer.className = 'quick-view-popup__images-container';
      imagesContainer.style.transform = 'translateX(0)';
      
      if (isMobile) {
        imagesContainer.style.position = 'absolute';
        imagesContainer.style.top = '0';
        imagesContainer.style.left = '0';
        imagesContainer.style.width = '100%';
        imagesContainer.style.height = '100%';
      }
      
      // Add all images
      images.forEach((image, index) => {
        const imgWrapper = document.createElement('div');
        imgWrapper.className = `quick-view-popup__image-slide ${index === 0 ? 'active' : ''}`;
        imgWrapper.setAttribute('data-image-index', index);
        
        const img = document.createElement('img');
        const imageUrl = typeof image === 'string' ? image : (image.src || (image.url || ''));
        img.src = imageUrl;
        img.alt = product.title || '';
        img.className = isMobile ? 'quick-view-popup__image quick-view-popup__image--mobile' : 'quick-view-popup__image';
        img.loading = index === 0 ? 'eager' : 'lazy';
        
        if (isMobile) {
          img.style.position = 'absolute';
          img.style.top = '0';
          img.style.left = '0';
          img.style.width = '100%';
          img.style.height = '100%';
        }
        
        imgWrapper.appendChild(img);
        imagesContainer.appendChild(imgWrapper);
      });
      
      sliderContainer.appendChild(imagesContainer);
      
      // Add navigation arrows for desktop
      if (!isMobile) {
        const prevArrow = document.createElement('button');
        prevArrow.className = 'quick-view-popup__nav-arrow quick-view-popup__nav-arrow--prev';
        prevArrow.setAttribute('aria-label', 'Previous image');
        prevArrow.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        prevArrow.addEventListener('click', (e) => {
          e.stopPropagation();
          const currentIdx = parseInt(popup.getAttribute('data-current-image-index') || '0');
          this.changeImage(popup, currentIdx - 1, images.length);
        });
        
        const nextArrow = document.createElement('button');
        nextArrow.className = 'quick-view-popup__nav-arrow quick-view-popup__nav-arrow--next';
        nextArrow.setAttribute('aria-label', 'Next image');
        nextArrow.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        nextArrow.addEventListener('click', (e) => {
          e.stopPropagation();
          const currentIdx = parseInt(popup.getAttribute('data-current-image-index') || '0');
          this.changeImage(popup, currentIdx + 1, images.length);
        });
        
        sliderContainer.appendChild(prevArrow);
        sliderContainer.appendChild(nextArrow);
      }
      
      // Replace existing image wrapper with slider
      imageWrapper.parentNode.replaceChild(sliderContainer, imageWrapper);
      
      // Add swipe functionality for mobile
      if (isMobile) {
        this.initSwipe(sliderContainer, images.length);
      }
      
      // Store current index in popup
      popup.setAttribute('data-current-image-index', '0');
    }

    changeImage(popup, newIndex, totalImages) {
      if (!popup) return;
      
      const imagesContainer = popup.querySelector('.quick-view-popup__images-container');
      if (!imagesContainer) return;
      
      // Clamp index
      let index = newIndex;
      if (index < 0) index = totalImages - 1;
      if (index >= totalImages) index = 0;
      
      // Update transform
      imagesContainer.style.transform = `translateX(-${index * 100}%)`;
      
      // Update active slide
      const slides = popup.querySelectorAll('.quick-view-popup__image-slide');
      slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
      });
      
      // Update counter badge
      const counter = popup.querySelector('[data-current-image]');
      if (counter) {
        counter.textContent = index + 1;
      }
      
      // Store current index
      popup.setAttribute('data-current-image-index', index.toString());
    }

    initSwipe(container, totalImages) {
      if (!container) return;
      
      let startX = 0;
      let currentX = 0;
      let isDragging = false;
      const popup = container.closest('.quick-view-popup');
      
      container.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
      }, { passive: true });
      
      container.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX - startX;
      }, { passive: true });
      
      container.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        
        const threshold = 50;
        const currentIndex = parseInt(popup.getAttribute('data-current-image-index') || '0');
        
        if (Math.abs(currentX) > threshold) {
          if (currentX > 0) {
            // Swipe right - previous image
            this.changeImage(popup, currentIndex - 1, totalImages);
          } else {
            // Swipe left - next image
            this.changeImage(popup, currentIndex + 1, totalImages);
          }
        }
        
        currentX = 0;
      }, { passive: true });
    }

    closePopup() {
      if (this.currentPopup) {
        this.currentPopup.classList.remove('is-open');
        this.currentPopup = null;
      }
    }

    updateButtonStates(product) {
      if (!this.currentPopup) return;

      // Update wishlist button state
      try {
        const stored = localStorage.getItem('shopify_wishlist');
        const wishlist = stored ? JSON.parse(stored) : [];
        
        const wishlistButtons = this.currentPopup.querySelectorAll('[data-wishlist-button]');
        wishlistButtons.forEach(button => {
          const productHandle = button.getAttribute('data-product-handle') || product.handle;
          if (productHandle && wishlist.includes(String(productHandle))) {
            button.classList.add('is-active');
          } else {
            button.classList.remove('is-active');
          }
        });
      } catch (error) {
        console.error('Error updating wishlist button states:', error);
      }

      // Update compare button state
      try {
        const compareStored = localStorage.getItem('shopify_compare');
        const compareItems = compareStored ? JSON.parse(compareStored) : [];
        
        const compareButtons = this.currentPopup.querySelectorAll('[data-compare-button]');
        compareButtons.forEach(button => {
          const productHandle = button.getAttribute('data-product-handle') || product.handle;
          if (productHandle && compareItems.includes(String(productHandle))) {
            button.classList.add('is-active');
          } else {
            button.classList.remove('is-active');
          }
        });
      } catch (error) {
        console.error('Error updating compare button states:', error);
      }

      // Also update via compareManager if available (for consistency)
      if (window.compareManager && window.compareManager.updateButtonStates) {
        setTimeout(() => {
          window.compareManager.updateButtonStates();
        }, 50);
      }
    }
  }

  // Initialize on DOM ready
  let quickViewPopupInstance;
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      quickViewPopupInstance = new QuickViewPopup();
      window.quickViewPopup = quickViewPopupInstance;
    });
  } else {
    quickViewPopupInstance = new QuickViewPopup();
    window.quickViewPopup = quickViewPopupInstance;
  }

  // Re-initialize on section load (for theme editor)
  if (typeof Shopify !== 'undefined' && Shopify.designMode) {
    document.addEventListener('shopify:section:load', () => {
      if (!window.quickViewPopup) {
        quickViewPopupInstance = new QuickViewPopup();
        window.quickViewPopup = quickViewPopupInstance;
      }
    });
  }

})();

