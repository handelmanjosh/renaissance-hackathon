use anchor_lang::prelude::{borsh::{BorshDeserialize, BorshSerialize}, *};

declare_id!("6Vx6kqd7ngW341teSFzBPnrEGD8fKPxiwvBDqdQRKK8o");
#[program]
pub mod p2p_contract_solana {

    use super::*;
    use anchor_lang::solana_program::clock::Clock;

    pub fn create_room(ctx: Context<CreateRoom>) -> Result<()> {
        let room = &mut ctx.accounts.room;
        room.player1 = ctx.accounts.user.key();
        room.player2 = Pubkey::default();
        room.winner = 0;
        Ok(())
    }
    pub fn join_room(ctx: Context<JoinRoom>) -> Result<()> {
        let room = &mut ctx.accounts.room;

        if room.player1 == Pubkey::default() {
            return Err(ErrorCode::UninitializedRoom.into())
        }
        if room.player2 != Pubkey::default() {
            return Err(ErrorCode::RoomAlreadyInitialized.into())
        }
        room.player2 = ctx.accounts.player2.key();
        room.timestamp = Clock::get().unwrap().unix_timestamp;
        Ok(())
    }
    pub fn open_dispute(ctx: Context<OpenDispute>, op_owner: u64) -> Result<()> {
        let room = &mut ctx.accounts.room;
        if ctx.accounts.opener.key() == room.player1 {
            room.dispute.last1 = (*ctx.accounts.my_block).clone();
        } else if ctx.accounts.opener.key() == room.player2 {
            room.dispute.last2 = (*ctx.accounts.my_block).clone();
        } else {
            return Err(error!(ErrorCode::NotAMember))
        }
        room.dispute.op_owner = op_owner;
        room.dispute.disputed = (*ctx.accounts.disputed).clone();
        room.dispute.opener = ctx.accounts.opener.key();
        Ok(())
    }
    pub fn close_dispute(ctx: Context<CloseDispute>) -> Result<()> {
        let room = &mut ctx.accounts.room;
        let dispute = &mut ctx.accounts.dispute;
    
        if ctx.accounts.closer.key() != room.player1 && ctx.accounts.closer.key() != room.player2 {
            return Err(error!(ErrorCode::NotAMember));
        }
    
        let (recent_block, i): (&Block, u64) = if dispute.last1.num > dispute.last2.num {
            (&dispute.last1, 1)
        } else {
            (&dispute.last2, 2)
        };
    
        let operations = &dispute.disputed.operations;
        let mut target = dispute.disputed.clone();
    
        let player_vmax: f64 = 5.0;
        let rotate_amount: f64 = 0.1;
        let bullet_vmax: f64 = 20.0;
        for operation in operations {
            let player = &mut target.data[dispute.op_owner as usize];
    
            if *operation == 1 {
                // move forward
                player.x += player_vmax * player.angle.cos();
                player.y += player_vmax * player.angle.sin();
            } else if *operation == 2 {
                // turn left
                player.angle -= rotate_amount;
            } else if *operation == 3 {
                // turn right
                player.angle += rotate_amount;
            } else if *operation == 4 {
                // move backward
                player.x -= player_vmax * player.angle.cos();
                player.y -= player_vmax * player.angle.sin();
            } else if *operation == 5 {
                // shoot
                let bullet = Bullet {
                    x: player.x,
                    y: player.y,
                    angle: player.angle,
                    vx: bullet_vmax * player.angle.cos(),
                    vy: bullet_vmax * player.angle.sin()
                };
                player.bullets.push(bullet);
            } else if *operation == 6 {
                // move bullet
                let mut bullet: Bullet = player.bullets.pop().unwrap();
                bullet.x += bullet.vx;
                bullet.y += bullet.vy;
                player.bullets.push(bullet);

            }
        } 
    
        let status: bool = target == *recent_block;
        dispute.verified = i;
        dispute.follows = status;
    
        Ok(())
    }
    pub fn end_game(ctx: Context<EndGame>, winner: u64) -> Result<()> {
        let room = &mut ctx.accounts.room;
        if ctx.accounts.caller.key() != room.player1 && ctx.accounts.caller.key() != room.player2 {
            return Err(error!(ErrorCode::NotAMember))
        }
        if room.winner == 0 {
            room.winner = winner;
        } else if room.winner != winner {
            return Err(error!(ErrorCode::InvalidAction))
        }
        Ok(())
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Uninitialized Room")]
    UninitializedRoom,

    #[msg("Room already initialized with two players")]
    RoomAlreadyInitialized,

    #[msg("You are not a member of the room")]
    NotAMember,
    #[msg("Call dispute to dispute your opponents actions")]
    InvalidAction
}
#[account]
pub struct Room {
    player1: Pubkey,
    player2: Pubkey,
    timestamp: i64,
    dispute: Dispute,
    winner: u64,
}
#[account]
pub struct Dispute {
    opener: Pubkey,
    disputed: Block,
    last1: Block,
    last2: Block,
    verified: u64,
    follows: bool,
    op_owner: u64,
}
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Player {
    x: f64,
    y: f64,
    angle: f64,
    health: u8,
    bullets: Vec<Bullet>
}
impl PartialEq for Player {
    fn eq(&self, other: &Self) -> bool {
        self.x == other.x && 
        self.y == other.y && 
        self.angle == other.angle && 
        self.health == other.health &&
        self.bullets == other.bullets
    }
}
#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub struct Bullet {
    x: f64,
    y: f64,
    vx: f64,
    vy: f64,
    angle: f64
}
impl PartialEq for Bullet {
    fn eq(&self, other: &Self) -> bool {
        self.x == other.x && self.x == other.y && self.angle == other.angle &&
        self.vx == other.vx && self.vy == other.vy
    }
}
#[account]
pub struct Block {
    data: Vec<Player>,
    num: u64,
    operations: Vec<u64>,
    timestamp: i64,
    sig1: Vec<u8>,
    sig2: Vec<u8>,
}
impl PartialEq for Block {
    fn eq(&self, other: &Self) -> bool {
        self.data[0] == other.data[0] && self.data[1] == other.data[1]
    }
}
#[derive(Accounts)]
pub struct CreateRoom<'info> {
    pub room: Account<'info, Room>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>
}
#[derive(Accounts)]
pub struct JoinRoom<'info> {
    #[account(mut)]
    pub room: Account<'info, Room>,
    pub player2: Signer<'info>
}
#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub room: Account<'info, Room>,
    pub opener: Signer<'info>,
    pub disputed: Account<'info, Block>,
    pub my_block: Account<'info, Block>
}   

#[derive(Accounts)]
pub struct CloseDispute<'info> {
    pub room: Account<'info, Room>,
    pub closer: Signer<'info>,
    pub dispute: Account<'info, Dispute>
}
#[derive(Accounts)]
pub struct EndGame<'info> {
    pub room: Account<'info, Room>,
    pub caller: Signer<'info>
}