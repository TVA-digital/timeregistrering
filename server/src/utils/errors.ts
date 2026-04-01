export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (resource: string) => new AppError(404, `${resource} ikke funnet`);
export const forbidden = () => new AppError(403, 'Ingen tilgang');
export const badRequest = (msg: string) => new AppError(400, msg);
export const unauthorized = () => new AppError(401, 'Ikke autentisert');
