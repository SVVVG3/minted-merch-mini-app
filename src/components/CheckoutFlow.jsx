'use client';

import { useState, useEffect } from 'react';
import { ErrorMessage } from './ErrorMessage';
import { OrderSuccess } from './OrderSuccess';
import { 
  checkFrameContext, 
  switchToBase, 
  sendUSDCPayment, 
  extractUserInfo 
} from '@/lib/payment';

export function CheckoutFlow({ checkoutData, onBack }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState({
    address1: '',
    city: '',
    province: '',
    country: 'US',
    zip: ''
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => {
    // Pre-fill user info from Farcaster context
    const prefillUserInfo = async () => {
      try {
        const context = await checkFrameContext();
        const userInfo = extractUserInfo(context);
        if (!firstName) setFirstName(userInfo.firstName);
        if (!lastName) setLastName(userInfo.lastName);
      } catch (err) {
        // Ignore errors here, user can still fill manually
      }
    };
    prefillUserInfo();
  }, []);

  useEffect(() => {
    // Initialize Google Places Autocomplete
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      const input = document.getElementById('autocomplete-address');
      if (input) {
        const autocomplete = new window.google.maps.places.Autocomplete(input, {
          types: ['address'],
          componentRestrictions: { country: 'us' }
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.address_components) {
            const addressComponents = place.address_components;
            const newAddress = {
              address1: '',
              city: '',
              province: '',
              country: 'US',
              zip: ''
            };

            // Parse address components
            let streetNumber = '';
            let streetName = '';

            addressComponents.forEach(component => {
              const types = component.types;
              if (types.includes('street_number')) {
                streetNumber = component.long_name;
              }
              if (types.includes('route')) {
                streetName = component.long_name;
              }
              if (types.includes('locality')) {
                newAddress.city = component.long_name;
              }
              if (types.includes('administrative_area_level_1')) {
                newAddress.province = component.short_name;
              }
              if (types.includes('postal_code')) {
                newAddress.zip = component.long_name;
              }
            });

            newAddress.address1 = `${streetNumber} ${streetName}`.trim();
            setAddress(newAddress);
          }
        });
      }
    }
  }, []);

  const validateForm = () => {
    if (!email || !address.address1 || !address.city || !address.zip) {
      setError('Please fill in all required fields');
      return false;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    setError('');
    
    if (!validateForm()) return;

    setLoading(true);
    setStatus('Creating order session...');
    
    try {
      // Create order session
      const sessionResponse = await fetch('/api/order-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: checkoutData.product.id,
          variantId: checkoutData.variant.id,
          variantPrice: checkoutData.variant.price,
          quantity: checkoutData.quantity,
          customer: {
            email,
            firstName: firstName || 'Farcaster',
            lastName: lastName || 'User'
          },
          shippingAddress: address
        })
      });

      const sessionData = await sessionResponse.json();
      
      if (!sessionResponse.ok) {
        throw new Error(sessionData.error || 'Failed to create order session');
      }

      // Check frame context and switch to Base
      setStatus('Preparing wallet...');
      await checkFrameContext();
      await switchToBase();

      // Initiate payment
      setStatus('Confirming payment...');
      const paymentRecipient = process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS;
      const txHash = await sendUSDCPayment(checkoutData.variant.price, paymentRecipient);

      // Verify payment and create order
      setStatus('Creating order...');
      const verifyResponse = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          transactionHash: txHash
        })
      });

      const verifyData = await verifyResponse.json();
      
      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      // Success!
      setOrderDetails(verifyData.order);
      setOrderComplete(true);
      
    } catch (error) {
      console.error('Payment error:', error);
      setError(error.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  if (orderComplete && orderDetails) {
    return <OrderSuccess orderDetails={orderDetails} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={onBack} className="mr-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Checkout</h1>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h2 className="font-medium text-gray-900 mb-2">Order Summary</h2>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{checkoutData.product.title}</span>
            <span className="font-medium">${parseFloat(checkoutData.variant.price).toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <h2 className="font-medium text-gray-900">Contact Information</h2>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
          <h2 className="font-medium text-gray-900">Shipping Address</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street Address *
            </label>
            <input
              type="text"
              value={address.address1}
              onChange={(e) => setAddress({...address, address1: e.target.value})}
              placeholder="123 Main St"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              id="autocomplete-address"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City *
              </label>
              <input
                type="text"
                value={address.city}
                onChange={(e) => setAddress({...address, city: e.target.value})}
                placeholder="New York"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                value={address.province}
                onChange={(e) => setAddress({...address, province: e.target.value})}
                placeholder="NY"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ZIP Code *
            </label>
            <input
              type="text"
              value={address.zip}
              onChange={(e) => setAddress({...address, zip: e.target.value})}
              placeholder="10001"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>

        {error && <ErrorMessage message={error} type="error" />}
        {status && <ErrorMessage message={status} type="info" />}

        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing...' : `Pay ${parseFloat(checkoutData.variant.price).toFixed(2)} USDC`}
        </button>
      </main>
    </div>
  );
}