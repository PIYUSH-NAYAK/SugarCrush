#!/usr/bin/env node

/**
 * Initialize Victory NFT Collection
 * Run: node initialize_collection.js
 */

const { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } = require('@solana/web3.js');
const fs = require('fs');

const PROGRAM_ID = new PublicKey('6DKEYNYdiTB77U36Gnkp5kGYqJPmeUTyqJuavhejrF6t');

async function main() {
    console.log('🎮 Initializing Victory NFT Collection\n');

    // Connect to devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

    // Load authority wallet
    const authorityPath = process.env.HOME + '/.config/solana/id.json';
    const authority = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(authorityPath, 'utf8')))
    );

    console.log('🔑 Authority:', authority.publicKey.toBase58());

    // Check balance
    const balance = await connection.getBalance(authority.publicKey);
    console.log('💰 Balance:', (balance / 1e9).toFixed(4), 'SOL\n');

    if (balance < 0.01 * 1e9) {
        console.error('❌ Insufficient balance. Need at least 0.01 SOL');
        process.exit(1);
    }

    // Derive victory_collection PDA
    const [victoryCollectionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('victory_collection')],
        PROGRAM_ID
    );

    console.log('📦 Victory Collection PDA:', victoryCollectionPda.toBase58());

    // Check if already initialized
    const accountInfo = await connection.getAccountInfo(victoryCollectionPda);
    if (accountInfo) {
        console.log('✅ Collection already initialized!\n');
        console.log('Account details:');
        console.log('  - Owner:', accountInfo.owner.toBase58());
        console.log('  - Size:', accountInfo.data.length, 'bytes');
        console.log('  - Rent-exempt:', (accountInfo.lamports / 1e9).toFixed(6), 'SOL');
        return;
    }

    console.log('⚙️  Collection not found. Initializing...\n');

    // Build instruction discriminator (from IDL)
    const discriminator = Buffer.from([112, 62, 53, 139, 173, 152, 98, 93]);

    // Build instruction
    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: victoryCollectionPda, isSigner: false, isWritable: true },
            { pubkey: authority.publicKey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: discriminator, // No args, just discriminator
    });

    // Build and send transaction
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = authority.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    console.log('📤 Sending transaction...');
    const signature = await connection.sendTransaction(transaction, [authority]);

    console.log('⏳ Confirming transaction...');
    await connection.confirmTransaction(signature, 'confirmed');

    console.log('\n✅ SUCCESS! Victory collection initialized!\n');
    console.log('📝 Transaction:', signature);
    console.log('🔗 Explorer: https://explorer.solana.com/tx/' + signature + '?cluster=devnet');
    console.log('\n🎯 Players can now mint victory NFTs!');
}

main().catch(err => {
    console.error('\n❌ Error:', err.message);
    if (err.logs) {
        console.error('\nTransaction logs:');
        err.logs.forEach(log => console.error('  ', log));
    }
    process.exit(1);
});
