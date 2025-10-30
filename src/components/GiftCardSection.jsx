import { useState } from 'react';

export default function GiftCardSection({ 
  onGiftCardApplied, 
  cartTotal = 0, 
  className = '' 
}) {
  const [giftCardCode, setGiftCardCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [appliedGiftCard, setAppliedGiftCard] = useState(null);
  const [error, setError] = useState('');

  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim()) {
      setError('Please enter a gift card code');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      console.log('🎁 Applying gift card:', giftCardCode);
      
      const response = await fetch('/api/gift-cards/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: giftCardCode.trim(),
          cartTotal: cartTotal
        })
      });

      const result = await response.json();
      console.log('🔍 Frontend received gift card validation response:', result);

      if (result.success && result.isValid) {
        console.log('✅ Gift card validation successful:', result);
        
        // SECURITY: Only store gift card info, discount will be calculated server-side
        const giftCardData = {
          ...result.giftCard,
          code: giftCardCode.trim(), // Store the actual code for server-side validation
          // Note: discount amounts are no longer returned for security
        };
        
        setAppliedGiftCard(giftCardData);
        setGiftCardCode('');
        setError('');
        
        // Notify parent component
        if (onGiftCardApplied) {
          onGiftCardApplied(giftCardData);
        }
      } else {
        console.log('❌ Gift card validation failed:', result);
        setError(result.error || 'Invalid gift card code');
      }
    } catch (error) {
      console.error('❌ Error applying gift card:', error);
      setError('Error applying gift card. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveGiftCard = () => {
    setAppliedGiftCard(null);
    setGiftCardCode('');
    setError('');
    
    // Notify parent component
    if (onGiftCardApplied) {
      onGiftCardApplied(null);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setGiftCardCode(value);
    if (error) setError('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleApplyGiftCard();
    }
  };

  return (
    <div className={`gift-card-section ${className}`}>
      <h3 className="text-lg font-semibold mb-3 text-gray-800">
        🎁 Gift Card
      </h3>
      
      {!appliedGiftCard ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter gift card code"
              value={giftCardCode}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isValidating}
            />
            <button
              onClick={handleApplyGiftCard}
              disabled={isValidating || !giftCardCode.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isValidating ? 'Validating...' : 'Apply'}
            </button>
          </div>
          
          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-2 rounded-md">
              ❌ {error}
            </div>
          )}
          
          <div className="text-xs text-gray-500">
            Enter your gift card code to apply it to your order
          </div>
        </div>
      ) : (
        <div className="applied-gift-card bg-green-50 p-4 rounded-md border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600 font-medium">✅ Gift Card Applied</span>
                {appliedGiftCard.code && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {appliedGiftCard.code}
                  </span>
                )}
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Gift Card Balance:</span>
                  <span className="font-medium">${appliedGiftCard.balance.toFixed(2)}</span>
                </div>
                
                {appliedGiftCard.discount && (
                  <>
                    <div className="flex justify-between">
                      <span>Discount Applied:</span>
                      <span className="font-medium text-green-600">
                        -${appliedGiftCard.discount.discountAmount.toFixed(2)}
                      </span>
                    </div>
                    
                    {appliedGiftCard.discount.remainingBalance > 0 && (
                      <div className="flex justify-between">
                        <span>Remaining Balance:</span>
                        <span className="font-medium">
                          ${appliedGiftCard.discount.remainingBalance.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                
                {appliedGiftCard.expiresAt && (
                  <div className="flex justify-between">
                    <span>Expires:</span>
                    <span className="text-xs">
                      {new Date(appliedGiftCard.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <button
              onClick={handleRemoveGiftCard}
              className="ml-3 text-red-500 hover:text-red-600 text-sm underline"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for gift card balance display
export function GiftCardBalance({ giftCard }) {
  if (!giftCard) return null;
  
  return (
    <div className="gift-card-balance text-sm text-gray-600">
      <div className="flex justify-between items-center">
        <span>Gift Card ({giftCard.code})</span>
        <span className="font-medium text-green-600">
          -${giftCard.discount?.discountAmount?.toFixed(2) || '0.00'}
        </span>
      </div>
    </div>
  );
}

// Helper component for gift card creation (admin/promotional use)
export function GiftCardCreator({ onGiftCardCreated, className = '' }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateGiftCard = async () => {
    const amountNum = parseFloat(amount);
    
    if (!amountNum || amountNum <= 0 || amountNum > 2000) {
      setError('Amount must be between $0.01 and $2,000');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch('/api/gift-cards/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          note: note.trim() || null
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Gift card created successfully:', result);
        
        setAmount('');
        setNote('');
        setError('');
        
        if (onGiftCardCreated) {
          onGiftCardCreated(result.giftCard);
        }
      } else {
        console.log('❌ Gift card creation failed:', result);
        setError(result.error || 'Failed to create gift card');
      }
    } catch (error) {
      console.error('❌ Error creating gift card:', error);
      setError('Error creating gift card. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`gift-card-creator ${className}`}>
      <h3 className="text-lg font-semibold mb-3 text-gray-800">
        🎁 Create Gift Card
      </h3>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount ($)
          </label>
          <input
            type="number"
            placeholder="25.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="0.01"
            max="2000"
            step="0.01"
            disabled={isCreating}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note (optional)
          </label>
          <input
            type="text"
            placeholder="Holiday gift, Birthday present, etc."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={100}
            disabled={isCreating}
          />
        </div>
        
        {error && (
          <div className="text-red-500 text-sm bg-red-50 p-2 rounded-md">
            ❌ {error}
          </div>
        )}
        
        <button
          onClick={handleCreateGiftCard}
          disabled={isCreating || !amount}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCreating ? 'Creating...' : 'Create Gift Card'}
        </button>
      </div>
    </div>
  );
} 