import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { supabaseAdmin } from './supabase';

function getJWTSecret() {
  const secret = process.env.PARTNER_JWT_SECRET;
  
  if (!secret) {
    console.error('❌ CRITICAL: PARTNER_JWT_SECRET environment variable is not set!');
    throw new Error('Server configuration error: PARTNER_JWT_SECRET not configured');
  }
  
  return secret;
}

// Hash password
export async function hashPassword(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

// Generate JWT token for partner (Edge-compatible with jose)
export async function generatePartnerToken(partner) {
  const secret = getJWTSecret();
  const secretKey = new TextEncoder().encode(secret);
  
  const tokenPayload = {
    id: partner.id,
    email: partner.email,
    name: partner.name,
    fid: partner.fid,
    type: 'partner',
    partnerType: partner.partner_type || 'fulfillment' // 'fulfillment' or 'collab'
  };
  
  const token = await new SignJWT(tokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
  
  return token;
}

// Verify JWT token (Edge-compatible with jose)
export async function verifyPartnerToken(token) {
  if (!token) {
    return null;
  }
  
  try {
    const secret = getJWTSecret();
    const secretKey = new TextEncoder().encode(secret);
    
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256']
    });
    
    // Verify it's a partner token
    if (payload.type !== 'partner') {
      console.warn('⚠️ Token is not a partner token');
      return null;
    }
    
    return payload;
  } catch (error) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      console.warn('⚠️ Partner token expired');
    } else if (error.code === 'ERR_JWS_INVALID') {
      console.warn('⚠️ Invalid partner token');
    } else {
      console.error('❌ Error verifying partner token:', error);
    }
    return null;
  }
}

// Create new partner
export async function createPartner(email, password, name, fid = null, partnerType = 'fulfillment') {
  try {
    const hashedPassword = await hashPassword(password);
    
    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .insert({
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        name,
        fid,
        partner_type: partnerType
      })
      .select('id, email, name, fid, partner_type, is_active, created_at')
      .single();

    if (error) {
      console.error('Error creating partner:', error);
      return { success: false, error: error.message };
    }

    return { success: true, partner };
  } catch (error) {
    console.error('Error in createPartner:', error);
    return { success: false, error: 'Failed to create partner' };
  }
}

// Authenticate partner login
export async function authenticatePartner(email, password) {
  try {
    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !partner) {
      return { success: false, error: 'Invalid credentials' };
    }

    const isValidPassword = await verifyPassword(password, partner.password_hash);
    
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Don't return password hash
    const { password_hash, ...safePartner } = partner;
    const token = await generatePartnerToken(safePartner);

    return { 
      success: true, 
      partner: safePartner,
      token
    };
  } catch (error) {
    console.error('Error in authenticatePartner:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

// Get partner by ID
export async function getPartnerById(partnerId) {
  try {
    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .select('id, email, name, fid, is_active, created_at, updated_at')
      .eq('id', partnerId)
      .eq('is_active', true)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, partner };
  } catch (error) {
    console.error('Error in getPartnerById:', error);
    return { success: false, error: 'Failed to get partner' };
  }
}

// Get all partners (admin only)
export async function getAllPartners() {
  try {
    const { data: partners, error } = await supabaseAdmin
      .from('partners')
      .select(`
        id,
        email,
        name,
        fid,
        partner_type,
        is_active,
        created_at,
        updated_at,
        profiles (
          username,
          display_name,
          pfp_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, partners };
  } catch (error) {
    console.error('Error in getAllPartners:', error);
    return { success: false, error: 'Failed to get partners' };
  }
}

// Update partner status (activate/deactivate)
export async function updatePartnerStatus(partnerId, isActive) {
  try {
    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .update({ is_active: isActive })
      .eq('id', partnerId)
      .select('id, email, name, is_active')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, partner };
  } catch (error) {
    console.error('Error in updatePartnerStatus:', error);
    return { success: false, error: 'Failed to update partner status' };
  }
}

// Middleware to verify partner authentication
export function verifyPartnerAuth(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return { success: false, error: 'No token provided' };
  }

  const decoded = verifyPartnerToken(token);
  
  if (!decoded || decoded.type !== 'partner') {
    return { success: false, error: 'Invalid token' };
  }

  return { success: true, partner: decoded };
} 