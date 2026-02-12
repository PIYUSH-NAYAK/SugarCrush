#!/bin/bash

# Setup Reward Token for Candy Crush Game
# This script creates an SPL token mint for game rewards

echo "🍭 Setting up Candy Crush Reward Token..."

# Set to devnet
solana config set --url devnet

# Get the reward authority PDA (this will be the mint authority)
# Seeds: ["reward_authority"]
# Program ID: BjcZsUV8h5A9GxgJuCUem28mWX7vLEfoqEWK113dhfsj

echo ""
echo "📝 Creating SPL Token Mint..."
echo "Note: The mint authority will need to be transferred to the reward_authority PDA after creation"

# Create the token mint (9 decimals for token rewards)
spl-token create-token --decimals 9

echo ""
echo "✅ Token mint created successfully!"
echo ""
echo "Important Next Steps:"
echo "1. Copy the mint address from above"
echo "2. Update REWARD_MINT_ADDRESS in src/services/solanaService.ts"
echo "3. Transfer mint authority to the reward_authority PDA using the command below:"
echo ""
echo "   # Get the reward_authority PDA first:"
echo "   # Seeds: ['reward_authority']"
echo "   # Program: BjcZsUV8h5A9GxgJuCUem28mWX7vLEfoqEWK113dhfsj"
echo ""
echo "   # Then run:"
echo "   spl-token authorize <MINT_ADDRESS> mint <REWARD_AUTHORITY_PDA>"
echo ""
