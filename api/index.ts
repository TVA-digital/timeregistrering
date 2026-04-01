let app: any;

export default async function handler(req: any, res: any) {
  if (!app) {
    const { createApp } = await import('../server/dist/app.js');
    app = createApp();
  }
  return app(req, res);
}
