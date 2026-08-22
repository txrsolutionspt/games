// ── Data-driven physics constants (see GAME_SPEC.md § Physics Configuration) ──

const TILE_SIZE = 32;

const PhysicsConfig = {
    // Gravity & fall speed
    gravity: 0.38,               // px/frame^2
    maxFallSpeed: 14,            // px/frame (terminal velocity)

    // Horizontal movement
    runAcceleration: 0.8,        // px/frame^2
    runDeceleration: 0.6,        // px/frame^2
    maxRunSpeed: 3.4,            // px/frame
    airAcceleration: 0.4,        // reduced control while airborne
    airDeceleration: 0.3,

    // Jumping
    jumpVelocity: -9.5,          // px/frame (upward)
    jumpCutMultiplier: 0.5,      // releasing jump early cuts remaining upward velocity

    // Timing
    coyoteTimeMs: 120,           // can still jump ~120ms after leaving ground
    jumpBufferMs: 120,           // a jump pressed ~120ms before landing still fires

    // Knockback (from enemy/hazard hit)
    knockbackX: 3.5,
    knockbackY: -6,

    // Stomping an enemy
    stompBounceVelocity: -6.5,

    // State durations (ms)
    hurtDurationMs: 300,
    landingDurationMs: 120,
    dyingDurationMs: 700,
    invincibilityDurationMs: 2000,
    invincibilityFlashMs: 100
};

window.TILE_SIZE = TILE_SIZE;
window.PhysicsConfig = PhysicsConfig;
