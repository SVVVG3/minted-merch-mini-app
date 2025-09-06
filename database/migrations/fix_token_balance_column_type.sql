-- Fix token_balance column type from BIGINT to NUMERIC
-- BIGINT max value: 9,223,372,036,854,775,807 (9.2 quintillion)
-- Large token balances in wei exceed this limit
-- NUMERIC can handle arbitrarily large numbers

DO $$
BEGIN
  -- Check if column exists and is BIGINT type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'token_balance' 
    AND data_type = 'bigint'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN token_balance TYPE NUMERIC;
    RAISE NOTICE 'Changed token_balance column type from BIGINT to NUMERIC';
  ELSE
    RAISE NOTICE 'token_balance column already correct type or does not exist';
  END IF;
END $$;
