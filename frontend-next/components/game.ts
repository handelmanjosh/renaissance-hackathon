import { Block } from "../pages/index";
import Player, { Bullet } from "./player";

export default class Game {
    players: [Player, Player];
    constructor() {
        this.players = [new Player(), new Player()];
    }
    update(x: number, y: number, i: number, canvasX: number, canvasY: number) {
        this.players[i].update(x, y, canvasX, canvasY);
    }
    draw(context: CanvasRenderingContext2D) {
        if (!this.players[0].dead) this.players[0].draw(context);
        if (!this.players[1].dead) this.players[1].draw(context);
        this.players[0].bullets = this.players[0].bullets.filter((bullet: Bullet) => {
            if (CheckRadialCollision(bullet, this.players[1])) {
                this.players[1].takeDamage();
                bullet.dead = true;
            }
            return !bullet.dead;
        });
        this.players[1].bullets = this.players[1].bullets.filter((bullet: Bullet) => {
            if (CheckRadialCollision(bullet, this.players[0])) {
                this.players[0].takeDamage();
                bullet.dead = true;
            }
            return !bullet.dead;
        });
    }
    serialize() {
        return {
            players: this.players.map(p => p.serialize()),
        };
    }
    verify(block: Block, onWin: () => void, onLoss: () => void, num: number) {
        const { players } = JSON.parse(block.data);
        const [one, two] = players;
        const from = num === 1 ? two : one;
        const target = num === 1 ? this.players[1] : this.players[0];
        target.x = from.x;
        target.y = from.y;
        target.bodyAngle = from.bodyAngle;
        target.health = from.health;
        target.turretAngle = from.turretAngle;
        target.id = from.id;
        target.img = from.img;
        const newBullets: Bullet[] = [];
        for (const bullet of from.bullets) {
            const b = new Bullet(0, 0, 0);
            b.angle = bullet.angle;
            b.x = bullet.x;
            b.y = bullet.y;
            b.vx = bullet.vx;
            b.vy = bullet.vy;
            b.id = bullet.id;
            newBullets.push(b);
        }
        target.bullets = newBullets;
        if (one.dead) {
            num === 1 ? onLoss() : onWin();
        }
        if (two.dead) {
            num === 1 ? onWin() : onLoss();
        }
    }
}
type Collideable = {
    width: number;
    x: number;
    y: number;
};
const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
export function id() {
    let result = "";
    for (let i = 0; i < 20; i++) {
        result += letters[Math.floor(Math.random() * letters.length)];
    }
    return result;
}
const distance = (a: Collideable, b: Collideable) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
function CheckRadialCollision(a: Collideable, b: Collideable): boolean {
    const d = distance(a, b);
    return d < a.width / 2 || d < b.width / 2;
}