'use client';

import { useState } from 'react';

export default function RecoverPage() {
  const [fid, setFid] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const recoverSpin = async () => {
    if (!fid || parseInt(fid) <= 0) {
      setResult({ success: false, error: 'Please enter a valid FID' });
      return;
    }

    setLoading(true);
    setResult({ loading: true, message: 'Processing recovery...' });

    try {
      const response = await fetch('/api/recover-stuck-spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userFid: parseInt(fid) })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ 
        success: false, 
        error: error.message || 'Network error. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '600px',
        width: '100%'
      }}>
        <h1 style={{ color: '#667eea', marginTop: 0 }}>
          🔧 Spin Recovery Tool
        </h1>

        <div style={{
          background: '#d1ecf1',
          color: '#0c5460',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #bee5eb'
        }}>
          <strong>When to use this:</strong><br />
          If you tried to spin and got &quot;Already spun this app-day&quot; error,
          use this tool to claim your missing points.
        </div>

        <label htmlFor="fid" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
          Your Farcaster ID (FID):
        </label>
        <input
          type="number"
          id="fid"
          value={fid}
          onChange={(e) => setFid(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && recoverSpin()}
          placeholder="Enter your FID (e.g., 466111)"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            border: '2px solid #ddd',
            borderRadius: '8px',
            boxSizing: 'border-box',
            marginBottom: '10px'
          }}
        />

        <button
          onClick={recoverSpin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '18px',
            fontWeight: 'bold',
            color: 'white',
            background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '10px'
          }}
        >
          {loading ? '⏳ Recovering...' : '🔄 Recover Stuck Spin'}
        </button>

        {result && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            borderRadius: '8px',
            border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
            background: result.loading ? '#d1ecf1' : (result.success ? '#d4edda' : '#f8d7da'),
            color: result.loading ? '#0c5460' : (result.success ? '#155724' : '#721c24')
          }}>
            {result.loading ? (
              <div>{result.message}</div>
            ) : result.success ? (
              <>
                <strong>✅ Success!</strong><br /><br />
                Points Earned: <strong>{result.data.pointsEarned}</strong><br />
                New Streak: <strong>{result.data.newStreak} days</strong><br />
                Total Points: <strong>{result.data.totalPoints}</strong><br /><br />
                Your spin has been recovered! 🎉
              </>
            ) : (
              <>
                <strong>❌ {result.alreadyCheckedIn ? 'Already Completed' : 'Recovery Failed'}</strong><br /><br />
                {result.error}<br /><br />
                {result.alreadyCheckedIn && 'Your spin was already completed and points were awarded.'}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

