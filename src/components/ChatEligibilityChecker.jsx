'use client';

import { useState } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';
import { checkChatEligibility, generateChatInvitation } from '@/lib/chatEligibility';

export function ChatEligibilityChecker() {
  const { user, isInFarcaster, getSessionToken, isReady } = useFarcaster();
  const [isChecking, setIsChecking] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState(null);
  const [invitationResult, setInvitationResult] = useState(null);

  const handleCheckEligibility = async () => {
    if (!user?.fid) {
      alert('Please connect to Farcaster first');
      return;
    }

    if (!isReady) {
      alert('Please wait for Farcaster to load');
      return;
    }

    setIsChecking(true);
    setEligibilityResult(null);
    setInvitationResult(null);

    try {
      // 🔒 SECURITY: Include JWT token for authentication
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        setEligibilityResult({
          eligible: false,
          message: 'Authentication required. Please refresh the page.'
        });
        setIsChecking(false);
        return;
      }

      // Get user's wallet addresses
      const response = await fetch(`/api/user-wallet-data?fid=${user.fid}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });
      const userData = await response.json();
      
      if (!userData.success || !userData.walletAddresses?.length) {
        setEligibilityResult({
          eligible: false,
          message: 'No wallet addresses found. Please connect your wallets in your Farcaster profile.'
        });
        return;
      }

      // Check eligibility
      const eligibility = await checkChatEligibility(userData.walletAddresses);
      setEligibilityResult(eligibility);

      // If eligible, generate invitation
      if (eligibility.eligible) {
        const invitation = await generateChatInvitation(user.fid, userData.walletAddresses);
        setInvitationResult(invitation);
      }

    } catch (error) {
      console.error('Error checking eligibility:', error);
      setEligibilityResult({
        eligible: false,
        message: 'Error checking eligibility. Please try again.',
        error: error.message
      });
    } finally {
      setIsChecking(false);
    }
  };

  if (!isInFarcaster || !user) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          $MINTEDMERCH Holders Chat
        </h3>
        <p className="text-gray-600 mb-4">
          Please open this app in Farcaster to check your chat eligibility
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          🎫 $MINTEDMERCH Holders Chat
        </h3>
        <p className="text-gray-600">
          Exclusive chat for holders of 50M+ $MINTEDMERCH tokens
        </p>
      </div>

      {!eligibilityResult && (
        <div className="text-center">
          <button
            onClick={handleCheckEligibility}
            disabled={isChecking}
            className="bg-[#3eb489] text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? 'Checking Eligibility...' : 'Check My Eligibility'}
          </button>
        </div>
      )}

      {eligibilityResult && (
        <div className={`p-4 rounded-lg mb-4 ${
          eligibilityResult.eligible 
            ? 'bg-green-100 border border-green-300' 
            : 'bg-red-100 border border-red-300'
        }`}>
          <div className="flex items-start space-x-3">
            <div className="text-2xl">
              {eligibilityResult.eligible ? '✅' : '❌'}
            </div>
            <div className="flex-1">
              <h4 className={`font-semibold ${
                eligibilityResult.eligible ? 'text-green-800' : 'text-red-800'
              }`}>
                {eligibilityResult.eligible ? 'You\'re Eligible!' : 'Not Eligible'}
              </h4>
              <p className={`text-sm ${
                eligibilityResult.eligible ? 'text-green-700' : 'text-red-700'
              }`}>
                {eligibilityResult.message}
              </p>
              
              {eligibilityResult.tokenBalance !== undefined && (
                <div className="mt-2 text-xs text-gray-600">
                  <p>Your Balance: {eligibilityResult.tokenBalance.toLocaleString()} tokens</p>
                  <p>Required: {eligibilityResult.requiredBalance.toLocaleString()} tokens</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {invitationResult && invitationResult.success && (
                  <div className="bg-blue-100 border border-blue-300 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">🎉 You're Eligible!</h4>
            
            {invitationResult.groupInviteLink && (
              <div className="bg-white p-3 rounded border mb-3">
                <p className="text-xs text-gray-500 mb-2">Join the $MINTEDMERCH Holders Chat:</p>
                <a 
                  href={invitationResult.groupInviteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center bg-[#3eb489] text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors font-medium"
                >
                  🚀 Join Group Chat
                </a>
              </div>
            )}

            <div className="bg-white p-3 rounded border mb-3">
              <p className="text-xs text-gray-500 mb-1">Invitation Token (for reference):</p>
              <code className="text-sm font-mono text-blue-800 break-all">
                {invitationResult.invitationToken}
              </code>
            </div>

            <div className="text-sm text-blue-700">
              <p className="font-medium mb-2">Instructions:</p>
              <ol className="list-decimal list-inside space-y-1">
                {invitationResult.instructions.map((instruction, index) => (
                  <li key={index}>{instruction}</li>
                ))}
              </ol>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-blue-600">
                💡 <strong>Note:</strong> Your token balance will be monitored automatically. You may be removed if it falls below 50M tokens.
              </p>
            </div>
          </div>
      )}

      <div className="mt-4 text-center">
        <button
          onClick={() => {
            setEligibilityResult(null);
            setInvitationResult(null);
          }}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Check Again
        </button>
      </div>
    </div>
  );
}
