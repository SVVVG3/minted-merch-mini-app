import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './supabase';

const JWT_SECRET = process.env.PARTNER_JWT_SECRET || 'fallback-secret-change-in-production';

// Hash password
export async function hashPassword(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

// Generate JWT token for partner
export function generatePartnerToken(partner) {
  return jwt.sign(
    { 
      id: partner.id,
      email: partner.email,
      name: partner.name,
      fid: partner.fid,
      type: 'partner'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Verify JWT token
export function verifyPartnerToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Partner token verification failed:', error);
    return null;
  }
}

// Create new partner
export async function createPartner(email, password, name, fid = null) {
  try {
    const hashedPassword = await hashPassword(password);
    
    const { data: partner, error } = await supabaseAdmin
      .from('partners')
      .insert({
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        name,
        fid
      })
      .select('id, email, name, fid, is_active, created_at')
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
    const token = generatePartnerToken(safePartner);

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