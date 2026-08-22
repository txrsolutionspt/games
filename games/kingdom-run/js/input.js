// ── Unified input abstraction (see GAME_SPEC.md § Mobile Controls Integration) ──
//
// Keyboard, touch, and mouse (for desktop testing of the touch buttons) all
// write into this one object. Game/player logic never checks input device
// type — it only reads Input.

const Input = {
    left: false,
    right: false,
    jumpHeld: false,

    _jumpPressedAt: -Infinity,
    _pausePressed: false,

    // True if a jump was pressed within `withinMs` of `now` — used for jump
    // buffering (queueing a jump input shortly before landing).
    jumpBufferedRecently(withinMs, now) {
        return (now - this._jumpPressedAt) <= withinMs;
    },
    consumeJumpBuffer() {
        this._jumpPressedAt = -Infinity;
    },
    consumePausePress() {
        const p = this._pausePressed;
        this._pausePressed = false;
        return p;
    }
};

function notifyUserInteraction() {
    window.dispatchEvent(new Event('kingdomrun:userinteracted'));
}

function pressJump() {
    if (!Input.jumpHeld) Input._jumpPressedAt = performance.now();
    Input.jumpHeld = true;
}
function releaseJump() {
    Input.jumpHeld = false;
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
    notifyUserInteraction();
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') Input.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') Input.right = true;
    if ((e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && !e.repeat) {
        pressJump();
    }
    if (e.key === ' ') e.preventDefault();
    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && !e.repeat) {
        Input._pausePressed = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') Input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') Input.right = false;
    if (e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') releaseJump();
});

// ── Touch / mouse buttons ────────────────────────────────────────────────────
// A "hold" button (left/right/jump) tracks press+release; a "tap" button
// (pause) fires once per tap. Both work with touch and mouse so the controls
// are testable on desktop too.

function bindHoldButton(id, onPress, onRelease) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const press = (e) => {
        e.preventDefault();
        notifyUserInteraction();
        onPress();
        btn.classList.add('pressed');
    };
    const release = (e) => {
        if (e) e.preventDefault();
        onRelease();
        btn.classList.remove('pressed');
    };
    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
}

function bindTapButton(id, onTap) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        notifyUserInteraction();
        onTap();
    });
}

function initTouchControls() {
    bindHoldButton('btn-left', () => { Input.left = true; }, () => { Input.left = false; });
    bindHoldButton('btn-right', () => { Input.right = true; }, () => { Input.right = false; });
    bindHoldButton('btn-jump', pressJump, releaseJump);
    bindTapButton('btn-pause', () => { Input._pausePressed = true; });
}

window.Input = Input;
window.initTouchControls = initTouchControls;
window.notifyUserInteraction = notifyUserInteraction;
