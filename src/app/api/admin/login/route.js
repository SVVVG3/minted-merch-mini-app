import { NextResponse } from 'next/server';
import { validateAdminPassword, generateAdminToken } from '@/lib/adminAuth';

export async function POST(request) {
  try {
    const { password } = await request.json();
    
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }
    
    // Validate password using secure auth module
    const isValid = validateAdminPassword(password);
    
    if (isValid) {
      // Generate JWT token with 8-hour expiration
      const token = generateAdminToken({
        timestamp: Date.now(),
        // Add any other non-sensitive data you want in the token
      }, '8h');
      
      console.log('✅ Admin login successful');
      
      return NextResponse.json({ 
        success: true,
        token: token,
        expiresIn: '8h'
      });
    } else {
      console.warn('⚠️ Failed admin login attempt');
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('❌ Admin login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
} 