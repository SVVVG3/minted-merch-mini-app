'use client';

import { useState, useEffect, useRef } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';

export function ShippingForm({ onShippingChange, initialShipping = null }) {
  const { getDisplayName, getUsername } = useFarcaster();
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  
  const [shipping, setShipping] = useState({
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    province: '', // state/province
    zip: '',
    country: 'US',
    phone: '',
    email: ''
  });

  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(false);
  const [googleMapsStatus, setGoogleMapsStatus] = useState('loading');

  // Pre-fill name from Farcaster if available
  useEffect(() => {
    const displayName = getDisplayName();
    const username = getUsername();
    
    if (displayName && !shipping.firstName) {
      // Try to split display name into first/last
      const nameParts = displayName.split(' ');
      setShipping(prev => ({
        ...prev,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || ''
      }));
    } else if (username && !shipping.firstName) {
      // Use username as first name if no display name
      setShipping(prev => ({
        ...prev,
        firstName: username
      }));
    }
  }, [getDisplayName, getUsername]);

  // Load initial shipping data if provided
  useEffect(() => {
    if (initialShipping) {
      setShipping(initialShipping);
    }
  }, [initialShipping]);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    const initializeAutocomplete = () => {
      console.log('Checking Google Maps availability:', {
        hasWindow: typeof window !== 'undefined',
        hasGoogle: typeof window !== 'undefined' && !!window.google,
        hasMaps: typeof window !== 'undefined' && !!window.google?.maps,
        hasPlaces: typeof window !== 'undefined' && !!window.google?.maps?.places,
        hasRef: !!addressInputRef.current,
        hasAutocomplete: !!autocompleteRef.current,
        googleMapsLoaded: typeof window !== 'undefined' && !!window.googleMapsLoaded
      });

      if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places && addressInputRef.current && !autocompleteRef.current) {
        try {
          console.log('Initializing Google Maps autocomplete...');
          setGoogleMapsStatus('initializing');
          
          autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
            types: ['address'],
            componentRestrictions: { country: ['AU', 'AT', 'BE', 'CA', 'CZ', 'DK', 'FI', 'FR', 'DE', 'HK', 'IE', 'IL', 'IT', 'JP', 'MY', 'NL', 'NZ', 'NO', 'PL', 'PT', 'SG', 'KR', 'ES', 'SE', 'CH', 'AE', 'GB', 'US'] }
          });

          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current.getPlace();
            if (place && place.address_components) {
              console.log('Place selected:', place);
              populateAddressFromPlace(place);
            }
          });
          
          console.log('Google Maps autocomplete initialized successfully');
          setGoogleMapsStatus('ready');
        } catch (error) {
          console.error('Error initializing Google Maps autocomplete:', error);
          setGoogleMapsStatus('error');
        }
      } else {
        console.log('Google Maps API not ready yet, retrying...');
        setGoogleMapsStatus('waiting');
        // Retry after a short delay
        setTimeout(initializeAutocomplete, 500);
      }
    };

    // Add a small delay to ensure the script has loaded
    const timer = setTimeout(initializeAutocomplete, 1000);
    
    return () => {
      clearTimeout(timer);
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  // Populate address fields from Google Places result
  const populateAddressFromPlace = (place) => {
    const addressComponents = place.address_components;
    const newShipping = { ...shipping };

    // Extract address components
    let streetNumber = '';
    let route = '';
    
    addressComponents.forEach(component => {
      const types = component.types;
      
      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (types.includes('route')) {
        route = component.long_name;
      } else if (types.includes('locality')) {
        newShipping.city = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        newShipping.province = component.short_name;
      } else if (types.includes('postal_code')) {
        newShipping.zip = component.long_name;
      } else if (types.includes('country')) {
        newShipping.country = component.short_name;
      }
    });

    // Combine street number and route for address1
    newShipping.address1 = `${streetNumber} ${route}`.trim();

    setShipping(newShipping);
    const valid = validateForm(newShipping);
    onShippingChange(newShipping, valid);
  };

  // Validation function
  const validateForm = (data) => {
    const newErrors = {};
    
    if (!data.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!data.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!data.address1.trim()) newErrors.address1 = 'Address is required';
    if (!data.city.trim()) newErrors.city = 'City is required';
    if (!data.province.trim()) newErrors.province = 'State/Province is required';
    if (!data.zip.trim()) newErrors.zip = 'ZIP/Postal code is required';
    if (!data.country.trim()) newErrors.country = 'Country is required';
    
    // Email validation (optional but must be valid if provided)
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Phone validation (optional but must be valid if provided)
    if (data.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(data.phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    const valid = Object.keys(newErrors).length === 0;
    setIsValid(valid);
    return valid;
  };

  // Handle input changes
  const handleChange = (field, value) => {
    const updatedShipping = { ...shipping, [field]: value };
    setShipping(updatedShipping);
    
    // Validate and notify parent
    const valid = validateForm(updatedShipping);
    onShippingChange(updatedShipping, valid);
  };

  // US States for dropdown
  const US_STATES = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
  ];

  const COUNTRIES = [
    { code: 'AU', name: 'Australia' },
    { code: 'AT', name: 'Austria' },
    { code: 'BE', name: 'Belgium' },
    { code: 'CA', name: 'Canada' },
    { code: 'CZ', name: 'Czechia' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'HK', name: 'Hong Kong SAR' },
    { code: 'IE', name: 'Ireland' },
    { code: 'IL', name: 'Israel' },
    { code: 'IT', name: 'Italy' },
    { code: 'JP', name: 'Japan' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'NO', name: 'Norway' },
    { code: 'PL', name: 'Poland' },
    { code: 'PT', name: 'Portugal' },
    { code: 'SG', name: 'Singapore' },
    { code: 'KR', name: 'South Korea' },
    { code: 'ES', name: 'Spain' },
    { code: 'SE', name: 'Sweden' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Shipping Address</h3>
      
      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            value={shipping.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489] ${
              errors.firstName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="First name"
          />
          {errors.firstName && (
            <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            value={shipping.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489] ${
              errors.lastName ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Last name"
          />
          {errors.lastName && (
            <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Address Fields */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address *
          {googleMapsStatus !== 'ready' && (
            <span className="text-xs text-gray-500 ml-2">
              (Maps: {googleMapsStatus})
            </span>
          )}
        </label>
        <input
          type="text"
          value={shipping.address1}
          onChange={(e) => handleChange('address1', e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489] ${
            errors.address1 ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder={googleMapsStatus === 'ready' ? 'Start typing your address...' : 'Street address'}
          ref={addressInputRef}
        />
        {errors.address1 && (
          <p className="text-red-500 text-xs mt-1">{errors.address1}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Apartment, suite, etc. (optional)
        </label>
        <input
          type="text"
          value={shipping.address2}
          onChange={(e) => handleChange('address2', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489]"
          placeholder="Apartment, suite, etc."
        />
      </div>

      {/* City, State, ZIP */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City *
          </label>
          <input
            type="text"
            value={shipping.city}
            onChange={(e) => handleChange('city', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489] ${
              errors.city ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="City"
          />
          {errors.city && (
            <p className="text-red-500 text-xs mt-1">{errors.city}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {shipping.country === 'US' ? 'State' : 'Province'} *
          </label>
          {shipping.country === 'US' ? (
            <select
              value={shipping.province}
              onChange={(e) => handleChange('province', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489] ${
                errors.province ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select state</option>
              {US_STATES.map(state => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={shipping.province}
              onChange={(e) => handleChange('province', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489] ${
                errors.province ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Province"
            />
          )}
          {errors.province && (
            <p className="text-red-500 text-xs mt-1">{errors.province}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {shipping.country === 'US' ? 'ZIP Code' : 'Postal Code'} *
          </label>
          <input
            type="text"
            value={shipping.zip}
            onChange={(e) => handleChange('zip', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489] ${
              errors.zip ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={shipping.country === 'US' ? 'ZIP code' : 'Postal code'}
          />
          {errors.zip && (
            <p className="text-red-500 text-xs mt-1">{errors.zip}</p>
          )}
        </div>
      </div>

      {/* Country */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Country *
        </label>
        <select
          value={shipping.country}
          onChange={(e) => handleChange('country', e.target.value)}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489] ${
            errors.country ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          {COUNTRIES.map(country => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
        {errors.country && (
          <p className="text-red-500 text-xs mt-1">{errors.country}</p>
        )}
      </div>

      {/* Contact Information */}
      <div className="border-t pt-4">
        <h4 className="text-md font-medium mb-3">Contact Information</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email (optional)
          </label>
          <input
            type="email"
            value={shipping.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489] ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="email@example.com"
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            For order updates and shipping notifications
          </p>
        </div>

        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone (optional)
          </label>
          <input
            type="tel"
            value={shipping.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3eb489] ${
              errors.phone ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="+1 (555) 123-4567"
          />
          {errors.phone && (
            <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            For delivery coordination
          </p>
        </div>
      </div>
    </div>
  );
} 