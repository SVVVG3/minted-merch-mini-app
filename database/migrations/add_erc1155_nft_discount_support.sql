-- Migration: Add ERC-1155 NFT support for token-gated discounts
-- Date: 2025-01-14
-- Description: Add nft_type and token_ids columns to support ERC-1155 NFT discounts
-- Status: APPLIED via Supabase MCP

-- Add nft_type column to distinguish between ERC-721 and ERC-1155
ALTER TABLE discount_codes
ADD COLUMN IF NOT EXISTS nft_type TEXT DEFAULT 'erc721';

-- Add token_ids column for ERC-1155 (which requires specific token IDs)
-- This is a JSONB array of token IDs to check
ALTER TABLE discount_codes
ADD COLUMN IF NOT EXISTS token_ids JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN discount_codes.nft_type IS 'NFT standard type: erc721 or erc1155. Default is erc721 for backwards compatibility.';
COMMENT ON COLUMN discount_codes.token_ids IS 'For ERC-1155 NFTs: array of token IDs to check. Not used for ERC-721.';

