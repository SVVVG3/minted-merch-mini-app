'use client';

import { useState, useEffect } from 'react';

export function CollectionSelector({ selectedCollection, onCollectionChange, className = '' }) {
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch collections on component mount
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/shopify/collections');
        if (!response.ok) {
          throw new Error(`Failed to fetch collections: ${response.status}`);
        }
        
        const collectionsData = await response.json();
        console.log('Fetched collections:', collectionsData);
        
        // Sort collections with "All Products" first, then collections with images in ABC order, then collections without images in ABC order
        const sortedCollections = (collectionsData || []).sort((a, b) => {
          // "All Products" always comes first
          if (a.title === 'All Products') return -1;
          if (b.title === 'All Products') return 1;
          
          // Check if collections have images
          const aHasImage = a.image?.url;
          const bHasImage = b.image?.url;
          
          // Collections with images come before collections without images
          if (aHasImage && !bHasImage) return -1;
          if (!aHasImage && bHasImage) return 1;
          
          // Within the same group (with/without images), sort alphabetically
          return a.title.localeCompare(b.title);
        });
        
        setCollections(sortedCollections);
      } catch (err) {
        console.error('Error fetching collections:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollections();
  }, []);

  // Handle collection selection
  const handleCollectionSelect = (collection) => {
    setIsOpen(false);
    onCollectionChange(collection);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest('.collection-selector')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className={`collection-selector ${className}`}>
        <div className="flex items-center justify-center h-10 px-3 bg-white border border-gray-300 rounded-lg">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3eb489]"></div>
          <span className="ml-2 text-sm text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`collection-selector ${className}`}>
        <div className="flex items-center h-10 px-3 bg-red-50 border border-red-300 rounded-lg">
          <span className="text-sm text-red-600">Error loading collections</span>
        </div>
      </div>
    );
  }

  const currentCollection = selectedCollection || collections[0];

  return (
    <div className={`collection-selector relative ${className}`}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full h-10 px-3 bg-white border border-white rounded-lg hover:border-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-colors shadow-sm"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {currentCollection?.image?.url && (
            <img
              src={currentCollection.image.url}
              alt={currentCollection.image.altText || currentCollection.title}
              className="w-5 h-5 rounded object-cover flex-shrink-0"
            />
          )}
          <span className="text-sm font-medium text-gray-900 truncate">
            {currentCollection?.title || 'Select Collection'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {collections.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              No collections available
            </div>
          ) : (
            collections.map((collection) => (
              <button
                key={collection.id}
                onClick={() => handleCollectionSelect(collection)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors border-l-4 ${
                  currentCollection?.id === collection.id
                    ? 'border-l-[#3eb489] bg-gray-50 text-[#3eb489] font-medium'
                    : 'border-l-transparent text-gray-900'
                }`}
                role="option"
                aria-selected={currentCollection?.id === collection.id}
              >
                <div className="flex items-center space-x-2">
                  {collection.image?.url && (
                    <img
                      src={collection.image.url}
                      alt={collection.image.altText || collection.title}
                      className="w-6 h-6 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="truncate font-medium">{collection.title}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
