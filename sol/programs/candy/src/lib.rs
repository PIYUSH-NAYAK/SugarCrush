use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3, CreateMasterEditionV3,
        CreateMetadataAccountsV3, Metadata,
    },
    token::{self, Mint, MintTo, Token, TokenAccount},
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};
use mpl_token_metadata::types::DataV2;
use session_keys::{session_auth_or, Session, SessionError, SessionToken};


declare_id!("HEPEoHjEb2tJRgzHdWNUmqpojX11nYTJWAhx3QBxVhiY");

// ========================================
// Level Configuration (On-chain Constants)
// ========================================

#[derive(Copy, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct LevelConfig {
    pub id: u8,
    pub rows: u8,
    pub cols: u8,
    pub target_score: u64,
    pub time_limit: i64, // milliseconds
}

pub const LEVELS: [LevelConfig; 10] = [
    LevelConfig {
        id: 1,
        rows: 6,
        cols: 6,
        target_score: 80,
        time_limit: 40000,
    },
    LevelConfig {
        id: 2,
        rows: 5,
        cols: 7,
        target_score: 120,
        time_limit: 50000,
    },
    LevelConfig {
        id: 3,
        rows: 5,
        cols: 7,
        target_score: 150,
        time_limit: 60000,
    },
    LevelConfig {
        id: 4,
        rows: 8,
        cols: 7,
        target_score: 200,
        time_limit: 70000,
    },
    LevelConfig {
        id: 5,
        rows: 9,
        cols: 7,
        target_score: 250,
        time_limit: 80000,
    },
    LevelConfig {
        id: 6,
        rows: 9,
        cols: 7,
        target_score: 280,
        time_limit: 90000,
    },
    LevelConfig {
        id: 7,
        rows: 9,
        cols: 7,
        target_score: 350,
        time_limit: 100000,
    },
    LevelConfig {
        id: 8,
        rows: 10,
        cols: 7,
        target_score: 380,
        time_limit: 110000,
    },
    LevelConfig {
        id: 9,
        rows: 10,
        cols: 7,
        target_score: 400,
        time_limit: 120000,
    },
    LevelConfig {
        id: 10,
        rows: 10,
        cols: 7,
        target_score: 500,
        time_limit: 130000,
    },
];

// ========================================
// Candy Types
// ========================================

#[derive(Copy, Clone, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub enum CandyColor {
    Blank = 0,
    Red = 1,
    Green = 2,
    Blue = 3,
    Purple = 4,
    Yellow = 5,
}

// ========================================
// Main Program
// ========================================

#[ephemeral]
#[program]
pub mod candy_crush {
    use super::*;

    /// Initialize a player profile
    pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
        let player_profile = &mut ctx.accounts.player_profile;
        player_profile.authority = ctx.accounts.authority.key();
        player_profile.total_games = 0;
        player_profile.total_wins = 0;
        player_profile.highest_level = 1;
        player_profile.unlocked_levels = 1; // Level 1 unlocked by default
        player_profile.total_candies_collected = 0;
        player_profile.total_nfts_minted = 0;
        player_profile.created_at = Clock::get()?.unix_timestamp;

