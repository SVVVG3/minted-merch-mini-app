'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useFarcaster } from '@/lib/useFarcaster';
import { ShareDropdown } from './ShareDropdown';

function getSubmittedDesignShareContent(mockup) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = mockup?.id
    ? `${origin}/design/${mockup.id}?dropShare=1`
    : `${origin}/?collection=limited-drops`;

  return {
    customUrl: url,
    customText: 'I just submitted my design for the upcoming @mintedmerch Limited Drop!\n\nSubmit your own & cast your vote below ↓',
  };
}

const SHEET_BOTTOM_PADDING = 'pb-[max(2.5rem,env(safe-area-inset-bottom,0px))]';

export function DropSubmitDesignTray({
  open,
  onClose,
  onSubmitted,
  onVoteNow,
  getSessionToken,
}) {
  const { isInFarcaster } = useFarcaster();
  const [mockups, setMockups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMockup, setSelectedMockup] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const confirmSectionRef = useRef(null);

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

  useEffect(() => {
    if (!selectedMockup || !confirmSectionRef.current) return;
    const id = requestAnimationFrame(() => {
      confirmSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedMockup]);

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

  const shareContent = success && selectedMockup
    ? getSubmittedDesignShareContent(selectedMockup)
    : null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !submitting && onClose()}
      />
      <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl max-h-[85vh] flex flex-col ${success ? 'min-h-[50vh]' : ''}`}>
        <div className={`flex-1 overflow-y-auto px-5 pt-5 ${success ? '' : SHEET_BOTTOM_PADDING}`}>
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

          {success ? (
            <div className="text-center py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/GreenVerifiedCheck.png"
                alt="Design submitted"
                className="h-16 w-16 mx-auto mb-3 object-contain"
              />
              <h2 className="text-lg font-bold text-gray-900 mb-2">Design Submitted!</h2>
              <p className="text-sm text-gray-500">
                Your design is submitted & can now be voted to become the next Limited Drop. Vote for your favorite before the timer ends!
              </p>
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
                  <div ref={confirmSectionRef} className="pt-1">
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
                  </div>
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

        {success && (
          <div className={`px-5 pt-2 space-y-3 ${SHEET_BOTTOM_PADDING}`}>
            {shareContent && (
              <div className="w-full [&>div]:w-full [&_button]:w-full [&_button]:justify-center">
                <ShareDropdown
                  type="custom"
                  customUrl={shareContent.customUrl}
                  customText={shareContent.customText}
                  isInFarcaster={isInFarcaster}
                  buttonStyle="text"
                  buttonText="Share My Design"
                  dropUp
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => onVoteNow?.()}
              className="w-full py-3 bg-[#3eb489] text-white font-semibold rounded-2xl text-base"
            >
              Vote Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
