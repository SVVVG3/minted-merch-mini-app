'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export function DropSubmitDesignTray({
  open,
  onClose,
  onSubmitted,
  getSessionToken,
}) {
  const [mockups, setMockups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMockup, setSelectedMockup] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const loadMockups = useCallback(async () => {
    const token = getSessionToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/design-studio/my-mockups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load your designs.');
      setMockups(data.mockups || []);
    } catch (err) {
      setError(err.message || 'Could not load your designs.');
      setMockups([]);
    } finally {
      setLoading(false);
    }
  }, [getSessionToken]);

  useEffect(() => {
    if (!open) return;
    setSelectedMockup(null);
    setConfirmed(false);
    setError('');
    setSuccess(false);
    loadMockups();
  }, [open, loadMockups]);

  const handleSubmit = async () => {
    if (!selectedMockup) return;
    const token = getSessionToken();
    if (!token) {
      setError('Please sign in with Farcaster to submit.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/drops/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mockupId: selectedMockup.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit.');
      setSuccess(true);
      onSubmitted?.();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {success ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Submitted!</h2>
            <p className="text-sm text-gray-500 mb-5">
              Your design is in for the Limited Drop. Vote for your favorite — the community picks the winner when the timer ends.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-[#3eb489] text-white font-semibold rounded-2xl text-base"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-base font-bold text-gray-900 mb-1">Submit a Design</h2>
            <p className="text-sm text-gray-500 mb-4">
              Choose one of your Design Studio creations to enter this drop. One submission per person.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#3eb489]" />
              </div>
            ) : mockups.length === 0 ? (
              <div className="text-center py-8 px-2">
                <p className="text-sm text-gray-500 mb-4">
                  You don&apos;t have any saved designs yet. Create one in the Minted Merch Design Studio first.
                </p>
                <Link
                  href="/create"
                  onClick={onClose}
                  className="inline-block px-5 py-2.5 bg-[#3eb489] text-white font-semibold rounded-xl text-sm"
                >
                  Open Design Studio
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {mockups.map((mockup) => {
                    const isSelected = selectedMockup?.id === mockup.id;
                    return (
                      <button
                        key={mockup.id}
                        type="button"
                        onClick={() => {
                          setSelectedMockup(mockup);
                          setConfirmed(false);
                          setError('');
                        }}
                        className={`rounded-xl border-2 overflow-hidden text-left transition-colors ${
                          isSelected
                            ? 'border-[#3eb489] bg-[#3eb489]/5'
                            : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className="aspect-square bg-white">
                          {mockup.mockup_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mockup.mockup_url}
                              alt=""
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                              No preview
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-2">
                          <p className="text-xs font-semibold text-gray-800 capitalize truncate">
                            {mockup.product_type || 'Design'}
                            {mockup.color_name ? ` · ${mockup.color_name}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedMockup && (
                  <>
                    <label className="flex items-start gap-3 cursor-pointer mb-4">
                      <div
                        onClick={() => setConfirmed((v) => !v)}
                        className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                          confirmed ? 'bg-[#3eb489] border-[#3eb489]' : 'bg-white border-gray-300'
                        }`}
                      >
                        {confirmed && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-gray-700 leading-relaxed">
                        I confirm this is my original design, or I have explicit permission to use it on merchandise.
                      </span>
                    </label>

                    {error && (
                      <p className="text-red-500 text-sm mb-3">{error}</p>
                    )}

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!confirmed || submitting}
                      className="w-full py-3.5 bg-[#3eb489] hover:bg-[#359970] disabled:opacity-50 text-white font-semibold rounded-2xl text-sm transition-colors"
                    >
                      {submitting ? 'Submitting…' : 'Submit Selected Design'}
                    </button>
                  </>
                )}
              </>
            )}

            {!selectedMockup && error && (
              <p className="text-red-500 text-sm mt-3">{error}</p>
            )}

            {!success && (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="w-full mt-3 py-3 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-sm"
              >
                Cancel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
