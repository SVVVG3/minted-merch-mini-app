'use client';

import { useState, useEffect, useRef } from 'react';
import { useFarcaster } from '@/lib/useFarcaster';

export const DROP_SUBMIT_LABEL = 'Submit for Limited Drop';

/**
 * Drop submission UI: status badge, submit button/menu item, and confirmation modal.
 * variant: "button" (full-width stack) | "menu-item" (Design Studio mockup menu)
 */
export function DropSubmitSection({ mockupId, variant = 'button', onMenuClose }) {
  const { getSessionToken, isInFarcaster, sessionToken } = useFarcaster();
  const sessionTokenRef = useRef(sessionToken);
  useEffect(() => { sessionTokenRef.current = sessionToken; }, [sessionToken]);

  const [currentDrop, setCurrentDrop] = useState(null);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!mockupId) return;
    const token = getSessionToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/drops/current?mockupId=${mockupId}`, { headers })
      .then(r => r.json())
      .then(data => {
        setCurrentDrop(data.drop || null);
        setExistingSubmission(data.submission || null);
      })
      .catch(() => {});
  }, [mockupId, getSessionToken, sessionToken]);

  const openModal = () => {
    onMenuClose?.();
    setModalOpen(true);
    setConfirmed(false);
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async () => {
    let token = sessionTokenRef.current || getSessionToken();
    if (!token && isInFarcaster) {
      for (let i = 0; i < 50 && !token; i++) {
        await new Promise(r => setTimeout(r, 100));
        token = sessionTokenRef.current;
      }
    }
    if (!token) { setError('Please connect your Farcaster account.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/drops/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mockupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit.');
      setSuccess(true);
      setExistingSubmission({ status: 'submitted', mockupId, isThisMockup: true });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentDrop || !mockupId) return null;

  const statusBadge = existingSubmission ? (
    <div className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-sm font-semibold ${
      existingSubmission.status === 'winner'
        ? 'bg-green-50 border-green-300 text-green-700'
        : existingSubmission.status === 'finalist'
        ? 'bg-purple-50 border-purple-300 text-purple-700'
        : existingSubmission.status === 'rejected'
        ? 'bg-red-50 border-red-300 text-red-700'
        : 'bg-amber-50 border-amber-300 text-amber-700'
    }`}>
      {existingSubmission.status === 'winner' && '🏆 Winner — Limited Drop!'}
      {existingSubmission.status === 'finalist' && '⭐ Finalist — Voting in Progress'}
      {existingSubmission.status === 'rejected' && '❌ Not Selected This Week'}
      {existingSubmission.status === 'submitted' && (
        existingSubmission.isThisMockup === false
          ? '✅ Submitted another design this week'
          : '✅ Submitted for Limited Drop'
      )}
    </div>
  ) : null;

  const trigger = existingSubmission ? (
    variant === 'menu-item' ? null : statusBadge
  ) : variant === 'menu-item' ? (
    <button
      onClick={openModal}
      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <span className="text-base flex-shrink-0">🎯</span>
      {DROP_SUBMIT_LABEL}
    </button>
  ) : (
    <button
      onClick={openModal}
      className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl transition-colors text-base"
    >
      🎯 {DROP_SUBMIT_LABEL}
    </button>
  );

  return (
    <>
      {trigger}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && setModalOpen(false)} />
          <div className="relative bg-white rounded-3xl px-6 pt-6 pb-7 shadow-2xl w-full max-w-sm">
            {success ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="text-5xl">🎉</div>
                <h2 className="text-lg font-bold text-gray-900">Submitted!</h2>
                <p className="text-sm text-gray-500">
                  Your design is in for the Limited Drop. Merch Moguls will vote on finalists — good luck!
                </p>
                <button
                  onClick={() => setModalOpen(false)}
                  className="mt-2 w-full py-3 bg-[#3eb489] text-white font-semibold rounded-2xl text-base"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-gray-900 mb-2">{DROP_SUBMIT_LABEL}</h2>
                <p className="text-sm text-gray-500 mb-5">
                  One submission per week. If selected, your design could become a limited drop (37 units) with a creator payout.
                </p>

                <label className="flex items-start gap-3 cursor-pointer mb-5">
                  <div
                    onClick={() => setConfirmed(v => !v)}
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

                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => setModalOpen(false)}
                    disabled={submitting}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!confirmed || submitting}
                    className="flex-1 py-3 bg-[#3eb489] disabled:opacity-40 text-white font-semibold rounded-2xl text-base"
                  >
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
