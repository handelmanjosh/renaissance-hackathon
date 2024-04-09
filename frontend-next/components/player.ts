import { id } from "./game";


const turretRatio = 134 / 68;
const Player_VMAX: number = 5;
const ROTATE_AMOUNT: number = 0.1;
export default class Player {
    turretAngle: number;
    bodyAngle: number;
    x: number;
    y: number;
    bullets: Bullet[];
    width: number;
    turretWidth: number;
    turretHeight: number;
    pressed: string;
    shooting: boolean;
    health: number;
    dead: boolean;
    id: string;
    img: number;
    explosions: HTMLImageElement[];
    body: HTMLImageElement;
    turret: HTMLImageElement;
    constructor() {
        this.id = id();
        this.width = 40;
        this.turretWidth = 20;
        this.turretHeight = this.turretWidth * turretRatio;
        this.x = Math.random() * 600;
        this.y = Math.random() * 600;
        this.bullets = [];
        this.turretAngle = 0;
        this.bodyAngle = 0;
        this.pressed = "";
        this.shooting = false;
        this.health = 20;
        this.dead = false;
        this.img = -1;
        const turret: HTMLImageElement = document.createElement("img");
const body: HTMLImageElement = document.createElement("img");
turret.src = "/Tank/GunTurret.png";
body.src = "/Tank/Tank.png";

const explosions: HTMLImageElement[] = [];
for (let i = 0; i < 5; i++) {
    const img = document.createElement("img");
    img.src = `/explosions/explosion${i}.png`;
    explosions.push(img);
}
this.explosions = explosions;
this.body = body;
this.turret = turret;
    }
    draw(context: CanvasRenderingContext2D) {
        if (this.img === -1) {
            context.save();
            context.translate(this.x, this.y);
            context.rotate(this.bodyAngle);
            context.drawImage(this.body, - this.width / 2, - this.width / 2, this.width, this.width);
            context.restore();
            context.save();
            context.translate(this.x, this.y);
            context.rotate(this.turretAngle);
            context.drawImage(this.turret, - this.turretWidth / 2, - this.turretHeight / 2, this.turretWidth, this.turretHeight);
            context.restore();
            for (const bullet of this.bullets) {
                bullet.update();
                bullet.draw(context);
            }
        } else {
            context.drawImage(this.explosions[this.img], this.x - this.width, this.y - this.width, this.width * 2, this.width * 2);
        }
    }
    takeDamage() {
        this.health--;
        if (this.health <= 0 && this.img === -1) {
            let count = 0;
            const interval = setInterval(() => {
                this.img = count;
                count++;
                if (count > 4) {
                    this.dead = true;
                    clearInterval(interval);
                }
            }, 100);
        }
    }
    update(x: number, y: number, canvasX: number, canvasY: number) {
        const diffX = x - (canvasX + this.x);
        const diffY = - y + (canvasY + this.y);
        this.turretAngle = Math.atan2(diffX, diffY);
        switch (this.pressed) {
            case "ArrowRight": {
                this.bodyAngle = (2 * Math.PI + (this.bodyAngle + ROTATE_AMOUNT)) % (2 * Math.PI);
                break;
            }
            case "ArrowLeft": {
                this.bodyAngle = (2 * Math.PI + (this.bodyAngle - ROTATE_AMOUNT)) % (2 * Math.PI);
                break;
            }
            case "ArrowUp": {
                this.x += Math.sin(this.bodyAngle) * Player_VMAX;
                this.y -= Math.cos(this.bodyAngle) * Player_VMAX;
                break;
            }
            case "ArrowDown": {
                this.x -= Math.sin(this.bodyAngle) * Player_VMAX;
                this.y += Math.cos(this.bodyAngle) * Player_VMAX;
                break;
            }
        }
        if (this.shooting) {
            this.bullets.push(
                new Bullet(this.x, this.y, this.turretAngle)
            );
        }
    }
    serialize() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            health: this.health,
            turretAngle: this.turretAngle,
            bodyAngle: this.bodyAngle,
            bullets: this.bullets.map(b => b.serialize()),
            dead: this.dead,
            img: this.img,
        };
    }
}
const Bullet_VMAX: number = 20;
export class Bullet {
    id: string;
    x: number;
    y: number;
    angle: number;
    vx: number;
    vy: number;
    dead: boolean;
    width: number;
    bullet: HTMLImageElement;
    constructor(x: number, y: number, angle: number) {
        this.id = id();
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.vy = - Math.cos(angle) * Bullet_VMAX;
        this.vx = Math.sin(angle) * Bullet_VMAX;
        this.dead = false;
        this.width = 10;
        const bullet: HTMLImageElement = document.createElement("img");
        bullet.src = "/Tank/Bullet.png";
        this.bullet = bullet;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.y < 0 || this.x > 600 || this.y > 600) {
            this.dead = true;
        }
    }
    draw(context: CanvasRenderingContext2D) {
        context.save();
        context.translate(this.x, this.y);
        context.rotate(this.angle);
        context.drawImage(this.bullet, - this.width / 2, - this.width / 2, this.width, this.width);
        context.restore();
    }
    serialize() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            angle: this.angle,
            dead: this.dead,
        };
    }
}