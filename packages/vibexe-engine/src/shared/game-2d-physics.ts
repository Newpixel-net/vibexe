/**
 * 2D Physics Engine — Lightweight AABB physics for platformer games
 *
 * No external dependency needed. Handles:
 * - Gravity, velocity, acceleration
 * - AABB collision detection & resolution
 * - One-way platform support
 * - Character controller: walk, run, jump, double-jump, wall-slide, coyote time
 *
 * Injected as src/engine/physics.ts template.
 */

export const ENGINE_PHYSICS_CONTENT = `
// ---------------------------------------------------------------------------
// Physics Body
// ---------------------------------------------------------------------------

export interface PhysicsBody {
  // Position (center)
  x: number;
  y: number;
  // Velocity
  vx: number;
  vy: number;
  // Acceleration
  ax: number;
  ay: number;
  // Size (half-extents)
  hw: number; // half width
  hh: number; // half height
  // Properties
  mass: number;
  friction: number;
  bounce: number;
  isStatic: boolean;
  isOneWay: boolean;   // one-way platform (only collide from above)
  isSensor: boolean;   // triggers overlap events but no physics response
  enabled: boolean;
  // State
  onGround: boolean;
  onWall: 'left' | 'right' | null;
  onCeiling: boolean;
  // User data
  tag?: string;
  sprite?: any;
  userData?: any;
}

export function createBody(x: number, y: number, w: number, h: number,
  opts: Partial<PhysicsBody> = {}): PhysicsBody {
  return {
    x, y,
    vx: 0, vy: 0,
    ax: 0, ay: 0,
    hw: w / 2, hh: h / 2,
    mass: 1,
    friction: 0.2,
    bounce: 0,
    isStatic: false,
    isOneWay: false,
    isSensor: false,
    enabled: true,
    onGround: false,
    onWall: null,
    onCeiling: false,
    ...opts,
  };
}

export function createStaticBody(x: number, y: number, w: number, h: number,
  opts: Partial<PhysicsBody> = {}): PhysicsBody {
  return createBody(x, y, w, h, { isStatic: true, mass: 0, ...opts });
}

export function createOneWayPlatform(x: number, y: number, w: number, h = 16): PhysicsBody {
  return createStaticBody(x, y, w, h, { isOneWay: true, tag: 'platform' });
}

// ---------------------------------------------------------------------------
// AABB Collision
// ---------------------------------------------------------------------------

export interface Collision {
  bodyA: PhysicsBody;
  bodyB: PhysicsBody;
  overlapX: number;
  overlapY: number;
  normalX: number;
  normalY: number;
}

function aabbOverlap(a: PhysicsBody, b: PhysicsBody): Collision | null {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const ox = (a.hw + b.hw) - Math.abs(dx);
  const oy = (a.hh + b.hh) - Math.abs(dy);

  if (ox <= 0 || oy <= 0) return null;

  return {
    bodyA: a,
    bodyB: b,
    overlapX: ox,
    overlapY: oy,
    normalX: dx > 0 ? 1 : -1,
    normalY: dy > 0 ? 1 : -1,
  };
}

// ---------------------------------------------------------------------------
// Physics World
// ---------------------------------------------------------------------------

export type CollisionCallback = (bodyA: PhysicsBody, bodyB: PhysicsBody, collision: Collision) => void;

export class PhysicsWorld {
  gravity: number;
  bodies: PhysicsBody[] = [];
  private onCollide: CollisionCallback | null = null;
  private onOverlap: CollisionCallback | null = null;

  constructor(gravity = 980) {
    this.gravity = gravity;
  }

  addBody(body: PhysicsBody): PhysicsBody {
    this.bodies.push(body);
    return body;
  }

  removeBody(body: PhysicsBody): void {
    const idx = this.bodies.indexOf(body);
    if (idx >= 0) this.bodies.splice(idx, 1);
  }

  onCollision(cb: CollisionCallback): void { this.onCollide = cb; }
  onSensorOverlap(cb: CollisionCallback): void { this.onOverlap = cb; }

  update(dt: number): void {
    const dtCapped = Math.min(dt, 1 / 30); // cap at ~33ms to prevent tunneling

    // Track moving platforms — compute velocity from position delta
    for (var pi = 0; pi < this.bodies.length; pi++) {
      var pb = this.bodies[pi] as any;
      if (pb.isStatic) {
        if (pb._prevX === undefined) { pb._prevX = pb.x; pb._prevY = pb.y; }
        pb._platformVx = (pb.x - pb._prevX) / dtCapped;
        pb._platformVy = (pb.y - pb._prevY) / dtCapped;
      }
    }

    // Integrate dynamic bodies
    for (const b of this.bodies) {
      if (b.isStatic || !b.enabled) continue;

      // Reset contact flags
      b.onGround = false;
      b.onWall = null;
      b.onCeiling = false;
      (b as any)._groundBody = null;

      // Apply gravity
      b.vy += this.gravity * dtCapped;

      // Apply acceleration
      b.vx += b.ax * dtCapped;
      b.vy += b.ay * dtCapped;

      // Terminal velocity cap — prevents tunneling through thin platforms
      var MAX_VEL = 2000;
      if (b.vx > MAX_VEL) b.vx = MAX_VEL;
      if (b.vx < -MAX_VEL) b.vx = -MAX_VEL;
      if (b.vy > MAX_VEL) b.vy = MAX_VEL;
      if (b.vy < -MAX_VEL) b.vy = -MAX_VEL;

      // Apply friction (horizontal damping when on ground)
      // Friction applied during collision resolution

      // Integrate position
      b.x += b.vx * dtCapped;
      b.y += b.vy * dtCapped;
    }

    // Spatial hash broadphase — reduces O(n²) to near-linear for spread-out bodies
    var CELL = 128;
    var grid: Record<string, number[]> = {};
    var bodies = this.bodies;
    for (var gi = 0; gi < bodies.length; gi++) {
      var gb = bodies[gi];
      if (!gb.enabled) continue;
      var minCX = Math.floor((gb.x - gb.hw) / CELL);
      var maxCX = Math.floor((gb.x + gb.hw) / CELL);
      var minCY = Math.floor((gb.y - gb.hh) / CELL);
      var maxCY = Math.floor((gb.y + gb.hh) / CELL);
      for (var cx = minCX; cx <= maxCX; cx++) {
        for (var cy = minCY; cy <= maxCY; cy++) {
          var key = cx + ',' + cy;
          if (!grid[key]) grid[key] = [];
          grid[key].push(gi);
        }
      }
    }

    // Collision detection & resolution (grid-accelerated)
    var checked: Record<string, boolean> = {};
    for (var gk in grid) {
      var cell = grid[gk];
      for (var ci = 0; ci < cell.length; ci++) {
        for (var cj = ci + 1; cj < cell.length; cj++) {
          var idxA = cell[ci];
          var idxB = cell[cj];
          var pairKey = idxA < idxB ? idxA + ':' + idxB : idxB + ':' + idxA;
          if (checked[pairKey]) continue;
          checked[pairKey] = true;

          const a = bodies[idxA];
          const b = bodies[idxB];
          if (a.isStatic && b.isStatic) continue;

          const col = aabbOverlap(a, b);
          if (!col) continue;

          // Sensor bodies: trigger overlap, no physics response
          if (a.isSensor || b.isSensor) {
            if (this.onOverlap) this.onOverlap(a, b, col);
            continue;
          }

          // One-way platform: only block from above
          if (b.isOneWay) {
            // Only collide if A is falling and was above B last frame
            if (a.vy < 0 || (a.y + a.hh - col.overlapY) > (b.y - b.hh + 2)) continue;
          }
          if (a.isOneWay) {
            if (b.vy < 0 || (b.y + b.hh - col.overlapY) > (a.y - a.hh + 2)) continue;
          }

          // Resolve collision — push apart along smallest overlap axis
          if (col.overlapX < col.overlapY) {
            // Horizontal separation
            const dynamic = a.isStatic ? b : a;
            const sign = a.isStatic ? -col.normalX : col.normalX;
            dynamic.x += col.overlapX * sign;
            dynamic.vx = dynamic.bounce > 0 ? -dynamic.vx * dynamic.bounce : 0;

            // Wall contact
            if (!a.isStatic) a.onWall = col.normalX > 0 ? 'right' : 'left';
            if (!b.isStatic) b.onWall = col.normalX > 0 ? 'left' : 'right';
          } else {
            // Vertical separation
            if (a.isStatic) {
              b.y -= col.overlapY * col.normalY;
              if (col.normalY > 0) { b.onGround = true; b.vy = 0; (b as any)._groundBody = a; }
              else { b.onCeiling = true; b.vy = Math.max(0, b.vy); }
            } else if (b.isStatic) {
              a.y += col.overlapY * col.normalY;
              if (col.normalY < 0) { a.onGround = true; a.vy = 0; (a as any)._groundBody = b; }
              else { a.onCeiling = true; a.vy = Math.max(0, a.vy); }
            } else {
              // Both dynamic — split separation
              a.y += col.overlapY * col.normalY * 0.5;
              b.y -= col.overlapY * col.normalY * 0.5;
              if (col.normalY < 0) { a.onGround = true; a.vy = 0; (a as any)._groundBody = b; }
              if (col.normalY > 0) { b.onGround = true; b.vy = 0; (b as any)._groundBody = a; }
            }
          }

          // Friction (horizontal damping on ground contact)
          if (!a.isStatic && a.onGround) {
            a.vx *= (1 - a.friction);
          }
          if (!b.isStatic && b.onGround) {
            b.vx *= (1 - b.friction);
          }

          if (this.onCollide) this.onCollide(a, b, col);
        }
      }
    }

    // Moving platform carry — transfer platform velocity to riders
    for (var mi = 0; mi < this.bodies.length; mi++) {
      var mb = this.bodies[mi] as any;
      if (!mb.isStatic && mb.onGround && mb._groundBody) {
        var gnd = mb._groundBody;
        if (gnd._platformVx !== undefined && (gnd._platformVx !== 0 || gnd._platformVy !== 0)) {
          mb.x += gnd._platformVx * dtCapped;
          mb.y += gnd._platformVy * dtCapped;
        }
      }
    }

    // Sync sprites to physics bodies
    for (const b of this.bodies) {
      if (b.sprite && !b.isStatic) {
        b.sprite.x = b.x;
        b.sprite.y = b.y;
      }
    }

    // Save current static body positions for next frame's platform velocity calc
    for (var si = 0; si < this.bodies.length; si++) {
      var sb = this.bodies[si] as any;
      if (sb.isStatic) {
        sb._prevX = sb.x;
        sb._prevY = sb.y;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Character Controller
// ---------------------------------------------------------------------------

export interface CharacterConfig {
  moveSpeed: number;
  runSpeed: number;
  jumpForce: number;
  doubleJump: boolean;
  wallSlide: boolean;
  wallSlideSpeed: number;
  coyoteTime: number;     // seconds of jump grace after leaving ground
  jumpBuffer: number;     // seconds of jump input buffering
  airControl: number;     // 0-1 how much control in air
}

const DEFAULT_CHAR_CONFIG: CharacterConfig = {
  moveSpeed: 300,
  runSpeed: 450,
  jumpForce: 500,
  doubleJump: true,
  wallSlide: true,
  wallSlideSpeed: 100,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  airControl: 0.7,
};

export class CharacterController {
  body: PhysicsBody;
  config: CharacterConfig;
  facingRight = true;

  private jumpsLeft = 2;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private wasOnGround = false;

  constructor(body: PhysicsBody, config: Partial<CharacterConfig> = {}) {
    this.body = body;
    this.config = { ...DEFAULT_CHAR_CONFIG, ...config };
  }

  update(input: { left: boolean; right: boolean; jump: boolean; run?: boolean }, dt: number): void {
    const b = this.body;
    const c = this.config;
    const onGround = b.onGround;
    const speed = input.run ? c.runSpeed : c.moveSpeed;
    const control = onGround ? 1 : c.airControl;

    // Coyote time: allow jump shortly after leaving ground
    if (onGround) {
      this.coyoteTimer = c.coyoteTime;
      this.jumpsLeft = c.doubleJump ? 2 : 1;
    } else {
      this.coyoteTimer -= dt;
    }

    // Jump buffer: remember jump press
    if (input.jump) {
      this.jumpBufferTimer = c.jumpBuffer;
    } else {
      this.jumpBufferTimer -= dt;
    }

    // Horizontal movement
    if (input.left) {
      b.vx = -speed * control + b.vx * (1 - control);
      this.facingRight = false;
    } else if (input.right) {
      b.vx = speed * control + b.vx * (1 - control);
      this.facingRight = true;
    } else if (onGround) {
      // Ground deceleration
      b.vx *= 0.8;
      if (Math.abs(b.vx) < 5) b.vx = 0;
    }

    // Jump (with coyote time + jump buffer)
    if (this.jumpBufferTimer > 0) {
      if (this.coyoteTimer > 0 && this.jumpsLeft > 0) {
        b.vy = -c.jumpForce;
        this.jumpsLeft--;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      } else if (!onGround && this.jumpsLeft > 0 && c.doubleJump) {
        // Double jump (air jump)
        b.vy = -c.jumpForce * 0.85;
        this.jumpsLeft--;
        this.jumpBufferTimer = 0;
      }
    }

    // Wall slide
    if (c.wallSlide && b.onWall && !onGround && b.vy > 0) {
      b.vy = Math.min(b.vy, c.wallSlideSpeed);
      // Wall jump
      if (input.jump) {
        b.vy = -c.jumpForce * 0.9;
        b.vx = b.onWall === 'left' ? speed * 0.8 : -speed * 0.8;
        this.jumpsLeft = c.doubleJump ? 1 : 0;
      }
    }

    // Flip sprite
    if (b.sprite) {
      b.sprite.scale.x = Math.abs(b.sprite.scale.x) * (this.facingRight ? 1 : -1);
    }

    // Update wasOnGround at END so justLanded works correctly
    this.wasOnGround = onGround;
  }

  get isJumping(): boolean { return !this.body.onGround && this.body.vy < 0; }
  get isFalling(): boolean { return !this.body.onGround && this.body.vy > 0; }
  get isWallSliding(): boolean { return !!this.body.onWall && !this.body.onGround && this.body.vy > 0; }
  get justLanded(): boolean { return this.body.onGround && !this.wasOnGround; }
}
`;