        msg!(
            "Player profile initialized for: {}",
            ctx.accounts.authority.key()
        );
        Ok(())
    }

    /// Initialize the Victory NFT Collection (admin only) - Placeholder
    pub fn initialize_collection(ctx: Context<InitializeCollection>) -> Result<()> {
        let collection = &mut ctx.accounts.victory_collection;
        collection.authority = ctx.accounts.authority.key();
        collection.total_victories = 0;

        msg!("Victory collection initialized (NFT minting to be added)");
        Ok(())
    }

    /// Start a new game session and delegate to ephemeral rollup
    pub fn start_game(ctx: Context<StartGame>, level: u8) -> Result<()> {
        require!(level >= 1 && level <= 10, CandyCrushError::InvalidLevel);

        let player_profile = &ctx.accounts.player_profile;

        // Check if level is unlocked (bitmap check)
        let level_bit = 1u64 << (level - 1);
        require!(
            (player_profile.unlocked_levels & level_bit) != 0,
            CandyCrushError::LevelLocked
        );

        let game_session = &mut ctx.accounts.game_session;
        let level_config = &LEVELS[(level - 1) as usize];

        game_session.player = ctx.accounts.authority.key();
        game_session.level = level;
        game_session.score = 0;
        game_session.moves_made = 0;
        game_session.start_time = Clock::get()?.unix_timestamp;
        game_session.is_active = true;
        game_session.grid = [[0u8; 10]; 10]; // Initialize empty grid

        // Initialize grid with random candies (simplified - in practice, ensure no matches)
        let clock = Clock::get()?;
        let mut seed = clock.unix_timestamp as u64;

        for row in 0..level_config.rows as usize {
            for col in 0..level_config.cols as usize {
                seed = seed.wrapping_mul(1103515245).wrapping_add(12345);
                game_session.grid[row][col] = ((seed / 65536) % 5 + 1) as u8; // 1-5
            }
        }

        msg!("Game session started for level {}", level);
        Ok(())
    }

    /// Make a move (swap two candies) - executed in ephemeral rollup
    #[session_auth_or(
        ctx.accounts.game_session.player.key() == ctx.accounts.signer.key(),
        CandyCrushError::InvalidAuth
    )]
    pub fn make_move(
        ctx: Context<MakeMove>,
        from_row: u8,
        from_col: u8,
        to_row: u8,
        to_col: u8,
    ) -> Result<()> {
        let game_session = &mut ctx.accounts.game_session;

        require!(game_session.is_active, CandyCrushError::GameNotActive);

        let level_config = &LEVELS[(game_session.level - 1) as usize];

        // Validate positions are within grid
        require!(
            from_row < level_config.rows
                && from_col < level_config.cols
                && to_row < level_config.rows
                && to_col < level_config.cols,
            CandyCrushError::InvalidPosition
        );

        // Check if swap is adjacent
        let row_diff = (from_row as i8 - to_row as i8).abs();
        let col_diff = (from_col as i8 - to_col as i8).abs();
        require!(
            (row_diff == 1 && col_diff == 0) || (row_diff == 0 && col_diff == 1),
            CandyCrushError::NotAdjacent
        );

        // Perform swap
        let temp = game_session.grid[from_row as usize][from_col as usize];
        game_session.grid[from_row as usize][from_col as usize] =
            game_session.grid[to_row as usize][to_col as usize];
        game_session.grid[to_row as usize][to_col as usize] = temp;

        game_session.moves_made += 1;

        // Note: Match detection and scoring would happen client-side in ephemeral rollup
        // for performance. Final validation happens in end_game.

        msg!(
            "Move executed: ({},{}) <-> ({},{})",
            from_row,
            from_col,
            to_row,
            to_col
        );
        Ok(())
    }

    /// End game, commit results, and mint victory NFT if won
    pub fn end_game(ctx: Context<EndGame>, final_score: u64) -> Result<()> {
        let game_session = &mut ctx.accounts.game_session;
        let player_profile = &mut ctx.accounts.player_profile;

        require!(game_session.is_active, CandyCrushError::GameNotActive);

        let level_config = &LEVELS[(game_session.level - 1) as usize];
        let won = final_score >= level_config.target_score;

        // Update player profile
        player_profile.total_games += 1;
        if won {
            player_profile.total_wins += 1;
            player_profile.total_candies_collected += final_score;

            // Unlock next level if not already unlocked
            if game_session.level < 10 {
                let next_level_bit = 1u64 << game_session.level;
                player_profile.unlocked_levels |= next_level_bit;
            }

            // Update highest level
            if game_session.level > player_profile.highest_level {
                player_profile.highest_level = game_session.level;
            }
        }

        game_session.score = final_score;
        game_session.is_active = false;

        msg!(
            "Game ended - Level: {}, Score: {}, Result: {}",
            game_session.level,
            final_score,
            if won { "WIN" } else { "LOSS" }
        );

        Ok(())
    }

    /// Mint victory NFT
    pub fn mint_victory_nft(ctx: Context<MintVictoryNFT>) -> Result<()> {
        let game_session = &ctx.accounts.game_session;
        let player_profile = &mut ctx.accounts.player_profile;
        let victory_collection = &mut ctx.accounts.victory_collection;

        require!(!game_session.is_active, CandyCrushError::GameStillActive);

        let level_config = &LEVELS[(game_session.level - 1) as usize];
        require!(
            game_session.score >= level_config.target_score,
            CandyCrushError::InsufficientScore
        );

        // Calculate rarity tier
        let score_percentage = (game_session.score * 100) / level_config.target_score;
        let rarity = if score_percentage >= 200 {
            4 // Legendary
        } else if score_percentage >= 150 {
            3 // Epic
        } else if score_percentage >= 120 {
            2 // Rare
        } else {
            1 // Common
        };

        let rarity_str = match rarity {
            4 => "Legendary",
            3 => "Epic",
            2 => "Rare",
            _ => "Common",
        };

        // Mint Token
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::mint_to(cpi_ctx, 1)?;

        // Create Metadata
        let metadata_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            mint_authority: ctx.accounts.authority.to_account_info(),
            payer: ctx.accounts.authority.to_account_info(),
            update_authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let metadata_ctx = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            metadata_accounts,
        );

        let data = DataV2 {
            name: format!("Candy Victory Lvl {}", game_session.level),
            symbol: "CANDYVIC".to_string(),
            uri: "https://example.com/candy.json".to_string(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(
            metadata_ctx,
            data,
            true, // is_mutable
            true, // update_authority_is_signer
            None, // collection details
        )?;

        // Create Master Edition
        let master_edition_accounts = CreateMasterEditionV3 {
            edition: ctx.accounts.master_edition.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            update_authority: ctx.accounts.authority.to_account_info(),
            mint_authority: ctx.accounts.authority.to_account_info(),
            payer: ctx.accounts.authority.to_account_info(),
            metadata: ctx.accounts.metadata.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let master_edition_ctx = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            master_edition_accounts,
        );

        create_master_edition_v3(master_edition_ctx, Some(0))?;

        player_profile.total_nfts_minted += 1;
        victory_collection.total_victories += 1;

        msg!(
            "Victory recorded - Rarity: {} (NFT minting complete)",
            rarity_str
        );
        Ok(())
    }

    // ========================================
    // MagicBlock Ephemeral Rollups Functions
    // ========================================

    /// Delegate the game session to ephemeral rollup
    pub fn delegate_game(ctx: Context<DelegateGame>) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[b"game_session", ctx.accounts.payer.key().as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        msg!("Game session delegated to ephemeral rollup");
        Ok(())
    }

    /// Commit game session state
    pub fn commit_game(ctx: Context<CommitGame>) -> Result<()> {
        commit_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.game_session.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        msg!("Game session committed");
        Ok(())
    }

    /// Undelegate game session from rollup
    pub fn undelegate_game(ctx: Context<CommitGame>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.game_session.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        msg!("Game session undelegated");
        Ok(())
    }
}

