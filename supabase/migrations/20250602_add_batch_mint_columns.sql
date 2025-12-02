-- Add columns for batch minting support
-- quantity: number of NFTs minted in a single transaction
-- token_reward_amount: scaled reward amount (base * quantity)

ALTER TABLE nft_mint_claims 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

ALTER TABLE nft_mint_claims 
ADD COLUMN IF NOT EXISTS token_reward_amount TEXT;

-- Add comment for documentation
COMMENT ON COLUMN nft_mint_claims.quantity IS 'Number of NFTs minted in this transaction (for batch mints)';
COMMENT ON COLUMN nft_mint_claims.token_reward_amount IS 'Scaled token reward amount in wei (base reward * quantity)';
