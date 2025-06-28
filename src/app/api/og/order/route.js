import { ImageResponse } from '@vercel/og';
import React from 'react';

// Use edge runtime for ImageResponse compatibility
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber') || 'ORDER-123';
    const total = searchParams.get('total') || '0.00';
    
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
          }}
        >
          <div style={{ fontSize: '120px', marginBottom: '40px' }}>
            ✅
          </div>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            Order Complete!
          </div>
          <div style={{ fontSize: '36px', color: '#3eb489', marginBottom: '30px' }}>
            {orderNumber}
          </div>
          <div style={{ fontSize: '24px', color: '#888' }}>
            Total: ${parseFloat(total).toFixed(2)}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 800,
      }
    );
    
  } catch (error) {
    console.error('OG Error:', error);
    
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
} 