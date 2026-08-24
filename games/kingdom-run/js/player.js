// ── Player entity & state machine (see GAME_SPEC.md § Player Mechanics, § Player States) ──

const PlayerState = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    JUMPING: 'JUMPING',
    FALLING: 'FALLING',
    HURT: 'HURT',
    DYING: 'DYING',
    INVINCIBLE: 'INVINCIBLE'
};

function createPlayer(spawnPoint) {
    return {
        x: spawnPoint.x,
        y: spawnPoint.y,
        width: 22,
        height: 30,
        vx: 0,
        vy: 0,
        facing: 1,
        grounded: false,
        state: PlayerState.IDLE,
        stateEnteredAt: 0,
        lastGroundedAt: -Infinity,
        lives: 3,
        invincibleUntil: 0,
        controlLockedUntil: 0,
        jumpCutApplied: false // guards the early-release height cut to a single, one-time trim per jump
    };
}

function setPlayerState(player, state, now) {
    if (player.state !== state) {
        player.state = state;
        player.stateEnteredAt = now;
    }
}

// Advances the player one frame. Movement magnitudes are per-frame constants
// (matching PhysicsConfig's px/frame units and this repo's other games), while
// `now` (performance.now()) drives the millisecond timers — coyote time, jump
// buffering, hurt/invincibility durations.
function updatePlayer(player, now, level) {
    const cfg = PhysicsConfig;
    const events = [];
    const controlsLocked = now < player.controlLockedUntil || player.state === PlayerState.DYING;
    const wasGrounded = player.grounded;

    if (!controlsLocked) {
        const accel = player.grounded ? cfg.runAcceleration : cfg.airAcceleration;
        const decel = player.grounded ? cfg.runDeceleration : cfg.airDeceleration;

        if (Input.left && !Input.right) {
            player.vx = Math.max(player.vx - accel, -cfg.maxRunSpeed);
            player.facing = -1;
        } else if (Input.right && !Input.left) {
            player.vx = Math.min(player.vx + accel, cfg.maxRunSpeed);
            player.facing = 1;
        } else if (player.vx > 0) {
            player.vx = Math.max(0, player.vx - decel);
        } else if (player.vx < 0) {
            player.vx = Math.min(0, player.vx + decel);
        }

        const canCoyoteJump = (now - player.lastGroundedAt) <= cfg.coyoteTimeMs;
        const jumpBuffered = Input.jumpBufferedRecently(cfg.jumpBufferMs, now);
        if (jumpBuffered && (player.grounded || canCoyoteJump)) {
            player.vy = cfg.jumpVelocity;
            player.grounded = false;
            player.lastGroundedAt = -Infinity; // prevent a second coyote jump off the same fall
            player.jumpCutApplied = false; // this is a new jump — early release may trim it once
            Input.consumeJumpBuffer();
            events.push({ type: 'jump' });
        } else if (!Input.jumpHeld && player.vy < 0 && !player.jumpCutApplied) {
            // Early release cuts the jump short exactly once (deterministic,
            // controllable height) — without the guard this re-applies every
            // frame the key stays up, halving vy repeatedly and collapsing
            // the jump almost immediately instead of trimming it predictably.
            player.vy *= cfg.jumpCutMultiplier;
            player.jumpCutApplied = true;
        }
    } else if (player.vx > 0) {
        player.vx = Math.max(0, player.vx - cfg.airDeceleration);
    } else if (player.vx < 0) {
        player.vx = Math.min(0, player.vx + cfg.airDeceleration);
    }

    player.vy = Math.min(player.vy + cfg.gravity, cfg.maxFallSpeed);

    const wasFalling = player.vy > 0;
    const collision = resolveTileCollisions(player, level);
    player.grounded = collision.grounded;
    if (player.grounded) player.lastGroundedAt = now;
    if (collision.grounded && !wasGrounded && wasFalling) events.push({ type: 'land' });
    if (collision.hitCeiling) events.push({ type: 'ceilingHit', tiles: collision.ceilingTiles });

    // Safety net beyond wall tiles — never let numeric drift push the player
    // outside the level horizontally.
    player.x = Math.max(0, Math.min(player.x, level.width - player.width));

    advancePlayerState(player, now);

    return { ...collision, events };
}

function advancePlayerState(player, now) {
    if (player.state === PlayerState.HURT) {
        if (now - player.stateEnteredAt >= PhysicsConfig.hurtDurationMs) {
            setPlayerState(player, PlayerState.DYING, now);
        }
        return;
    }
    if (player.state === PlayerState.DYING) return; // game.js owns the respawn/game-over transition

    if (player.state === PlayerState.INVINCIBLE) {
        if (now < player.invincibleUntil) return; // still invincible; movement already applied above
    }

    if (!player.grounded) {
        setPlayerState(player, player.vy < 0 ? PlayerState.JUMPING : PlayerState.FALLING, now);
    } else if (Math.abs(player.vx) > 0.15) {
        setPlayerState(player, PlayerState.RUNNING, now);
    } else {
        setPlayerState(player, PlayerState.IDLE, now);
    }
}

// Enemy/side hit: brief knockback + HURT, then DYING (no growth power-up in
// the MVP means the player only ever has one hit to give).
function playerTakeHit(player, now, knockbackDir) {
    if (now < player.invincibleUntil) return false;
    if (player.state === PlayerState.HURT || player.state === PlayerState.DYING) return false;
    player.vx = PhysicsConfig.knockbackX * knockbackDir;
    player.vy = PhysicsConfig.knockbackY;
    player.controlLockedUntil = now + PhysicsConfig.hurtDurationMs;
    setPlayerState(player, PlayerState.HURT, now);
    return true;
}

// Hazard touch or falling off the level: no knockback beat, straight to DYING.
function playerDie(player, now) {
    if (now < player.invincibleUntil) return false;
    if (player.state === PlayerState.DYING) return false;
    player.vx = 0;
    player.vy = 0;
    setPlayerState(player, PlayerState.DYING, now);
    return true;
}

function playerStomp(player) {
    player.vy = PhysicsConfig.stompBounceVelocity;
}

// Repositions the player at a checkpoint/spawn point and grants a brief
// invincibility window so they can't be re-hit by the same threat instantly.
function playerRespawn(player, position, now) {
    player.x = position.x;
    player.y = position.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.lastGroundedAt = -Infinity;
    player.controlLockedUntil = 0;
    player.jumpCutApplied = false;
    player.invincibleUntil = now + PhysicsConfig.invincibilityDurationMs;
    setPlayerState(player, PlayerState.INVINCIBLE, now);
}

window.PlayerState = PlayerState;
window.createPlayer = createPlayer;
window.updatePlayer = updatePlayer;
window.playerTakeHit = playerTakeHit;
window.playerDie = playerDie;
window.playerStomp = playerStomp;
window.playerRespawn = playerRespawn;