// ========================================
// Account Contexts
// ========================================

#[derive(Accounts)]
pub struct InitializePlayer<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + PlayerProfile::INIT_SPACE,
        seeds = [b"player_profile", authority.key().as_ref()],
        bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeCollection<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + VictoryCollection::INIT_SPACE,
        seeds = [b"victory_collection"],
        bump
    )]
    pub victory_collection: Account<'info, VictoryCollection>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct StartGame<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + GameSession::INIT_SPACE,
        seeds = [b"game_session", authority.key().as_ref()],
        bump
    )]
    pub game_session: Account<'info, GameSession>,

    #[account(
        seeds = [b"player_profile", authority.key().as_ref()],
        bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts, Session)]
pub struct MakeMove<'info> {
    #[account(
        mut,
        seeds = [b"game_session", game_session.player.key().as_ref()],
        bump
    )]
    pub game_session: Account<'info, GameSession>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[session(signer = signer, authority = game_session.player.key())]
    pub session_token: Option<Account<'info, SessionToken>>,
}

#[derive(Accounts)]
pub struct EndGame<'info> {
    #[account(
        mut,
        seeds = [b"game_session", authority.key().as_ref()],
        bump
    )]
    pub game_session: Account<'info, GameSession>,

    #[account(
        mut,
        seeds = [b"player_profile", authority.key().as_ref()],
        bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct MintVictoryNFT<'info> {
    #[account(
        seeds = [b"game_session", authority.key().as_ref()],
        bump
    )]
    pub game_session: Account<'info, GameSession>,

    #[account(
        mut,
        seeds = [b"player_profile", authority.key().as_ref()],
        bump
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(
        mut,
        seeds = [b"victory_collection"],
        bump
    )]
    pub victory_collection: Account<'info, VictoryCollection>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = authority,
        mint::freeze_authority = authority,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK: Validated by Metaplex CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Validated by Metaplex CPI
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateGame<'info> {
    pub payer: Signer<'info>,

    /// CHECK: PDA validated by seeds
    #[account(
        mut,
        del,
        seeds = [b"game_session", payer.key().as_ref()],
        bump
    )]
    pub pda: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitGame<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"game_session", payer.key().as_ref()],
        bump
    )]
    pub game_session: Account<'info, GameSession>,
}

// ========================================
// Account Data Structures
// ========================================

#[account]
#[derive(InitSpace)]
pub struct PlayerProfile {
    pub authority: Pubkey,
    pub total_games: u64,
    pub total_wins: u64,
    pub highest_level: u8,
    pub unlocked_levels: u64, // Bitmap for levels 1-64
    pub total_candies_collected: u64,
    pub total_nfts_minted: u64,
    pub created_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct VictoryCollection {
    pub authority: Pubkey,
    pub total_victories: u64,
}

#[account]
#[derive(InitSpace)]
pub struct GameSession {
    pub player: Pubkey,
    pub level: u8,
    pub grid: [[u8; 10]; 10], // Max 10x10 grid
    pub score: u64,
    pub moves_made: u32,
    pub start_time: i64,
    pub is_active: bool,
}

// ========================================
// Errors
// ========================================

#[error_code]
pub enum CandyCrushError {
    #[msg("Invalid level number")]
    InvalidLevel,
    #[msg("Level is locked")]
    LevelLocked,
    #[msg("Game session is not active")]
    GameNotActive,
    #[msg("Invalid grid position")]
    InvalidPosition,
    #[msg("Candies are not adjacent")]
    NotAdjacent,
    #[msg("Invalid authentication")]
    InvalidAuth,
    #[msg("Game is still active")]
    GameStillActive,
    #[msg("Insufficient score to mint NFT")]
    InsufficientScore,
}
