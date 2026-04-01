import { Request, Response, NextFunction, RequestHandler } from 'express';

// Wrapper som fanger async-feil og sender til Express error-handler
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
