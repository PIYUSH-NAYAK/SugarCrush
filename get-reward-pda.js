const { PublicKey } = require('@solana/web3.js');

// Calculate reward_authority PDA
const programId = new PublicKey('BjcZsUV8h5A9GxgJuCUem28mWX7vLEfoqEWK113dhfsj');
const [rewardAuthorityPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('reward_authority')],
    programId
);

console.log('Reward Authority PDA:', rewardAuthorityPda.toBase58());
console.log('Bump:', bump);
console.log('\nNow run this command to transfer mint authority:');
console.log(`spl-token authorize Apt4pW3AjdYxLEDzCTzgrPBnwPazuvKCiTpe4TiEUFt1 mint ${rewardAuthorityPda.toBase58()}`);
