import { type Context, Hono } from "jsr:@hono/hono";

class Msg {
  body: string;
  bodyLength: number | undefined;
  private watchBody: (() => void) | undefined;
  constructor() {
    this.body = "";
    const { promise, resolve } = Promise.withResolvers<void>();
    this.watchBody = resolve;
    promise
      .then(() => {
        this.bodyLength = this.body.length;
        console.log(this.bodyLength);
      });
    return this;
  }
  setMsg(msg: string) {
    this.body = msg;
    if (this.watchBody) this.watchBody();
    return this;
  }
}

const app = new Hono();

const resolvers: (
  | {
    resolver: (v: Msg) => void;
    rejecter: (v: Msg) => void;
  }
  | undefined
)[] = new Array(10).fill(undefined);

app.get("/q/list", (ctx: Context) => {
  const queue = resolvers.map((r) => r !== undefined);
  return ctx.json(queue);
});

app.get("/q/:num{[0-9]}", (ctx: Context) => {
  const { num: numString } = ctx.req.param();
  const num = parseInt(numString);
  const index = isNaN(num) ? 0 : num;

  if (resolvers[index] === undefined) {
    const p: Promise<Msg> = new Promise((resolve, reject) => {
      resolvers[index] = {
        resolver: resolve,
        rejecter: reject,
      };
    });
    return p
      .then((msg) => ctx.text(`${msg.body.trim()}お待たせしました。\n`))
      .catch((msg) =>
        ctx.text(`${msg.body.trim()}解決しなかったけどもう待たなくていいよ。\n`)
      )
      .finally(() => resolvers[index] = undefined);
  } else {
    return ctx.text("誰かが待ってる。\n");
  }
});

app.on(
  "get",
  ["/resolve/:num{[0-9]}", "/reject/:num{[0-9]}"],
  (ctx: Context) => {
    const { num: numString } = ctx.req.param();
    const num = parseInt(numString);
    const index = isNaN(num) ? 0 : num;
    
    if (resolvers[index] !== undefined) {
      const { resolver, rejecter } = resolvers[index];
      const { msg = [""] } = ctx.req.queries();
      const message = msg.join(" ") + " ";
      if (ctx.req.path.startsWith("/resolve")) {
        resolver(new Msg().setMsg(message));
      }
      if (ctx.req.path.startsWith("/reject")) {
        rejecter(new Msg().setMsg(message));
      }
      return ctx.text("ありがとう。\n");
    } else {
      return ctx.text("街はいない。\n");
    }
  },
);

Deno.serve({ port: 3001 }, app.fetch);
