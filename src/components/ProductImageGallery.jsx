'use client';

import React, { useState, useEffect, useCallback } from 'react';

/**
 * ProductImageGallery - Main gallery component for displaying product images
 * 
 * Features:
 * - Image carousel with touch/swipe navigation
 * - Thumbnail navigation strip
 * - Zoom/full-screen functionality
 * - Variant image switching
 * - Mobile-first responsive design
 * - Accessibility support
 * 
 * Props:
 * - images: Array of image objects from Shopify (product.images.edges)
 * - selectedVariant: Currently selected product variant (for variant-specific images)
 * - productTitle: Product title for alt text fallback
 * - className: Additional CSS classes
 * - onImageChange: Callback when active image changes
 */
export function ProductImageGallery({ 
  images = [], 
  selectedVariant = null,
  productTitle = '',
  className = '',
  onImageChange = null 
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Process images from Shopify format and ensure stable array
  const processedImages = images.map(edge => edge.node);
  
  // Add variant image if it exists and isn't already in the list
  const allImages = React.useMemo(() => {
    const imageList = [...processedImages];
    if (selectedVariant?.image) {
      const variantImageExists = imageList.some(img => img.url === selectedVariant.image.url);
      if (!variantImageExists) {
        imageList.unshift(selectedVariant.image); // Add variant image at the beginning
      }
    }
    return imageList;
  }, [processedImages, selectedVariant?.image]);
  
  // Current active image
  const currentImage = allImages[currentImageIndex] || null;
  
  // Debug logging
  console.log('Gallery state:', {
    currentImageIndex,
    totalImages: allImages.length,
    currentImageUrl: currentImage?.url,
    allImageUrls: allImages.map(img => img.url)
  });
  
  // Update current image when variant changes
  useEffect(() => {
    if (selectedVariant?.image) {
      const variantImageIndex = allImages.findIndex(img => img.url === selectedVariant.image.url);
      if (variantImageIndex !== -1) {
        setCurrentImageIndex(variantImageIndex);
      }
    }
  }, [selectedVariant?.image, allImages]);

  // Notify parent when image changes
  useEffect(() => {
    if (onImageChange && currentImage) {
      onImageChange(currentImage, currentImageIndex);
    }
  }, [currentImage, currentImageIndex, onImageChange]);

  // Navigation functions
  const goToImage = useCallback((index) => {
    console.log('goToImage called with index:', index, 'total images:', allImages.length);
    if (index >= 0 && index < allImages.length) {
      setIsLoading(true); // Reset loading state for new image
      setCurrentImageIndex(index);
      console.log('Updated currentImageIndex to:', index);
    }
  }, [allImages.length]);

  const goToPrevious = useCallback(() => {
    const prevIndex = currentImageIndex > 0 ? currentImageIndex - 1 : allImages.length - 1;
    goToImage(prevIndex);
  }, [currentImageIndex, allImages.length, goToImage]);

  const goToNext = useCallback(() => {
    const nextIndex = currentImageIndex < allImages.length - 1 ? currentImageIndex + 1 : 0;
    goToImage(nextIndex);
  }, [currentImageIndex, allImages.length, goToImage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isFullScreen) {
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault();
            goToPrevious();
            break;
          case 'ArrowRight':
            event.preventDefault();
            goToNext();
            break;
          case 'Escape':
            event.preventDefault();
            setIsFullScreen(false);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen, goToPrevious, goToNext]);

  // Touch/swipe handling for mobile
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
  };

  // Handle image load
  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // Handle image error
  const handleImageError = () => {
    setIsLoading(false);
    console.warn('Failed to load image:', currentImage?.url);
  };

  // If no images available, show placeholder
  if (!allImages || allImages.length === 0) {
    return (
      <div className={`aspect-square bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No images available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main Image Container */}
      <div 
        className="aspect-square bg-white relative overflow-hidden rounded-lg"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="img"
        aria-label={currentImage?.altText || productTitle}
      >
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3eb489]"></div>
          </div>
        )}

        {/* Main Image */}
        {currentImage && (
          <img
            key={currentImage.url} // Force re-render when URL changes
            src={currentImage.url}
            alt={currentImage.altText || productTitle}
            className="w-full h-full object-contain transition-opacity duration-300"
            style={{ opacity: isLoading ? 0 : 1 }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onClick={() => setIsFullScreen(true)}
          />
        )}

        {/* Navigation Arrows - Hidden for cleaner look */}
        {/* Removed overlay buttons as requested */}
      </div>

      {/* Thumbnail Navigation - Only show if multiple images */}
      {allImages.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2" role="tablist">
          {allImages.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              onClick={() => {
                console.log('Thumbnail clicked, index:', index, 'currentImageIndex:', currentImageIndex);
                goToImage(index);
              }}
              className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all duration-200 ${
                index === currentImageIndex 
                  ? 'border-[#3eb489] ring-2 ring-[#3eb489]/30' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              role="tab"
              aria-selected={index === currentImageIndex}
              aria-label={`View image ${index + 1}`}
            >
              <img
                src={image.url}
                alt={image.altText || `${productTitle} - Image ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Full Screen Modal */}
      {isFullScreen && currentImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={() => setIsFullScreen(false)}
        >
          <div className="relative max-w-full max-h-full p-4">
            {/* Close Button */}
            <button
              onClick={() => setIsFullScreen(false)}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-10"
              aria-label="Close full screen"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Full Screen Image */}
            <img
              src={currentImage.url}
              alt={currentImage.altText || productTitle}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Full Screen Navigation */}
            {allImages.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-3"
                  aria-label="Previous image"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); goToNext(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-3"
                  aria-label="Next image"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* Full Screen Counter */}
            {allImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                {currentImageIndex + 1} / {allImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 